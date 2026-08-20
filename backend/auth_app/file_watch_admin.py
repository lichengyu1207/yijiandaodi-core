"""
文件监控模型管理后台配置

注册文件监控相关的数据模型到Django Admin
"""

from django.contrib import admin
from .file_watch_models import (
    FileWatchConfig,
    FileOperationLog,
    FileHashRecord,
    FileRiskAssessment
)


@admin.register(FileWatchConfig)
class FileWatchConfigAdmin(admin.ModelAdmin):
    """文件监控配置管理"""
    
    list_display = [
        'watch_name',
        'watch_path',
        'user',
        'is_active',
        'auto_verify',
        'risk_threshold',
        'total_files',
        'created_at'
    ]
    
    list_filter = [
        'is_active',
        'auto_verify',
        'risk_threshold',
        'watch_create',
        'watch_modify',
        'watch_rename',
        'watch_delete'
    ]
    
    search_fields = ['watch_name', 'watch_path', 'user__username']
    
    readonly_fields = ['total_files', 'last_check_time', 'created_at', 'updated_at']
    
    fieldsets = (
        ('基本信息', {
            'fields': ('user', 'watch_name', 'watch_path')
        }),
        ('监控选项', {
            'fields': (
                'watch_create',
                'watch_modify',
                'watch_rename',
                'watch_delete'
            )
        }),
        ('文件过滤', {
            'fields': ('file_extensions', 'exclude_patterns'),
            'classes': ('collapse',)
        }),
        ('校验配置', {
            'fields': ('auto_verify', 'risk_threshold')
        }),
        ('状态信息', {
            'fields': ('is_active', 'total_files', 'last_check_time'),
            'classes': ('collapse',)
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_watch', 'deactivate_watch']
    
    def activate_watch(self, request, queryset):
        """批量激活监控"""
        count = queryset.update(is_active=True)
        self.message_user(request, f'成功激活 {count} 个监控配置')
    activate_watch.short_description = '激活选中的监控配置'
    
    def deactivate_watch(self, request, queryset):
        """批量停用监控"""
        count = queryset.update(is_active=False)
        self.message_user(request, f'成功停用 {count} 个监控配置')
    deactivate_watch.short_description = '停用选中的监控配置'


@admin.register(FileOperationLog)
class FileOperationLogAdmin(admin.ModelAdmin):
    """文件操作日志管理"""
    
    list_display = [
        'operation_time',
        'file_name',
        'operation_type',
        'risk_level',
        'risk_score',
        'verification_triggered',
        'user_confirmed',
        'config'
    ]
    
    list_filter = [
        'operation_type',
        'risk_level',
        'verification_triggered',
        'user_confirmed',
        'hash_changed'
    ]
    
    search_fields = ['file_path', 'file_name', 'file_hash']
    
    readonly_fields = [
        'config',
        'file_path',
        'file_name',
        'file_extension',
        'file_size',
        'operation_type',
        'old_path',
        'file_hash',
        'previous_hash',
        'hash_changed',
        'risk_level',
        'risk_score',
        'risk_tags',
        'verification_triggered',
        'verification_result',
        'operation_time',
        'created_at'
    ]
    
    fieldsets = (
        ('文件信息', {
            'fields': ('config', 'file_path', 'file_name', 'file_extension', 'file_size')
        }),
        ('操作信息', {
            'fields': ('operation_type', 'old_path', 'operation_time')
        }),
        ('哈希信息', {
            'fields': ('file_hash', 'previous_hash', 'hash_changed'),
            'classes': ('collapse',)
        }),
        ('风险评估', {
            'fields': ('risk_level', 'risk_score', 'risk_tags')
        }),
        ('校验结果', {
            'fields': ('verification_triggered', 'verification_result'),
            'classes': ('collapse',)
        }),
        ('用户确认', {
            'fields': ('user_confirmed', 'confirmed_at', 'confirmation_note')
        }),
        ('时间信息', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        """禁止手动添加日志"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """只允许修改用户确认相关字段"""
        return False


@admin.register(FileHashRecord)
class FileHashRecordAdmin(admin.ModelAdmin):
    """文件哈希记录管理"""
    
    list_display = ['file_path', 'version', 'is_current', 'file_size', 'created_at']
    
    list_filter = ['is_current', 'config']
    
    search_fields = ['file_path', 'file_hash']
    
    readonly_fields = ['config', 'file_path', 'file_hash', 'file_size', 'version', 'is_current', 'created_at']
    
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        """禁止手动添加记录"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """禁止修改记录"""
        return False


@admin.register(FileRiskAssessment)
class FileRiskAssessmentAdmin(admin.ModelAdmin):
    """文件风险评估管理"""
    
    list_display = [
        'operation_log',
        'overall_risk_level',
        'overall_score',
        'created_at'
    ]
    
    list_filter = ['overall_risk_level']
    
    search_fields = ['operation_log__file_name']
    
    readonly_fields = [
        'operation_log',
        'identity_check',
        'risk_check',
        'verification_check',
        'decision_check',
        'overall_score',
        'overall_risk_level',
        'recommendations',
        'created_at'
    ]
    
    fieldsets = (
        ('关联信息', {
            'fields': ('operation_log',)
        }),
        ('四官协同校验', {
            'fields': (
                'identity_check',
                'risk_check',
                'verification_check',
                'decision_check'
            ),
            'classes': ('collapse',)
        }),
        ('综合评估', {
            'fields': ('overall_score', 'overall_risk_level', 'recommendations')
        }),
        ('时间信息', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        """禁止手动添加评估"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """禁止修改评估"""
        return False