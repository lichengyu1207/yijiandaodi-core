import uuid
from django.db import models
from django.conf import settings


class ResumeAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)

    resume_text = models.TextField(verbose_name='简历文本')
    resume_hash = models.CharField(max_length=64, verbose_name='简历哈希(SHA256)', unique=True)

    target_position = models.CharField(max_length=100, verbose_name='目标职位', blank=True)
    target_industry = models.CharField(max_length=50, verbose_name='目标行业', choices=[
        ('tech', '互联网/IT'),
        ('finance', '金融/投资'),
        ('consulting', '咨询/专业服务'),
        ('manufacturing', '制造业'),
        ('retail', '零售/电商'),
        ('healthcare', '医疗/健康'),
        ('education', '教育/培训'),
        ('media', '媒体/广告'),
        ('real_estate', '房地产'),
        ('logistics', '物流/供应链'),
        ('government', '政府/公共事业'),
        ('other', '其他行业'),
    ], default='other')
    
    experience_level = models.CharField(max_length=20, verbose_name='经验水平', choices=[
        ('entry', '应届生/入门(0-2年)'),
        ('junior', '初级(2-5年)'),
        ('mid', '中级(5-8年)'),
        ('senior', '高级(8-12年)'),
        ('executive', '高管/专家(12年+)'),
        ('career_change', '转行/转型'),
    ], default='mid')

    overall_score = models.IntegerField(default=0, verbose_name='综合评分(0-100)')
    ats_score = models.IntegerField(default=0, verbose_name='ATS通过率(0-100)')
    impact_score = models.IntegerField(default=0, verbose_name='影响力得分(0-100)')
    clarity_score = models.IntegerField(default=0, verbose_name='清晰度得分(0-100)')
    completeness_score = models.IntegerField(default=0, verbose_name='完整度得分(0-100)')

    total_suggestions = models.IntegerField(default=0, verbose_name='建议总数')
    critical_suggestions = models.IntegerField(default=0, verbose_name='关键建议数')
    improvement_suggestions = models.IntegerField(default=0, verbose_name='优化建议数')
    enhancement_suggestions = models.IntegerField(default=0, verbose_name='增强建议数')

    section_analysis = models.JSONField(default=dict, verbose_name='章节分析')
    keyword_analysis = models.JSONField(default=dict, verbose_name='关键词分析')
    ats_compatibility = models.JSONField(default=dict, verbose_name='ATS兼容性详情')
    salary_impact_estimate = models.JSONField(default=dict, verbose_name='薪资影响预估')

    executive_summary = models.TextField(blank=True, verbose_name='执行摘要')
    optimization_roadmap = models.JSONField(default=list, verbose_name='优化路线图')
    benchmark_comparison = models.JSONField(default=dict, verbose_name='行业基准对比')

    processing_time_ms = models.IntegerField(default=0, verbose_name='处理耗时(ms)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'resume_analysis'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['resume_hash']),
            models.Index(fields=['target_industry']),
            models.Index(fields=['experience_level']),
            models.Index(fields=['overall_score']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['ats_score']),
        ]

    def __str__(self):
        return f'简历分析 #{str(self.id)[:8]} (得分:{self.overall_score})'


class OptimizationSuggestion(models.Model):
    analysis = models.ForeignKey(ResumeAnalysis, on_delete=models.CASCADE, related_name='optimizations')

    suggestion_category = models.CharField(max_length=30, verbose_name='建议类别', choices=[
        ('ats_keyword', 'ATS关键词优化'),
        ('achievement_quantification', '成就量化'),
        ('action_verbs', '动作动词升级'),
        ('impact_language', '影响力语言'),
        ('section_structure', '章节结构优化'),
        ('content_clarity', '内容清晰度'),
        ('redundancy_removal', '冗余删除'),
        ('skill_highlighting', '技能突出'),
        ('formatting', '格式规范'),
        ('industry_specific', '行业特定优化'),
        ('salary_optimization', '薪资谈判优化'),
        ('personal_branding', '个人品牌塑造'),
    ], default='action_verbs')

    severity = models.CharField(max_length=15, verbose_name='重要程度', choices=[
        ('critical', '关键问题'),
        ('important', '重要改进'),
        ('recommended', '推荐优化'),
        ('optional', '可选增强'),
    ], default='recommended')

    affected_section = models.CharField(max_length=50, verbose_name='涉及章节', choices=[
        ('summary', '个人总结/求职意向'),
        ('experience', '工作经历'),
        ('education', '教育背景'),
        ('skills', '技能列表'),
        ('projects', '项目经历'),
        ('certifications', '证书/资质'),
        ('awards', '获奖/荣誉'),
        ('other', '其他部分'),
    ], default='experience')

    original_text = models.TextField(verbose_name='原文片段')
    optimized_text = models.TextField(verbose_name='优化后文本', blank='')
    alternative_options = models.JSONField(default=list, verbose_name='备选方案列表')

    explanation = models.TextField(verbose_name='优化理由', blank='')
    impact_description = models.TextField(verbose_name='预期效果描述', blank='')
    salary_impact_range = models.CharField(max_length=50, verbose_name='薪资影响范围', blank='')

    before_example = models.TextField(blank=True, verbose_name='修改前示例')
    after_example = models.TextField(blank=True, verbose_name='修改后示例')

    confidence = models.FloatField(default=0.0, verbose_name='置信度(0-1)')
    difficulty = models.CharField(max_length=10, verbose_name='实施难度', choices=[
        ('easy', '简单(1分钟)'),
        ('medium', '中等(5分钟)'),
        ('hard', '较难(15分钟)'),
        ('complex', '复杂(30分钟+)'),
    ], default='easy')

    is_applied = models.BooleanField(null=True, verbose_name='是否应用(null=待处理)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'optimization_suggestion'
        ordering = ['-confidence', '-severity']
        indexes = [
            models.Index(fields=['analysis']),
            models.Index(fields=['suggestion_category']),
            models.Index(fields=['severity']),
            models.Index(fields=['affected_section']),
            models.Index(fields=['difficulty']),
        ]

    def __str__(self):
        return f'{self.get_suggestion_category_display()}: {self.original_text[:30]}...'
