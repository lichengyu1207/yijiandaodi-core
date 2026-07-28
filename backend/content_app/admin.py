from django.contrib import admin
from .models import Article
from .b_scenario_models import (
    BScenarioMedicalReport, BScenarioLegalDocument,
    BScenarioFinancialStatement, BScenarioDesignDraft,
)
from .tech_models import AIContentProvenance, DeepfakeVideoDetection
from .c_scenario_models import AcademicIntegrityCheck, EnterpriseSecurityAudit, EnterpriseAuditAlert
from .unified_scan_models import UnifiedContentScan, ComplianceRule
from .dual_engine_models import DualEngineScan
from .antifraud_models import DeviceFingerprint, RiskEvent, FraudRule, UserRiskProfile, AntiFraudDashboardSnapshot
from .chapter_detect_models import PaperSubmission, ChapterAnalysis
from .copyscape_models import PlagiarismScan, MatchSource
from .grammarly_models import GrammarCheck, CorrectionSuggestion
from .resume_models import ResumeAnalysis, OptimizationSuggestion
from .tipping_models import CreatorProfile, TipDonation
from auth_app.workflow_models import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, WorkflowTemplate


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'category', 'xinfa_tag', 'zone_id', 'status', 'is_pinned', 'is_recommended', 'read_count', 'like_count', 'published_at')
    list_filter = ('status', 'category', 'xinfa_tag', 'zone_id', 'is_pinned', 'is_recommended', 'published_at')
    search_fields = ('title', 'summary', 'content')
    readonly_fields = ('created_at', 'updated_at', 'read_count', 'like_count', 'comment_count')
    list_editable = ('status', 'is_pinned', 'is_recommended')
    ordering = ('-is_pinned', '-read_count', '-published_at')
    list_per_page = 30
    fieldsets = (
        ('基本信息', {
            'fields': ('title', 'summary', 'content', 'cover_image', 'category', 'author')
        }),
        ('分类标签', {
            'fields': ('xinfa_tag', 'zone_id', 'is_pinned', 'is_recommended')
        }),
        ('互动钩子', {
            'fields': ('hook_line', 'cta_text', 'cta_link')
        }),
        ('状态统计', {
            'fields': ('status', 'read_count', 'like_count', 'comment_count', 'published_at'),
            'classes': ('collapse',)
        }),
        ('时间戳', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(BScenarioMedicalReport)
class BScenarioMedicalReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'report_type', 'risk_level', 'status', 'user', 'institution', 'ai_generated_prob', 'medical_error_score', 'created_at')
    list_filter = ('report_type', 'risk_level', 'status', 'department')
    search_fields = ('file_name', 'institution', 'original_text')
    readonly_fields = ('id', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(BScenarioLegalDocument)
class BScenarioLegalDocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'doc_type', 'risk_level', 'status', 'user', 'jurisdiction', 'ai_generated_prob', 'legal_risk_score', 'created_at')
    list_filter = ('doc_type', 'risk_level', 'status', 'jurisdiction')
    search_fields = ('file_name', 'original_text')
    readonly_fields = ('id', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(BScenarioFinancialStatement)
class BScenarioFinancialStatementAdmin(admin.ModelAdmin):
    list_display = ('id', 'statement_type', 'risk_level', 'status', 'user', 'company_name_masked', 'ai_generated_prob', 'fraud_risk_score', 'created_at')
    list_filter = ('statement_type', 'risk_level', 'status')
    search_fields = ('file_name', 'company_name_masked', 'original_text')
    readonly_fields = ('id', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(BScenarioDesignDraft)
class BScenarioDesignDraftAdmin(admin.ModelAdmin):
    list_display = ('id', 'design_type', 'risk_level', 'status', 'user', 'designer_alias', 'ai_generated_prob', 'plagiarism_score', 'originality_score', 'created_at')
    list_filter = ('design_type', 'risk_level', 'status', 'design_tool')
    search_fields = ('file_name', 'designer_alias')
    readonly_fields = ('id', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(AIContentProvenance)
class AIContentProvenanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'content_type', 'source_confidence', 'status', 'user', 'generation_tool_detected', 'confidence_score', 'watermark_detected', 'created_at')
    list_filter = ('content_type', 'source_confidence', 'status', 'fingerprint_version')
    search_fields = ('file_name', 'generation_tool_detected', 'file_hash_sha256')
    readonly_fields = ('id', 'file_hash_sha256', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(DeepfakeVideoDetection)
class DeepfakeVideoDetectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'video_type', 'overall_verdict', 'risk_level', 'status', 'user', 'deepfake_probability', 'confidence_score', 'frames_analyzed', 'created_at')
    list_filter = ('video_type', 'overall_verdict', 'risk_level', 'status')
    search_fields = ('file_name',)
    readonly_fields = ('id', 'file_hash_sha256', 'processing_time_ms', 'frames_analyzed', 'created_at', 'updated_at')


@admin.register(AcademicIntegrityCheck)
class AcademicIntegrityCheckAdmin(admin.ModelAdmin):
    list_display = ('id', 'document_type', 'overall_verdict', 'status', 'user', 'institution', 'integrity_score', 'ai_generated_probability', 'overall_similarity', 'created_at')
    list_filter = ('document_type', 'overall_verdict', 'status', 'institution')
    search_fields = ('title', 'file_name', 'institution')
    readonly_fields = ('id', 'file_hash_sha256', 'word_count', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(EnterpriseSecurityAudit)
class EnterpriseSecurityAuditAdmin(admin.ModelAdmin):
    list_display = ('id', 'enterprise_name', 'audit_name', 'audit_scope', 'status', 'overall_risk_score', 'compliance_score', 'risk_items_found', 'contract_value', 'created_at')
    list_filter = ('audit_scope', 'status', 'industry', 'scheduled_frequency')
    search_fields = ('enterprise_name', 'audit_name', 'contact_person')
    readonly_fields = ('id', 'total_items_scanned', 'last_run_at', 'created_at', 'updated_at')


@admin.register(EnterpriseAuditAlert)
class EnterpriseAuditAlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'audit', 'severity', 'alert_type', 'title', 'status', 'created_at')
    list_filter = ('severity', 'status', 'alert_type')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at')


@admin.register(UnifiedContentScan)
class UnifiedContentScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'detected_category', 'overall_risk_level', 'status', 'user', 'overall_risk_score', 'compliance_score', 'integrity_score', 'detectors_failed', 'processing_time_ms', 'created_at')
    list_filter = ('overall_risk_level', 'status', 'detected_category', 'input_category', 'sensitivity_level')
    search_fields = ('file_name',)
    readonly_fields = ('id', 'file_hash_sha256', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(ComplianceRule)
class ComplianceRuleAdmin(admin.ModelAdmin):
    list_display = ('rule_code', 'rule_type', 'severity', 'title', 'article_reference', 'is_active', 'created_at')
    list_filter = ('rule_type', 'severity', 'is_active')
    search_fields = ('rule_code', 'title', 'article_reference', 'description')


@admin.register(DualEngineScan)
class DualEngineScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'overall_verdict', 'status', 'user', 'originality_score', 'ai_score', 'plagiarism_score', 'ai_model_detected', 'confidence_level', 'word_count', 'processing_time_ms', 'created_at')
    list_filter = ('overall_verdict', 'status', 'confidence_level', 'ai_model_detected', 'content_language')
    search_fields = ('file_name', 'original_text')
    readonly_fields = ('id', 'file_hash_sha256', 'processing_time_ms', 'ai_engine_time_ms', 'plagiarism_engine_time_ms', 'created_at', 'updated_at')


@admin.register(DeviceFingerprint)
class DeviceFingerprintAdmin(admin.ModelAdmin):
    list_display = ('id', 'fingerprint_hash', 'device_type', 'risk_level', 'risk_score', 'ip_address', 'is_proxy', 'event_count', 'user_count', 'last_seen_at')
    list_filter = ('device_type', 'risk_level', 'os_name', 'is_proxy', 'is_datacenter_ip')
    search_fields = ('fingerprint_hash', 'ip_address', 'browser')
    readonly_fields = ('id', 'fingerprint_hash', 'first_seen_at', 'last_seen_at', 'created_at')


@admin.register(RiskEvent)
class RiskEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'event_type', 'severity', 'action_taken', 'user', 'ip_address', 'risk_score', 'is_blocked', 'created_at')
    list_filter = ('event_type', 'severity', 'action_taken', 'is_blocked')
    search_fields = ('username_attempted', 'email_attempted', 'ip_address', 'block_reason')
    readonly_fields = ('id', 'processing_time_ms', 'created_at')


@admin.register(FraudRule)
class FraudRuleAdmin(admin.ModelAdmin):
    list_display = ('rule_code', 'rule_name', 'category', 'action', 'priority', 'status', 'hit_count', 'block_count', 'last_hit_at')
    list_filter = ('category', 'action', 'status')
    search_fields = ('rule_code', 'rule_name', 'description')
    readonly_fields = ('id', 'hit_count', 'block_count', 'false_positive_count', 'last_hit_at', 'created_at', 'updated_at')


@admin.register(UserRiskProfile)
class UserRiskProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'risk_level', 'overall_risk_score', 'login_risk_score', 'device_risk_score', 'is_frozen', 'requires_mfa', 'blocked_events', 'total_events')
    list_filter = ('risk_level', 'is_frozen', 'requires_mfa')
    search_fields = ('user__username', 'user__email', 'frozen_reason')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(AntiFraudDashboardSnapshot)
class AntiFraudDashboardSnapshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'snapshot_time', 'total_events_24h', 'blocked_events_24h', 'critical_events_24h', 'suspicious_user_count', 'banned_user_count')
    list_filter = ('snapshot_time',)
    readonly_fields = ('id', 'snapshot_time', 'created_at')


@admin.register(PaperSubmission)
class PaperSubmissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'paper_type', 'subject_area', 'overall_verdict', 'overall_integrity_score', 'overall_ai_score', 'chapter_count', 'problematic_sections_count', 'status', 'user', 'created_at')
    list_filter = ('paper_type', 'subject_area', 'overall_verdict', 'status')
    search_fields = ('title', 'author_name', 'institution')
    readonly_fields = ('id', 'file_hash_sha256', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(ChapterAnalysis)
class ChapterAnalysisAdmin(admin.ModelAdmin):
    list_display = ('id', 'submission', 'chapter_order', 'chapter_title', 'chapter_type', 'verdict', 'ai_probability', 'plagiarism_similarity', 'integrity_score')
    list_filter = ('chapter_type', 'verdict')
    search_fields = ('chapter_title',)
    readonly_fields = ('id', 'integrity_score', 'verdict', 'perplexity_score', 'burstiness_score', 'created_at')


@admin.register(PlagiarismScan)
class PlagiarismScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'content_type', 'plagiarism_risk', 'user', 'overall_similarity', 'unique_score', 'match_count', 'exact_matches', 'processing_time_ms', 'created_at')
    list_filter = ('content_type', 'plagiarism_risk')
    search_fields = ('original_text',)
    readonly_fields = ('id', 'text_hash', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(MatchSource)
class MatchSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'scan', 'domain', 'platform_type', 'similarity_percent', 'match_type', 'risk_level', 'is_verified', 'created_at')
    list_filter = ('platform_type', 'match_type', 'risk_level', 'is_verified')
    search_fields = ('source_url', 'source_title', 'domain')
    readonly_fields = ('id', 'created_at')


@admin.register(GrammarCheck)
class GrammarCheckAdmin(admin.ModelAdmin):
    list_display = ('id', 'content_type', 'user', 'overall_score', 'correctness_score', 'clarity_score', 'engagement_score', 'total_issues', 'critical_count', 'processing_time_ms', 'created_at')
    list_filter = ('content_type',)
    search_fields = ('original_text',)
    readonly_fields = ('id', 'text_hash', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(CorrectionSuggestion)
class CorrectionSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'check', 'suggestion_type', 'severity', 'category', 'original_text', 'confidence', 'impact_score', 'is_accepted', 'created_at')
    list_filter = ('suggestion_type', 'severity', 'category', 'is_accepted')
    search_fields = ('original_text', 'corrected_text', 'explanation')
    readonly_fields = ('id', 'created_at')


@admin.register(ResumeAnalysis)
class ResumeAnalysisAdmin(admin.ModelAdmin):
    list_display = ('id', 'target_position', 'target_industry', 'experience_level', 'user', 'overall_score', 'ats_score', 'impact_score', 'total_suggestions', 'processing_time_ms', 'created_at')
    list_filter = ('target_industry', 'experience_level')
    search_fields = ('target_position', 'resume_text')
    readonly_fields = ('id', 'resume_hash', 'processing_time_ms', 'created_at', 'updated_at')


@admin.register(OptimizationSuggestion)
class OptimizationSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'analysis', 'suggestion_category', 'severity', 'affected_section', 'original_text', 'confidence', 'difficulty', 'is_applied', 'created_at')
    list_filter = ('suggestion_category', 'severity', 'affected_section', 'difficulty', 'is_applied')
    search_fields = ('original_text', 'optimized_text', 'explanation')
    readonly_fields = ('id', 'created_at')


@admin.register(CreatorProfile)
class CreatorProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'display_name', 'is_verified', 'tip_enabled', 'total_tips_count', 'total_tips_amount', 'unique_supporters', 'created_at')
    list_filter = ('is_verified', 'tip_enabled')
    search_fields = ('display_name', 'bio', 'user__username')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(TipDonation)
class TipDonationAdmin(admin.ModelAdmin):
    list_display = ('id', 'creator', 'supporter', 'amount', 'status', 'source_page', 'is_anonymous', 'payment_method', 'created_at')
    list_filter = ('status', 'source_page', 'payment_method', 'is_anonymous')
    search_fields = ('message', 'creator_reply', 'transaction_id')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'workflow_type', 'status', 'owner', 'version', 'use_count', 'is_template', 'created_at')
    list_filter = ('workflow_type', 'status', 'is_template')
    search_fields = ('name', 'description')
    readonly_fields = ('id', 'use_count', 'created_at', 'updated_at')


@admin.register(WorkflowNode)
class WorkflowNodeAdmin(admin.ModelAdmin):
    list_display = ('id', 'workflow', 'node_type', 'title', 'sort_order')
    list_filter = ('node_type',)
    search_fields = ('title', 'desc')


@admin.register(WorkflowEdge)
class WorkflowEdgeAdmin(admin.ModelAdmin):
    list_display = ('id', 'workflow', 'source_node_id', 'target_node_id', 'label')


@admin.register(WorkflowExecution)
class WorkflowExecutionAdmin(admin.ModelAdmin):
    list_display = ('id', 'workflow', 'user', 'status', 'total_steps', 'elapsed_time_ms', 'started_at')
    list_filter = ('status',)
    readonly_fields = ('id', 'started_at', 'finished_at')


@admin.register(WorkflowTemplate)
class WorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'difficulty', 'use_count', 'rating', 'is_featured')
    list_filter = ('category', 'difficulty', 'is_official')
    search_fields = ('name', 'description')
