import time
import json
import logging
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .b_scenario_models import (
    BScenarioMedicalReport, BScenarioLegalDocument,
    BScenarioFinancialStatement, BScenarioDesignDraft,
)

logger = logging.getLogger(__name__)


class BScenarioMedicalReportSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BScenarioMedicalReport
        fields = [
            'id', 'user', 'report_type', 'report_type_display',
            'file_name', 'file_size', 'original_text',
            'ai_generated_prob', 'medical_error_score', 'risk_level', 'risk_level_display',
            'status', 'status_display',
            'detection_result', 'medical_issues', 'ai_indicators', 'professional_report',
            'patient_id_masked', 'institution', 'department', 'report_date',
            'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'ai_generated_prob', 'medical_error_score',
            'risk_level', 'status', 'detection_result', 'medical_issues',
            'ai_indicators', 'professional_report', 'processing_time_ms',
            'created_at', 'updated_at',
        ]


class BScenarioLegalDocumentSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BScenarioLegalDocument
        fields = [
            'id', 'user', 'doc_type', 'doc_type_display',
            'file_name', 'file_size', 'original_text',
            'ai_generated_prob', 'legal_risk_score', 'risk_level', 'risk_level_display',
            'status', 'status_display',
            'detection_result', 'legal_risks', 'compliance_issues', 'ai_indicators', 'professional_report',
            'parties_involved', 'jurisdiction', 'effective_date', 'doc_amount',
            'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'ai_generated_prob', 'legal_risk_score',
            'risk_level', 'status', 'detection_result', 'legal_risks',
            'compliance_issues', 'ai_indicators', 'professional_report',
            'processing_time_ms', 'created_at', 'updated_at',
        ]


class BScenarioFinancialStatementSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    statement_type_display = serializers.CharField(source='get_statement_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BScenarioFinancialStatement
        fields = [
            'id', 'user', 'statement_type', 'statement_type_display',
            'file_name', 'file_size', 'original_text',
            'ai_generated_prob', 'fraud_risk_score', 'risk_level', 'risk_level_display',
            'status', 'status_display',
            'detection_result', 'fraud_indicators', 'anomaly_items', 'ai_indicators', 'professional_report',
            'company_name_masked', 'reporting_period', 'total_assets', 'total_revenue', 'audit_firm',
            'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'ai_generated_prob', 'fraud_risk_score',
            'risk_level', 'status', 'detection_result', 'fraud_indicators',
            'anomaly_items', 'ai_indicators', 'professional_report',
            'processing_time_ms', 'created_at', 'updated_at',
        ]


class BScenarioDesignDraftSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    design_type_display = serializers.CharField(source='get_design_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BScenarioDesignDraft
        fields = [
            'id', 'user', 'design_type', 'design_type_display',
            'file_name', 'file_size', 'original_text', 'image_preview_url',
            'ai_generated_prob', 'plagiarism_score', 'originality_score', 'risk_level', 'risk_level_display',
            'status', 'status_display',
            'detection_result', 'plagiarism_sources', 'ai_style_markers', 'ai_indicators', 'professional_report',
            'designer_alias', 'design_tool', 'color_palette', 'dimensions',
            'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'ai_generated_prob', 'plagiarism_score',
            'originality_score', 'risk_level', 'status', 'detection_result',
            'plagiarism_sources', 'ai_style_markers', 'ai_indicators',
            'professional_report', 'processing_time_ms', 'created_at', 'updated_at',
        ]


MEDICAL_SYSTEM_PROMPT = """你是一位拥有20年经验的资深医疗文档鉴别专家，同时精通AI生成内容检测技术。
你的任务是分析用户提交的医疗报告/文书，完成以下检测：

1. **AI生成检测**：判断该医疗报告是否由AI生成或AI辅助生成，分析语言模式、术语使用、数据一致性等
2. **医疗错误识别**：检查报告中的医学错误，包括但不限于：
   - 诊断与症状不匹配
   - 药物剂量/用法错误
   - 检验指标异常但未标注
   - 医学术语误用
   - 逻辑矛盾（如正常结论但异常数据）
3. **格式规范性**：检查是否符合标准医疗文书格式要求

请以JSON格式返回结果，严格遵循以下结构：
{
  "ai_generated_probability": 0.0-1.0,
  "ai_indicators": {"pattern_consistency": "描述", "terminology_usage": "描述", "data_coherence": "描述"},
  "medical_error_score": 0-100,
  "risk_level": "high|medium|low|safe",
  "medical_issues": [{"category": "类别", "severity": "high|medium|low", "description": "详细描述", "location": "位置"}],
  "summary": "总体鉴别结论（200字以内）",
  "professional_report": "专业鉴别报告（结构化，包含执行摘要、详细分析、建议措施）"
}"""

LEGAL_SYSTEM_PROMPT = """你是一位资深法律文书鉴别专家，同时精通AI生成内容检测技术。
你的任务是分析用户提交的法律文书，完成以下检测：

1. **AI生成检测**：判断该法律文书是否由AI生成或AI辅助生成
2. **法律风险识别**：
   - 条款合法性风险（违反强制性法律规定）
   - 权利义务不对等风险
   - 争议解决条款缺陷
   - 知识产权条款漏洞
   - 数据合规问题（个人信息保护法等）
   - 格式和效力瑕疵
3. **合规性审查**：对照《民法典》《公司法》《劳动合同法》等核心法规

请以JSON格式返回结果：
{
  "ai_generated_probability": 0.0-1.0,
  "ai_indicators": {"legal_reasoning": "描述", "citation_pattern": "描述", "language_style": "描述"},
  "legal_risk_score": 0-100,
  "risk_level": "high|medium|low|safe",
  "legal_risks": [{"category": "类别", "severity": "high|medium|low", "description": "详细描述", "article_ref": "相关法条"}],
  "compliance_issues": [{"standard": "合规标准", "description": "问题描述", "suggestion": "修改建议"}],
  "summary": "总体鉴别结论（200字以内）",
  "professional_report": "专业鉴别报告"
}"""

FINANCIAL_SYSTEM_PROMPT = """你是一位拥有CPA资质和15年审计经验的财务专家，同时精通AI生成内容和财务造假检测技术。
你的任务是分析用户提交的财务报表/文件，完成以下检测：

1. **AI生成检测**：判断该财务报表是否由AI生成
2. **财务造假识别**（基于Beneish M-Score、Altman Z-Score等模型思路）：
   - 应收账款异常（增长率远超营收）
   - 存货异常变动
   - 资产质量恶化信号
   - 利润率异常波动
   - 现金流与利润不匹配
   - 关联交易异常
   - 会计政策变更操纵
3. **数据一致性检验**：报表勾稽关系验证

请以JSON格式返回结果：
{
  "ai_generated_probability": 0.0-1.0,
  "ai_indicators": {"number_patterns": "描述", "narrative_style": "描述", "structure_analysis": "描述"},
  "fraud_risk_score": 0-100,
  "risk_level": "high|medium|low|safe",
  "fraud_indicators": [{"indicator": "指标名称", "value": "数值", "threshold": "阈值", "risk_level": "high|medium|low", "description": "说明"}],
  "anomaly_items": [{"item": "项目", "observed_value": "观测值", "expected_range": "预期范围", "deviation": "偏离度%", "explanation": "解释"}],
  "summary": "总体鉴别结论（200字以内）",
  "professional_report": "专业审计报告"
}"""

DESIGN_SYSTEM_PROMPT = """你是一位资深设计作品鉴别专家，精通AI图像生成检测技术和设计版权鉴定。
你的任务是分析用户提交的设计稿，完成以下检测：

1. **AI生成检测**：判断该设计稿是否由AI工具（Midjourney/Stable Diffusion/DALL-E等）生成
2. **抄袭/原创性检测**：
   - 与已知设计作品的相似度分析
   - 常见AI生成模式的特征识别
   - 设计元素的原创性评估
3. **风格特征分析**：
   - AI典型伪影（手指数量错误、文字乱码、不对称细节）
   - 构图规律性（AI倾向于过度对称）
   - 色彩分布统计特征
   - 细节一致性检验

请以JSON格式返回结果：
{
  "ai_generated_probability": 0.0-1.0,
  "ai_indicators": {"artifact_detection": "描述", "composition_analysis": "描述", "detail_consistency": "描述", "color_distribution": "描述"},
  "plagiarism_similarity": 0.0-100.0,
  "originality_score": 0-100,
  "risk_level": "high|medium|low|safe",
  "plagiarism_sources": [{"source": "疑似来源", "similarity": "相似度%", "matched_elements": "匹配元素"}],
  "ai_style_markers": [{"marker": "特征名称", "confidence": "置信度%", "description": "描述"}],
  "summary": "总体鉴别结论（200字以内）",
  "professional_report": "原创度分析报告"
}"""


def _call_deepseek_detect(system_prompt: str, user_content: str) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        response = client.simple_chat(
            user_message=user_content,
            system_prompt=system_prompt,
            temperature=0.3,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"DeepSeek detection error: {e}")
        return {"error": str(e)}


class BScenarioMedicalReportViewSet(viewsets.ModelViewSet):
    queryset = BScenarioMedicalReport.objects.all()
    serializer_class = BScenarioMedicalReportSerializer
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
    def detect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        start_time = time.time()

        instance = serializer.save(
            user=request.user,
            status='processing',
        )

        result = _call_deepseek_detect(
            MEDICAL_SYSTEM_PROMPT,
            f"【医疗报告类型】{instance.get_report_type_display()}\n【文件名】{instance.file_name}\n【原始内容】\n{instance.original_text[:8000]}",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        instance.ai_generated_prob = float(result.get('ai_generated_probability', 0))
        instance.medical_error_score = float(result.get('medical_error_score', 0))
        instance.risk_level = result.get('risk_level', 'safe')
        instance.detection_result = result
        instance.medical_issues = result.get('medical_issues', [])
        instance.ai_indicators = result.get('ai_indicators', {})
        instance.professional_report = result.get('professional_report', '')
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({
            'data': self.get_serializer(instance).data,
            'message': '医疗报告鉴别完成',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = BScenarioMedicalReport.objects.count()
        completed = BScenarioMedicalReport.objects.filter(status='completed').count()
        high_risk = BScenarioMedicalReport.objects.filter(risk_level='high').count()
        return Response({
            'total': total, 'completed': completed, 'high_risk': high_risk,
            'avg_ai_prob': sum(BScenarioMedicalReport.objects.values_list('ai_generated_prob', flat=True)) / max(completed, 1),
        })


class BScenarioLegalDocumentViewSet(viewsets.ModelViewSet):
    queryset = BScenarioLegalDocument.objects.all()
    serializer_class = BScenarioLegalDocumentSerializer
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
    def detect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        instance = serializer.save(user=request.user, status='processing')

        result = _call_deepseek_detect(
            LEGAL_SYSTEM_PROMPT,
            f"【文书类型】{instance.get_doc_type_display()}\n【文件名】{instance.file_name}\n【原始内容】\n{instance.original_text[:8000]}",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        instance.ai_generated_prob = float(result.get('ai_generated_probability', 0))
        instance.legal_risk_score = float(result.get('legal_risk_score', 0))
        instance.risk_level = result.get('risk_level', 'safe')
        instance.detection_result = result
        instance.legal_risks = result.get('legal_risks', [])
        instance.compliance_issues = result.get('compliance_issues', [])
        instance.ai_indicators = result.get('ai_indicators', {})
        instance.professional_report = result.get('professional_report', '')
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({'data': self.get_serializer(instance).data, 'message': '法律文书鉴别完成'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = BScenarioLegalDocument.objects.count()
        completed = BScenarioLegalDocument.objects.filter(status='completed').count()
        high_risk = BScenarioLegalDocument.objects.filter(risk_level='high').count()
        return Response({'total': total, 'completed': completed, 'high_risk': high_risk})


class BScenarioFinancialStatementViewSet(viewsets.ModelViewSet):
    queryset = BScenarioFinancialStatement.objects.all()
    serializer_class = BScenarioFinancialStatementSerializer
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
    def detect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        instance = serializer.save(user=request.user, status='processing')

        result = _call_deepseek_detect(
            FINANCIAL_SYSTEM_PROMPT,
            f"【报表类型】{instance.get_statement_type_display()}\n【文件名】{instance.file_name}\n【企业名称】{instance.company_name_masked or '未提供'}\n【报告期间】{instance.reporting_period or '未提供'}\n【原始内容】\n{instance.original_text[:8000]}",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        instance.ai_generated_prob = float(result.get('ai_generated_probability', 0))
        instance.fraud_risk_score = float(result.get('fraud_risk_score', 0))
        instance.risk_level = result.get('risk_level', 'safe')
        instance.detection_result = result
        instance.fraud_indicators = result.get('fraud_indicators', [])
        instance.anomaly_items = result.get('anomaly_items', [])
        instance.ai_indicators = result.get('ai_indicators', {})
        instance.professional_report = result.get('professional_report', '')
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({'data': self.get_serializer(instance).data, 'message': '财务报表鉴别完成'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = BScenarioFinancialStatement.objects.count()
        completed = BScenarioFinancialStatement.objects.filter(status='completed').count()
        high_risk = BScenarioFinancialStatement.objects.filter(risk_level='high').count()
        return Response({'total': total, 'completed': completed, 'high_risk': high_risk})


class BScenarioDesignDraftViewSet(viewsets.ModelViewSet):
    queryset = BScenarioDesignDraft.objects.all()
    serializer_class = BScenarioDesignDraftSerializer
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
    def detect(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        instance = serializer.save(user=request.user, status='processing')

        design_desc = instance.original_text or f"设计类型: {instance.get_design_type_display()}, 文件: {instance.file_name}"
        result = _call_deepseek_detect(
            DESIGN_SYSTEM_PROMPT,
            f"【设计类型】{instance.get_design_type_display()}\n【文件名】{instance.file_name}\n【设计工具】{instance.design_tool or '未提供'}\n【尺寸规格】{instance.dimensions or '未提供'}\n【设计描述/文本内容】\n{design_desc[:8000]}",
        )

        processing_ms = int((time.time() - start_time) * 1000)
        instance.ai_generated_prob = float(result.get('ai_generated_probability', 0))
        instance.plagiarism_score = float(result.get('plagiarism_similarity', 0))
        instance.originality_score = float(result.get('originality_score', 100))
        instance.risk_level = result.get('risk_level', 'safe')
        instance.detection_result = result
        instance.plagiarism_sources = result.get('plagiarism_sources', [])
        instance.ai_style_markers = result.get('ai_style_markers', [])
        instance.ai_indicators = result.get('ai_indicators', {})
        instance.professional_report = result.get('professional_report', '')
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({'data': self.get_serializer(instance).data, 'message': '设计稿鉴别完成'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = BScenarioDesignDraft.objects.count()
        completed = BScenarioDesignDraft.objects.filter(status='completed').count()
        high_risk = BScenarioDesignDraft.objects.filter(risk_level='high').count()
        avg_originality = sum(BScenarioDesignDraft.objects.values_list('originality_score', flat=True)) / max(completed, 1)
        return Response({'total': total, 'completed': completed, 'high_risk': high_risk, 'avg_originality': round(avg_originality, 1)})
