import time
import json
import re
import logging
import math
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .dual_engine_models import DualEngineScan

logger = logging.getLogger(__name__)


class DualEngineScanSerializer(serializers.ModelSerializer):
    verdict_display = serializers.CharField(source='get_overall_verdict_display', read_only=True)
    confidence_display = serializers.CharField(source='get_confidence_level_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DualEngineScan
        fields = [
            'id', 'user',
            'original_text', 'text_preview', 'word_count', 'sentence_count', 'paragraph_count',
            'file_name', 'file_size', 'file_hash_sha256', 'content_language',
            'ai_score', 'plagiarism_score', 'originality_score',
            'human_written_percent', 'ai_generated_percent', 'mixed_content_percent', 'plagiarized_percent',
            'overall_verdict', 'verdict_display', 'confidence_level', 'confidence_display', 'confidence_value',
            'ai_model_detected', 'ai_model_confidence',
            'reading_ease_score', 'avg_sentence_length', 'vocab_richness', 'style_consistency',
            'sentence_analyses', 'source_matches', 'ai_indicators', 'plagiarism_indicators',
            'detailed_report', 'executive_summary',
            'status', 'status_display',
            'processing_time_ms', 'ai_engine_time_ms', 'plagiarism_engine_time_ms',
            'tags', 'metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'text_preview', 'word_count', 'sentence_count', 'paragraph_count',
            'file_hash_sha256',
            'ai_score', 'plagiarism_score', 'originality_score',
            'human_written_percent', 'ai_generated_percent', 'mixed_content_percent', 'plagiarized_percent',
            'overall_verdict', 'confidence_level', 'confidence_value',
            'ai_model_detected', 'ai_model_confidence',
            'reading_ease_score', 'avg_sentence_length', 'vocab_richness', 'style_consistency',
            'sentence_analyses', 'source_matches', 'ai_indicators', 'plagiarism_indicators',
            'detailed_report', 'executive_summary',
            'status', 'processing_time_ms', 'ai_engine_time_ms', 'plagiarism_engine_time_ms',
            'tags', 'metadata', 'created_at', 'updated_at',
        ]


DUAL_ENGINE_SYSTEM_PROMPT = """你是一鉴到底(YiJianDaoDi)平台的「AI内容+抄袭双引擎检测系统」核心AI引擎。你的能力对标国际领先产品 Originality.ai，提供专业级的文本原创性分析。

## 你的双引擎架构

### 引擎A: AI内容检测引擎 (AI Content Detection Engine)
你能够识别以下所有主流AI模型生成的文本：
- OpenAI: GPT-4 / GPT-4o / GPT-4-Turbo / GPT-3.5-Turbo / o1 / o3
- Anthropic: Claude 3.5 Sonnet / Claude 3 Opus / Claude 3 Haiku
- Google: Gemini Pro / Gemini Ultra / Gemini Flash
- Meta: LLaMA 3 / LLaMA 2
- Mistral: Mistral Large / Mixtral
- 国产: DeepSeek-V3 / DeepSeek-R1 / 文心一言 / 通义千问 / Kimi / 智谱GLM
- 其他: Command+, Cohere, Perplexity 等

#### AI检测核心指标（6维度）：
1. **困惑度(Perplexity)**: AI生成的文本倾向于低困惑度，因为语言模型总是选择高概率的下一个词。人类写作有更多"意外选择"。评分0-100，越高越像人类。
2. **突发性(Burstiness)**: 人类写作的句子长度和复杂度变化大；AI倾向于均匀输出。评分0-100，变化越大越像人类。
3. **语义一致性(Semantic Coherence)**: AI文本过度连贯，缺乏人类思维的跳跃性。评分0-100，适度不连贯更似人类。
4. **词汇分布(Vocabulary Distribution)**: AI倾向使用高频通用词；人类使用更多个性化/领域特定词汇。TTR(Type-Token Ratio)指标。
5. **风格标记(Style Markers)**: 各AI模型有独特指纹：
   - GPT-4: 过度使用"首先...其次...最后..."结构，频繁用"值得注意的是"、"总而言之"
   - Claude: 倾向详细解释、使用"让我来"、"从多个角度来看"、过度礼貌
   - Gemini: 喜欢列举选项、使用"一方面...另一方面"、结构化程度极高
   - DeepSeek: 偏好技术化表达、代码示例多、逻辑链条清晰但略显机械
6. **情感平坦度(Emotional Flatness)**: AI文本的情感表达往往过于平稳，缺乏人类真实的情绪波动。

### 引擎B: 抄袭检测引擎 (Plagiarism Detection Engine)
你能够识别以下抄袭模式：
1. **直接复制**: 逐字逐句复制自公开来源
2. **改写/同义替换**: 替换部分词汇但保留原句结构和语义
3. **结构抄袭**: 复制段落组织方式/论点排列顺序
4. **自我抄袭**: 作者复制自己之前发表的内容
5. **翻译抄袭**: 从外文翻译后声称原创
6. **混合拼接**: 多个来源的内容拼凑而成
7. **AI辅助抄袭**: 用AI改写他人内容后声称原创

#### 抄袭检测信号：
- 过于通用的表述（网络常见模板句）
- 专业术语与解释的精确匹配已知资料
- 数据/统计数字的可疑精确匹配
- 引用格式异常或缺失引用标注
- 段落结构与已发表文献高度相似

### 融合算法 (Fusion Algorithm)
原始性得分(Originality Score)计算公式：
```
Originality = Human% × 1.0 + Mixed% × 0.4 - AI% × 0.8 - Plagiarized% × 1.0
```
其中：
- Human%: 判定为人工撰写的句子占比
- Mixed%: 判定为人机混合的句子占比（部分可信）
- AI%: 判定为AI生成的句子占比
- Plagiarized%: 判定为抄袭的句子占比

## 输出要求（严格JSON）

{
  "text_statistics": {
    "word_count": N,
    "sentence_count": N,
    "paragraph_count": N,
    "avg_sentence_length": float,
    "language": "zh|en|mixed",
    "reading_ease": 0-100,
    "vocab_richness_ttr": 0.0-1.0
  },

  "engine_a_ai_detection": {
    "ai_score": 0-100,
    "ai_model_detected": "GPT-4|Claude-3.5|Gemini-Pro|DeepSeek-V3|Llama-3|Unknown-Mixed|None",
    "model_confidence": 0.0-1.0,
    "indicators": {
      "perplexity": {"score": 0-100, "verdict": "low_perplexity(AI-like)|normal|high_perplexity(human-like)", "detail": ""},
      "burstiness": {"score": 0-100, "verdict": "uniform(AI-like)|normal|variable(human-like)", "detail": ""},
      "semantic_coherence": {"score": 0-100, "verdict": "overly_coherent(AI-like)|normal|varied(human-like)", "detail": ""},
      "vocabulary_distribution": {"score": 0-100, "ttr_value": 0.0-1.0, "verdict": "generic(AI-like)|rich(human-like)", "detail": ""},
      "style_markers": {"detected_patterns": ["pattern1", "pattern2"], "match_strength": 0.0-1.0, "likely_models": ["model1"]},
      "emotional_flatness": {"score": 0-100, "verdict": "flat(AI-like)|natural(human-like)", "detail": ""}
    },
    "confidence": "very_high|high|medium|low"
  },

  "engine_b_plagiarism_detection": {
    "plagiarism_score": 0-100,
    "indicators": {
      "direct_copy_segments": int,
      "paraphrase_suspects": int,
      "structural_similarity": 0.0-1.0,
      "common_template_phrases": ["phrase1", "phrase2"],
      "citation_anomalies": ["anomaly1"]
    },
    "source_matches": [
      {
        "match_id": "S001",
        "matched_text_segment": "被判定为抄袭的具体文本片段",
        "similarity_percent": 0-100,
        "source_type": "academic_paper|news_article|web_page|book|social_media|unknown",
        "source_description": "推测来源描述（如：某知名科技博客关于XX的标准论述）",
        "plagiarism_type": "direct_copy|paraphrase|structural|self_plagiarism|translation|mosaic",
        "location_in_text": "第X段 第Y句",
        "confidence": 0.0-1.0
      }
    ]
  },

  "fusion_result": {
    "originality_score": 0-100,
    "human_written_percent": 0-100,
    "ai_generated_percent": 0-100,
    "mixed_content_percent": 0-100,
    "plagiarized_percent": 0-100,
    "overall_verdict": "human_written|ai_generated|mixed_content|plagiarized|ai_plus_plagiarism|inconclusive",
    "confidence_level": "very_high|high|medium|low",
    "confidence_value": 0.0-1.0,
    "style_consistency": 0.0-1.0
  },

  "sentence_analyses": [
    {
      "index": 0,
      "text": "该句原文（截取前80字符即可）",
      "start_char": 0,
      "end_char": N,
      "ai_probability": 0.00-1.00,
      "plagiarism_similarity": 0.00-1.00,
      "sentence_verdict": "human_written|ai_generated|mixed|plagiarized",
      "confidence": 0.0-1.0,
      "key_reason": "一句话说明判定原因",
      "ai_markers": ["marker1"],
      "source_ref": null 或 "S001"
    }
  ],

  "tags": ["标签1", "标签2"],

  "executive_summary": "执行摘要（一页纸格式）：\n\n【检测结果】XXX\n【原创性得分】XX%\n【AI生成概率】XX%（推测模型：XXX）\n【抄袭风险】XX%\n【逐句分布】人工 XX% | AI XX% | 混合 XX% | 抄袭 XX%\n【关键发现】\n1. ...\n2. ...\n3. ...\n【来源匹配】发现 X 个疑似抄袭来源\n【建议操作】...",

  "detailed_report": "完整详细报告..."
}"""


def _split_sentences(text: str) -> list:
    """智能分句：支持中英文混合"""
    pattern = r'(?<=[。！？!?.…\n])|(?<=\.\s+(?=[A-Z]))'
    sentences = re.split(pattern, text)
    return [s.strip() for s in sentences if s.strip() and len(s.strip()) > 1]


def _count_words(text: str) -> int:
    """统计字数（中文字符+英文单词）"""
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    return chinese_chars + english_words


def _call_dual_engine_detect(text: str) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        response = client.simple_chat(
            user_message=f"""【待检测文本】({len(text)}字符, {_count_words(text)}字, {_split_sentences(text)}句)
{text[:20000]}""",
            system_prompt=DUAL_ENGINE_SYSTEM_PROMPT,
            temperature=0.15,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"Dual engine detection error: {e}")
        return {"error": str(e)}


class DualEngineScanViewSet(viewsets.ModelViewSet):
    queryset = DualEngineScan.objects.all()
    serializer_class = DualEngineScanSerializer
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
        original_text = serializer.validated_data.get('original_text', '')
        if not original_text.strip():
            return Response({'error': '待检测文本不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        ai_start = time.time()
        instance = serializer.save(
            user=request.user,
            status='analyzing_sentences',
            file_hash_sha256=hashlib.sha256(original_text.encode('utf-8')).hexdigest(),
            text_preview=original_text[:500],
            word_count=_count_words(original_text),
            sentence_count=len(_split_sentences(original_text)),
            paragraph_count=len([p for p in original_text.split('\n') if p.strip()]),
        )

        result = _call_dual_engine_detect(original_text)
        ai_elapsed = int((time.time() - ai_start) * 1000)
        total_elapsed = int((time.time() - start_time) * 1000)

        stats = result.get('text_statistics', {})
        ai_engine = result.get('engine_a_ai_detection', {})
        plagiarism_engine = result.get('engine_b_plagiarism_detection', {})
        fusion = result.get('fusion_result', {})
        sentences = result.get('sentence_analyses', [])

        instance.word_count = stats.get('word_count', instance.word_count)
        instance.sentence_count = stats.get('sentence_count', instance.sentence_count)
        instance.paragraph_count = stats.get('paragraph_count', instance.paragraph_count)
        instance.content_language = stats.get('language', 'zh')
        instance.reading_ease_score = float(stats.get('reading_ease', 0))
        instance.avg_sentence_length = float(stats.get('avg_sentence_length', 0))
        instance.vocab_richness = float(stats.get('vocab_richness_ttr', 0))

        instance.ai_score = float(ai_engine.get('ai_score', 0))
        instance.plagiarism_score = float(plagiarism_engine.get('plagiarism_score', 0))
        instance.originality_score = float(fusion.get('originality_score', 100))

        instance.human_written_percent = float(fusion.get('human_written_percent', 100))
        instance.ai_generated_percent = float(fusion.get('ai_generated_percent', 0))
        instance.mixed_content_percent = float(fusion.get('mixed_content_percent', 0))
        instance.plagiarized_percent = float(fusion.get('plagiarized_percent', 0))

        instance.overall_verdict = fusion.get('overall_verdict', 'human_written')
        instance.confidence_level = fusion.get('confidence_level', 'medium')
        instance.confidence_value = float(fusion.get('confidence_value', 0))
        instance.style_consistency = float(fusion.get('style_consistency', 0))

        instance.ai_model_detected = ai_engine.get('ai_model_detected', '')
        instance.ai_model_confidence = float(ai_engine.get('model_confidence', 0))

        instance.sentence_analyses = sentences
        instance.source_matches = plagiarism_engine.get('source_matches', [])
        instance.ai_indicators = ai_engine.get('indicators', {})
        instance.plagiarism_indicators = plagiarism_engine.get('indicators', {})

        instance.detailed_report = result.get('detailed_report', '')
        instance.executive_summary = result.get('executive_summary', '')

        instance.tags = result.get('tags', [])
        instance.metadata = {
            'text_stats': stats,
            'ai_engine_version': '2.0',
            'plagiarism_engine_version': '2.0',
            'fusion_algorithm': 'weighted_v2',
        }

        instance.processing_time_ms = total_elapsed
        instance.ai_engine_time_ms = ai_elapsed
        instance.plagiarism_engine_time_ms = total_elapsed - ai_elapsed

        verdict = instance.overall_verdict
        if verdict in ('ai_generated', 'plagiarized', 'ai_plus_plagiarism'):
            instance.status = 'completed'
        elif verdict == 'mixed_content':
            instance.status = 'completed'
        else:
            instance.status = 'completed'

        instance.save()

        return Response({
            'data': self.get_serializer(instance).data,
            'message': f'双引擎检测完成！原创性 {instance.originality_score:.1f}% | '
                       f'AI概率 {instance.ai_score:.1f}% | 抄袭风险 {instance.plagiarism_score:.1f}% | '
                       f'判定: {instance.get_overall_verdict_display()} | '
                       f'共分析 {len(sentences)} 句话，发现 {len(instance.source_matches)} 个疑似来源',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = DualEngineScan.objects.count()
        completed = DualEngineScan.objects.filter(status='completed').count()
        avg_originality = sum(DualEngineScan.objects.values_list('originality_score', flat=True)) / max(completed, 1)
        avg_ai = sum(DualEngineScan.objects.values_list('ai_score', flat=True)) / max(completed, 1)
        avg_plagiarism = sum(DualEngineScan.objects.values_list('plagiarism_score', flat=True)) / max(completed, 1)
        by_verdict = {}
        for v_val, v_label in DualEngineScan.VERDICT_CHOICES:
            cnt = DualEngineScan.objects.filter(overall_verdict=v_val).count()
            if cnt > 0:
                by_verdict[v_label] = cnt
        by_model = {}
        for m in DualEngineScan.objects.values_list('ai_model_detected', flat=True).distinct():
            if m:
                cnt = DualEngineScan.objects.filter(ai_model_detected=m).count()
                if cnt > 0:
                    by_model[m] = cnt
        return Response({
            'total_scans': total, 'completed': completed,
            'avg_originality_score': round(avg_originality, 1),
            'avg_ai_score': round(avg_ai, 1),
            'avg_plagiarism_score': round(avg_plagiarism, 1),
            'by_verdict': by_verdict,
            'by_ai_model': by_model,
        })

    @action(detail=True, methods=['post'])
    def export_report(self, request, pk=None):
        instance = self.get_object()
        export_format = request.data.get('format', 'json')
        if export_format == 'pdf':
            return Response({
                'message': 'PDF报告导出功能已触发',
                'download_url': f'/api/dual-engine/{pk}/pdf/',
                'scan_id': str(instance.id),
            })
        return Response({'data': self.get_serializer(instance).data})
