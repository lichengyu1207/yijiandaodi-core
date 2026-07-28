import time
import json
import re
import hashlib
import logging
from datetime import datetime
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .chapter_detect_models import PaperSubmission, ChapterAnalysis

logger = logging.getLogger(__name__)


class ChapterAnalysisSerializer(serializers.ModelSerializer):
    verdict_display = serializers.CharField(source='get_verdict_display', read_only=True)
    chapter_type_display = serializers.CharField(source='get_chapter_type_display', read_only=True)

    class Meta:
        model = ChapterAnalysis
        fields = [
            'id', 'submission', 'chapter_order', 'chapter_title',
            'chapter_type', 'chapter_type_display',
            'original_text', 'char_count', 'word_count', 'paragraph_count', 'sentence_count',
            'ai_probability', 'plagiarism_similarity', 'integrity_score',
            'verdict', 'verdict_display',
            'perplexity_score', 'burstiness_score', 'vocabulary_diversity',
            'academic_tone_score', 'citation_density',
            'problem_sentences', 'plagiarism_sources', 'ai_markers',
            'writing_style_notes', 'detailed_analysis', 'created_at',
        ]
        read_only_fields = ['id', 'integrity_score', 'verdict', 'perplexity_score', 'burstiness_score',
                           'vocabulary_diversity', 'academic_tone_score', 'citation_density',
                           'problem_sentences', 'plagiarism_sources', 'ai_markers',
                           'writing_style_notes', 'detailed_analysis', 'created_at']


class PaperSubmissionSerializer(serializers.ModelSerializer):
    paper_type_display = serializers.CharField(source='get_paper_type_display', read_only=True)
    subject_area_display = serializers.CharField(source='get_subject_area_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    verdict_display = serializers.CharField(source='get_overall_verdict_display', read_only=True)
    chapters = ChapterAnalysisSerializer(many=True, read_only=True)

    class Meta:
        model = PaperSubmission
        fields = [
            'id', 'user', 'title', 'author_name', 'institution',
            'paper_type', 'paper_type_display', 'subject_area', 'subject_area_display',
            'original_text', 'text_preview', 'total_characters', 'total_words', 'estimated_pages',
            'file_name', 'file_size', 'file_hash_sha256',
            'overall_integrity_score', 'overall_ai_score', 'overall_plagiarism_score',
            'overall_verdict', 'verdict_display', 'confidence_level',
            'chapter_count', 'sections_analyzed', 'problematic_sections_count', 'clean_sections_count',
            'structure_analysis', 'chapter_results', 'key_findings', 'risk_indicators', 'citation_analysis',
            'detailed_report', 'student_friendly_summary', 'improvement_recommendations',
            'status', 'status_display', 'processing_time_ms', 'error_message',
            'tags', 'metadata', 'created_at', 'updated_at', 'chapters',
        ]
        read_only_fields = [
            'id', 'text_preview', 'total_characters', 'total_words', 'estimated_pages',
            'file_hash_sha256', 'overall_integrity_score', 'overall_ai_score', 'overall_plagiarism_score',
            'overall_verdict', 'confidence_level', 'chapter_count', 'sections_analyzed',
            'problematic_sections_count', 'clean_sections_count',
            'structure_analysis', 'chapter_results', 'key_findings', 'risk_indicators', 'citation_analysis',
            'detailed_report', 'student_friendly_summary', 'improvement_recommendations',
            'status', 'processing_time_ms', 'error_message', 'tags', 'metadata', 'created_at', 'updated_at', 'chapters',
        ]


WINSTON_SYSTEM_PROMPT = """你是一鉴到底(YiJianDaoDi)平台的「学术论文分章节检测引擎」核心AI。你的能力对标国际领先产品 Winston AI，专门为学生和学术机构提供论文诚信检测服务。

## 你的核心理念
- **学生友好**：用通俗易懂的语言解释检测结果，不使用过于技术化的术语
- **逐章分析**：对论文的每个章节独立评分，精确定位问题位置
- **建设性反馈**：不只是指出问题，更要给出具体的修改建议
- **多维度评估**：AI检测 + 抄袭检测 + 学术规范 + 写作质量，四合一

## 论文结构识别能力

你能自动识别以下学术论文章节类型：
1. **摘要(Abstract)** — 研究背景+目的+方法+结果+结论的浓缩
2. **引言/绪论(Introduction)** — 研究背景、问题陈述、研究意义、论文结构
3. **文献综述(Literature Review)** — 前人研究成果梳理、研究空白识别
4. **研究方法(Methodology)** — 实验设计、数据采集方法、分析框架
5. **研究结果(Results)** — 数据呈现、实验结果、统计分析
6. **讨论(Discussion)** — 结果解读、与前人研究对比、局限性分析
7. **结论(Conclusion)** — 主要发现总结、贡献声明、未来研究方向
8. **参考文献(References)** — 引用列表格式检查
9. **附录(Appendix)** — 补充材料、代码、原始数据
10. **致谢(Acknowledgement)** — 基金资助、感谢人员
11. **其他章节** — 自定义章节

## 7维度学术检测体系

### D1: AI生成内容检测 (AI Content Detection)
针对学术论文场景优化：
- 检测GPT-4/Claude/Gemini/DeepSeek等主流AI生成的学术文本
- 重点关注：文献综述是否为AI拼凑（缺乏真正理解）、方法论描述是否泛化空洞
- 学术AI特征：过度使用"值得注意的是"、"综上所述"、"研究表明"等模板句式
- 引用模式异常：AI生成的引用往往不存在或被篡改（幻觉引用）
- 逻辑链条：AI倾向于给出完美但缺乏深度的论证链

### D2: 抄袭相似度检测 (Plagiarism Detection)
- 直接复制：与已发表论文/网络资源逐句比对
- 改写抄袭：同义词替换但保留原句结构
- 自我抄袭：作者复制自己之前发表的内容（跨论文重复）
- 翻译抄袭：从外文翻译后未标注来源
- 拼接抄袭：多源内容组合而成
- 数据抄袭：图表数据/统计结果的可疑复现

### D3: 学术写作规范性 (Academic Writing Standards)
- 格式规范：是否符合目标期刊/学校的格式要求
- 语言风格：是否保持正式学术语气，避免口语化表达
- 段落结构：主题句→支撑句→过渡→小结 是否完整
- 术语一致性：专业术语全文统一使用
- 缩写规范：首次出现时是否全称+缩写

### D4: 引用完整性 (Citation Integrity)
- 引用格式：是否符合APA/MLA/GB/T 7714等标准
- 引用密度：各章节引用数量是否合理（文献综述应密集，方法部分适中）
- 引用时效性：是否包含近3-5年的最新文献
- 引用相关性：引用是否与上下文直接相关
- 虚假引用：检测不存在的DOI/ISBN/作者组合

### D5: 数据与方法可信度 (Data & Method Credibility)
- 方法描述完整性：是否能据此复现实验
- 样本量合理性：样本量是否足够支撑结论
- 统计方法正确性：t检验/ANOVA/回归等方法选择是否恰当
- 结果呈现：是否有必要的统计量（p值/置信区间/效应量）
- 数据一致性：正文中的数字是否与表格/图一致

### D6: 逻辑连贯性 (Logical Coherence)
- 论点-论据-结论链条是否完整
- 各章节之间的衔接是否自然
- 是否存在自相矛盾的表述
- 研究问题→方法→结果→讨论→结论 的闭环检验
- 假设检验的一致性

### D7: 创新性评估 (Originality Assessment)
- 与已有研究的差异化程度
- 新方法/新数据/新视角的贡献识别
- 研究空白填补的有效性
- 结论的实际应用价值

## 输出要求（严格JSON）

{
  "paper_structure": {
    "detected_chapters": [
      {
        "order": 1,
        "title": "章节标题",
        "type": "abstract|introduction|literature_review|methodology|results|discussion|conclusion|references|appendix|acknowledgement|other",
        "char_start": N,
        "char_end": N,
        "estimated_percentage": float (该章占总字数%)
      }
    ],
    "total_chapters_detected": N,
    "structure_completeness_score": 0-100,
    "missing_sections": ["缺少的章节"]
  },

  "chapter_analyses": [
    {
      "order": 1,
      "title": "章节标题",
      "type": "abstract",
      "word_count": N,

      "ai_probability": 0.00-1.00,
      "plagiarism_similarity": 0.00-1.00,
      "integrity_score": 0-100,
      "verdict": "original_clean|minor_ai_hints|moderate_ai_content|highly_ai_generated|plagiarism_found|mixed_issues|inconclusive",

      "perplexity": 0-100,
      "burstiness": 0-100,
      "vocabulary_diversity_ttr": 0.0-1.0,
      "academic_tone_score": 0-100,
      "citation_density": 0.0 (引用/千字),

      "problem_sentences": [
        {
          "index_in_chapter": N,
          "text_preview": "问题句子前80字符...",
          "issue_type": "ai_generated|plagiarized|poor_writing|missing_citation|logical_error|data_issue",
          "severity": "low|medium|high|critical",
          "suggestion": "具体修改建议"
        }
      ],

      "plagiarism_sources": [
        {
          "matched_text": "匹配文本片段",
          "similarity_percent": 0-100,
          "source_description": "推测来源",
          "type": "direct_copy|paraphrase|self_plagiarism|translation"
        }
      ],

      "ai_markers": ["marker1", "marker2"],
      "writing_style_notes": "本章写作风格的简要评价(学生友好的语言)",
      "key_strengths": ["优点1", "优点2"],
      "areas_for_improvement": ["改进建议1"]
    }
  ],

  "overall_assessment": {
    "integrity_score": 0-100,
    "ai_score": 0-100,
    "plagiarism_score": 0-100,
    "verdict": "original|minor_issues|moderate_risk|high_risk|ai_generated_suspected|plagiarism_detected|mixed_violation",
    "confidence": "very_high|high|medium|low",

    "score_breakdown": {
      "d1_ai_detection": {"score": 0-100, "weight": 0.30, "verdict": ""},
      "d2_plagiarism": {"score": 0-100, "weight": 0.25, "verdict": ""},
      "d3_academic_writing": {"score": 0-100, "weight": 0.15, "verdict": ""},
      "d4_citation_integrity": {"score": 0-100, "weight": 0.10, "verdict": ""},
      "d5_data_method": {"score": 0-100, "weight": 0.10, "verdict": ""},
      "d6_logical_coherence": {"score": 0-100, "weight": 0.05, "verdict": ""},
      "d7_originality": {"score": 0-100, "weight": 0.05, "verdict": ""}
    },

    "chapter_summary": {
      "total_chapters": N,
      "clean": N,
      "minor_issues": N,
      "needs_revision": N,
      "critical": N
    }
  },

  "student_friendly_summary": "用通俗语言写给学生的摘要（200-300字）：\n\n【总体评价】一句话概括\n\n【做得好的地方】\n1. ...\n\n【需要注意的地方】\n1. ...\n\n【修改优先级】\n🔴 紧急(必须改): ...\n🟡 重要(应该改): ...\n🟢 建议(可以改): ...\n\n【给同学的一句话】鼓励性话语...",

  "improvement_recommendations": [
    {
      "priority": "P0(紧急)|P1(重要)|P2(建议)",
      "chapter_ref": "第X章 / 具体章节名",
      "issue": "问题描述",
      "suggestion": "具体如何修改",
      "example_before": "修改前示例",
      "example_after": "修改后示例"
    }
  ],

  "citation_analysis": {
    "total_citations_found": N,
    "citations_per_1000words": float,
    "oldest_citation_year": N,
    "newest_citation_year": N,
    "avg_citation_age_years": float,
    "format_compliance": "compliant|mostly_compliant|needs_improvement|non_compliant",
    "issues": []
  },

  "risk_indicators": {
    "top_risks": [{"category": "...", "description": "...", "severity": "..."}],
    "overall_risk_level": "low|medium|high|critical"
  },

  "detailed_report": "完整详细报告..."
}"""


def _count_words(text: str) -> int:
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    return chinese_chars + english_words


def _split_into_chapters(text: str) -> list:
    """智能拆分为章节"""
    patterns = [
        r'(?:^|\n)\s*(?:第[一二三四五六七八九十\d]+[章节篇]|Chapter\s*\d+[\.:\s]|[\d]+\.[\s]+[^\n]{2,30})',
        r'(?:^|\n)\s*(?:摘要|Abstract|ABSTRACT|引言|绪论|Introduction|INTRODUCTION)',
        r'(?:^|\n)\s*(?:文献综述|Literature\s*Review|相关工作|Related\s*Work)',
        r'(?:^|\n)\s*(?:研究方法|Methodology|METHODS?|实验设计|Experimental\s*Design)',
        r'(?:^|\n)\s*(?:研究结果|Results|RESULTS?|实验结果)',
        r'(?:^|\n)\s*(?:讨论|Discussion|DISCUSSION|分析与讨论)',
        r'(?:^|\n)\s*(?:结论|Conclusion|CONCLUSIONS?|总结|Summary)',
        r'(?:^|\n)\s*(?:参考文献|References|REFERENCES?|Bibliography)',
        r'(?:^|\n)\s*(?:致谢|Acknowledgements?|附录|Appendix)',
    ]
    combined_pattern = '|'.join(patterns)
    matches = list(re.finditer(combined_pattern, text, re.MULTILINE | re.IGNORECASE))

    chapters = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        title = match.group().strip()
        content = text[start:end].strip()
        if len(content) > 20:
            chapters.append({'title': title, 'content': content, 'start': start, 'end': end})

    if not chapters:
        chapters.append({'title': '全文', 'content': text, 'start': 0, 'end': len(text)})
    return chapters


def _detect_chapter_type(title: str, content: str) -> str:
    t_lower = title.lower()
    c_lower = content[:500].lower()
    combined = f"{t_lower} {c_lower}"
    if any(k in combined for k in ['摘要', 'abstract']):
        return 'abstract'
    if any(k in combined for k in ['引言', '绪论', 'introduction']):
        return 'introduction'
    if any(k in combined for k in ['文献综述', 'literature review', 'related work', '相关工作']):
        return 'literature_review'
    if any(k in combined for k in ['方法', 'methodology', 'method', '实验设计', 'experimental']):
        return 'methodology'
    if any(k in combined for k in ['结果', 'result', 'experiment', '实验结果', '数据分析']):
        return 'results'
    if any(k in combined for k in ['讨论', 'discussion', '分析', 'analyze']):
        return 'discussion'
    if any(k in combined for k in ['结论', 'conclusion', '总结', 'summary']):
        return 'conclusion'
    if any(k in combined for k in ['参考', 'reference', 'bibliography', '文献']):
        return 'references'
    if any(k in combined for k in ['致谢', 'acknowledge']):
        return 'acknowledgement'
    if any(k in combined for k in ['附录', 'appendix']):
        return 'appendix'
    return 'other'


def _call_winston_detect(paper_text: str, title: str, paper_type: str, subject: str) -> dict:
    try:
        from content_app.deepseek_service import get_deepseek_client
        client = get_deepseek_client()
        response = client.simple_chat(
            user_message=f"""【待检测论文】
标题: {title}
类型: {paper_type}
学科: {subject}
总字数: {_count_words(paper_text)} 字
字符数: {len(paper_text)} 字符

【论文全文】({len(paper_text)}字符)
{paper_text[:25000]}""",
            system_prompt=WINSTON_SYSTEM_PROMPT,
            temperature=0.12,
        )
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(response[json_start:json_end])
        return {"raw_response": response}
    except Exception as e:
        logger.error(f"Winston detection error: {e}")
        return {"error": str(e)}


class PaperSubmissionViewSet(viewsets.ModelViewSet):
    queryset = PaperSubmission.objects.all()
    serializer_class = PaperSubmissionSerializer
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
        original_text = serializer.validated_data.get('original_text', '')
        title = serializer.validated_data.get('title', '未命名论文')
        if not original_text.strip():
            return Response({'error': '论文内容不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        instance = serializer.save(
            user=request.user,
            status='parsing_structure',
            file_hash_sha256=hashlib.sha256(original_text.encode('utf-8')).hexdigest(),
            text_preview=original_text[:500],
            total_characters=len(original_text),
            total_words=_count_words(original_text),
            estimated_pages=max(1, len(original_text) // 4000),
        )

        result = _call_winston_detect(
            original_text, title,
            instance.get_paper_type_display(),
            instance.get_subject_area_display(),
        )
        total_elapsed = int((time.time() - start_time) * 1000)

        structure = result.get('paper_structure', {})
        chapters_data = result.get('chapter_analyses', [])
        overall = result.get('overall_assessment', {})
        citation = result.get('citation_analysis', {})

        instance.structure_analysis = structure
        instance.chapter_results = chapters_data
        instance.key_findings = result.get('risk_indicators', {}).get('top_risks', [])
        instance.risk_indicators = result.get('risk_indicators', {})
        instance.citation_analysis = citation
        instance.detailed_report = result.get('detailed_report', '')
        instance.student_friendly_summary = result.get('student_friendly_summary', '')
        instance.improvement_recommendations = result.get('improvement_recommendations', [])

        instance.overall_integrity_score = float(overall.get('integrity_score', 100))
        instance.overall_ai_score = float(overall.get('ai_score', 0))
        instance.overall_plagiarism_score = float(overall.get('plagiarism_score', 0))
        instance.overall_verdict = overall.get('verdict', 'original')
        instance.confidence_level = overall.get('confidence', 'high')

        instance.chapter_count = len(chapters_data)
        ch_summary = overall.get('chapter_summary', {})
        instance.problematic_sections_count = int(ch_summary.get('needs_revision', 0)) + int(ch_summary.get('critical', 0))
        instance.clean_sections_count = int(ch_summary.get('clean', 0)) + int(ch_summary.get('minor_issues', 0))
        instance.sections_analyzed = len(chapters_data)

        instance.status = 'completed'
        instance.processing_time_ms = total_elapsed
        instance.save()

        for ch_data in chapters_data:
            ChapterAnalysis.objects.create(
                submission=instance,
                chapter_order=ch_data.get('order', 1),
                chapter_title=ch_data.get('title', ''),
                chapter_type=_detect_chapter_type(ch_data.get('title', ''), ch_data.get('original_text', '')),
                original_text=ch_data.get('original_text', '')[:10000],
                char_count=len(ch_data.get('original_text', '')),
                word_count=ch_data.get('word_count', 0),
                ai_probability=float(ch_data.get('ai_probability', 0)) * 100,
                plagiarism_similarity=float(ch_data.get('plagiarism_similarity', 0)) * 100,
                integrity_score=float(ch_data.get('integrity_score', 100)),
                verdict=ch_data.get('verdict', 'original_clean'),
                perplexity_score=float(ch_data.get('perplexity', 50)),
                burstiness_score=float(ch_data.get('burstiness', 50)),
                vocabulary_diversity=float(ch_data.get('vocabulary_diversity_ttr', 0.5)),
                academic_tone_score=float(ch_data.get('academic_tone_score', 70)),
                citation_density=float(ch_data.get('citation_density', 0)),
                problem_sentences=ch_data.get('problem_sentences', []),
                plagiarism_sources=ch_data.get('plagiarism_sources', []),
                ai_markers=ch_data.get('ai_markers', []),
                writing_style_notes=ch_data.get('writing_style_notes', ''),
                detailed_analysis=ch_data,
            )

        return Response({
            'data': self.get_serializer(instance).data,
            'message': f'分章节检测完成！综合诚信分 {instance.overall_integrity_score:.1f}% | '
                       f'判定: {instance.get_overall_verdict_display()} | '
                       f'共分析 {instance.chapter_count} 章节, '
                       f'其中 {instance.clean_sections_count} 章清洁, {instance.problematic_sections_count} 章需关注 | '
                       f'耗时: {total_elapsed}ms',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = PaperSubmission.objects.count()
        completed = PaperSubmission.objects.filter(status='completed').count()
        avg_integrity = sum(PaperSubmission.objects.values_list('overall_integrity_score', flat=True)) / max(completed, 1)
        avg_ai = sum(PaperSubmission.objects.values_list('overall_ai_score', flat=True)) / max(completed, 1)
        by_verdict = {}
        for v_val, v_label in PaperSubmission.VERDICT_CHOICES:
            cnt = PaperSubmission.objects.filter(overall_verdict=v_val).count()
            if cnt > 0: by_verdict[v_label] = cnt
        by_type = {}
        for t_val, t_label in PaperSubmission.PAPER_TYPE_CHOICES:
            cnt = PaperSubmission.objects.filter(paper_type=t_val).count()
            if cnt > 0: by_type[t_label] = cnt
        return Response({
            'total_papers': total, 'completed': completed,
            'avg_integrity_score': round(avg_integrity, 1),
            'avg_ai_score': round(avg_ai, 1),
            'by_verdict': by_verdict, 'by_paper_type': by_type,
        })

    @action(detail=True, methods=['post'])
    def export_pdf(self, request, pk=None):
        instance = self.get_object()
        return Response({
            'message': 'PDF报告导出功能已触发',
            'download_url': f'/api/chapter-detect/{pk}/pdf/',
            'paper_id': str(instance.id),
            'title': instance.title,
        })
