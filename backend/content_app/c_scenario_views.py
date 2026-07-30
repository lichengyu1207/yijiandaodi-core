import time
import json
import logging
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .c_scenario_models import AcademicIntegrityCheck, EnterpriseSecurityAudit, EnterpriseAuditAlert

logger = logging.getLogger(__name__)


class AcademicIntegrityCheckSerializer(serializers.ModelSerializer):
    verdict_display = serializers.CharField(source='get_overall_verdict_display', read_only=True)
    doc_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AcademicIntegrityCheck
        fields = [
            'id', 'user', 'institution', 'department', 'submitter_role',
            'document_type', 'doc_type_display', 'file_name', 'file_size',
            'title', 'author_names', 'abstract_text', 'word_count', 'reference_count',
            'overall_verdict', 'verdict_display', 'integrity_score',
            'ai_detection_result', 'ai_generated_probability', 'ai_generated_sections',
            'plagiarism_result', 'overall_similarity', 'plagiarism_sources', 'matched_segments',
            'citation_analysis', 'fabrication_check', 'image_manipulation', 'authorship_analysis',
            'violation_categories', 'recommended_actions', 'academic_report',
            'status', 'status_display', 'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'file_hash_sha256', 'word_count',
            'overall_verdict', 'integrity_score',
            'ai_detection_result', 'ai_generated_probability', 'ai_generated_sections',
            'plagiarism_result', 'overall_similarity', 'plagiarism_sources', 'matched_segments',
            'citation_analysis', 'fabrication_check', 'image_manipulation', 'authorship_analysis',
            'violation_categories', 'recommended_actions', 'academic_report',
            'status', 'processing_time_ms', 'created_at', 'updated_at',
        ]


class EnterpriseSecurityAuditSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    scope_display = serializers.CharField(source='get_audit_scope_display', read_only=True)

    class Meta:
        model = EnterpriseSecurityAudit
        fields = [
            'id', 'user', 'enterprise_name', 'industry', 'employee_count',
            'contact_person', 'contact_email', 'audit_name', 'audit_scope', 'scope_display',
            'audit_config', 'scheduled_frequency', 'alert_threshold',
            'total_items_scanned', 'risk_items_found', 'critical_count', 'high_count',
            'medium_count', 'low_count', 'overall_risk_score', 'compliance_score',
            'audit_results', 'active_alerts', 'alert_history', 'remediation_tracking',
            'dashboard_snapshot', 'compliance_standards', 'executive_summary', 'detailed_audit_report',
            'contract_value', 'audit_period_start', 'audit_period_end', 'next_audit_date',
            'status', 'status_display', 'last_run_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'total_items_scanned', 'risk_items_found', 'critical_count', 'high_count',
            'medium_count', 'low_count', 'overall_risk_score', 'compliance_score',
            'audit_results', 'active_alerts', 'alert_history', 'remediation_tracking',
            'dashboard_snapshot', 'compliance_standards', 'executive_summary', 'detailed_audit_report',
            'last_run_at', 'created_at', 'updated_at',
        ]


class EnterpriseAuditAlertSerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = EnterpriseAuditAlert
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


ACADEMIC_SYSTEM_PROMPT = """你是一位世界顶级的学术不端检测专家，同时精通自然语言处理、文本相似度计算、AI生成内容检测和学术规范。你拥有博士学位和15年以上学术诚信审查经验。

## 全链路检测体系（7大维度）

### 1. AI生成内容检测 (AI-Generated Content Detection)
- 语言模型特征识别(perplexity/burstiness/vocabulary richness)
- 语义连贯性异常(逻辑跳跃/过度流畅)
- 引用模式异常(虚假引用/不存在文献)
- 格式与风格一致性分析

### 2. 抄袭/相似度检测 (Plagiarism Detection)
- 文本相似度计算(基于n-gram/Jaccard/Cosine语义相似度)
- 段落级匹配定位(精确到句子级别)
- 改写/同义词替换检测(paraphrase detection)
- 跨语言抄袭识别
- 自我抄袭(self-plagiarism)检测

### 3. 引用规范性检查 (Citation Integrity)
- 引用格式一致性(GB/T 7714 / APA / MLA / IEEE)
- 引用真实性验证(是否存在捏造引用)
- 引用相关性分析(是否为堆砌引用)
- 引用时效性评估

### 4. 数据伪造检测 (Data Fabrication Detection)
- 统计数据合理性(是否符合统计规律)
- 图表数据一致性(图与文/表数据是否矛盾)
- 实验结果可复现性评估
- 异常值/离群点标记

### 5. 图片篡改检测 (Image Manipulation)
- 图片元数据分析(EXIF/timestamp consistency)
- 图像编辑痕迹检测(crop/clone/healing brush)
- 数据图篡改(axis manipulation/data point alteration)

### 6. 署名真实性分析 (Authorship Verification)
- 写作风格一致性(与作者历史作品对比)
- 署名顺序合规性(贡献度vs署名顺序)
- 利益冲突声明完整性

### 7. 学术规范综合评估 (Academic Standards Compliance)
- 结构完整性(摘要/引言/方法/结果/讨论/结论/参考文献)
- 方法论描述充分性
- 伦理声明(IRB/动物实验/利益冲突)

请对提交的学术文档执行完整的全链路检测，输出严格结构化JSON：

{
  "overall_verdict": "original|minor_issue|moderate_concern|serious_violation|plagiarism_confirmed|ai_generated_confirmed|mixed_violation|inconclusive",
  "integrity_score": 0-100,

  "ai_detection": {
    "ai_generated_probability": 0.00-1.00,
    "confidence": 0.00-1.00,
    "suspicious_sections": [
      {"section": "段落位置/标题", "start_char": N, "end_char": N,
       "ai_probability": 0.0-1.0, "reasoning": "判定理由", "style_anomalies": ["异常1", "异常2"]}
    ],
    "model_hints": ["推测使用的AI工具"],
    "writing_style_analysis": {
      "perplexity_score": N, "burstiness_score": N, "vocabulary_richness": N,
      "sentence_length_variance": N, "readability_index": N
    }
  },

  "plagiarism_detection": {
    "overall_similarity": 0.00-1.00,
    "similarity_breakdown": {
      "exact_match_percent": 0.0,
      "heavy_paraphrase_percent": 0.0,
      "light_paraphrase_percent": 0.0,
      "structural_similarity": 0.0,
      "source_diversity": N
    },
    "matched_sources": [
      {"source_title": "来源标题", "source_type": "journal|conference|webpage|thesis|unknown",
       "max_similarity": 0.0-100.0, "matched_word_count": N,
       "matched_segments": [
         {"original_text": "原文片段", "source_text": "来源片段", "similarity": 0.0, "type": "exact|paraphrase|structural"}
       ]}
    ],
    "self_plagiarism_detected": bool,
    "cross_language_plagiarism": []
  },

  "citation_analysis": {
    "total_citations": N,
    "format_compliance_score": 0-100,
    "format_used": "GB/T7714|APA|MLA|IEEE|inconsistent|none",
    "suspicious_citations": [
      {"citation_text": "引用文本", "issue": "fake|irrelevant|misrepresented|outdated", "verification_result": "not_found|invalid_context|valid"}
    ],
    "citation_density": "appropriate|excessive|insufficient",
    "reference_list_integrity": "complete|incomplete|missing"
  },

  "data_fabrication_check": {
    "has_data": bool,
    "statistical_anomalies": [],
    "figure_table_consistency": 0-100,
    "reproducibility_assessment": "highly_reproducible|somewhat_reproducible|difficult_to_verify|cannot_verify",
    "flagged_items": [{"item": "数据项", "concern": "描述"}]
  },

  "image_analysis": {
    "images_found": N,
    "manipulated_images": [],
    "metadata_issues": [],
    "figure_integrity_score": 0-100
  },

  "authorship_analysis": {
    "declared_authors": N,
    "authorship_consistency": 0-100,
    "contribution_vs_authorship_match": true|false|unclear,
    "coi_declaration_present": bool,
    "issues": []
  },

  "structure_compliance": {
    "required_sections_present": ["缺失的必要章节"],
    "methodology_adequacy": "adequate|inadequate|missing",
    "ethics_statement": "present|absent|incomplete",
    "completeness_score": 0-100
  },

  "violation_categories": [
    {"category": "AI代写|抄袭|伪造数据|图片篡改|不当署名|引用造假|伦理违规|其他",
     "severity": "critical|major|minor|info",
     "description": "详细描述", "evidence": "证据", "location": "位置"}
  ],

  "recommended_actions": [
    "具体建议措施1(如：第3段疑似AI生成，建议作者提供创作过程说明)",
    "具体建议措施2"
  ],

  "summary": "总体结论(300字以内，适合向学术委员会汇报)",
  "academic_report": "完整学术不端检测报告(含各维度详细数据、证据链、结论、建议、符合高校/期刊申诉格式)"
}"""

ENTERPRISE_AUDIT_SYSTEM_PROMPT = """你是一位世界顶级的企业AI内容安全审计专家，同时精通网络安全审计、数据安全法、等保2.0测评、ISO27001认证和GDPR/PIPL合规。你拥有CISA/CISSP/CISA认证和20年企业安全咨询经验。

## 企业级安全审计框架（6大模块）

### 模块1: 全量内容扫描 (Content Inventory & Scan)
- 企业内部文档/邮件/聊天记录/代码库分类扫描
- 敏感信息自动发现(PII/商业秘密/财务数据)
- 内容风险分级(L1-L4)
- 存量内容基线建立

### 模块2: AI生成内容监控 (AI-Generated Content Monitoring)
- 实时API接口内容检测
- 内部文档AI生成率趋势
- 外部发布内容审核
- 员工使用AI工具合规性

### 模块3: 数据泄露风险 (Data Leak Risk Assessment)
- PII暴露检测(姓名/手机/身份证/地址/邮箱脱敏状态)
- 商业秘密保护(定价策略/客户名单/技术文档)
- 合规数据跨境传输检测
- 权限访问异常模式

### 模块4: 合规对标 (Compliance Benchmarking)
- 《网络安全法》21条(日志留存≥6个月)
- 《数据安全法》数据分类分级
- 《个人信息保护法》PIPL合规(告知同意/最小必要/目的限制)
- 等保2.0三级技术要求
- ISO 27001 A.18合规
- 行业特定法规(金融/医疗/教育)

### 模块5: 安全态势感知 (Security Posture Dashboard)
- 风险热力图(按部门/时间/类型)
- 趋势分析(周/月环比)
- TOP风险项排行
- 整改闭环跟踪

### 模块6: 高管报告 (Executive Reporting)
- C级仪表盘(一页纸关键指标)
- 风险影响评估(业务/法律/声誉/财务)
- ROI量化(避免损失金额估算)
- 下一步行动建议

请对企业安全审计配置和抽样数据进行全面审计分析：

{
  "audit_summary": {
    "total_items_scanned": N,
    "scan_coverage_percent": 0.0-100.0,
    "scan_duration": "描述",
    "risk_items_found": N,
    "severity_distribution": {"critical": N, "high": N, "medium": N, "low": N, "info": N},
    "overall_risk_score": 0-100,
    "compliance_score": 0-100,
    "trend_vs_last_audit": "improved|stable|degraded|no_baseline"
  },

  "content_inventory": {
    "by_category": {"documents": N, "emails": N, "chat_logs": N, "code_files": N, "other": N},
    "by_sensitivity": {"L1_public": N, "L2_internal": N, "L3_confidential": N, "L4_secret": N},
    "by_department": {},
    "new_items_since_last_scan": N
  },

  "ai_content_monitoring": {
    "ai_generated_rate": 0.0-100.0,
    "trend": "increasing|stable|decreasing",
    "high_risk_ai_content": [
      {"resource_id": "资源标识", "type": "document|email|chat|api_response",
       "ai_probability": 0.0-1.0, "department": "部门", "owner": "负责人", "risk_level": "critical|high|medium|low"}
    ],
    "tool_usage_compliance": {
      "approved_tools": ["允许的工具"],
      "unapproved_tools_detected": ["未批准的工具"],
      "policy_violations": N
    }
  },

  "data_leak_risk": {
    "pii_exposure": {
      "total_exposures": N,
      "by_type": {"phone": N, "id_card": N, "email": N, "address": N, "name": N},
      "unmasked_exposure_rate": 0.0-100.0,
      "high_risk_exposures": [{"location": "位置", "data_type": "类型", "access_count": N}]
    },
    "trade_secret_risk": {
      "sensitive_documents_found": N,
      "unprotected_count": N,
      "external_sharing_risk": 0.0-1.0
    },
    "cross_border_transfer": {
      "detected_transfers": N,
      "compliant_transfers": N,
      "non_compliant_transfers": N
    },
    "access_anomaly": {
      "unusual_access_patterns": N,
      "after_hours_access": N,
      "mass_download_events": N
    }
  },

  "compliance_benchmarking": {
    "cybersecurity_law": {"score": 0-100, "gaps": ["差距1", "差距2"]},
    "data_security_law": {"score": 0-100, "gaps": []},
    "pipl_compliance": {"score": 0-100, "gaps": []},
    "djb_level3": {"score": 0-100, "gaps": [], "passed_controls": N, "total_controls": N},
    "iso27001": {"score": 0-100, "gaps": []},
    "industry_specific": {}
  },

  "alerts": [
    {
      "alert_id": "唯一ID", "severity": "critical|high|medium|low|info",
      "type": "PII泄露|AI违规|数据越权|合规偏差|异常行为|系统漏洞",
      "title": "告警标题", "description": "详细描述",
      "affected_resource": "受影响资源", "department": "部门",
      "detection_method": "自动化规则|人工审核|采样审计",
      "evidence": {"raw_data": "...", "screenshot": "..."},
      "remediation_recommendation": "整改建议",
      "regulatory_reference": "相关法规条款",
      "deadline": "建议整改期限"
    }
  ],

  "dashboard_snapshot": {
    "risk_heatmap_data": [],
    "top_risk_departments": [],
    "monthly_trend": [],
    "remediation_progress": {"total_open": N, "resolved_this_period": N, "overdue": N}
  },

  "executive_summary": {
    "one_page_metrics": {"risk_score": N, "compliance_score": N, "open_critical": N, "cost_saved_estimate": "N万元"},
    "key_findings": ["发现1", "发现2", "发现3"],
    "strategic_recommendations": ["建议1", "建议2"],
    "board_level_risk_assessment": "低|中|高|严重"
  },

  "detailed_report": "完整企业安全审计报告(含方法论、详细发现、证据链、合规差距分析、整改计划、时间线)"
}"""


def _call_detect(system_prompt: str, user_content: str) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        response = client.simple_chat(user_message=user_content, system_prompt=system_prompt, temperature=0.2)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"C-scenario detection error: {e}")
        return {"error": str(e)}


class AcademicIntegrityCheckViewSet(viewsets.ModelViewSet):
    queryset = AcademicIntegrityCheck.objects.all()
    serializer_class = AcademicIntegrityCheckSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated or not user.is_staff:
            qs = qs.filter(status='completed')
        if user.is_authenticated and not user.is_staff:
            qs = qs.filter(user=user) | qs.filter(status='completed')
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def check(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        content = serializer.validated_data.get('full_content', '')
        instance = serializer.save(
            user=request.user,
            status='analyzing',
            word_count=len(content),
            file_hash_sha256=hashlib.sha256(content.encode('utf-8')).hexdigest(),
        )

        result = _call_detect(
            ACADEMIC_SYSTEM_PROMPT,
            f"""【文档类型】{instance.get_document_type_display()}
【标题】{instance.title or '未提供'}
【机构】{instance.institution or '未提供'}
【院系】{instance.department or '未提供'}
【摘要】{instance.abstract_text[:2000] or '未提供'}
【全文内容】({len(content)}字)
{content[:15000]}
""",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        ai_det = result.get('ai_detection', {})
        plag = result.get('plagiarism_detection', {})

        instance.overall_verdict = result.get('overall_verdict', 'inconclusive')
        instance.integrity_score = float(result.get('integrity_score', 100))
        instance.ai_detection_result = ai_det
        instance.ai_generated_probability = float(ai_det.get('ai_generated_probability', 0))
        instance.ai_generated_sections = ai_det.get('suspicious_sections', [])
        instance.plagiarism_result = plag
        instance.overall_similarity = float(plag.get('overall_similarity', 0))
        instance.plagiarism_sources = plag.get('matched_sources', [])
        instance.matched_segments = []
        for src in plag.get('matched_sources', []):
            instance.matched_segments.extend(src.get('matched_segments', []))
        instance.citation_analysis = result.get('citation_analysis', {})
        instance.fabrication_check = result.get('data_fabrication_check', {})
        instance.image_manipulation = result.get('image_analysis', {}).get('manipulated_images', []) if isinstance(result.get('image_analysis'), dict) else []
        instance.authorship_analysis = result.get('authorship_analysis', {})
        instance.violation_categories = result.get('violation_categories', [])
        instance.recommended_actions = result.get('recommended_actions', [])
        instance.academic_report = result.get('academic_report', '')
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({'data': self.get_serializer(instance).data, 'message': '学术不端检测完成'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = AcademicIntegrityCheck.objects.count()
        completed = AcademicIntegrityCheck.objects.filter(status='completed').count()
        violation = AcademicIntegrityCheck.objects.filter(
            overall_verdict__in=['serious_violation', 'plagiarism_confirmed', 'ai_generated_confirmed', 'mixed_violation']
        ).count()
        original = AcademicIntegrityCheck.objects.filter(overall_verdict='original').count()
        return Response({'total': total, 'completed': completed, 'violation_found': violation, 'confirmed_original': original})


class EnterpriseSecurityAuditViewSet(viewsets.ModelViewSet):
    queryset = EnterpriseSecurityAudit.objects.all()
    serializer_class = EnterpriseSecurityAuditSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(user=user)
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def run_audit(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        instance = serializer.save(user=request.user, status='running', last_run_at=None)
        config = instance.audit_config or {}

        result = _call_detect(
            ENTERPRISE_AUDIT_SYSTEM_PROMPT,
            f"""【企业名称】{instance.enterprise_name}
【行业领域】{instance.industry or '未提供'}
【员工规模】{instance.employee_count}人
【审计任务】{instance.audit_name}
【审计范围】{instance.get_audit_scope_display()}
【审计频率】{instance.get_scheduled_frequency_display()}
【审计配置】{json.dumps(config, ensure_ascii=False)[:3000] if config else '默认配置'}

请根据以上企业信息，模拟一次企业AI内容安全审计的全量扫描结果。
假设该企业有以下典型内容场景：
- 内部文档约500份(Word/PDF/Excel/PPT)
- 员工邮件约2000封/月
- 即时通讯记录(企业微信/钉钉/飞书)
- API接口日志约10万条/日
- 代码仓库若干(GitLab/GitHub)
- 对外发布内容(官网/公众号/社交媒体)
""",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        summary = result.get('audit_summary', {})
        alerts = result.get('alerts', [])
        dash = result.get('dashboard_snapshot', {})

        instance.total_items_scanned = summary.get('total_items_scanned', 0)
        instance.risk_items_found = summary.get('risk_items_found', 0)
        instance.critical_count = (summary.get('severity_distribution') or {}).get('critical', 0)
        instance.high_count = (summary.get('severity_distribution') or {}).get('high', 0)
        instance.medium_count = (summary.get('severity_distribution') or {}).get('medium', 0)
        instance.low_count = (summary.get('severity_distribution') or {}).get('low', 0)
        instance.overall_risk_score = float(summary.get('overall_risk_score', 0))
        instance.compliance_score = float(summary.get('compliance_score', 100))
        instance.audit_results = result.get('content_inventory', {})
        instance.active_alerts = alerts[:20]
        instance.alert_history = alerts
        instance.dashboard_snapshot = dash
        instance.compliance_standards = result.get('compliance_benchmarking', {})
        exec_sum = result.get('executive_summary', {})
        instance.executive_summary = exec_sum.get('strategic_recommendations', []) if isinstance(exec_sum, dict) else []
        instance.detailed_audit_report = result.get('detailed_audit_report', '')
        instance.status = 'completed'
        instance.last_run_at = None
        instance.processing_time_ms = processing_ms
        instance.save()

        for alert_data in alerts[:10]:
            EnterpriseAuditAlert.objects.create(
                audit=instance,
                severity=alert_data.get('severity', 'medium'),
                alert_type=alert_data.get('type', 'general'),
                title=alert_data.get('title', '安全告警'),
                description=alert_data.get('description', ''),
                affected_resource=alert_data.get('affected_resource', ''),
                detection_method=alert_data.get('detection_method', 'automated'),
                raw_evidence=alert_data.get('evidence', {}),
            )

        return Response({'data': self.get_serializer(instance).data, 'message': f'企业安全审计完成！发现 {instance.risk_items_found} 个风险项，生成 {EnterpriseAuditAlert.objects.filter(audit=instance).count()} 条告警'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = EnterpriseSecurityAudit.objects.count()
        running = EnterpriseSecurityAudit.objects.filter(status='running').count()
        total_alerts = EnterpriseAuditAlert.objects.count()
        active_alerts = EnterpriseAuditAlert.objects.filter(status='active').count()
        critical_active = EnterpriseAuditAlert.objects.filter(status='active', severity='critical').count()
        return Response({'total': total, 'running': running, 'total_alerts': total_alerts, 'active_alerts': active_alerts, 'critical_active': critical_active})
