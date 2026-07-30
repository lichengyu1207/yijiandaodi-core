from django.db import models
from django.conf import settings
import uuid
import hashlib
import json


class AIContentProvenance(models.Model):
    STATUS_CHOICES = [
        ('pending', '待分析'),
        ('fingerprinting', '生成指纹中'),
        ('tracing', '溯源分析中'),
        ('completed', '已完成'),
        ('failed', '分析失败'),
    ]
    CONTENT_TYPE_CHOICES = [
        ('text', '文本内容'),
        ('image', '图片内容'),
        ('audio', '音频内容'),
        ('video', '视频内容'),
        ('document', '文档内容'),
        ('code', '代码内容'),
    ]
    SOURCE_CONFIDENCE_CHOICES = [
        ('human_confirmed', '确认为人工创作'),
        ('ai_generated', '确认为AI生成'),
        ('ai_assisted', 'AI辅助创作'),
        ('mixed_source', '混合来源'),
        ('unknown', '无法确定'),
        ('manipulated', '已被篡改'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='provenance_records', verbose_name='提交用户'
    )
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, verbose_name='内容类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    file_hash_sha256 = models.CharField(max_length=64, blank=True, default='', verbose_name='SHA256哈希')
    original_content = models.TextField(blank=True, default='', verbose_name='原始内容(文本/元数据)')
    content_preview = models.TextField(blank=True, default='', verbose_name='内容预览(前2000字符)')

    digital_fingerprint = models.JSONField(default=dict, verbose_name='数字指纹数据')
    fingerprint_version = models.CharField(max_length=20, default='v1.0', verbose_name='指纹算法版本')
    watermark_detected = models.BooleanField(default=False, verbose_name='检测到水印')
    watermark_info = models.JSONField(default=dict, verbose_name='水印信息')

    source_confidence = models.CharField(max_length=20, choices=SOURCE_CONFIDENCE_CHOICES, default='unknown', verbose_name='来源置信判定')
    confidence_score = models.FloatField(default=0, verbose_name='置信度评分(0-1)')

    provenance_chain = models.JSONField(default=list, verbose_name='溯源链(来源归因链)')
    generation_tool_detected = models.CharField(max_length=100, blank=True, default='', verbose_name='检测到的生成工具')
    generation_params = models.JSONField(default=dict, verbose_name='推测的生成参数(prompt/模型/温度等)')
    modification_history = models.JSONField(default=list, verbose_name='修改历史记录')
    cross_platform_matches = models.JSONField(default=list, verbose_name='跨平台匹配结果')

    c2pa_metadata = models.JSONField(default=dict, verbose_name='C2PA标准元数据')
    technical_report = models.TextField(blank=True, default='', verbose_name='技术溯源报告')
    risk_assessment = models.JSONField(default=dict, verbose_name='风险评估')

    status = models.CharField(max_length=18, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'tech_provenance'
        verbose_name = '技术-AI内容溯源'
        verbose_name_plural = '技术-AI内容溯源'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_prov_user_time'),
            models.Index(fields=['status'], name='idx_prov_status'),
            models.Index(fields=['source_confidence'], name='idx_prov_source'),
            models.Index(fields=['content_type'], name='idx_prov_type'),
            models.Index(fields=['file_hash_sha256'], name='idx_prov_hash'),
        ]

    def __str__(self):
        return f'内容溯源-{self.content_type}-{self.id.hex[:8]}'


class DeepfakeVideoDetection(models.Model):
    STATUS_CHOICES = [
        ('pending', '待检测'),
        ('extracting_frames', '提取帧中'),
        ('analyzing', '深度分析中'),
        ('completed', '已完成'),
        ('failed', '检测失败'),
    ]
    VERDICT_CHOICES = [
        ('authentic', '真实视频'),
        ('likely_authentic', '大概率真实'),
        ('suspected', '疑似伪造'),
        ('likely_deepfake', '大概率深伪'),
        ('confirmed_deepfake', '确认深伪'),
        ('inconclusive', '无法判断'),
    ]
    VIDEO_TYPE_CHOICES = [
        ('talking_head', '人脸对话视频'),
        ('interview', '采访视频'),
        ('presentation', '演讲/报告视频'),
        ('social_media', '社交媒体短视频'),
        ('surveillance', '监控录像'),
        ('news', '新闻视频'),
        ('entertainment', '娱乐视频'),
        ('other', '其他类型'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='deepfake_detections', verbose_name='提交用户'
    )
    video_type = models.CharField(max_length=20, choices=VIDEO_TYPE_CHOICES, verbose_name='视频类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    duration_seconds = models.PositiveIntegerField(null=True, blank=True, verbose_name='视频时长(秒)')
    resolution = models.CharField(max_length=20, blank=True, default='', verbose_name='分辨率')
    file_hash_sha256 = models.CharField(max_length=64, blank=True, default='', verbose_name='SHA256哈希')
    video_metadata = models.JSONField(default=dict, verbose_name='视频元数据')

    overall_verdict = models.CharField(max_length=24, choices=VERDICT_CHOICES, default='inconclusive', verbose_name='综合判定')
    deepfake_probability = models.FloatField(default=0, verbose_name='深伪概率(0-1)')
    confidence_score = models.FloatField(default=0, verbose_name='检测置信度(0-1)')

    face_analysis = models.JSONField(default=dict, verbose_name='面部一致性分析')
    frame_analysis = models.JSONField(default=list, verbose_name='逐帧分析结果')
    temporal_consistency = models.JSONField(default=dict, verbose_name='时序一致性分析')
    frequency_analysis = models.JSONField(default=dict, verbose_name='频域分析结果')
    biological_signals = models.JSONField(default=dict, verbose_name='生物信号分析(眨眼/脉搏)')
    audio_visual_sync = models.JSONField(default=dict, verbose_name='音画同步分析')
    gan_artifact_detection = models.JSONField(default=list, verbose_name='GAN伪影检测结果')
    manipulation_traces = models.JSONField(default=list, verbose_name='篡改痕迹列表')

    detected_techniques = models.JSONField(default=list, verbose_name='检测到的伪造技术')
    affected_regions = models.JSONField(default=list, verbose_name='受影响区域(时间轴+空间坐标)')
    forensic_evidence = models.JSONField(default=dict, verbose_name='取证证据包')

    technical_report = models.TextField(blank=True, default='', verbose_name='深度伪造鉴别报告')
    risk_level = models.CharField(max_length=10, choices=[
        ('critical', '严重'), ('high', '高'), ('medium', '中'), ('low', '低'), ('safe', '安全'),
    ], default='safe', verbose_name='风险等级')
    recommended_actions = models.JSONField(default=list, verbose_name='建议措施')

    status = models.CharField(max_length=18, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    frames_analyzed = models.PositiveIntegerField(default=0, verbose_name='分析帧数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'tech_deepfake_detection'
        verbose_name = '技术-深度伪造鉴别'
        verbose_name_plural = '技术-深度伪造鉴别'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_deepfake_user_time'),
            models.Index(fields=['status'], name='idx_deepfake_status'),
            models.Index(fields=['overall_verdict'], name='idx_deepfake_verdict'),
            models.Index(fields=['risk_level'], name='idx_deepfake_risk'),
            models.Index(fields=['video_type'], name='idx_deepfake_type'),
        ]

    def __str__(self):
        return f'深伪鉴别-{self.video_type}-{self.id.hex[:8]}'
