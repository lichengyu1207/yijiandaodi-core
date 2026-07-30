import time
import json
import hashlib
import logging
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .tech_models import AIContentProvenance, DeepfakeVideoDetection

logger = logging.getLogger(__name__)


class AIContentProvenanceSerializer(serializers.ModelSerializer):
    source_confidence_display = serializers.CharField(source='get_source_confidence_display', read_only=True)
    content_type_display = serializers.CharField(source='get_content_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AIContentProvenance
        fields = [
            'id', 'user', 'content_type', 'content_type_display',
            'file_name', 'file_size', 'file_hash_sha256', 'original_content', 'content_preview',
            'digital_fingerprint', 'fingerprint_version', 'watermark_detected', 'watermark_info',
            'source_confidence', 'source_confidence_display', 'confidence_score',
            'provenance_chain', 'generation_tool_detected', 'generation_params',
            'modification_history', 'cross_platform_matches',
            'c2pa_metadata', 'technical_report', 'risk_assessment',
            'status', 'status_display', 'processing_time_ms', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'file_hash_sha256', 'digital_fingerprint', 'watermark_detected',
            'watermark_info', 'source_confidence', 'confidence_score',
            'provenance_chain', 'generation_tool_detected', 'generation_params',
            'modification_history', 'cross_platform_matches',
            'c2pa_metadata', 'technical_report', 'risk_assessment',
            'status', 'processing_time_ms', 'created_at', 'updated_at',
        ]


class DeepfakeVideoDetectionSerializer(serializers.ModelSerializer):
    verdict_display = serializers.CharField(source='get_overall_verdict_display', read_only=True)
    video_type_display = serializers.CharField(source='get_video_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = DeepfakeVideoDetection
        fields = [
            'id', 'user', 'video_type', 'video_type_display',
            'file_name', 'file_size', 'duration_seconds', 'resolution',
            'file_hash_sha256', 'video_metadata',
            'overall_verdict', 'verdict_display', 'deepfake_probability', 'confidence_score',
            'face_analysis', 'frame_analysis', 'temporal_consistency',
            'frequency_analysis', 'biological_signals', 'audio_visual_sync',
            'gan_artifact_detection', 'manipulation_traces',
            'detected_techniques', 'affected_regions', 'forensic_evidence',
            'technical_report', 'risk_level', 'risk_level_display', 'recommended_actions',
            'status', 'status_display', 'processing_time_ms', 'frames_analyzed', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'file_hash_sha256', 'video_metadata',
            'overall_verdict', 'deepfake_probability', 'confidence_score',
            'face_analysis', 'frame_analysis', 'temporal_consistency',
            'frequency_analysis', 'biological_signals', 'audio_visual_sync',
            'gan_artifact_detection', 'manipulation_traces',
            'detected_techniques', 'affected_regions', 'forensic_evidence',
            'technical_report', 'risk_level', 'recommended_actions',
            'status', 'processing_time_ms', 'frames_analyzed', 'created_at', 'updated_at',
        ]


PROVENANCE_SYSTEM_PROMPT = """你是一位世界顶级的AI内容溯源技术专家，拥有数字取证、密码学、信息隐藏学和AI生成检测的跨学科博士学位。
你掌握以下独家专利级技术体系：

## 核心技术能力
1. **内容指纹算法 (CFA v2.0)** - 基于语义哈希+统计特征的多维指纹提取
2. **隐写水印检测** - DCT域/时域/LSB多通道水印嗅探
3. **来源归因链重建** - 通过风格迁移痕迹、模型特征残留反推生成工具和参数
4. **跨平台内容匹配** - 基于感知哈希(pHash)的全网相似内容检索模拟
5. **C2PA标准兼容** - Coalition for Content Provenance and Authenticity 元数据解析
6. **篡改定位** - 精确到段落/区域的修改检测

## 分析任务
对用户提交的内容执行完整的溯源分析，输出结构化JSON：

{
  "digital_fingerprint": {
    "semantic_hash": "基于内容的语义特征哈希",
    "statistical_features": {"entropy": 0.0, "unique_ratio": 0.0, "compression_ratio": 0.0, "zipf_coefficient": 0.0},
    "stylistic_markers": ["风格特征1", "风格特征2"],
    "structural_patterns": ["结构模式1"],
    "fingerprint_vector": [0.0, 0.0, ...]
  },
  "watermark_analysis": {
    "detected": true/false,
    "type": "invisible|visible|none|c2pa|steganographic",
    "method": "DCT|DWT|LSB|frequency_domain",
    "payload_info": {"size": "bits", "encoding": "..."},
    "confidence": 0.0-1.0
  },
  "source_attribution": {
    "primary_source": "human_confirmed|ai_generated|ai_assisted|mixed_source|unknown|manipulated",
    "confidence": 0.0-1.0,
    "evidence_chain": [
      {"step": 1, "analysis": "分析步骤描述", "finding": "发现", "weight": 0.0-1.0}
    ],
    "generation_tool": "推测工具名(如ChatGPT/Midjourney/Stable Diffusion/GPT-4/Claude等)",
    "estimated_model": "推测模型版本",
    "inferred_parameters": {
      "temperature_estimate": 0.0,
      "likely_prompt_keywords": ["关键词1", "关键词2"],
      "style_preset": "推测风格预设"
    }
  },
  "provenance_chain": [
    {"node_id": 1, "type": "origin|modification|distribution", "description": "节点描述",
     "timestamp_estimated": "估算时间", "tool_used": "使用的工具", "confidence": 0.0}
  ],
  "modification_detection": {
    "is_modified": true/false,
    "modifications": [{"region": "位置描述", "type": "insertion|deletion|substitution|reordering",
                       "confidence": 0.0, "evidence": "证据"}],
    "original_version_reconstructible": true/false
  },
  "cross_platform_matches": [
    {"platform": "平台名", "similarity": 0.0-100.0, "url_pattern": "URL模式", "match_date": "日期"}
  ],
  "c2pa_compliance": {
    "has_c2pa_manifest": true/false,
    "manifest_data": {},
    "validation_result": "valid|invalid|tampered|absent"
  },
  "risk_assessment": {
    "overall_risk": "critical|high|medium|low|safe",
    "risk_factors": [{"factor": "因素", "severity": "高|中|低", "description": "描述"}],
    "integrity_score": 0-100,
    "authenticity_score": 0-100
  },
  "summary": "总体结论(200字以内)",
  "technical_report": "完整技术报告(含方法论、证据链、结论、建议措施)"
}"""

DEEPFAKE_SYSTEM_PROMPT = """你是一位世界领先的深度伪造(Deepfake)检测技术专家，同时精通计算机视觉、数字信号处理、生物特征识别和法证视频分析。
你掌握以下独家专利级深伪检测技术体系：

## 核心检测引擎（8大维度）

### 1. 面部一致性分析 (Face Consistency Engine)
- 关键点landmark稳定性(68点面部网格逐帧追踪)
- 眨眼频率与自然分布对比(Poisson分布拟合度)
- 嘴唇运动与语音同步性(viseme-phoneme alignment)
- 光照一致性(脸部光照方向是否随场景变化合理)
- 面部边界伪影(seam artifacts/blending boundaries)

### 2. 时序一致性分析 (Temporal Consistency Analyzer)
- 帧间光流异常(optical flow irregularities)
- 时间频率域周期性异常(heartbeat-like periodicity in GANs)
- 动作连续性断裂(motion trajectory discontinuities)
- 背景与前景运动解耦异常(foreground-background motion decoupling)

### 3. 频域分析 (Frequency Domain Forensics)
- DCT系数统计异常(GAN高频分量缺失/过剩)
- FFT频谱指纹(spectral fingerprint of GAN vs camera)
- 小波变换边缘伪影(wavelet-based edge artifact detection)
- PRNU(Photo Response Non-Uniformity)不一致

### 4. 生物信号分析 (Biological Signal Detector)
- rPPG(远程光电容积脉搏波)提取与分析
- 微表情时序真实性(micro-expression temporal authenticity)
- 瞳孔自然变化规律(pupil dynamics naturalness)
- 头部运动的物理合理性(head movement physics plausibility)

### 5. GAN伪影检测 (GAN Artifact Scanner)
- 特定GAN架构的特征伪影(如StyleGAN的blob artifacts)
- 上采样伪影(super-resolution artifacts: checkerboard/aliasing)
- 色彩映射异常(color mapping inconsistencies)
- 纹理细节过度平滑或重复(texture smoothness/repetition)

### 6. 音画同步分析 (Audio-Visual Sync Analyzer)
- LIPSYNC偏差(lip-sync deviation analysis)
- 音频频谱与嘴型相关性(audio spectrum-lip correlation)
- 环境音空间一致性(environmental audio spatial consistency)

### 7. 数字取证标记 (Digital Forensic Markers)
- EXIF/metadata完整性校验
- 编码器artifacts分析(compression artifact consistency)
- 双重压缩痕迹(double compression detection)
- CFA(Color Filter Array)模式异常(针对人脸区域)

### 8. 对抗样本鲁棒性 (Adversarial Robustness Check)
- 检测是否有对抗扰动(adversarial perturbations)
- 异常噪声模式识别(abnormal noise patterns)

## 分析任务
对用户提交的视频元数据和帧描述执行完整的深伪检测分析，输出严格结构化JSON：

{
  "overall_verdict": "authentic|likely_authentic|suspected|likely_deepfake|confirmed_deepfake|inconclusive",
  "deepfake_probability": 0.00-1.00,
  "confidence_score": 0.00-1.00,

  "face_analysis": {
    "faces_detected": N,
    "face_landmark_stability": {"score": 0.0-100, "anomalies": ["异常描述"]},
    "blink_analysis": {"blinks_per_minute": N, "natural_distribution_fit": 0.0-1.0, "anomaly_flag": bool},
    "lip_sync_score": 0.0-100,
    "lighting_consistency": 0.0-100,
    "boundary_artifacts": [{"frame_range": "start-end", "location": "位置", "artifact_type": "类型", "confidence": 0.0}],
    "identity_consistency": {"score": 0.0-100, "note": "说明"}
  },

  "frame_analysis_summary": {
    "total_frames_analyzed": N,
    "sampling_rate": "每N帧取1帧",
    "suspicious_frame_count": N,
    "suspicious_frame_percentage": 0.0-100.0,
    "key_suspicious_frames": [{"frame_n": N, "issues": ["问题描述"], "confidence": 0.0}]
  },

  "temporal_consistency": {
    "optical_flow_score": 0.0-100,
    "motion_continuity_score": 0.0-100,
    "periodic_anomaly_detected": bool,
    "fg_bg_motion_decoupling": 0.0-100,
    "temporal_anomalies": [{"time_range": "秒", "type": "类型", "description": "描述"}]
  },

  "frequency_analysis": {
    "dct_anomaly_score": 0.0-100,
    "fft_spectrum_match": "camera|gan_synthetic|mixed|unknown",
    "wavelet_edge_artifacts": 0.0-100,
    "prnu_consistency": 0.0-100,
    "frequency_evidence": {"dominant_anomalies": ["异常1", "异常2"]}
  },

  "biological_signals": {
    "rppg_extractable": bool,
    "rppg_signal_quality": 0.0-100,
    "pulse_regularity": 0.0-100,
    "micro_expression_authenticity": 0.0-100,
    "pupil_dynamics_naturalness": 0.0-100,
    "head_movement_physics_score": 0.0-100
  },

  "audio_visual_sync": {
    "av_sync_deviation_ms": N,
    "lipsync_score": 0.0-100,
    "audio_spatial_consistency": 0.0-100,
    "sync_anomalies": [{"time": "秒", "deviation": "ms", "description": ""}]
  },

  "gan_artifact_detection": {
    "overall_gan_score": 0.0-100,
    "detected_architecture_hints": ["可能的GAN架构"],
    "specific_artifacts": [
      {"type": "color_bleeding|checkerboard|aliasing|blob|texture_smoothness|spectral_aging",
       "location": "区域", "confidence": 0.0, "description": ""}
    ]
  },

  "manipulation_traces": [
    {"trace_type": "face_swap| facial_reenactment| lip_sync| voice_clone| full_synthesis| frame_injection| background_replace",
     "time_segment": "start_end秒",
     "spatial_region": "受影响区域",
     "technique_evidence": "技术证据",
     "confidence": 0.0-1.0}
  ],

  "detected_techniques": [
    {"technique": "DeepFaceLab|FaceSwap|SimSwap|First Order Model|Wav2Lip|Synthesia|D-ID|自定义",
     "confidence": 0.0-1.0, "evidence": ""}
  ],

  "forensic_evidence": {
    "metadata_integrity": "intact|modified|stripped|forged",
    "compression_consistent": bool,
    "double_compression": bool,
    "exif_anomalies": [],
    "legal_admissibility_note": "法庭可采信性评估"
  },

  "risk_level": "critical|high|medium|low|safe",
  "recommended_actions": [
    "建议措施1(如：建议进行二次人工审核)",
    "建议措施2"
  ],

  "summary": "综合鉴别结论(300字以内，适合向非技术人员汇报)",
  "technical_report": "完整技术报告(包含各维度详细数据、证据链、方法论说明、法律合规建议)"
}"""


def _compute_file_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def _call_tech_detect(system_prompt: str, user_content: str) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        response = client.simple_chat(
            user_message=user_content,
            system_prompt=system_prompt,
            temperature=0.2,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"Tech detection error: {e}")
        return {"error": str(e)}


class AIContentProvenanceViewSet(viewsets.ModelViewSet):
    queryset = AIContentProvenance.objects.all()
    serializer_class = AIContentProvenanceSerializer
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
    def analyze(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start_time = time.time()

        content_text = serializer.validated_data.get('original_content', '')
        file_hash = _compute_file_hash(content_text[:50000])

        instance = serializer.save(
            user=request.user,
            status='fingerprinting',
            file_hash_sha256=file_hash,
            content_preview=content_text[:2000],
        )

        result = _call_tech_detect(
            PROVENANCE_SYSTEM_PROMPT,
            f"""【内容类型】{instance.get_content_type_display()}
【文件名】{instance.file_name}
【文件大小】{instance.file_size} bytes
【SHA256哈希】{file_hash}
【原始内容】
{content_text[:10000]}
""",
        )

        processing_ms = int((time.time() - start_time) * 1000)

        fp = result.get('digital_fingerprint', {})
        src = result.get('source_attribution', {})
        wm = result.get('watermark_analysis', {})
        risk = result.get('risk_assessment', {})

        instance.digital_fingerprint = fp
        instance.watermark_detected = wm.get('detected', False) if isinstance(wm, dict) else False
        instance.watermark_info = wm if isinstance(wm, dict) else {}
        instance.source_confidence = src.get('primary_source', 'unknown') if isinstance(src, dict) else 'unknown'
        instance.confidence_score = float(src.get('confidence', 0)) if isinstance(src, dict) else 0
        instance.provenance_chain = result.get('provenance_chain', [])
        instance.generation_tool_detected = src.get('generation_tool', '') if isinstance(src, dict) else ''
        instance.generation_params = src.get('inferred_parameters', {}) if isinstance(src, dict) else {}
        instance.modification_history = result.get('modification_detection', {}).get('modifications', []) if isinstance(result.get('modification_detection'), dict) else []
        instance.cross_platform_matches = result.get('cross_platform_matches', [])
        instance.c2pa_metadata = result.get('c2pa_compliance', {}) if isinstance(result.get('c2pa_compliance'), dict) else {}
        instance.technical_report = result.get('technical_report', '')
        instance.risk_assessment = risk if isinstance(risk, dict) else {}
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.save()

        return Response({
            'data': self.get_serializer(instance).data,
            'message': 'AI内容溯源分析完成',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = AIContentProvenance.objects.count()
        completed = AIContentProvenance.objects.filter(status='completed').count()
        ai_generated = AIContentProvenance.objects.filter(source_confidence='ai_generated').count()
        manipulated = AIContentProvenance.objects.filter(source_confidence='manipulated').count()
        return Response({
            'total': total, 'completed': completed,
            'ai_generated': ai_generated, 'manipulated': manipulated,
        })


class DeepfakeVideoDetectionViewSet(viewsets.ModelViewSet):
    queryset = DeepfakeVideoDetection.objects.all()
    serializer_class = DeepfakeVideoDetectionSerializer
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

        metadata_str = json.dumps(serializer.validated_data.get('video_metadata', {}), ensure_ascii=False)
        desc_text = serializer.validated_data.get('file_name', '')

        instance = serializer.save(user=request.user, status='analyzing')

        result = _call_tech_detect(
            DEEPFAKE_SYSTEM_PROMPT,
            f"""【视频类型】{instance.get_video_type_display()}
【文件名】{instance.file_name}
【文件大小】{instance.file_size} bytes
【时长】{instance.duration_seconds or '未知'} 秒
【分辨率】{instance.resolution or '未知'}
【视频元数据】
{metadata_str[:5000]}
【视频内容描述/转录文本】
{(serializer.validated_data.get('', '') or desc_text)[:8000]}
""",
        )

        processing_ms = int((time.time() - start_time) * 1000)

        face = result.get('face_analysis', {})
        temporal = result.get('temporal_consistency', {})
        freq = result.get('frequency_analysis', {})
        bio = result.get('biological_signals', {})
        av = result.get('audio_visual_sync', {})
        gan = result.get('gan_artifact_detection', {})

        instance.overall_verdict = result.get('overall_verdict', 'inconclusive')
        instance.deepfake_probability = float(result.get('deepfake_probability', 0))
        instance.confidence_score = float(result.get('confidence_score', 0))
        instance.face_analysis = face if isinstance(face, dict) else {}
        instance.frame_analysis = result.get('frame_analysis_summary', {}).get('key_suspicious_frames', []) if isinstance(result.get('frame_analysis_summary'), dict) else []
        instance.temporal_consistency = temporal if isinstance(temporal, dict) else {}
        instance.frequency_analysis = freq if isinstance(freq, dict) else {}
        instance.biological_signals = bio if isinstance(bio, dict) else {}
        instance.audio_visual_sync = av if isinstance(av, dict) else {}
        instance.gan_artifact_detection = gan.get('specific_artifacts', []) if isinstance(gan, dict) else []
        instance.manipulation_traces = result.get('manipulation_traces', [])
        instance.detected_techniques = result.get('detected_techniques', [])
        instance.affected_regions = [t.get('spatial_region', '') for t in result.get('manipulation_traces', []) if t.get('spatial_region')]
        instance.forensic_evidence = result.get('forensic_evidence', {}) if isinstance(result.get('forensic_evidence'), dict) else {}
        instance.technical_report = result.get('technical_report', '')
        instance.risk_level = result.get('risk_level', 'safe')
        instance.recommended_actions = result.get('recommended_actions', [])
        instance.status = 'completed'
        instance.processing_time_ms = processing_ms
        instance.frames_analyzed = result.get('frame_analysis_summary', {}).get('total_frames_analyzed', 0) if isinstance(result.get('frame_analysis_summary'), dict) else 0
        instance.save()

        return Response({
            'data': self.get_serializer(instance).data,
            'message': '深度伪造鉴别完成',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = DeepfakeVideoDetection.objects.count()
        completed = DeepfakeVideoDetection.objects.filter(status='completed').count()
        confirmed_deepfake = DeepfakeVideoDetection.objects.filter(overall_verdict__in=['confirmed_deepfake', 'likely_deepfake']).count()
        authentic = DeepfakeVideoDetection.objects.filter(overall_verdict__in=['authentic', 'likely_authentic']).count()
        avg_prob = sum(DeepfakeVideoDetection.objects.values_list('deepfake_probability', flat=True)) / max(completed, 1)
        return Response({
            'total': total, 'completed': completed,
            'confirmed_deepfake': confirmed_deepfake, 'authentic': authentic,
            'avg_deepfake_prob': round(avg_prob, 3),
        })
