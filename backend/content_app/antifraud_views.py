import time
import json
import hashlib
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.db import models
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser

from .antifraud_models import (
    DeviceFingerprint, RiskEvent, FraudRule,
    UserRiskProfile, AntiFraudDashboardSnapshot,
)

logger = logging.getLogger(__name__)


class DeviceFingerprintSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    device_type_display = serializers.CharField(source='get_device_type_display', read_only=True)
    os_name_display = serializers.CharField(source='get_os_name_display', read_only=True)

    class Meta:
        model = DeviceFingerprint
        fields = [
            'id', 'fingerprint_hash', 'device_type', 'device_type_display',
            'os_name', 'os_name_display', 'os_version', 'browser', 'browser_version',
            'screen_resolution', 'language', 'timezone',
            'ip_address', 'ip_country', 'ip_region', 'ip_isp', 'is_proxy', 'is_datacenter_ip',
            'canvas_fingerprint', 'webgl_vendor', 'webgl_renderer', 'plugins_count', 'fonts_count',
            'risk_level', 'risk_level_display', 'risk_score', 'risk_reasons',
            'first_seen_at', 'last_seen_at', 'event_count', 'user_count',
            'tags', 'created_at',
        ]
        read_only_fields = ['id', 'fingerprint_hash', 'risk_level', 'risk_score', 'risk_reasons',
                           'first_seen_at', 'last_seen_at', 'event_count', 'user_count']


class RiskEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    action_display = serializers.CharField(source='get_action_taken_display', read_only=True)

    class Meta:
        model = RiskEvent
        fields = [
            'id', 'user', 'device', 'event_type', 'event_type_display',
            'severity', 'severity_display', 'action_taken', 'action_display',
            'ip_address', 'user_agent', 'request_path', 'request_method',
            'username_attempted', 'email_attempted',
            'risk_score', 'triggered_rules', 'risk_indicators',
            'location_city', 'location_region', 'location_country',
            'is_blocked', 'block_reason', 'session_id',
            'extra_context', 'processing_time_ms', 'created_at',
        ]
        read_only_fields = [
            'id', 'risk_score', 'triggered_rules', 'risk_indicators',
            'is_blocked', 'block_reason', 'processing_time_ms', 'created_at',
        ]


class FraudRuleSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = FraudRule
        fields = [
            'id', 'rule_code', 'rule_name', 'category', 'category_display',
            'description', 'condition_config', 'threshold_value',
            'action', 'action_display', 'action_params',
            'priority', 'weight', 'status', 'status_display',
            'hit_count', 'block_count', 'false_positive_count', 'last_hit_at',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'hit_count', 'block_count', 'false_positive_count', 'last_hit_at',
                           'created_at', 'updated_at']


class UserRiskProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = UserRiskProfile
        fields = [
            'id', 'user', 'username', 'email',
            'overall_risk_score', 'risk_level', 'risk_level_display',
            'registration_risk_score', 'login_risk_score', 'behavior_risk_score',
            'device_risk_score', 'ip_risk_score', 'velocity_risk_score',
            'total_events', 'blocked_events', 'failed_logins_24h', 'successful_logins_24h',
            'known_devices', 'known_ips', 'login_locations',
            'triggered_rules_history', 'risk_timeline',
            'is_frozen', 'frozen_until', 'frozen_reason', 'requires_mfa',
            'notes', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [f.name for f in UserRiskProfile._meta.fields if f.name not in ('notes',)]


ANTIFRAUD_ANALYSIS_PROMPT = """你是一鉴到底(YiJianDaoDi)平台的「账号反欺诈与异常行为检测引擎」核心AI。你的能力对标数美科技(Shumei)的反欺诈系统。

## 你的检测能力矩阵（8大维度）

### D1: 设备指纹分析 (Device Fingerprinting)
- Canvas指纹唯一性检测（识别虚拟机/模拟器）
- WebGL渲染器指纹（检测自动化工具）
- 插件/字体数量异常（无头浏览器特征）
- 屏幕分辨率一致性检查
- 时区与IP地理位置偏差检测
- 代理/VPN/数据中心IP识别

### D2: IP信誉评估 (IP Reputation)
- IP归属地与用户声明位置不一致
- 已知恶意IP库匹配（Tor出口节点、僵尸网络C2、垃圾邮件发送者）
- 数据中心IP用于个人账户操作
- 同一IP短时间大量注册/登录
- IP段风险评级（住宅/数据中心/移动/代理）

### D3: 行为生物识别 (Behavioral Biometrics)
- 鼠标移动轨迹分析（人类vs脚本：贝塞尔曲线平滑度）
- 键盘打字节奏（按键间隔分布、修正模式）
- 页面停留时间分布
- 滚动行为模式
- 表单填写速度（过快=自动填充，过慢=人工犹豫）

### D4: 频率/速率检测 (Velocity Checks)
- 注册频率：同IP/设备1分钟内>3次注册
- 登录频率：同一账户1分钟内>5次尝试
- API调用频率：单用户1秒内>10次请求
- 批量操作检测：短时间内大量相似操作
- 时间窗口滑动计数器（支持可配置窗口）

### D5: 账号接管检测 (Account Takeover Prevention)
- 异地登录（与历史位置偏差>500km）
- 新设备首次登录
- 密码错误后突然成功（暴力破解成功标志）
- 不寻常的操作时间（如凌晨3点大额操作）
- 会话并发数异常（多地点同时活跃）

### D6: 注册滥用防护 (Registration Abuse Prevention)
- 一次性邮箱检测（temp-mail/10minutemail等）
- 相似用户名批量注册（test001, test002...）
- 同一设备多账号关联（设备指纹→用户映射>3）
- 虚假信息检测（手机号格式/邮箱域名可疑）
- 年龄验证绕过迹象

### D7: 内容垃圾检测 (Content Spam)
- 注册后立即发布推广内容
- 短时间内大量相似内容发布
- 关键词密度异常（SEO垃圾特征）
- 外链注入模式
- 模板化/机器生成内容特征

### D8: 关联图谱分析 (Graph Analysis)
- 用户-设备-IP 三角关系图
- 共享设备/IP的用户群体聚类
- 异常连接密度（正常用户通常1-3设备，滥用者可能10+）
- 环形检测（A→B→C→A 的欺诈环）

## 输出要求（严格JSON）

{
  "analysis_summary": {
    "event_type": "register|login|login_failed|...",
    "overall_risk_score": 0-100,
    "risk_level": "info|low|medium|high|critical",
    "recommended_action": "none|pass|challenge|step_up_auth|block|freeze_account|flag_for_review",
    "confidence": 0.0-1.0,
    "should_block": true/false,
    "reasoning": "一句话总结判定依据"
  },

  "dimension_scores": {
    "D1_device_fingerprint": {"score": 0-100, "verdict": "safe|suspicious|dangerous", "key_finding": "", "indicators": []},
    "D2_ip_reputation": {"score": 0-100, "verdict": "safe|suspicious|dangerous", "key_finding": "", "indicators": []},
    "D3_behavioral_biometrics": {"score": 0-100, "verdict": "safe|suspicious|dangerous", "key_finding": "", "indicators": []},
    "D4_velocity_check": {"score": 0-100, "verdict": "safe|warning|violated", "key_finding": "", "indicators": []},
    "D5_account_takeover": {"score": 0-100, "verdict": "safe|warning|detected", "key_finding": "", "indicators": []},
    "D6_registration_abuse": {"score": 0-100, "verdict": "safe|suspicious|detected", "key_finding": "", "indicators": []},
    "D7_content_spam": {"score": 0-100, "verdict": "safe|warning|detected", "key_finding": "", "indicators": []},
    "D8_graph_analysis": {"score": 0-100, "verdict": "normal|anomalous|fraud_ring", "key_finding": "", "indicators": []}
  },

  "triggered_rules": ["rule_code_1", "rule_code_2"],

  "risk_indicators": [
    {
      "indicator_id": "IND-001",
      "category": "D1-D8",
      "title": "指标标题",
      "description": "详细描述",
      "severity": "info|low|medium|high|critical",
      "score_impact": N (对总分的贡献)
    }
  ],

  "device_analysis": {
    "is_virtual_machine": bool,
    "is_headless_browser": bool,
    "is_bot": bool,
    "trust_level": "trusted|normal|suspicious|untrusted",
    "risk_factors": ["factor1", "factor2"]
  },

  "ip_analysis": {
    "is_datacenter": bool,
    "is_proxy_vpn": bool,
    "is_tor_exit": bool,
    "is_blacklisted": bool,
    "reputation_score": 0-100,
    "geo_consistency": "consistent|inconsistent|unknown"
  },

  "user_profile_update": {
    "overall_risk_score_delta": N,
    "new_risk_level": "trusted|normal|watched|suspicious|restricted|banned",
    "dimension_deltas": {
      "registration_risk_score": delta,
      "login_risk_score": delta,
      "behavior_risk_score": delta,
      "device_risk_score": delta,
      "ip_risk_score": delta,
      "velocity_risk_score": delta
    },
    "flags_to_add": ["flag1"],
    "recommendations": ["建议1"]
  },

  "detailed_report": "完整反欺诈分析报告..."
}"""


def _compute_fp_hash(fp_data: dict) -> str:
    """计算设备指纹哈希"""
    raw_str = json.dumps(fp_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()


def _call_antifraud_analyze(event_context: dict) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        context_str = json.dumps(event_context, ensure_ascii=False)[:3000]
        response = client.simple_chat(
            user_message=f"""【反欺诈事件上下文】{context_str}
请对该事件进行全面的反欺诈分析。""",
            system_prompt=ANTIFRAUD_ANALYSIS_PROMPT,
            temperature=0.15,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"Anti-fraud analysis error: {e}")
        return {"error": str(e)}


class DeviceFingerprintViewSet(viewsets.ModelViewSet):
    queryset = DeviceFingerprint.objects.all()
    serializer_class = DeviceFingerprintSerializer
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        if self.action in ['collect']:
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def collect(self, request):
        fp_data = request.data.get('fingerprint_data', {})
        fp_hash = _compute_fp_hash(fp_data)
        device, created = DeviceFingerprint.objects.update_or_create(
            fingerprint_hash=fp_hash,
            defaults={
                'device_type': fp_data.get('device_type', 'desktop'),
                'os_name': fp_data.get('os_name', 'unknown'),
                'os_version': fp_data.get('os_version', ''),
                'browser': fp_data.get('browser', ''),
                'browser_version': fp_data.get('browser_version', ''),
                'screen_resolution': fp_data.get('screen_resolution', ''),
                'language': fp_data.get('language', 'zh-CN'),
                'timezone': fp_data.get('timezone', ''),
                'ip_address': request.META.get('REMOTE_ADDR'),
                'canvas_fingerprint': fp_data.get('canvas_fingerprint', ''),
                'webgl_vendor': fp_data.get('webgl_vendor', ''),
                'webgl_renderer': fp_data.get('webgl_renderer', ''),
                'plugins_count': fp_data.get('plugins_count', 0),
                'fonts_count': fp_data.get('fonts_count', 0),
                'raw_fingerprint_data': fp_data,
                'event_count': 1 if created else models.F('event_count') + 1,
            }
        )
        if not created:
            device.event_count += 1
            device.save(update_fields=['event_count', 'last_seen_at'])
        return Response({
            'data': self.get_serializer(device).data,
            'device_id': str(device.id),
            'is_new_device': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class RiskEventViewSet(viewsets.ModelViewSet):
    queryset = RiskEvent.objects.all()
    serializer_class = RiskEventSerializer
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        if self.action in ['report', 'my_events']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        event_type = self.request.query_params.get('event_type')
        severity = self.request.query_params.get('severity')
        is_blocked = self.request.query_params.get('is_blocked')
        hours = self.request.query_params.get('hours')
        if event_type:
            qs = qs.filter(event_type=event_type)
        if severity:
            qs = qs.filter(severity=severity)
        if is_blocked is not None:
            qs = qs.filter(is_blocked=is_blocked.lower() == 'true')
        if hours:
            since = datetime.now() - timedelta(hours=int(hours))
            qs = qs.filter(created_at__gte=since)
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def report(self, request):
        start_time = time.time()
        event_type = request.data.get('event_type', 'suspicious_behavior')

        fp_hash = None
        device = None
        fp_data = request.data.get('fingerprint_data')
        if fp_data:
            fp_hash = _compute_fp_hash(fp_data)
            device, _ = DeviceFingerprint.objects.update_or_create(
                fingerprint_hash=fp_hash,
                defaults={
                    'raw_fingerprint_data': fp_data,
                    'ip_address': request.META.get('REMOTE_ADDR'),
                    'event_count': models.F('event_count') + 1,
                }
            )

        event_ctx = {
            'event_type': event_type,
            'ip_address': request.META.get('REMOTE_ADDR'),
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:500],
            'request_path': request.data.get('request_path', ''),
            'request_method': request.method,
            'username': request.user.username if request.user.is_authenticated else request.data.get('username_attempted', ''),
            'fingerprint_data': fp_data or {},
            'session_id': request.data.get('session_id', ''),
            'extra_data': request.data.get('extra_context', {}),
        }

        result = _call_antifraud_analyze(event_ctx)
        elapsed = int((time.time() - start_time) * 1000)

        summary = result.get('analysis_summary', {})
        dims = result.get('dimension_scores', {})
        indicators = result.get('risk_indicators', [])
        triggered = result.get('triggered_rules', [])
        dev_analysis = result.get('device_analysis', {})
        ip_analysis = result.get('ip_analysis', {})

        action_taken = summary.get('recommended_action', 'none')
        should_block = summary.get('should_block', False)

        event = RiskEvent.objects.create(
            user=request.user if request.user.is_authenticated else None,
            device=device,
            event_type=event_type,
            severity=summary.get('risk_level', 'info'),
            action_taken=action_taken,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000],
            request_path=event_ctx['request_path'],
            request_method=event_ctx['request_method'],
            username_attempted=event_ctx['username'],
            risk_score=float(summary.get('overall_risk_score', 0)),
            triggered_rules=triggered,
            risk_indicators=indicators,
            is_blocked=should_block,
            block_reason=summary.get('reasoning', '') if should_block else '',
            session_id=event_ctx['session_id'],
            extra_context={**event_ctx, **result},
            processing_time_ms=elapsed,
        )

        if device:
            device.risk_score = max(device.risk_score, float(summary.get('overall_risk_score', 0)))
            reasons = list(device.risk_reasons or [])
            new_reasons = result.get('risk_indicators', [])
            for ind in new_reasons[:3]:
                if ind.get('title') and ind['title'] not in reasons:
                    reasons.append(ind['title'])
            device.risk_reasons = reasons[-10:]
            if should_block or summary.get('risk_level') in ('high', 'critical'):
                device.risk_level = 'high_risk' if device.risk_level != 'blocked' else device.risk_level
            device.save()

        profile_update = result.get('user_profile_update', {})
        if request.user.is_authenticated and profile_update:
            profile, created = UserRiskProfile.objects.get_or_create(
                user=request.user,
                defaults={'overall_risk_score': 0}
            )
            deltas = profile_update.get('dimension_deltas', {})
            profile.overall_risk_score = max(0, min(100, profile.overall_risk_score + float(deltas.get('overall_risk_score_delta', 0))))
            profile.registration_risk_score = max(0, min(100, profile.registration_risk_score + float(deltas.get('registration_risk_score', 0))))
            profile.login_risk_score = max(0, min(100, profile.login_risk_score + float(deltas.get('login_risk_score', 0))))
            profile.behavior_risk_score = max(0, min(100, profile.behavior_risk_score + float(deltas.get('behavior_risk_score', 0))))
            profile.device_risk_score = max(0, min(100, profile.device_risk_score + float(deltas.get('device_risk_score', 0))))
            profile.ip_risk_score = max(0, min(100, profile.ip_risk_score + float(deltas.get('ip_risk_score', 0))))
            profile.velocity_risk_score = max(0, min(100, profile.velocity_risk_score + float(deltas.get('velocity_risk_score', 0))))

            new_level = profile_update.get('new_risk_level')
            if new_level:
                level_order = ['trusted', 'normal', 'watched', 'suspicious', 'restricted', 'banned']
                current_idx = level_order.index(profile.risk_level) if profile.risk_level in level_order else 1
                new_idx = level_order.index(new_level) if new_level in level_order else 1
                if new_idx > current_idx:
                    profile.risk_level = new_level

            profile.total_events += 1
            if should_block:
                profile.blocked_events += 1
            history = list(profile.triggered_rules_history or [])
            for r in triggered[:5]:
                history.insert(0, {'rule': r, 'time': event.created_at.isoformat(), 'score': profile.overall_risk_score})
            profile.triggered_rules_history = history[:50]
            profile.save()

        return Response({
            'data': self.get_serializer(event).data,
            'decision': {
                'blocked': should_block,
                'action': action_taken,
                'risk_score': summary.get('overall_risk_score', 0),
                'risk_level': summary.get('risk_level', 'info'),
                'reason': summary.get('reasoning', ''),
            },
            'message': f'反欺诈分析完成！风险评分: {summary.get("overall_risk_score", 0)}, '
                       f'处置: {action_taken}, 触发规则: {len(triggered)}个, '
                       f'耗时: {elapsed}ms',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my_events(self, request):
        events = RiskEvent.objects.filter(user=request.user).order_by('-created_at')[:50]
        return Response(self.get_serializer(events, many=True).data)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        now = datetime.now()
        h24_ago = now - timedelta(hours=24)
        h1_ago = now - timedelta(hours=1)

        total_events = RiskEvent.objects.filter(created_at__gte=h24_ago).count()
        blocked = RiskEvent.objects.filter(created_at__gte=h24_ago, is_blocked=True).count()
        critical = RiskEvent.objects.filter(created_at__gte=h24_ago, severity='critical').count()
        high = RiskEvent.objects.filter(created_at__gte=h24_ago, severity='high').count()

        by_type = {}
        for et_val, et_label in RiskEvent.EVENT_TYPE_CHOICES:
            cnt = RiskEvent.objects.filter(event_type=et_val, created_at__gte=h24_ago).count()
            if cnt > 0:
                by_type[et_label] = cnt

        top_ips = list(RiskEvent.objects.filter(
            created_at__gte=h24_ago
        ).exclude(ip_address__isnull=True).exclude(ip_address='').values('ip_address').annotate(
            count=models.Count('id')
        ).order_by('-count')[:10].values_list('ip_address', 'count'))

        avg_risk = RiskEvent.objects.filter(created_at__gte=h24_ago).aggregate(
            avg=models.Avg('risk_score'))['avg'] or 0

        profile_stats = {
            'total': UserRiskProfile.objects.count(),
            'trusted': UserRiskProfile.objects.filter(risk_level='trusted').count(),
            'normal': UserRiskProfile.objects.filter(risk_level='normal').count(),
            'watched': UserRiskProfile.objects.filter(risk_level='watched').count(),
            'suspicious': UserRiskProfile.objects.filter(risk_level='suspicious').count(),
            'restricted': UserRiskProfile.objects.filter(risk_level='restricted').count(),
            'banned': UserRiskProfile.objects.filter(risk_level='banned').count(),
            'frozen': UserRiskProfile.objects.filter(is_frozen=True).count(),
        }

        recent_critical = RiskEvent.objects.filter(severity__in=['critical', 'high']).order_by('-created_at')[:10]
        recent_events_serialized = RiskEventSerializer(recent_critical, many=True).data

        return Response({
            'time_range': '24h',
            'generated_at': now.isoformat(),
            'events': {
                'total_24h': total_events,
                'blocked_24h': blocked,
                'critical_24h': critical,
                'high_24h': high,
                'by_event_type': by_type,
                'avg_risk_score': round(float(avg_risk), 1),
            },
            'top_risk_ips': [{'ip': ip, 'count': c} for ip, c in top_ips],
            'user_profiles': profile_stats,
            'recent_critical_events': recent_events_serialized,
        })

    @action(detail=False, methods=['post'])
    def take_action(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        action_type = request.data.get('action_type')
        target_user_id = request.data.get('user_id')
        reason = request.data.get('reason', '')
        duration_hours = request.data.get('duration_hours', 24)

        if not target_user_id:
            return Response({'error': '需要提供 user_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserRiskProfile.objects.get_or_create(user=target_user)

        if action_type == 'freeze':
            profile.is_frozen = True
            profile.frozen_until = datetime.now() + timedelta(hours=int(duration_hours))
            profile.frozen_reason = reason
            profile.risk_level = 'restricted'
            target_user.is_active = False
            target_user.save()
        elif action_type == 'unfreeze':
            profile.is_frozen = False
            profile.frozen_until = None
            profile.risk_level = 'watched'
            target_user.is_active = True
            target_user.save()
        elif action_type == 'ban':
            profile.risk_level = 'banned'
            target_user.is_active = False
            target_user.save()
        elif action_type == 'require_mfa':
            profile.requires_mfa = True
        elif action_type == 'clear_mfa':
            profile.requires_mfa = False
        else:
            return Response({'error': f'未知动作类型: {action_type}'}, status=status.HTTP_400_BAD_REQUEST)

        profile.reviewed_by = request.user
        profile.reviewed_at = datetime.now()
        profile.notes = reason
        profile.save()

        RiskEvent.objects.create(
            user=target_user,
            event_type='suspicious_behavior' if action_type in ('freeze', 'ban') else 'profile_update',
            severity='high' if action_type in ('freeze', 'ban') else 'low',
            action_taken=action_type,
            ip_address=request.META.get('REMOTE_ADDR'),
            risk_score=90 if action_type in ('freeze', 'ban') else 20,
            block_reason=f'管理员手动操作: {action_type} - {reason}',
            extra_context={'admin_action': True, 'operator': request.user.username, 'reason': reason},
        )

        return Response({
            'message': f'已执行操作: {action_type}',
            'target_user': target_user.username,
            'profile': UserRiskProfileSerializer(profile).data,
        })


class FraudRuleViewSet(viewsets.ModelViewSet):
    queryset = FraudRule.objects.all()
    serializer_class = FraudRuleSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def active_rules(self, request):
        rules = FraudRule.objects.filter(status='enabled').order_by('-priority')
        return Response(FraudRuleSerializer(rules, many=True).data)

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        rule = self.get_object()
        rule.status = 'disabled' if rule.status == 'enabled' else 'enabled'
        rule.save()
        return Response({'status': rule.status, 'rule_code': rule.rule_code})


class UserRiskProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UserRiskProfile.objects.select_related('user').all()
    serializer_class = UserRiskProfileSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def high_risk_users(self, request):
        profiles = UserRiskProfile.objects.filter(
            risk_level__in=['suspicious', 'restricted', 'banned']
        ).select_related('user').order_by('-overall_risk_score')[:50]
        return Response(self.get_serializer(profiles, many=True).data)
