import os
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional, Generator

import requests

logger = logging.getLogger(__name__)

# P1-2 消费额度预警缓存键（与 control_plane_views 保持一致）
QUOTA_ALERT_CACHE_KEY = 'settings:quota_alert'
QUOTA_ALERT_LAST_LEVEL_KEY = 'settings:quota_alert:last_level'
# 过载事件告警（circuit_open / quota_exhausted）边缘触发状态键：仅状态变化时推送一次
OVERLOAD_ALERT_LAST_KEY = 'settings:overload_alert:last'


def _calc_cost(input_tokens: int, output_tokens: int) -> Decimal:
    """按单价计算调用费用（元），单价为元/百万 token。"""
    try:
        from django.conf import settings
        input_price = float(getattr(settings, 'DEEPSEEK_INPUT_PRICE', 0.5) or 0.5)
        output_price = float(getattr(settings, 'DEEPSEEK_OUTPUT_PRICE', 2.0) or 2.0)
    except Exception:
        input_price, output_price = 0.5, 2.0
    cost = (input_tokens / 1_000_000 * input_price) + (output_tokens / 1_000_000 * output_price)
    return Decimal(str(round(cost, 6)))


def _record_usage(response: Optional[Dict[str, Any]], *, user_id: Optional[int] = None,
                  model: str = '', scenario: str = '', run_id: Optional[str] = None,
                  status: str = 'success', error_message: str = '') -> None:
    """P1-2 计费落库：每次调用写入 APICallLog（tokens/cost/model/runId）。

    解析 OpenAI 兼容的 usage 结构：prompt_tokens / completion_tokens / total_tokens。
    落库失败不影响主流程（仅记录日志）。
    """
    try:
        from auth_app.billing_models import APICallLog
        usage = (response or {}).get('usage') or {}
        input_tokens = int(usage.get('prompt_tokens') or 0)
        output_tokens = int(usage.get('completion_tokens') or 0)
        total_tokens = int(usage.get('total_tokens') or 0) or (input_tokens + output_tokens)
        cost = _calc_cost(input_tokens, output_tokens)
        APICallLog.objects.create(
            user_id=user_id,
            run_id=run_id or uuid.uuid4().hex[:16],
            scenario=(scenario or '')[:64],
            provider='deepseek',
            model=(model or '')[:64],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost=cost,
            status=status,
            error_message=(error_message or '')[:2000],
        )
    except Exception as e:  # noqa: BLE001 - 计费落库失败不阻塞调用
        logger.warning('[计费落库] 写入 APICallLog 失败: %r', e)


class DeepSeekBudgetGate:
    """
    DeepSeek API 预算闸门（成本控制）
    - 每日全局调用配额（防脚本打爆账单）
    - 每用户每日配额（可选，通过 caller 传入）
    - 失败熔断：连续失败（401/429/5xx/超时）达到阈值后，冷却期内直接拒绝
    统计基于 Django cache（Redis 或本地内存），key 默认 24h 过期。
    """

    DAILY_KEY = 'deepseek:budget:day:{day}'
    GLOBAL_COUNT_KEY = 'deepseek:budget:global:{day}'
    USER_COUNT_KEY = 'deepseek:budget:user:{day}:{user}'
    FAIL_COUNT_KEY = 'deepseek:budget:failures'
    BREAK_UNTIL_KEY = 'deepseek:budget:break_until'

    def __init__(self):
        self.global_limit = 0
        self.user_limit = 0
        self.break_threshold = 5
        self.break_cooldown = 300
        try:
            from django.conf import settings
            self.global_limit = int(getattr(settings, 'DEEPSEEK_DAILY_CALL_LIMIT', 0) or 0)
            self.user_limit = int(getattr(settings, 'DEEPSEEK_USER_DAILY_CALL_LIMIT', 0) or 0)
            self.break_threshold = int(getattr(settings, 'DEEPSEEK_CIRCUIT_BREAKER_THRESHOLD', 5) or 5)
            self.break_cooldown = int(getattr(settings, 'DEEPSEEK_CIRCUIT_BREAKER_COOLDOWN', 300) or 300)
        except Exception:
            pass

    def _cache(self):
        from django.core.cache import cache
        return cache

    @staticmethod
    def _day_str() -> str:
        return datetime.now().strftime('%Y%m%d')

    def _get_int(self, key: str) -> int:
        try:
            return int(self._cache().get(key, 0) or 0)
        except Exception:
            return 0

    def check_allowed(self, caller: Optional[str] = None) -> Optional[str]:
        """
        检查当前是否允许发起调用。
        返回 None 表示放行；返回字符串表示被拦截的原因。
        """
        # 1. 熔断检查
        break_until = self._get_int(self.BREAK_UNTIL_KEY)
        if break_until and time.time() < break_until:
            remain = int(break_until - time.time())
            logger.warning(f'[预算闸门] 熔断拦截: 剩余 {remain}s (caller={caller})')
            return f'DeepSeek 服务暂不可用（熔断中，约 {remain}s 后重试）'

        # 2. 全局配额
        if self.global_limit > 0:
            gkey = self.GLOBAL_COUNT_KEY.format(day=self._day_str())
            used = self._get_int(gkey)
            if used >= self.global_limit:
                logger.warning(f'[预算闸门] 全局配额拦截: 今日已用 {used}/{self.global_limit} (caller={caller})')
                return '今日全局 DeepSeek 调用已达上限，请明日再试'

        # 3. 每用户配额
        if self.user_limit > 0 and caller:
            ukey = self.USER_COUNT_KEY.format(day=self._day_str(), user=caller)
            used = self._get_int(ukey)
            if used >= self.user_limit:
                logger.warning(f'[预算闸门] 用户配额拦截: {caller} 今日已用 {used}/{self.user_limit}')
                return '今日您的 DeepSeek 调用已达上限，请明日再试'

        logger.debug(f'[预算闸门] 放行 (caller={caller})')
        return None

    def record_start(self, caller: Optional[str] = None) -> None:
        """调用成功后计数（按天过期）"""
        day = self._day_str()
        expiry = 86400 * 2  # 2 天，覆盖跨天窗口
        try:
            cache = self._cache()
            gkey = self.GLOBAL_COUNT_KEY.format(day=day)
            cache.incr(gkey)
        except Exception:
            try:
                from django.core.cache import cache
                gkey = self.GLOBAL_COUNT_KEY.format(day=day)
                cache.set(gkey, 1, timeout=expiry)
            except Exception as e:
                logger.error(f'[预算闸门] 全局调用计数失败: {e!r}')
        if caller and self.user_limit > 0:
            try:
                from django.core.cache import cache
                ukey = self.USER_COUNT_KEY.format(day=day, user=caller)
                try:
                    cache.incr(ukey)
                except Exception:
                    cache.set(ukey, 1, timeout=expiry)
            except Exception as e:
                logger.error(f'[预算闸门] 用户调用计数失败: caller={caller} {e!r}')

        # P1-2 消费额度预警联动：调用计数后检查是否跨过阈值，跨级时推送告警
        self._maybe_push_quota_alert()

    def record_failure(self) -> None:
        """记录失败；连续失败达到阈值后触发熔断"""
        try:
            from django.core.cache import cache
            fkey = self.FAIL_COUNT_KEY
            try:
                failures = cache.incr(fkey)
            except Exception:
                cache.set(fkey, 1, timeout=self.break_cooldown * 2)
                failures = 1
            if failures >= self.break_threshold:
                cache.set(self.BREAK_UNTIL_KEY, int(time.time()) + self.break_cooldown,
                          timeout=self.break_cooldown + 60)
                cache.delete(fkey)
                logger.warning(f'[预算闸门] 连续失败 {failures} 次 ≥ 阈值 {self.break_threshold}，'
                               f'触发熔断 {self.break_cooldown}s')
                self._maybe_push_circuit_open_alert()
            else:
                logger.warning(f'[预算闸门] 调用失败，连续失败 {failures}/{self.break_threshold}，'
                               f'达阈值后熔断 {self.break_cooldown}s')
        except Exception as e:
            logger.error(f'[预算闸门] 失败计数异常: {e!r}')

    def record_success(self) -> None:
        """成功后清零失败计数"""
        try:
            from django.core.cache import cache
            cache.delete(self.FAIL_COUNT_KEY)
            logger.debug('[预算闸门] 调用成功，已清零失败计数')
        except Exception as e:
            logger.error(f'[预算闸门] 成功清零失败计数异常: {e!r}')

    def _get_thresholds(self) -> tuple:
        """读取消费额度预警阈值（百分比）。

        优先级：/api/settings/quota-alert 配置 > settings.DEEPSEEK_BUDGET_*_THRESHOLD。
        返回 (warn_pct, critical_pct)，例如 (80, 95)。
        """
        try:
            from django.conf import settings as dj_settings
            warn_pct = int(getattr(dj_settings, 'DEEPSEEK_BUDGET_WARN_THRESHOLD', 80) or 80)
            critical_pct = int(getattr(dj_settings, 'DEEPSEEK_BUDGET_CRITICAL_THRESHOLD', 95) or 95)
        except Exception:
            warn_pct, critical_pct = 80, 95
        try:
            from django.core.cache import cache
            cfg = cache.get(QUOTA_ALERT_CACHE_KEY) or {}
            if cfg.get('enabled'):
                warn_pct = int(cfg.get('warn_threshold') or warn_pct)
                critical_pct = int(cfg.get('critical_threshold') or critical_pct)
        except Exception:
            pass
        return max(1, min(warn_pct, 99)), max(1, min(critical_pct, 100))

    def get_quota_status(self) -> Dict[str, Any]:
        """
        只读实时额度状态（P0 统一控制面：GET /api/deepseek/quota）。
        结构对齐桌面端 DeepSeekQuotaStatus 字段，供内部诊断通道消费。

        P1-2 增强：新增 status（normal|warning|alert）；warnThreshold/criticalThreshold
        以 0-1 ratio 返回（如 0.8/0.95），与桌面端进度条直接比较。
        """
        day = self._day_str()
        global_used = self._get_int(self.GLOBAL_COUNT_KEY.format(day=day))
        break_until = self._get_int(self.BREAK_UNTIL_KEY)
        failures = self._get_int(self.FAIL_COUNT_KEY)
        remaining = max(0, break_until - int(time.time())) if break_until else 0
        opened_at = None
        if remaining > 0:
            opened_at = int((break_until - self.break_cooldown) * 1000)  # epoch ms

        warn_pct, critical_pct = self._get_thresholds()
        warn = round(warn_pct / 100, 4)
        critical = round(critical_pct / 100, 4)

        usage_ratio = global_used / self.global_limit if self.global_limit > 0 else 0.0
        if self.global_limit > 0 and usage_ratio >= critical:
            status = 'alert'
        elif self.global_limit > 0 and usage_ratio >= warn:
            status = 'warning'
        else:
            status = 'normal'

        return {
            'day': day,
            'globalUsed': global_used,
            'globalQuota': self.global_limit,
            'userUsed': 0,  # 按用户（caller）维度仅在调用时统计，聚合态不展开
            'userQuota': self.user_limit,
            'circuitOpen': remaining > 0,
            'circuitOpenedAt': opened_at,
            'failureRate': round(failures / self.break_threshold, 4) if self.break_threshold else 0,
            'warnThreshold': warn,
            'criticalThreshold': critical,
            'status': status,
            'usedRatio': round(usage_ratio, 4),  # 供过载检测读取配额比（与 used_ratio 兼容）
        }

    def _maybe_push_quota_alert(self) -> None:
        """P1-2 消费额度预警：使用率达到阈值且状态升级时，经 AlertService 推送到桌面端。

        - 仅当 /api/settings/quota-alert 的 enabled=True 时推送；
        - 仅在状态升级（normal→warning→alert）时推送一次，避免刷屏；
        - 推送能力失败不影响预算闸门主流程。
        """
        try:
            from django.core.cache import cache
            cfg = cache.get(QUOTA_ALERT_CACHE_KEY) or {}
            if not cfg.get('enabled', True):
                cache.set(QUOTA_ALERT_LAST_LEVEL_KEY, 'disabled', timeout=86400)
                return

            status = self.get_quota_status()
            level = status.get('status', 'normal')
            global_used = status.get('globalUsed', 0)
            global_limit = status.get('globalQuota', 0)
            pct = round(global_used / global_limit * 100, 1) if global_limit > 0 else 0.0

            order = {'normal': 0, 'warning': 1, 'alert': 2, 'disabled': -1}
            last = cache.get(QUOTA_ALERT_LAST_LEVEL_KEY) or 'normal'
            if level in ('warning', 'alert') and order.get(level, 0) > order.get(last, 0):
                from auth_app.alert_service import AlertService
                AlertService.push_quota_alert(level, pct, cfg)
                cache.set(QUOTA_ALERT_LAST_LEVEL_KEY, level, timeout=86400)
            elif level == 'normal':
                cache.set(QUOTA_ALERT_LAST_LEVEL_KEY, 'normal', timeout=86400)
        except Exception as e:  # noqa: BLE001 - 预警推送失败不阻塞
            logger.debug('[预算闸门] 消费额度预警推送异常: %r', e)

    def _maybe_push_circuit_open_alert(self) -> None:
        """熔断触发告警：circuit_open 场景（受 /api/settings/quota-alert 的 rules 控制）。

        仅在熔断刚触发（连续失败达阈值）时调用，天然边缘触发不刷屏。
        """
        try:
            if not get_quota_alert_rules().get('circuit_open'):
                return
            from auth_app.alert_service import AlertService
            AlertService.push_event_alert(
                event='circuit_open',
                level='critical',
                title='推理熔断已触发',
                message=f'连续失败达到阈值 {self.break_threshold}，熔断 {self.break_cooldown}s',
            )
        except Exception as e:  # noqa: BLE001 - 告警推送失败不阻塞主流程
            logger.debug('[预算闸门] 熔断告警推送异常: %r', e)


def get_quota_alert_rules() -> Dict[str, bool]:
    """读取 /api/settings/quota-alert 的事件告警规则开关。

    返回 {'circuit_open': bool, 'quota_exhausted': bool}，缺省均开启。
    配置缺失/异常时回落默认值，保证告警默认可用。
    """
    try:
        from django.core.cache import cache
        cfg = cache.get(QUOTA_ALERT_CACHE_KEY)
    except Exception:
        cfg = None
    if not isinstance(cfg, dict):
        cfg = {}
    rules = cfg.get('rules') if isinstance(cfg, dict) else None
    if not isinstance(rules, dict):
        rules = {}
    return {
        'circuit_open': bool(rules.get('circuit_open', True)),
        'quota_exhausted': bool(rules.get('quota_exhausted', True)),
    }


# 全局预算闸门单例
_budget_gate = None


def get_budget_gate() -> DeepSeekBudgetGate:
    global _budget_gate
    if _budget_gate is None:
        _budget_gate = DeepSeekBudgetGate()
    return _budget_gate


class DeepSeekKeyPool:
    """DeepSeek API Key 轮换池 - Round-Robin 负载均衡"""

    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        raw_keys = os.environ.get('DEEPSEEK_API_KEYS', '')
        # 兼容旧单 key 配置
        fallback = os.environ.get('DEEPSEEK_API_KEY', '')
        if raw_keys:
            self.keys = [k.strip() for k in raw_keys.split(',') if k.strip()]
        elif fallback:
            self.keys = [fallback]
        else:
            # 从 Django settings 回退（开发环境默认值）
            try:
                from django.conf import settings
                raw = getattr(settings, 'DEEPSEEK_API_KEYS', '')
                if raw:
                    self.keys = [k.strip() for k in raw.split(',') if k.strip()]
                else:
                    self.keys = []
            except Exception:
                self.keys = []
        self._index = 0
        self._local_index = threading.local()

    @classmethod
    def get_instance(cls) -> 'DeepSeekKeyPool':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def get_key(self) -> str:
        """Round-Robin 取下一个可用 Key"""
        if not self.keys:
            raise ValueError("未配置任何 DEEPSEEK_API_KEY(S)")
        idx = getattr(self._local_index, 'value', None)
        if idx is None:
            with self._lock:
                idx = self._index
                self._index = (self._index + 1) % len(self.keys)
            self._local_index.value = idx
        key = self.keys[idx]
        # 线程本地索引用完后重置，下次重新取
        self._local_index.value = None
        return key

    @property
    def available(self) -> int:
        return len(self.keys)

    def __repr__(self):
        return f"DeepSeekKeyPool(keys={len(self.keys)})"


class DeepSeekClient:
    """DeepSeek V4 大模型 API 客户端
    - 优先使用用户自有 Key（如果存在且有效），不消耗平台共享额度
    - 无自有 Key 则回退到平台共享 KeyPool
    """

    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        model: str = None,
        max_tokens: int = 4096,
        user_id: Optional[int] = None,
    ):
        # 优先使用传入的 key（caller 指定）
        if api_key:
            self._api_key = api_key
            self._use_pool = False
        else:
            self._api_key = None
            self._use_pool = True
            self._user_id = user_id
            self._key_pool = DeepSeekKeyPool.get_instance()
        self.base_url = (base_url or os.environ.get(
            'DEEPSEEK_BASE_URL',
            'https://api.deepseek.com/v1'
        )).rstrip('/')
        self.model = model or os.environ.get(
            'DEEPSEEK_MODEL',
            'deepseek-chat'
        )
        self.max_tokens = max_tokens or int(os.environ.get('DEEPSEEK_MAX_TOKENS', 4096))

    def _resolve_user_key(self) -> Optional[str]:
        """按调用时惰性解析用户自有 Key（存在且启用则优先，不消耗平台配额）"""
        if not getattr(self, '_user_id', None):
            return None
        try:
            from auth_app.user_provider_key_models import UserProviderKey
            obj = UserProviderKey.objects.filter(
                user_id=self._user_id, provider='deepseek', is_active=True
            ).first()
            if obj:
                key = obj.decrypted_key
                if key:
                    logger.debug('[DeepSeek] 使用用户自有 Key (user_id=%s)', self._user_id)
                    return key
        except Exception as e:  # noqa: BLE001
            logger.warning('[DeepSeek] 加载用户自有 Key 失败: %r', e)
        return None

    @property
    def api_key(self) -> str:
        """每次调用时获取 Key: 用户自有优先，否则轮询平台池"""
        if getattr(self, '_user_id', None):
            user_key = self._resolve_user_key()
            if user_key:
                return user_key
        if self._use_pool:
            return self._key_pool.get_key()
        return self._api_key

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        top_p: float = 1.0,
        stream: bool = False,
        image_data: str = None,  # Base64图片数据
        caller: Optional[str] = None,  # 调用方标识（用于配额统计）
        **kwargs,
    ) -> Dict[str, Any]:
        """
        调用 DeepSeek Chat Completion API（支持多模态）

        Args:
            messages: 对话消息列表 [{"role": "user"|"system"|"assistant", "content": "..."}]
            temperature: 温度参数（0-2，越高越随机）
            top_p: 核采样参数（0-1）
            stream: 是否流式返回
            image_data: Base64图片数据（用于多模态）
            caller: 调用方标识（如用户名或用户ID，用于配额统计）
            **kwargs: 其他API参数

        Returns:
            完整的API响应字典
        """
        # 预算闸门检查
        gate = get_budget_gate()
        reason = gate.check_allowed(caller)
        if reason:
            logger.warning(f'[预算闸门] chat_completion 被拦截: {reason} (caller={caller})')
            raise PermissionError(reason)

        url = f"{self.base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # 如果有图片数据，修改最后一条用户消息为多模态格式
        if image_data:
            # 查找最后一条用户消息
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]['role'] == 'user':
                    original_text = messages[i]['content']
                    messages[i]['content'] = [
                        {"type": "text", "text": original_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                    ]
                    break

        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": self.max_tokens,
            "stream": stream,
            **kwargs,
        }

        gate = get_budget_gate()
        run_id = uuid.uuid4().hex[:16]
        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=60,
            )
            response.raise_for_status()
            gate.record_success()
            gate.record_start(caller)
            resp_data = response.json()
            # P1-2 计费落库：成功调用记录 tokens/cost/model
            _record_usage(resp_data, user_id=getattr(self, '_user_id', None),
                          model=self.model, scenario=caller or '', run_id=run_id)
            return resp_data

        except requests.exceptions.Timeout:
            logger.error("DeepSeek API request timed out")
            gate.record_failure()
            _record_usage(None, user_id=getattr(self, '_user_id', None), model=self.model,
                          scenario=caller or '', run_id=run_id, status='error', error_message='request timed out')
            raise TimeoutError("请求超时，请稍后重试")
        except requests.exceptions.HTTPError as e:
            logger.error(f"DeepSeek API HTTP error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code in (401, 403, 429) or e.response.status_code >= 500:
                logger.warning(f'[预算闸门] HTTP {e.response.status_code} 计入失败计数，用于熔断判断')
                gate.record_failure()
            _record_usage(None, user_id=getattr(self, '_user_id', None), model=self.model,
                          scenario=caller or '', run_id=run_id, status='error',
                          error_message=f'HTTP {e.response.status_code}')
            raise Exception(f"API错误 ({e.response.status_code}): {e.response.text}")
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            gate.record_failure()
            _record_usage(None, user_id=getattr(self, '_user_id', None), model=self.model,
                          scenario=caller or '', run_id=run_id, status='error', error_message=str(e)[:2000])
            raise

    def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        top_p: float = 1.0,
        caller: Optional[str] = None,  # 调用方标识（用于配额统计）
        **kwargs,
    ) -> Generator[str, None, None]:
        """
        流式调用 DeepSeek API（逐token返回）

        Yields:
            每次生成的一个文本片段
        """
        # 预算闸门检查
        gate = get_budget_gate()
        reason = gate.check_allowed(caller)
        if reason:
            logger.warning(f'[预算闸门] chat_completion_stream 被拦截: {reason} (caller={caller})')
            raise PermissionError(reason)

        url = f"{self.base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": self.max_tokens,
            "stream": True,
            **kwargs,
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=60,
                stream=True,
            )
            response.raise_for_status()
            gate.record_success()
            gate.record_start(caller)

            # P1-2 计费落库：流式响应的 usage 通常出现在最后一个 chunk
            run_id = uuid.uuid4().hex[:16]
            last_usage = None

            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str.strip() == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data_str)
                            if chunk.get('usage'):
                                last_usage = chunk.get('usage')
                            delta = chunk['choices'][0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

            if last_usage:
                _record_usage({'usage': last_usage}, user_id=getattr(self, '_user_id', None),
                              model=self.model, scenario=caller or '', run_id=run_id)

        except PermissionError:
            raise
        except requests.exceptions.Timeout as e:
            logger.error(f"Stream timeout: {e}")
            gate.record_failure()
            raise
        except requests.exceptions.HTTPError as e:
            logger.error(f"Stream HTTP error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code in (401, 403, 429) or e.response.status_code >= 500:
                logger.warning(f'[预算闸门] HTTP {e.response.status_code} 计入失败计数，用于熔断判断')
                gate.record_failure()
            raise
        except Exception as e:
            logger.error(f"Stream error: {e}")
            gate.record_failure()
            raise

    def simple_chat(
        self,
        user_message: str,
        system_prompt: str = "",
        history: List[Dict[str, str]] = None,
        temperature: float = 0.7,
        image_data: str = None,  # Base64图片数据
        caller: Optional[str] = None,  # 调用方标识（用于配额统计）
    ) -> str:
        """
        简化的对话接口（直接返回文本，支持多模态）

        Args:
            user_message: 用户消息
            system_prompt: 系统提示词
            history: 历史消息 [{"role": "...", "content": "..."}]
            temperature: 温度
            image_data: Base64图片数据（用于多模态）
            caller: 调用方标识（如用户名或用户ID，用于配额统计）

        Returns:
            模型生成的回复文本
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if history:
            messages.extend(history)

        messages.append({"role": "user", "content": user_message})

        result = self.chat_completion(
            messages, temperature=temperature, image_data=image_data, caller=caller
        )

        try:
            return result['choices'][0]['message']['content']
        except (KeyError, IndexError) as e:
            logger.error(f"Parse response error: {e}")
            return "抱歉，AI服务暂时不可用，请稍后重试。"


# 全局单例实例
_deepseek_client: Optional[DeepSeekClient] = None


def get_deepseek_client(user_id: Optional[int] = None) -> DeepSeekClient:
    """获取 DeepSeek 客户端实例。

    - 不传 user_id：返回全局单例（平台共享 KeyPool）
    - 传 user_id：返回按用户新建的客户端（优先使用用户自有 Key，不消耗平台配额）
    """
    if user_id is not None:
        return DeepSeekClient(user_id=user_id)
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = DeepSeekClient()
    return _deepseek_client
