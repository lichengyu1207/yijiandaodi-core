from django.contrib import admin
from .models import User, BlacklistedToken
from .mall_models import BusinessInquiry, ScenarioPackage, EnterpriseAuditService, EnterpriseAuditContract
from .developer_models import DeveloperAccount, DeveloperAPIKey, DeveloperUsageLog
from .data_classification_models import (
    DataSensitivityLevel, DataCategory, DataFieldTag,
    DataClassificationRecord, DataExportApproval, DataProtectionOfficer,
)
# 行为基线建模引擎模型
from .behavior_models import (
    AgentBehaviorLog, BehaviorBaseline, BehaviorPattern, AnomalyDetection
)
# 浏览器插件数据同步模型
from .extension_sync_models import (
    ExtensionSession, ExtensionOperation, ExtensionFingerprint, ExtensionSyncLog
)
# 原创作品审核模型
from .original_work_models import OriginalWork, OriginalWorkEvidence


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'is_active', 'is_staff', 'date_joined', 'last_login']
    list_filter = ['role', 'is_active', 'is_staff', 'date_joined']
    search_fields = ['username', 'email']
    ordering = ['-date_joined']
    readonly_fields = ['date_joined', 'last_login']

    fieldsets = (
        ('基本信息', {
            'fields': ('username', 'email', 'avatar', 'password')
        }),
        ('权限设置', {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser')
        }),
        ('时间信息', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',)
        }),
    )


# =====================================================
# 行为基线建模引擎管理后台
# =====================================================

@admin.register(AgentBehaviorLog)
class AgentBehaviorLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'agent_code', 'agent_name', 'behavior_type', 'risk_level', 'risk_score', 'is_anomaly', 'timestamp']
    list_filter = ['agent_code', 'behavior_type', 'risk_level', 'is_anomaly', 'timestamp']
    search_fields = ['agent_code', 'agent_name', 'session_id']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp', 'behavior_id']  # 移除created_at
    
    fieldsets = (
        ('基本信息', {
            'fields': ('agent_code', 'agent_name', 'session_id', 'behavior_type', 'timestamp')
        }),
        ('行为详情', {
            'fields': ('behavior_data', 'duration_ms'),
            'classes': ('collapse',)
        }),
        ('风险评估', {
            'fields': ('risk_level', 'risk_score', 'anomaly_score', 'baseline_deviation', 'is_anomaly')
        }),
        ('用户信息', {
            'fields': ('user', 'ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
        ('审核信息', {
            'fields': ('is_reviewed', 'reviewed_by', 'reviewed_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(BehaviorBaseline)
class BehaviorBaselineAdmin(admin.ModelAdmin):
    list_display = ['agent_code', 'baseline_type', 'version', 'sample_count', 'accuracy', 'is_active', 'updated_at']
    list_filter = ['agent_code', 'baseline_type', 'is_active', 'version']
    search_fields = ['agent_code', 'baseline_type']
    ordering = ['-updated_at']
    readonly_fields = ['created_at', 'updated_at', 'period_start', 'period_end']
    
    fieldsets = (
        ('基本信息', {
            'fields': ('agent_code', 'baseline_type', 'version', 'is_active')
        }),
        ('统计周期', {
            'fields': ('period_start', 'period_end', 'sample_count')
        }),
        ('基线数据', {
            'fields': ('baseline_data',),
            'classes': ('collapse',)
        }),
        ('模型性能', {
            'fields': ('accuracy', 'precision', 'recall', 'f1_score')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(AnomalyDetection)
class AnomalyDetectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'anomaly_type', 'severity', 'confidence', 'status', 'detected_at', 'behavior_log']
    list_filter = ['anomaly_type', 'severity', 'status', 'detected_at']
    search_fields = ['anomaly_type', 'anomaly_description']
    ordering = ['-detected_at']
    readonly_fields = ['detected_at']
    
    fieldsets = (
        ('异常信息', {
            'fields': ('behavior_log', 'anomaly_type', 'severity', 'detection_method', 'confidence')
        }),
        ('异常详情', {
            'fields': ('anomaly_description', 'anomaly_data'),
            'classes': ('collapse',)
        }),
        ('处理信息', {
            'fields': ('status', 'assigned_to', 'resolution_notes', 'resolved_at')
        }),
        ('时间信息', {
            'fields': ('detected_at',),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['mark_resolved', 'mark_false_positive']
    
    def mark_resolved(self, request, queryset):
        from django.utils import timezone
        queryset.update(status='resolved', resolved_at=timezone.now())
        self.message_user(request, f'{queryset.count()} 个异常已标记为已解决')
    mark_resolved.short_description = '标记为已解决'
    
    def mark_false_positive(self, request, queryset):
        from django.utils import timezone
        queryset.update(status='false_positive', resolved_at=timezone.now())
        self.message_user(request, f'{queryset.count()} 个异常已标记为误报')
    mark_false_positive.short_description = '标记为误报'


@admin.register(BehaviorPattern)
class BehaviorPatternAdmin(admin.ModelAdmin):
    list_display = ['agent_code', 'pattern_type', 'pattern_name', 'occurrence_count', 'support', 'is_normal', 'is_active']
    list_filter = ['agent_code', 'pattern_type', 'is_normal', 'is_active']
    search_fields = ['agent_code', 'pattern_name']
    ordering = ['-occurrence_count']
    readonly_fields = ['created_at', 'updated_at', 'last_occurred_at']
    
    fieldsets = (
        ('基本信息', {
            'fields': ('agent_code', 'pattern_type', 'pattern_name', 'is_normal', 'is_active')
        }),
        ('模式定义', {
            'fields': ('pattern_definition',),
            'classes': ('collapse',)
        }),
        ('统计信息', {
            'fields': ('occurrence_count', 'support', 'confidence', 'last_occurred_at')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(BlacklistedToken)
class BlacklistedTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'token_preview', 'created_at', 'expires_at']
    list_filter = ['created_at', 'expires_at']
    search_fields = ['user__username', 'token']

    def token_preview(self, obj):
        return obj.token[:50] + '...' if len(obj.token) > 50 else obj.token
    token_preview.short_description = 'Token预览'


@admin.register(BusinessInquiry)
class BusinessInquiryAdmin(admin.ModelAdmin):
    list_display = ['id', 'inquiry_type_display', 'contact_name', 'company', 'phone', 'status_display', 'created_at']
    list_filter = ['inquiry_type', 'status', 'created_at']
    search_fields = ['contact_name', 'company', 'phone', 'email', 'requirement']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('基本信息', {
            'fields': ('inquiry_type', 'status', 'contact_name', 'company', 'phone', 'email')
        }),
        ('需求详情', {
            'fields': ('requirement',)
        }),
        ('广告合作信息', {
            'fields': ('ad_type', 'budget',),
            'classes': ('collapse',)
        }),
        ('KOL合作信息', {
            'fields': ('kol_target', 'platform', 'followers', 'cooperation_intent'),
            'classes': ('collapse',)
        }),
        ('管理', {
            'fields': ('user', 'admin_note', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def inquiry_type_display(self, obj):
        return obj.get_inquiry_type_display()
    inquiry_type_display.short_description = '咨询类型'

    def status_display(self, obj):
        return obj.get_status_display()
    status_display.short_description = '状态'


@admin.register(DeveloperAccount)
class DeveloperAccountAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'tier', 'status', 'daily_quota', 'monthly_quota', 'calls_today', 'total_calls', 'created_at']
    list_filter = ['tier', 'status']
    search_fields = ['user__username', 'company', 'contact_email']
    ordering = ['-created_at']


@admin.register(DeveloperAPIKey)
class DeveloperAPIKeyAdmin(admin.ModelAdmin):
    list_display = ['id', 'developer', 'name', 'key_type', 'key_preview', 'is_active', 'total_calls', 'last_used_at', 'created_at']
    list_filter = ['key_type', 'is_active']
    search_fields = ['developer__user__username', 'name']

    def key_preview(self, obj):
        return f'{obj.key_prefix}****{obj.key_last_4}'
    key_preview.short_description = '密钥预览'


@admin.register(DeveloperUsageLog)
class DeveloperUsageLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'api_key', 'api_type', 'endpoint', 'status', 'response_time_ms', 'ip_address', 'created_at']
    list_filter = ['api_type', 'status']
    search_fields = ['request_id', 'input_preview', 'error_message']
    ordering = ['-created_at']
    readonly_fields = ['created_at']


@admin.register(DataSensitivityLevel)
class DataSensitivityLevelAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'color', 'retention_days', 'encryption_required',
                    'export_approval_required', 'dpo_review_required', 'sort_order', 'is_active']
    list_editable = ['sort_order', 'is_active']
    list_filter = ['encryption_required', 'export_approval_required', 'dpo_review_required', 'is_active']
    ordering = ['sort_order']

    fieldsets = (
        ('基本信息', {'fields': ('code', 'name', 'description', 'color', 'icon')}),
        ('安全策略', {
            'fields': ('retention_days', 'encryption_required', 'access_log_required',
                      'export_approval_required', 'allowed_roles', 'dpo_review_required')
        }),
        ('显示控制', {'fields': ('sort_order', 'is_active')}),
    )


@admin.register(DataCategory)
class DataCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category_type', 'default_level', 'cross_border_transfer_allowed', 'is_active']
    list_filter = ['category_type', 'cross_border_transfer_allowed', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['category_type', 'code']


@admin.register(DataFieldTag)
class DataFieldTagAdmin(admin.ModelAdmin):
    list_display = ['field_path', 'field_label', 'pii_type', 'sensitivity_level', 'data_category',
                    'mask_rule', 'is_encrypted_at_rest']
    list_filter = ['pii_type', 'sensitivity_level', 'data_category', 'mask_rule', 'is_encrypted_at_rest']
    search_fields = ['field_path', 'field_label', 'legal_basis']
    ordering = ['pii_type', 'field_path']


@admin.register(DataClassificationRecord)
class DataClassificationRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'object_type', 'object_id', 'sensitivity_level', 'action_type',
                    'operator', 'created_at']
    list_filter = ['action_type', 'sensitivity_level', 'data_category', 'object_type']
    search_fields = ['object_repr', 'reason']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'auto_classification_score']


@admin.register(DataExportApproval)
class DataExportApprovalAdmin(admin.ModelAdmin):
    list_display = ['id', 'requester', 'status', 'max_sensitivity_level', 'purpose_preview',
                    'approver', 'approved_at', 'created_at']
    list_filter = ['status', 'max_sensitivity_level', 'export_format']
    search_fields = ['requester__username', 'purpose', 'recipient', 'data_description']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'download_count', 'last_download_at']

    def purpose_preview(self, obj):
        return obj.purpose[:80] + '...' if len(obj.purpose) > 80 else obj.purpose
    purpose_preview.short_description = '导出用途'


@admin.register(DataProtectionOfficer)
class DataProtectionOfficerAdmin(admin.ModelAdmin):
    list_display = ['user', 'employee_id', 'department', 'phone', 'is_active',
                    'appointed_at', 'term_end_date']
    list_filter = ['is_active']
    search_fields = ['user__username', 'employee_id', 'department', 'certificate']


@admin.register(ScenarioPackage)
class ScenarioPackageAdmin(admin.ModelAdmin):
    list_display = ['name', 'package_type', 'package_price', 'discount_percent',
                    'saved_amount', 'sales_count', 'is_featured', 'is_active']
    list_editable = ['is_featured', 'is_active']
    list_filter = ['package_type', 'is_featured', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['sort_order', '-sales_count']

    fieldsets = (
        ('基本信息', {'fields': ('name', 'package_type', 'description', 'cover_image')}),
        ('场景组合', {'fields': ('s_scenario', 'a_scenario', 'b_scenarios')}),
        ('定价策略', {
            'fields': ('original_total_price', 'package_price', 'discount_percent',
                      'saved_amount', 'validity_days', 'max_users')
        }),
        ('权益展示', {'fields': ('included_features', 'tier_badges')}),
        ('销售控制', {'fields': ('is_active', 'is_featured', 'sort_order', 'sales_count')}),
    )


@admin.register(EnterpriseAuditService)
class EnterpriseAuditServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'audit_tier', 'scope', 'base_price', 'min_price',
                    'profit_margin', 'audit_days', 'is_recommended', 'is_active']
    list_editable = ['is_recommended', 'is_active']
    list_filter = ['audit_tier', 'scope', 'is_recommended', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['base_price']


@admin.register(EnterpriseAuditContract)
class EnterpriseAuditContractAdmin(admin.ModelAdmin):
    list_display = ['contract_no', 'company_name', 'service', 'status', 'final_price',
                    'contact_person', 'start_date', 'signed_at', 'created_at']
    list_filter = ['status', 'service__audit_tier', 'service__scope']
    search_fields = ['contract_no', 'company_name', 'contact_person', 'contact_email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


# =====================================================
# 浏览器插件数据同步管理后台
# =====================================================

@admin.register(ExtensionSession)
class ExtensionSessionAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'user', 'title', 'status', 'operations_count',
                    'fingerprints_count', 'platforms_count', 'start_time', 'created_at']
    list_filter = ['status', 'created_at', 'start_time']
    search_fields = ['session_id', 'title', 'user__username', 'device_id']
    ordering = ['-start_time']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('会话信息', {
            'fields': ('user', 'session_id', 'title', 'status')
        }),
        ('时间信息', {
            'fields': ('start_time', 'end_time')
        }),
        ('统计信息', {
            'fields': ('operations_count', 'fingerprints_count', 'platforms_count', 'platforms')
        }),
        ('设备信息', {
            'fields': ('device_id', 'extension_version'),
            'classes': ('collapse',)
        }),
        ('时间戳', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ExtensionOperation)
class ExtensionOperationAdmin(admin.ModelAdmin):
    list_display = ['operation_id', 'session', 'operation_type', 'platform_name',
                    'timestamp', 'content_preview']
    list_filter = ['operation_type', 'platform_name', 'timestamp']
    search_fields = ['operation_id', 'session__session_id', 'content_preview']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']

    fieldsets = (
        ('操作信息', {
            'fields': ('session', 'operation_id', 'operation_type')
        }),
        ('时间信息', {
            'fields': ('timestamp', 'timestamp_display', 'timestamp_source')
        }),
        ('平台信息', {
            'fields': ('platform_name', 'platform_type')
        }),
        ('内容信息', {
            'fields': ('content_preview', 'content_hash'),
            'classes': ('collapse',)
        }),
        ('页面信息', {
            'fields': ('page_url', 'page_title'),
            'classes': ('collapse',)
        }),
        ('元数据', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )


@admin.register(ExtensionFingerprint)
class ExtensionFingerprintAdmin(admin.ModelAdmin):
    list_display = ['hash', 'session', 'prev_hash', 'operation_id', 'timestamp', 'created_at']
    list_filter = ['timestamp', 'created_at']
    search_fields = ['hash', 'prev_hash', 'operation_id', 'session__session_id']
    ordering = ['timestamp']
    readonly_fields = ['created_at']

    fieldsets = (
        ('指纹信息', {
            'fields': ('session', 'hash', 'prev_hash', 'operation_id')
        }),
        ('时间信息', {
            'fields': ('timestamp', 'timestamp_display')
        }),
    )


@admin.register(ExtensionSyncLog)
class ExtensionSyncLogAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'user', 'sync_type', 'operations_synced',
                    'fingerprints_synced', 'status', 'ip_address', 'created_at']
    list_filter = ['sync_type', 'status', 'created_at']
    search_fields = ['session_id', 'user__username', 'device_id', 'ip_address']
    ordering = ['-created_at']
    readonly_fields = ['created_at']

    fieldsets = (
        ('同步信息', {
            'fields': ('user', 'session_id', 'sync_type')
        }),
        ('同步统计', {
            'fields': ('operations_synced', 'fingerprints_synced')
        }),
        ('设备信息', {
            'fields': ('device_id', 'ip_address')
        }),
        ('状态', {
            'fields': ('status', 'error_message')
        }),
    )


# =====================================================
# 原创作品审核管理后台
# =====================================================

@admin.register(OriginalWork)
class OriginalWorkAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'work_type', 'status', 'declaration_number',
                    'reviewer', 'created_at', 'reviewed_at']
    list_filter = ['status', 'work_type', 'created_at', 'reviewed_at']
    search_fields = ['title', 'user__username', 'declaration_number', 'content_hash']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'content_hash', 'declaration_number']
    actions = ['approve_works', 'reject_works']

    fieldsets = (
        ('作品信息', {
            'fields': ('user', 'title', 'work_type', 'description')
        }),
        ('内容', {
            'fields': ('content', 'content_hash', 'file_url'),
            'classes': ('collapse',)
        }),
        ('证据链', {
            'fields': ('session_id', 'evidence_chain'),
            'classes': ('collapse',)
        }),
        ('审核状态', {
            'fields': ('status', 'review_note', 'reviewer', 'reviewed_at')
        }),
        ('原创声明', {
            'fields': ('declaration_number', 'declaration_issued_at')
        }),
        ('时间戳', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def approve_works(self, request, queryset):
        from django.utils import timezone
        count = 0
        for work in queryset.filter(status='pending'):
            work.status = 'approved'
            work.reviewer = request.user
            work.reviewed_at = timezone.now()
            work.declaration_issued_at = timezone.now()
            work.generate_declaration_number()
            work.save()
            count += 1
        self.message_user(request, f'已通过 {count} 个作品的审核')
    approve_works.short_description = '批量通过审核'

    def reject_works(self, request, queryset):
        from django.utils import timezone
        queryset.filter(status='pending').update(
            status='rejected',
            reviewer=request.user,
            reviewed_at=timezone.now()
        )
        count = queryset.filter(status='rejected').count()
        self.message_user(request, f'已拒绝 {count} 个作品')
    reject_works.short_description = '批量拒绝'


@admin.register(OriginalWorkEvidence)
class OriginalWorkEvidenceAdmin(admin.ModelAdmin):
    list_display = ['work', 'evidence_type', 'timestamp', 'fingerprint', 'created_at']
    list_filter = ['evidence_type', 'created_at']
    search_fields = ['work__title', 'fingerprint']
    ordering = ['timestamp']
    readonly_fields = ['created_at']
