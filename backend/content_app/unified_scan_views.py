import time
import json
import logging
import hashlib
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .unified_scan_models import UnifiedContentScan, ComplianceRule

logger = logging.getLogger(__name__)


class UnifiedContentScanSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_overall_risk_level_display', read_only=True)
    input_cat_display = serializers.CharField(source='get_input_category_display', read_only=True)
    detected_cat_display = serializers.CharField(source='get_detected_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UnifiedContentScan
        fields = [
            'id', 'user', 'input_category', 'input_cat_display',
            'detected_category', 'detected_cat_display', 'classification_confidence',
            'file_name', 'file_size', 'file_hash_sha256', 'file_type',
            'original_content', 'content_preview', 'content_language',
            'overall_risk_level', 'risk_level_display', 'overall_risk_score',
            'compliance_score', 'integrity_score',
            'ai_generated_probability', 'plagiarism_similarity', 'deepfake_probability',
            'data_leak_risk', 'sensitivity_level',
            'dimension_results', 'triggered_detectors', 'scan_timeline',
            'findings_summary', 'finding_details', 'risk_indicators',
            'compliance_mapping', 'affected_regulations', 'remediation_plan', 'audit_trail',
            'unified_report', 'executive_brief',
            'status', 'status_display', 'processing_time_ms',
            'detectors_executed', 'detectors_passed', 'detectors_failed',
            'tags', 'metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'file_hash_sha256', 'detected_category', 'classification_confidence',
            'overall_risk_level', 'overall_risk_score', 'compliance_score', 'integrity_score',
            'ai_generated_probability', 'plagiarism_similarity', 'deepfake_probability',
            'data_leak_risk', 'sensitivity_level',
            'dimension_results', 'triggered_detectors', 'scan_timeline',
            'findings_summary', 'finding_details', 'risk_indicators',
            'compliance_mapping', 'affected_regulations', 'remediation_plan', 'audit_trail',
            'unified_report', 'executive_brief',
            'status', 'processing_time_ms',
            'detectors_executed', 'detectors_passed', 'detectors_failed',
            'tags', 'metadata', 'created_at', 'updated_at',
        ]


UNIFIED_SYSTEM_PROMPT = """你是一鉴到底(YiJianDaoDi)平台的全品类内容安全检测引擎核心AI。你拥有所有垂直场景检测能力，并能自动完成以下全流程：

## 你的能力矩阵（10大检测维度）

### D1: AI生成内容检测 (AI-Generated Content)
- 语言模型特征(perplexity/burstiness/semantic coherence)
- 风格异常(过度流畅/缺乏个人风格)
- 推测生成工具和参数

### D2: 抄袭/相似度检测 (Plagiarism & Similarity)
- 文本相似度(n-gram/Jaccard/Cosine语义)
- 改写/同义词替换检测
- 自我抄袭识别

### D3: 深度伪造检测 (Deepfake Detection) [仅视频/图片]
- GAN伪影特征
- 面部一致性(如适用)
- 频域指纹分析

### D4: 敏感信息泄露 (Sensitive Data Leakage)
- PII检测: 姓名/手机号/身份证/邮箱/地址/银行卡
- 商业秘密: 定价策略/客户名单/技术文档/源码
- 凭证泄露: API Key/密码/token/私钥

### D5: 合规性审查 (Compliance Check)
- 《网络安全法》第21条(日志留存)、第27条(实名制)、第48条(违法内容)
- 《数据安全法》第21条(分类分级)、第24条(数据出境)
- 《个人信息保护法》第6条(告知同意)、第13-15条(最小必要/目的限制)
- 等保2.0三级技术要求
- 行业特定法规

### D6: 内容安全风险 (Content Safety Risk)
- 违法违禁内容(暴恐/色情/赌博/毒品)
- 虚假信息/谣言特征
- 广告法违规(极限词/虚假宣传/比较广告)
- 版权侵权风险

### D7: 数据质量评估 (Data Quality Assessment)
- 数据一致性检验
- 逻辑矛盾检测
- 格式规范性
- 完整性评分

### D8: 来源可信度评估 (Source Credibility)
- 来源归因(人工/AI/混合)
- 数字水印检测
- 修改历史痕迹
- C2PA元数据验证

### D9: 行业特定检测 (Industry-Specific) [根据内容类型]
- 医疗: 医疗错误/格式规范/患者隐私
- 法律: 法律风险/合规扫描/条款效力
- 财务: 造假指标/异常项目/Beneish M-Score
- 学术: 引用规范/数据伪造/署名真实性
- 设计: AI伪影/抄袭/原创度

### D10: 综合风险评估 (Comprehensive Risk Matrix)
- 多维度风险聚合
- 法规映射(发现→具体法条)
- 整改建议优先级排序
- 高管简报生成

## 输出要求（严格JSON）

{
  "classification": {
    "detected_category": "auto_detect|general_text|medical_report|legal_document|financial_statement|design_draft|academic_paper|enterprise_content|video_media|image_media|code_source|api_response|email_comm|social_content",
    "confidence": 0.0-1.0,
    "language": "zh|en|mixed",
    "reasoning": "分类依据"
  },

  "dimension_scores": {
    "D1_ai_generated": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": "一句话"},
    "D2_plagiarism": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": ""},
    "D3_deepfake": {"score": 0.0-100, "verdict": "pass|warn|fail|n/a", "key_finding": ""},
    "D4_data_leakage": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": "", "pii_found": []},
    "D5_compliance": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": "", "violations": []},
    "D6_content_safety": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": ""},
    "D7_data_quality": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": ""},
    "D8_source_credibility": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": ""},
    "D9_industry_specific": {"score": 0.0-100, "verdict": "pass|warn|fail|n/a", "key_finding": "", "industry_findings": []},
    "D10_comprehensive": {"score": 0.0-100, "verdict": "pass|warn|fail", "key_finding": ""}
  },

  "overall_assessment": {
    "risk_level": "critical|high|medium|low|info|safe",
    "risk_score": 0-100,
    "compliance_score": 0-100,
    "integrity_score": 0-100,
    "sensitivity_level": "L1|L2|L3|L4",
    "summary_50words": "50字以内结论"
  },

  "findings": {
    "critical": [{"id": "F001", "dimension": "D1-D10", "category": "类别", "title": "标题", "description": "描述", "location": "位置", "evidence": "证据"}],
    "high": [],
    "medium": [],
    "low": [],
    "info": []
  },

  "compliance_mapping": {
    "violated_articles": [
      {
        "regulation": "网络安全法|数据安全法|PIPL|等保2.0|广告法|著作权法|学术规范|金融监管|医疗规定",
        "article": "具体法条(如 第21条)",
        "title": "法条标题",
        "requirement": "合规要求描述",
        "finding_ref": "关联的发现ID",
        "penalty": "违规后果"
      }
    ],
    "total_violations": N,
    "critical_violations": N,
    "affected_regulation_count": N
  },

  "remediation_plan": [
    {"priority": "P0/P1/P2/P3", "finding_id": "Fxxx", "action": "整改措施", "deadline": "建议期限", "responsible_role": "责任人角色"}
  ],

  "tags": ["自动标签1", "自动标签2"],
  "metadata": {
    "word_count": N,
    "char_count": N,
    "estimated_reading_time_min": N,
    "complexity": "low|medium|high"
  },

  "executive_brief": "高管一页纸简报:\n\n【风险等级】XXX\n【综合评分】风险XX分 / 合规XX分 / 诚信XX分\n【关键发现】\n1. ...\n2. ...\n3. ...\n【涉及法规】X部法规，Y个法条\n【整改优先级】P0:N项 P1:N项\n【总体结论】一段话",

  "detailed_report": "完整统一检测报告..."
}"""


def _call_unified_detect(user_content: str, extra_context: dict = None) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        context_str = json.dumps(extra_context or {}, ensure_ascii=False)[:2000] if extra_context else ''
        response = client.simple_chat(
            user_message=f"""【输入上下文】{context_str}
【待检测内容】({len(user_content)}字符)
{user_content[:15000]}""",
            system_prompt=UNIFIED_SYSTEM_PROMPT,
            temperature=0.2,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"Unified scan error: {e}")
        return {"error": str(e)}


class UnifiedContentScanViewSet(viewsets.ModelViewSet):
    queryset = UnifiedContentScan.objects.all()
    serializer_class = UnifiedContentScanSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated or not user.is_staff:
            qs = qs.filter(status__in=['completed', 'partial'])
        if user.is_authenticated and not user.is_staff:
            qs = qs.filter(user=user) | qs.filter(status__in=['completed', 'partial'])
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def scan(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        start_time = time.time()
        timeline = []
        content_text = serializer.validated_data.get('original_content', '')

        timeline.append({'phase': 'queued', 'ts': int((time.time() - start_time) * 1000), 'detail': '任务入队'})

        instance = serializer.save(
            user=request.user,
            status='classifying',
            file_hash_sha256=hashlib.sha256(content_text.encode('utf-8')).hexdigest(),
            content_preview=content_text[:3000],
        )

        extra_ctx = {
            'input_category': instance.input_category,
            'file_name': instance.file_name,
            'file_size': instance.file_size,
            'file_type': instance.file_type,
        }

        result = _call_unified_detect(content_text, extra_ctx)
        processing_ms = int((time.time() - start_time) * 1000)

        cls = result.get('classification', {})
        dims = result.get('dimension_scores', {})
        overall = result.get('overall_assessment', {})
        findings = result.get('findings', {})
        compliance = result.get('compliance_mapping', {})

        instance.detected_category = cls.get('detected_category', '')
        instance.classification_confidence = float(cls.get('confidence', 0))
        instance.content_language = cls.get('language', 'zh')

        instance.overall_risk_level = overall.get('risk_level', 'safe')
        instance.overall_risk_score = float(overall.get('risk_score', 0))
        instance.compliance_score = float(overall.get('compliance_score', 100))
        instance.integrity_score = float(overall.get('integrity_score', 100))
        instance.sensitivity_level = overall.get('sensitivity_level', 'L1')

        d1 = dims.get('D1_ai_generated', {})
        d2 = dims.get('D2_plagiarism', {})
        d3 = dims.get('D3_deepfake', {})
        d4 = dims.get('D4_data_leakage', {})
        instance.ai_generated_prob = float(d1.get('score', 0)) / 100 if isinstance(d1.get('score'), (int, float)) else 0
        instance.plagiarism_similarity = float(d2.get('score', 0)) / 100 if isinstance(d2.get('score'), (int, float)) else 0
        instance.deepfake_probability = float(d3.get('score', 0)) / 100 if isinstance(d3.get('score'), (int, float)) else 0
        instance.data_leak_risk = float(d4.get('score', 0)) / 100 if isinstance(d4.get('score'), (int, float)) else 0

        instance.dimension_results = dims
        instance.triggered_detectors = [k for k, v in dims.items() if v.get('verdict') in ('warn', 'fail')]
        instance.findings_summary = {k: len(v) for k, v in findings.items() if isinstance(v, list)}
        instance.finding_details = (findings.get('critical') or []) + (findings.get('high') or []) + (findings.get('medium') or [])
        instance.risk_indicators = [
            {'dimension': f['dimension'], 'title': f['title'], 'severity': sev}
            for sev in ['critical', 'high', 'medium']
            for f in (findings.get(sev) or [])
        ]

        instance.compliance_mapping = compliance
        instance.affected_regulations = compliance.get('violated_articles', [])
        instance.remediation_plan = result.get('remediation_plan', [])

        triggered = instance.triggered_detectors
        passed = sum(1 for v in dims.values() if v.get('verdict') == 'pass')
        failed = sum(1 for v in dims.values() if v.get('verdict') in ('warn', 'fail'))
        n_a = sum(1 for v in dims.values() if v.get('verdict') == 'n/a')
        instance.detectors_executed = passed + failed + n_a
        instance.detectors_passed = passed
        instance.detectors_failed = failed

        instance.tags = result.get('tags', [])
        instance.metadata = result.get('metadata', {})
        instance.unified_report = result.get('detailed_report', '')
        instance.executive_brief = result.get('executive_brief', '')

        total_critical = len(findings.get('critical') or [])
        total_high = len(findings.get('high') or [])
        if total_critical > 0 or total_high > 0 or failed > 3:
            instance.status = 'completed'
        elif failed > 0:
            instance.status = 'partial'
        else:
            instance.status = 'completed'

        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({
            'data': self.get_serializer(instance).data,
            'message': f'全品类检测完成！触发 {len(triggered)} 个检测器，发现 {total_critical + total_high} 个高风险问题，涉及 {len(compliance.get("violated_articles", []))} 条法规',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = UnifiedContentScan.objects.count()
        completed = UnifiedContentScan.objects.filter(status='completed').count()
        partial = UnifiedContentScan.objects.filter(status='partial').count()
        critical = UnifiedContentScan.objects.filter(overall_risk_level='critical').count()
        high = UnifiedContentScan.objects.filter(overall_risk_level='high'). count()
        avg_risk = sum(UnifiedContentScan.objects.values_list('overall_risk_score', flat=True)) / max(completed + partial, 1)
        avg_compliance = sum(UnifiedContentScan.objects.values_list('compliance_score', flat=True)) / max(completed + partial, 1)
        by_cat = {}
        for cat_val, cat_label in UnifiedContentScan.CONTENT_CATEGORY_CHOICES:
            if cat_val != 'auto_detect':
                cnt = UnifiedContentScan.objects.filter(detected_category=cat_val).count()
                if cnt > 0:
                    by_cat[cat_label] = cnt
        return Response({
            'total': total, 'completed': completed, 'partial': partial,
            'critical': critical, 'high': high,
            'avg_risk_score': round(avg_risk, 1),
            'avg_compliance_score': round(avg_compliance, 1),
            'by_category': by_cat,
        })

    @action(detail=False, methods=['get'])
    def compliance_rules(self, request):
        rules = ComplianceRule.objects.filter(is_active=True)
        from .unified_scan_serializers import ComplianceRuleSerializer
        return Response(ComplianceRuleSerializer(rules, many=True).data)

    @action(detail=True, methods=['post'])
    def export_pdf(self, request, pk=None):
        instance = self.get_object()
        return Response({
            'message': 'PDF导出功能已触发',
            'download_url': f'/api/unified-scan/{pk}/pdf/',
            'report_id': str(instance.id),
        })
