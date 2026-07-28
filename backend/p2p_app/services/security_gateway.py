"""
L3 ASS 安全网关 - Anti-Spoofing Security Gateway

核心能力:
- 输入过滤 (XSS / 注入 / 超长输入截断)
- Prompt 注入检测 (越权指令 / 角色扮演攻击 / 上下文注入)
- 零信任权限校验 (每次请求验证 token + 权限 + 资源范围)
- ASS 签名生成 (Anti-Spoofing Signature)
- 内容分级 (public / internal / confidential)
"""

import re
import hashlib
import hmac
import json
import logging
import time
import html
from dataclasses import dataclass, field
from typing import Optional, Tuple

from django.conf import settings

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 常量定义
# ──────────────────────────────────────────────

SENSITIVITY_KEYWORDS = {
    'confidential': [
        'password', 'passwd', 'secret', 'api_key', 'apikey', 'token',
        'private_key', 'credential', 'auth_token', 'access_token',
        'session_id', 'ssn', 'credit_card', 'card_number',
        'bank_account', '身份证', '密码', '秘钥', '银行卡',
    ],
    'internal': [
        'internal', '内部', 'employee', '员工', 'salary', '薪资',
        'org_chart', '组织架构', 'meeting', '会议记录',
        'deployment', '部署配置', 'infra', '基础设施',
    ],
}

MAX_INPUT_LENGTH = 100_000  # 100KB
MAX_PAYLOAD_SIZE_MB = 10

ASS_SIGNATURE_SECRET = getattr(settings, 'ASS_SIGNATURE_SECRET', 'yijiandaodi-ass-default-secret')


# ──────────────────────────────────────────────
# Prompt 注入检测器
# ──────────────────────────────────────────────

class PromptInjectionDetector:
    """
    Prompt 注入检测器

    检测模式:
    - 角色扮演攻击 (ignore previous / act as ...)
    - 越权指令 (you are now / pretend to be)
    - 上下文注入 (system instruction / developer command)
    - 输出操控 (output only / print exactly)
    - 编码绕过 (base64 decode / hex encode)
    """

    PATTERNS = [
        # 角色扮演攻击 - 忽略之前的指令
        {
            'pattern': r'(ignore|forget|disregard|override)\s+(all\s+)?(previous|prior|above|earlier)',
            'category': 'role_play',
            'severity': 'high',
            'description': 'Ignore previous instructions attack',
        },
        # 越权指令 - 扮演其他角色
        {
            'pattern': r'(you\s+are\s+now|act\s+as|pretend\s+to\s+be|you\'re\s+now)\s+(a|an|the)?\s*\w*',
            'category': 'privilege_escalation',
            'severity': 'critical',
            'description': 'Role impersonation / privilege escalation',
        },
        # 系统级注入
        {
            'pattern': r'(system|developer|admin|root|superuser)(\s*(instruction|command|prompt|directive|message))?',
            'category': 'context_injection',
            'severity': 'high',
            'description': 'System-level context injection',
        },
        # 输出操控
        {
            'pattern': r'(output|print|return|echo|respond|reply)\s*(only|just|exactly|nothing\s+else)',
            'category': 'output_manipulation',
            'severity': 'medium',
            'description': 'Output manipulation attempt',
        },
        # 编码绕过
        {
            'pattern': r'(base64|rot13|hex|unicode|ascii|atob|btoa).*?(decode|encode|decrypt|encrypt)',
            'category': 'encoding_bypass',
            'severity': 'medium',
            'description': 'Encoding bypass attempt',
        },
        # 分隔符注入
        {
            'pattern': r'(<\|endoftext\|>|<\|end\|>|\[END\]|\[DONE\]|<\\/s>)',
            'category': 'delimiter_injection',
            'severity': 'high',
            'description': 'Delimiter / stop sequence injection',
        },
        # 思维链泄露/操控
        {
            'pattern': r'(ignore\s+your\s+(instructions|guidelines)|(reveal|show|dump)\s+your\s+(reasoning|thinking|chain-of-thought))',
            'category': 'chain_of_thought_attack',
            'severity': 'high',
            'description': 'Chain-of-thought manipulation',
        },
        # JSON 模式注入
        {
            'pattern': r'(\{.*"role"\s*:\s*"system".*\}|\[.*"role"\s*:\s*"system".*\])',
            'category': 'json_injection',
            'severity': 'critical',
            'description': 'JSON message format injection',
            'flags': re.DOTALL,
        },
    ]

    def __init__(self):
        self._compiled_patterns = []
        for p in self.PATTERNS:
            flags = p.get('flags', re.IGNORECASE)
            try:
                compiled = re.compile(p['pattern'], flags)
                self._compiled_patterns.append({**p, 'compiled': compiled})
            except re.error as e:
                logger.warning(f"Failed to compile pattern: {p['pattern']} - {e}")

    def detect(self, text: str) -> Tuple[bool, list[dict]]:
        """
        检测文本中的 Prompt 注入

        Returns:
            (is_malicious: bool, matched_patterns: list[dict])
        """
        if not text or not isinstance(text, str):
            return False, []

        matched = []
        for p in self._compiled_patterns:
            matches = p['compiled'].findall(text)
            if matches:
                matched.append({
                    'category': p['category'],
                    'severity': p['severity'],
                    'description': p['description'],
                    'match_count': len(matches) if isinstance(matches, list) else 1,
                    'sample': str(matches[0])[:200] if matches else '',
                })

        return len(matched) > 0, matched

    def score_risk(self, text: str) -> float:
        """
        风险评分 0-100

        0-20: 安全
        21-40: 低风险
        41-60: 中风险
        61-80: 高风险
        81-100: 极高风险（应拦截）
        """
        is_malicious, patterns = self.detect(text)

        if not is_malicious:
            base_score = 5.0
        else:
            severity_weights = {'critical': 35, 'high': 20, 'medium': 10, 'low': 3}
            score = sum(
                severity_weights.get(p['severity'], 5) * min(p['match_count'], 3)
                for p in patterns
            )
            base_score = min(score, 95.0)

        # 长度因子：超长输入增加风险分数
        length_factor = min(len(text) / MAX_INPUT_LENGTH * 10, 10)

        total = min(base_score + length_factor, 100.0)
        return round(total, 1)


# ──────────────────────────────────────────────
# 输入消毒器
# ──────────────────────────────────────────────

class InputSanitizer:
    """输入消毒器 - 清洗用户输入中的危险内容"""

    # 危险 HTML 标签
    DANGEROUS_TAGS = re.compile(
        r'<\s*/?(script|iframe|object|embed|form|input|textarea|button|select|'
        r'meta|link|style|base|applet)[^>]*>',
        re.IGNORECASE | re.DOTALL,
    )

    # 事件处理器属性
    EVENT_HANDLER_ATTR = re.compile(
        r'\bon\w+\s*=\s*[\'"][^\'"]*[\'"]',
        re.IGNORECASE,
    )

    # 控制字符 (保留换行、制表符)
    CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

    # 空字节
    NULL_BYTES = re.compile(r'\x00')

    # SQL 注入特征 (基础检测，不替代 ORM 参数化)
    SQL_INJECTION_PATTERNS = [
        re.compile(r"('|\")\s*(OR|AND)\s*('|\")?\s*\w+\s*= ", re.IGNORECASE),
        re.compile(r";\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC|UNION)\s", re.IGNORECASE),
        re.compile(r"--\s*$", re.MULTILINE),
        re.compile(r"/\*.*\*/", re.DOTALL),
    ]

    def sanitize(self, text: str, max_length: int = MAX_INPUT_LENGTH) -> str:
        """
        清理输入文本

        处理:
        - 截断超长输入
        - 移除危险 HTML 标签
        - 移除事件处理器属性
        - 移除控制字符和空字节
        - HTML 实体转义残留标签
        """
        if not isinstance(text, str):
            text = str(text)

        # 1. 长度截断
        if len(text) > max_length:
            logger.warning(f"Input truncated: {len(text)} -> {max_length}")
            text = text[:max_length]

        # 2. 移除空字节
        text = self.NULL_BYTES.sub('', text)

        # 3. 移除控制字符 (保留 \\n \\t \\r)
        text = self.CONTROL_CHARS.sub('', text)

        # 4. 移除危险 HTML 标签
        text = self.DANGEROUS_TAGS.sub('', text)

        # 5. 移除事件处理器属性
        text = self.EVENT_HANDLER_ATTR.sub('', text)

        # 6. 标准化空白字符
        text = ' '.join(text.split())

        return text.strip()

    def check_size_limit(self, data: dict, max_size_mb: int = MAX_PAYLOAD_SIZE_MB) -> Tuple[bool, int]:
        """
        检查数据大小限制

        Returns:
            (within_limit: bool, size_bytes: int)
        """
        serialized = json.dumps(data, ensure_ascii=False)
        size_bytes = len(serialized.encode('utf-8'))
        limit_bytes = max_size_mb * 1024 * 1024
        return size_bytes <= limit_bytes, size_bytes

    def sanitize_dict(self, data: dict, max_length: int = MAX_INPUT_LENGTH) -> dict:
        """递归清理字典中所有字符串值"""
        cleaned = {}
        for key, value in data.items():
            if isinstance(value, str):
                cleaned[key] = self.sanitize(value, max_length)
            elif isinstance(value, dict):
                cleaned[key] = self.sanitize_dict(value, max_length)
            elif isinstance(value, list):
                cleaned[key] = [
                    self.sanitize_str_or_dict(item, max_length) for item in value
                ]
            else:
                cleaned[key] = value
        return cleaned

    def sanitize_str_or_dict(self, item, max_length: int = MAX_INPUT_LENGTH):
        """处理列表中的混合类型元素"""
        if isinstance(item, str):
            return self.sanitize(item, max_length)
        elif isinstance(item, dict):
            return self.sanitize_dict(item, max_length)
        return item


# ──────────────────────────────────────────────
# 内容分类器
# ──────────────────────────────────────────────

class ContentClassifier:
    """内容敏感等级分类器"""

    LEVELS = ['public', 'internal', 'confidential']

    def classify(self, text: str) -> Tuple[str, float]:
        """
        分类文本的敏感等级

        Returns:
            (level: str, confidence: float 0-1)
        """
        if not text or not isinstance(text, str):
            return 'public', 1.0

        text_lower = text.lower()
        scores = {}

        for level, keywords in SENSITIVITY_KEYWORDS.items():
            hits = sum(1 for kw in keywords if kw.lower() in text_lower)
            scores[level] = hits

        # 选择得分最高的等级
        if scores.get('confidential', 0) > 0:
            return 'confidential', min(scores['confidential'] * 0.15, 1.0)
        elif scores.get('internal', 0) > 0:
            return 'internal', min(scores['internal'] * 0.12, 1.0)
        else:
            return 'public', 0.9


# ──────────────────────────────────────────────
# 零信任认证器
# ──────────────────────────────────────────────

@dataclass
class AuthResult:
    """认证结果"""
    is_valid: bool
    user_context: dict = field(default_factory=dict)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class ZeroTrustAuthenticator:
    """
    零信任认证器

    原则: Never trust, always verify
    每次请求都进行完整的 token + 权限 + 资源访问范围校验
    """

    # 权限层级
    PERMISSION_HIERARCHY = {
        'read': 1,
        'write': 2,
        'execute': 3,
        'admin': 4,
    }

    def __init__(self):
        self._token_cache: dict[str, dict] = {}  # 简单的 token 缓存
        self._rate_limit: dict[str, list[float]] = {}      # 用户级
        self._ip_rate_limit: dict[str, list[float]] = {}     # IP 级
        self._device_rate_limit: dict[str, list[float]] = {} # 设备指纹级

    def verify_request(
        self,
        request=None,
        request_data: Optional[dict] = None,
        required_permission: Optional[str] = None,
        resource_scope: Optional[str] = None,
    ) -> AuthResult:
        """
        验证请求：token 有效性 + 权限 + 资源范围 + 频率限制

        Args:
            request: Django HTTP request 对象 (可选)
            request_data: 请求数据字典 (可选)
            required_permission: 所需最低权限 (read/write/execute/admin)
            resource_scope: 允许的资源访问范围

        Returns:
            AuthResult
        """
        # 1. 提取 token
        token = self._extract_token(request, request_data)
        if not token:
            return AuthResult(
                is_valid=False,
                error_code='AUTH_001',
                error_message='Missing authentication token',
            )

        # 2. Token 有效性校验
        user_context = self._validate_token(token)
        if not user_context:
            return AuthResult(
                is_valid=False,
                error_code='AUTH_002',
                error_message='Invalid or expired token',
            )

        # 3. 频率限制检查 (用户级)
        user_id = user_context.get('user_id', 'anonymous')
        if not self._check_rate_limit(user_id):
            return AuthResult(
                is_valid=False,
                error_code='AUTH_003',
                error_message='Rate limit exceeded (user)',
            )

        # 3.1 IP 级频率限制
        client_ip = self._extract_client_ip(request)
        if client_ip and not self._check_ip_rate_limit(client_ip):
            return AuthResult(
                is_valid=False,
                error_code='AUTH_006',
                error_message='IP rate limit exceeded',
            )

        # 3.2 设备指纹级频率限制
        device_fp = self._extract_device_fingerprint(request)
        if device_fp and not self._check_device_rate_limit(device_fp):
            return AuthResult(
                is_valid=False,
                error_code='AUTH_007',
                error_message='Device rate limit exceeded',
            )

        # 4. 权限校验
        if required_permission:
            user_permissions = user_context.get('permissions', [])
            if not self._has_permission(user_permissions, required_permission):
                return AuthResult(
                    is_valid=False,
                    error_code='AUTH_004',
                    error_message=f'Insufficient permission: {required_permission} required',
                    user_context=user_context,
                )

        # 5. 资源访问范围校验
        if resource_scope:
            allowed_scopes = user_context.get('resource_scopes', [])
            if allowed_scopes and resource_scope not in allowed_scopes and '*' not in allowed_scopes:
                return AuthResult(
                    is_valid=False,
                    error_code='AUTH_005',
                    error_message=f'Resource scope denied: {resource_scope}',
                    user_context=user_context,
                )

        # 记录审计日志
        self._audit_log(user_id, required_permission, resource_scope, ip=client_ip, device_fp=device_fp)

        return AuthResult(is_valid=True, user_context=user_context)

    def _extract_token(self, request, request_data: Optional[dict]) -> Optional[str]:
        """从请求中提取认证 token"""
        # 优先从 Header 提取
        if request and hasattr(request, 'META'):
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                return auth_header[7:]
            elif auth_header.startswith('Token '):
                return auth_header[6:]

        # 其次从请求数据提取
        if request_data and isinstance(request_data, dict):
            return request_data.get('token') or request_data.get('access_token')

        return None

    def _validate_token(self, token: str) -> Optional[dict]:
        """
        校验 token 有效性

        在实际项目中这里应该对接 JWT / OAuth2 服务
        此处提供基本实现框架
        """
        # 缓存命中
        if token in self._token_cache:
            cached = self._token_cache[token]
            # 简单过期检查
            if cached.get('expires_at', 0) > time.time():
                return cached
            else:
                del self._token_cache[token]
                return None

        # TODO: 对接实际的 JWT 解码服务
        # 这里返回一个模拟的用户上下文用于开发测试
        # 生产环境必须替换为真实的 token 验证逻辑
        try:
            # 尝试简单格式解析 (非完整 JWT 实现)
            if '.' in token:
                import base64
                parts = token.split('.')
                if len(parts) >= 2:
                    payload_b64 = parts[1] + '=' * (4 - len(parts[1]) % 4)
                    try:
                        payload_json = base64.urlsafe_b64decode(payload_b64)
                        payload = json.loads(payload_json)
                        user_ctx = {
                            'user_id': payload.get('sub', payload.get('user_id', 'unknown')),
                            'username': payload.get('username', 'unknown'),
                            'permissions': payload.get('permissions', ['read']),
                            'resource_scopes': payload.get('scopes', ['*']),
                            'roles': payload.get('roles', []),
                            'expires_at': payload.get('exp', time.time() + 3600),
                        }
                        self._token_cache[token] = user_ctx
                        return user_ctx
                    except Exception:
                        pass

            # 无法解析的 token 返回 None
            return None

        except Exception as e:
            logger.warning(f"Token validation error: {e}")
            return None

    def _has_permission(self, user_permissions: list[str], required: str) -> bool:
        """检查用户是否拥有所需权限"""
        if '*' in user_permissions or 'admin' in user_permissions:
            return True

        required_level = self.PERMISSION_HIERARCHY.get(required, 99)
        for perm in user_permissions:
            user_level = self.PERMISSION_HIERARCHY.get(perm, 0)
            if user_level >= required_level:
                return True
        return False

    def _check_rate_limit(self, user_id: str, window_seconds: int = 60, max_requests: int = 100) -> bool:
        """简单的滑动窗口频率限制"""
        now = time.time()
        window_start = now - window_seconds

        if user_id not in self._rate_limit:
            self._rate_limit[user_id] = []

        # 清理过期记录
        self._rate_limit[user_id] = [
            t for t in self._rate_limit[user_id] if t > window_start
        ]

        if len(self._rate_limit[user_id]) >= max_requests:
            return False

        self._rate_limit[user_id].append(now)
        return True

    def _check_ip_rate_limit(self, ip_address: str, window_seconds: int = 60, max_requests: int = 200) -> bool:
        """IP 级滑动窗口频率限制"""
        now = time.time()
        window_start = now - window_seconds

        if ip_address not in self._ip_rate_limit:
            self._ip_rate_limit[ip_address] = []

        # 清理过期记录
        self._ip_rate_limit[ip_address] = [
            t for t in self._ip_rate_limit[ip_address] if t > window_start
        ]

        if len(self._ip_rate_limit[ip_address]) >= max_requests:
            return False

        self._ip_rate_limit[ip_address].append(now)
        return True

    def _check_device_rate_limit(self, device_fingerprint: str, window_seconds: int = 60, max_requests: int = 150) -> bool:
        """设备指纹级滑动窗口频率限制"""
        now = time.time()
        window_start = now - window_seconds

        if device_fingerprint not in self._device_rate_limit:
            self._device_rate_limit[device_fingerprint] = []

        # 清理过期记录
        self._device_rate_limit[device_fingerprint] = [
            t for t in self._device_rate_limit[device_fingerprint] if t > window_start
        ]

        if len(self._device_rate_limit[device_fingerprint]) >= max_requests:
            return False

        self._device_rate_limit[device_fingerprint].append(now)
        return True

    def _extract_client_ip(self, request) -> str:
        """提取客户端真实 IP"""
        if not request or not hasattr(request, 'META'):
            return ''
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            return xff.split(',')[0].strip()
        xri = request.META.get('HTTP_X_REAL_IP', '')
        if xri:
            return xri.strip()
        return request.META.get('REMOTE_ADDR', '')

    def _extract_device_fingerprint(self, request) -> Optional[str]:
        """提取设备指纹"""
        if not request or not hasattr(request, 'META'):
            return None
        fp = request.META.get('HTTP_X_DEVICE_FINGERPRINT', '')
        if not fp:
            fp = request.META.get('HTTP_FINGERPRINT_ID', '')
        return fp.strip() if fp else None

    def _audit_log(self, user_id: str, permission: str, scope: str, ip: Optional[str] = None, device_fp: Optional[str] = None) -> None:
        """记录安全审计日志"""
        log_data = {'user': user_id, 'perm': permission, 'scope': scope}
        if ip:
            log_data['ip'] = ip
        if device_fp:
            log_data['device'] = device_fp[:8] + '...'  # 只记录前8位保护隐私
        logger.info(f"ZeroTrustAuth audit: {log_data}")


# ──────────────────────────────────────────────
# ASS 签名生成器
# ──────────────────────────────────────────────

class ASSSignatureGenerator:
    """
    Anti-Spoofing Signature 生成器

    对通过安全网关的请求生成防篡改签名，
    确保请求在传输过程中未被篡改或伪造
    """

    @staticmethod
    def generate(
        payload: dict,
        timestamp: Optional[float] = None,
        extra_data: Optional[dict] = None,
    ) -> str:
        """
        生成 ASS 签名

        Algorithm: HMAC-SHA256(timestamp + sorted_payload_hash + secret)

        Args:
            payload: 待签名数据
            timestamp: 时间戳 (默认当前时间)
            extra_data: 附加签名数据

        Returns:
            签名字符串 (hex 格式)
        """
        ts = timestamp or time.time()

        # 对 payload 进行确定性序列化和哈希
        payload_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

        # 构建签名消息
        message_parts = [
            f"ts={int(ts)}",
            f"hash={payload_hash}",
        ]
        if extra_data:
            extra_str = json.dumps(extra_data, sort_keys=True, ensure_ascii=False)
            extra_hash = hashlib.sha256(extra_str.encode()).hexdigest()[:16]
            message_parts.append(f"extra={extra_hash}")

        message = "|".join(message_parts)

        # HMAC-SHA256 签名
        signature = hmac.new(
            ASS_SIGNATURE_SECRET.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()

        # 组合最终签名: version.timestamp.signature
        ass_signature = f"ASSv1.{int(ts)}.{signature}"

        return ass_signature

    @staticmethod
    def verify(
        ass_signature: str,
        payload: dict,
        tolerance_seconds: int = 300,
    ) -> Tuple[bool, Optional[str]]:
        """
        验证 ASS 签名

        Returns:
            (is_valid: bool, error_message: Optional[str])
        """
        if not ass_signature or not ass_signature.startswith("ASSv1."):
            return False, "Invalid signature format"

        try:
            parts = ass_signature.split(".")
            if len(parts) != 3:
                return False, "Malformed signature"

            ts = int(parts[1])
            provided_sig = parts[2]

            # 时间戳有效性检查 (防重放攻击)
            now = time.time()
            if abs(now - ts) > tolerance_seconds:
                return False, f"Timestamp expired: diff={abs(now - ts):.0f}s"

            # 重新计算签名并比对
            expected = ASSSignatureGenerator.generate(payload, timestamp=ts)
            expected_parts = expected.split(".")
            expected_sig = expected_parts[2] if len(expected_parts) == 3 else ""

            if not hmac.compare_digest(provided_sig, expected_sig):
                return False, "Signature mismatch"

            return True, None

        except (ValueError, IndexError) as e:
            return False, f"Signature parsing error: {e}"


# ──────────────────────────────────────────────
# 安全网关报告
# ──────────────────────────────────────────────

@dataclass
class SecurityReport:
    """安全处理报告"""
    passed: bool
    risk_score: float
    sensitivity_level: str
    sensitivity_confidence: float
    injection_detected: bool
    injection_details: list[dict]
    sanitized: bool
    auth_result: Optional[dict] = None
    ass_signature: Optional[str] = None
    warnings: list = field(default_factory=list)
    blocked_reason: Optional[str] = None
    processing_time_ms: float = 0.0


# ──────────────────────────────────────────────
# ASS 安全网关 - 统一入口
# ──────────────────────────────────────────────

class ASSSecurityGateway:
    """
    ASS 安全网关 - L3 层统一入口

    处理流水线:
    1. 认证鉴权 (Zero Trust)
    2. 输入大小检查
    3. 输入消毒
    4. Prompt 注入检测
    5. 内容分级
    6. 生成 ASS 签名
    """

    # 风险阈值
    RISK_THRESHOLD_BLOCK = 80.0   # 超过此值直接拦截
    RISK_THRESHOLD_WARN = 50.0    # 超过此值发出警告但放行

    def __init__(self):
        self.injection_detector = PromptInjectionDetector()
        self.sanitizer = InputSanitizer()
        self.classifier = ContentClassifier()
        self.authenticator = ZeroTrustAuthenticator()
        self.signer = ASSSignatureGenerator()

    def process(
        self,
        request_data: dict,
        request=None,
        user_context: Optional[dict] = None,
        required_permission: Optional[str] = None,
        resource_scope: Optional[str] = None,
        skip_auth: bool = False,
    ) -> dict:
        """
        完整的安全网关处理流水线

        Args:
            request_data: 用户提交的原始数据
            request: Django HTTP request (用于 header 提取)
            user_context: 预设的用户上下文 (跳过认证时使用)
            required_permission: 所需权限
            resource_scope: 资源访问范围
            skip_auth: 是否跳过认证步骤

        Returns:
            {
                "sanitized_data": dict,      # 清洗后的数据
                "security_report": SecurityReport,  # 安全报告
                "passed": bool,              # 是否通过
            }
        """
        start_time = time.time()

        report = SecurityReport(
            passed=True,
            risk_score=0.0,
            sensitivity_level="public",
            sensitivity_confidence=1.0,
            injection_detected=False,
            injection_details=[],
            sanitized=False,
        )

        # ── Step 1: 认证鉴权 (Zero Trust) ────
        if not skip_auth:
            auth_result = self.authenticator.verify_request(
                request=request,
                request_data=request_data,
                required_permission=required_permission,
                resource_scope=resource_scope,
            )
            report.auth_result = {
                'is_valid': auth_result.is_valid,
                'error_code': auth_result.error_code,
                'error_message': auth_result.error_message,
                'user_id': auth_result.user_context.get('user_id') if auth_result.user_context else None,
            }

            if not auth_result.is_valid:
                report.passed = False
                report.blocked_reason = f"Authentication failed: {auth_result.error_message}"
                report.processing_time_ms = (time.time() - start_time) * 1000
                return self._build_response(request_data, report)
        else:
            report.auth_result = {'is_valid': True, 'skipped': True}

        # ── Step 2: 输入大小检查 ─────────────
        within_limit, size_bytes = self.sanitizer.check_size_limit(request_data)
        if not within_limit:
            report.passed = False
            report.blocked_reason = f"Payload too large: {size_bytes / 1024 / 1024:.1f}MB"
            report.warnings.append(f"Size limit exceeded: {size_bytes} bytes")
            report.processing_time_ms = (time.time() - start_time) * 1000
            return self._build_response(request_data, report)

        # ── Step 3: 输入消毒 ─────────────────
        sanitized_data = self.sanitizer.sanitize_dict(request_data)
        report.sanitized = (sanitized_data != request_data)

        # ── Step 4: Prompt 注入检测 ─────────
        # 合并所有字符串字段进行检测
        full_text = self._extract_text_for_detection(sanitized_data)
        is_malicious, injection_details = self.injection_detector.detect(full_text)
        report.injection_detected = is_malicious
        report.injection_details = injection_details

        risk_score = self.injection_detector.score_risk(full_text)
        report.risk_score = risk_score

        # 高风险拦截
        if risk_score >= self.RISK_THRESHOLD_BLOCK:
            report.passed = False
            report.blocked_reason = f"High risk score ({risk_score}): potential prompt injection"
            report.processing_time_ms = (time.time() - start_time) * 1000
            logger.warning(
                f"Request BLOCKED by security gateway: risk_score={risk_score}, "
                f"injections={injection_details}"
            )
            return self._build_response(sanitized_data, report)

        # 中等风险警告
        if risk_score >= self.RISK_THRESHOLD_WARN:
            report.warnings.append(f"Elevated risk score: {risk_score}")

        # ── Step 5: 内容分级 ─────────────────
        sensitivity_level, confidence = self.classifier.classify(full_text)
        report.sensitivity_level = sensitivity_level
        report.sensitivity_confidence = confidence

        # ── Step 6: 生成 ASS 签名 ────────────
        ass_sig = self.signer.generate(sanitized_data)
        report.ass_signature = ass_sig

        report.processing_time_ms = (time.time() - start_time) * 1000

        logger.info(
            f"SecurityGateway processed: passed={report.passed} "
            f"risk={report.risk_score} level={report.sensitivity_level} "
            f"time={report.processing_time_ms:.1f}ms"
        )

        return self._build_response(sanitized_data, report)

    def quick_check(self, text: str) -> dict:
        """快速安全检查接口 (仅做注入检测 + 风险评分)"""
        is_malicious, details = self.injection_detector.detect(text)
        risk = self.injection_detector.score_risk(text)
        level, conf = self.classifier.classify(text)

        return {
            'is_safe': risk < self.RISK_THRESHOLD_BLOCK,
            'risk_score': risk,
            'injection_detected': is_malicious,
            'injection_details': details,
            'sensitivity_level': level,
            'sensitivity_confidence': conf,
            'should_block': risk >= self.RISK_THRESHOLD_BLOCK,
            'should_warn': risk >= self.RISK_THRESHOLD_WARN,
        }

    def _build_response(self, sanitized_data: dict, report: SecurityReport) -> dict:
        """构建统一响应格式"""
        return {
            'sanitized_data': sanitized_data,
            'security_report': {
                'passed': report.passed,
                'risk_score': report.risk_score,
                'sensitivity_level': report.sensitivity_level,
                'sensitivity_confidence': report.sensitivity_confidence,
                'injection_detected': report.injection_detected,
                'injection_count': len(report.injection_details),
                'injection_details': report.injection_details,
                'was_sanitized': report.sanitized,
                'auth_result': report.auth_result,
                'ass_signature': report.ass_signature,
                'warnings': report.warnings,
                'blocked_reason': report.blocked_reason,
                'processing_time_ms': round(report.processing_time_ms, 2),
            },
            'passed': report.passed,
        }

    @staticmethod
    def _extract_text_for_detection(data: dict) -> str:
        """从字典中提取所有文本用于注入检测"""
        parts = []
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, str):
                    parts.append(value)
                elif isinstance(value, (dict, list)):
                    parts.append(json.dumps(value, ensure_ascii=False))
        elif isinstance(data, str):
            parts.append(data)
        return "\n".join(parts)


# ──────────────────────────────────────────────
# 全局单例实例
# ──────────────────────────────────────────────

security_gateway = ASSSecurityGateway()
