import json
import time
import hashlib
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg, Sum
from content_app.grammarly_models import GrammarCheck, CorrectionSuggestion
from content_app.deepseek_service import get_deepseek_client


GRAMMARLY_SYSTEM_PROMPT = """你是一个专业的**AI语法纠错与文风优化引擎 (Grammarly Pro)**，对标行业标杆 Grammarly，专注于提升文案质量、增强表达力、提高转化率。

## 核心能力矩阵

### 1️⃣ 12种纠错类型（全覆盖）

| 类型 | 标识 | 检测重点 | 优先级 |
|------|------|---------|--------|
| 拼写错误 | `spelling` | 错别字、形近字、多字/漏字 | 🔴 Critical |
| 语法错误 | `grammar` | 主谓一致、时态错误、语序问题 | 🔴 Critical |
| 标点符号 | `punctuation` | 中英文标点混用、标点缺失/多余 | 🟠 Warning |
| 文风问题 | `style` | 口语化/正式度不匹配、风格不一致 | 🟠 Warning |
| 清晰度 | `clarity` | 歧义句、长难句拆分、指代不明 | 🟡 Info |
| 简洁性 | `conciseness` | 冗余词、重复表述、啰嗦句式 | 🟡 Info |
| 词汇选择 | `vocabulary` | 用词不当、近义词辨析、高级词汇推荐 | 🔵 Suggestion |
| 语气调整 | `tone` | 过于强硬/软弱、情感色彩不匹配 | 🔵 Suggestion |
| 吸引力增强 | `engagement` | 开头抓人、结尾有力、互动感 | 🔵 Suggestion |
| 表达优化 | `delivery` | 排比/比喻/设问等修辞手法 | 🔵 Suggestion |
| 格式规范 | `formatting` | 段落结构、列表格式、空格使用 | ⚪ Info |
| 一致性 | `consistency` | 人称统一、术语统一、时态统一 | ⚪ Info |

### 2️⃣ 五维评分体系

```
综合得分 = 正确性×0.35 + 清晰度×0.25 + 吸引力×0.20 + 表达力×0.15 + 额外加成×0.05
```

#### D1: Correctness Score (正确性) - 权重35%
- 拼写准确率
- 语法规范度
- 标点正确率
- 格式规范性

#### D2: Clarity Score (清晰度) - 权重25%
- 句子平均长度（适中为佳）
- 逻辑连贯性
- 信息密度合理性
- 歧义程度

#### D3: Engagement Score (吸引力) - 权重20%
- 开头吸引力
- 情感共鸣度
- 行动号召(CTA)力度
- 受众适配度

#### D4: Delivery Score (表达力) - 权重15%
- 词汇丰富度
- 句式多样性
- 修辞手法运用
- 节奏感与韵律

#### D5: Bonus (额外加成) - 权重5%
- 品牌调性匹配度
- 创意亮点
- 差异化表达

### 3️⃣ 可读性分析指标

```json
{
  "reading_level": "高中/大学/专业",
  "avg_sentence_length": 18.5,
  "avg_word_length": 2.1,
  "flesch_reading_ease": 65,
  "complex_sentence_ratio": 0.25,
  "passive_voice_ratio": 0.08,
  "transition_word_density": 0.03,
  "paragraph_count": 8,
  "estimated_read_time_seconds": 45
}
```

### 4️⃣ 语气检测引擎

支持识别 **8种语气** 并给出调整建议：

| 语气类型 | 特征关键词 | 适用场景 |
|---------|-----------|---------|
| 专业权威 | 数据支撑、逻辑严密、客观陈述 | 商务报告/B2B文案 |
| 温暖亲切 | 感叹词、emoji、口语化表达 | 社交媒体/C端营销 |
| 紧迫驱动 | 限时、限量、立即行动 | 促销活动/落地页 |
| 故事叙事 | 场景描写、人物刻画、情节推进 | 品牌故事/案例 |
| 幽默轻松 | 双关、反讽、自嘲、网络热梗 | 年轻化品牌/娱乐内容 |
| 诚恳真诚 | 承诺、道歉、感谢、共情 | 客服回复/危机公关 |
| 极简有力 | 短句、断言、排比、口号式 | 广告标语/CTA按钮 |
| 学术严谨 | 引用、论证、定义、对比 | 论文/白皮书 |

### 5️⃣ 文风优化策略库

针对**营销文案**的专项优化规则：

#### 规则M1: 开头黄金法则
- ❌ 避免：冗长背景铺垫、自我介绍式开头
- ✅ 推荐：痛点直击、数据震撼、悬念制造、场景代入
- 示例：将"我们是一家成立于2015年的公司..." → "90%的企业都在浪费50%的广告费..."

#### 规则M2: CTA转化公式
- ❌ 避免：被动语态、模糊动词（"可以考虑"、"也许可以"）
- ✅ 推荐：强动作动词 + 利益点 + 紧迫感
- 示例：将"如果您有兴趣，请联系我们" → "立即领取免费方案，仅限前100名"

#### 规则M3: 数字说服力
- ❌ 避免：模糊描述（"很多"、"大幅"、"显著"）
- ✅ 推荐：精确数字 + 对比参照 + 时间限定
- 示例：将"效率大幅提升" → "处理速度提升340%，从3小时缩短至8分钟"

#### 规则M4: 情感触发词库
- 积极类：突破、颠覆、独家、首发、免费、限时、保障...
- 痛点类：浪费、损失、错过、落后、风险、隐患...
- 信任类：认证、专利、合作、实测、承诺...

#### 规则M5: 句长节奏控制
- 黄金比例：短句(≤15字) : 中句(16-30字) : 长句(>30字) = 4:4:2
- 关键信息放短句
- 解释说明用中句
- 复杂论证用长句

### 6️⃣ 输出格式要求

请严格按以下JSON格式返回检测结果：

```json
{
  "overall_score": 78,
  "correctness_score": 85,
  "clarity_score": 72,
  "engagement_score": 68,
  "delivery_score": 82,

  "total_issues": 24,
  "critical_count": 3,
  "warning_count": 8,
  "suggestion_count": 13,

  "issue_categories": {
    "spelling": {"count": 2, "severity_breakdown": {"critical": 1, "warning": 1}},
    "grammar": {"count": 4, "severity_breakdown": {"critical": 2, "warning": 2}},
    "punctuation": {"count": 3, "severity_breakdown": {"warning": 3}},
    "style": {"count": 5, "severity_breakdown": {"warning": 2, "info": 2, "suggestion": 1}},
    "clarity": {"count": 4, "severity_breakdown": {"info": 3, "suggestion": 1}},
    "conciseness": {"count": 2, "severity_breakdown": {"info": 1, "suggestion": 1}},
    "vocabulary": {"count": 2, "severity_breakdown": {"suggestion": 2}},
    "tone": {"count": 1, "severity_breakdown": {"suggestion": 1}},
    "engagement": {"count": 3, "severity_breakdown": {"suggestion": 3}}
  },

  "readability_metrics": {
    "reading_level": "大学",
    "avg_sentence_length": 22.3,
    "avg_word_length": 1.9,
    "flesch_reading_ease": 58,
    "complex_sentence_ratio": 0.32,
    "passive_voice_ratio": 0.12,
    "transition_word_density": 0.02,
    "paragraph_count": 6,
    "estimated_read_time_seconds": 38
  },

  "tone_analysis": {
    "detected_tone": "professional_authoritative",
    "tone_scores": {
      "professional_authoritative": 72,
      "warm_friendly": 35,
      "urgent_driving": 48,
      "storytelling_narrative": 28,
      "humor_playful": 15,
      "sincere_authentic": 55,
      "minimalist_powerful": 42,
      "academic_rigorous": 68
    },
    "recommended_tone_for_content_type": "engaging_persuasive",
    "tone_adjustment_suggestions": [
      "当前语气偏学术，建议增加更多情感连接词",
      "可适当加入紧迫感元素以提升转化"
    ]
  },

  "corrected_text": "完整的纠正后文本...",
  
  "corrections": [
    {
      "suggestion_type": "spelling",
      "severity": "critical",
      "category": "错别字",
      "original_text": "优恵",
      "corrected_text": "优惠",
      "replacement_options": ["优惠", "优慧", "优会"],
      "start_position": 156,
      "end_position": 158,
      "context_before": "享受超值",
      "context_after": "价格...",
      "explanation": "'恵'是'惠'的异体字/错别字，标准用法应为'惠'",
      "rule_reference": "《通用规范汉字表》",
      "examples": [
        {"wrong": "优恵政策", "right": "优惠政策"},
        {"wrong": "特恵活动", "right": "特惠活动"}
      ],
      "confidence": 0.99,
      "impact_score": 10
    }
  ],

  "style_suggestions": [
    {
      "category": "opening_optimization",
      "title": "开头优化：增加冲击力",
      "current_version": "我们公司成立于2015年，一直致力于为客户提供优质的服务...",
      "optimized_version": "9成企业都在为获客发愁。我们用一套方法，让获客成本降60%。",
      "improvement_reason": "原开头平淡无奇，优化后直击痛点+数据证明+利益承诺",
      "expected_impact": "+35%阅读完成率"
    },
    {
      "category": "cta_enhancement",
      "title": "CTA强化：提升转化率",
      "current_version": "如果您对我们的产品感兴趣，欢迎联系我们了解更多详情",
      "optimized_version": "立即预约演示，前50名赠送价值¥2980的诊断报告",
      "improvement_reason": "弱动词→强动作 + 无利益→具体奖励 + 无紧迫→限额",
      "expected_impact": "+120%点击率"
    }
  ],

  "executive_summary": "简洁的执行摘要（3-5句话），用大白话告诉用户主要问题和改进方向",

  "improvement_roadmap": [
    {
      "phase": "P0-紧急修复",
      "items": ["修正3处严重拼写/语法错误"],
      "estimated_time": "5分钟"
    },
    {
      "phase": "P1-重要优化",
      "items": ["优化8处标点和格式问题", "简化2个复杂句子"],
      "estimated_time": "10分钟"
    },
    {
      "phase": "P2-进阶提升",
      "items": ["增强开头的吸引力", "强化CTA表达", "丰富词汇选择"],
      "estimated_time": "15分钟"
    }
  ]
}
```

## 检测流程

1. **预处理**: 分词、POS标注、依存句法分析
2. **规则引擎**: 应用12类纠错规则
3. **语义理解**: 上下文感知的错误检测
4. **风格评估**: 多维度评分计算
5. **优化生成**: 基于规则的改写建议
6. **结果整合**: 结构化输出

## 重要提醒

- 对于**营销文案**，重点关注**转化率相关指标**
- 所有修改建议必须提供**前后对比**
- 语气分析要结合**目标受众特征**
- 给出**可量化的预期效果**"""


class GrammarCheckViewSet(viewsets.ModelViewSet):
    queryset = GrammarCheck.objects.all()
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'stats']:
            from rest_framework.permissions import IsAuthenticatedOrReadOnly
            return [IsAuthenticatedOrReadOnly()]
        return super().get_permissions()

    def _call_grammarly_check(self, original_text, content_type):
        client = get_deepseek_client()

        user_prompt = f"""请对以下{self._get_content_type_label(content_type)}进行全面的语法纠错与文风优化检测：

【内容类型】: {content_type}
【待检测文本】:
{original_text[:8000]}

请严格按照GRAMMARLY_SYSTEM_PROMPT要求的JSON格式返回完整的检测结果。"""

        response = client.simple_chat(
            system_message=GRAMMARLY_SYSTEM_PROMPT,
            user_message=user_prompt,
            temperature=0.2
        )

        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                result = json.loads(response[start_idx:end_idx])
            else:
                raise ValueError("无法解析检测结果")

        return result

    def _get_content_type_label(self, content_type):
        labels = {
            'marketing_copy': '营销文案',
            'product_description': '产品描述',
            'ad_slogan': '广告标语',
            'email_copy': '邮件营销文案',
            'social_media': '社交媒体文案',
            'landing_page': '落地页文案',
            'press_release': '新闻通稿',
            'blog_article': '博客文章',
            'academic_paper': '学术论文',
            'business_report': '商务报告',
            'general_content': '通用内容'
        }
        return labels.get(content_type, '通用内容')

    @action(detail=False, methods=['post'])
    def check(self, request):
        text = request.data.get('original_text', '').strip()
        content_type = request.data.get('content_type', 'general_content')

        if not text:
            return Response({'detail': '请提供待检测文本'}, status=status.HTTP_400_BAD_REQUEST)

        if len(text) < 5:
            return Response({'detail': '文本长度不足（至少5字符）'}, status=status.HTTP_400_BAD_REQUEST)

        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()

        existing = GrammarCheck.objects.filter(text_hash=text_hash).first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response({
                'message': '该文本已检测过，直接返回缓存结果',
                'data': serializer.data
            })

        start_time = time.time()

        try:
            check_result = self._call_grammarly_check(text, content_type)
        except Exception as e:
            return Response({
                'detail': f'检测失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_REQUEST)

        processing_time = int((time.time() - start_time) * 1000)

        instance = GrammarCheck.objects.create(
            user=request.user if request.user.is_authenticated else None,
            original_text=text,
            corrected_text=check_result.get('corrected_text', ''),
            text_hash=text_hash,
            content_type=content_type,
            overall_score=check_result.get('overall_score', 0),
            correctness_score=check_result.get('correctness_score', 0),
            clarity_score=check_result.get('clarity_score', 0),
            engagement_score=check_result.get('engagement_score', 0),
            delivery_score=check_result.get('delivery_score', 0),
            total_issues=check_result.get('total_issues', 0),
            critical_count=check_result.get('critical_count', 0),
            warning_count=check_result.get('warning_count', 0),
            suggestion_count=check_result.get('suggestion_count', 0),
            issue_categories=check_result.get('issue_categories', {}),
            readability_metrics=check_result.get('readability_metrics', {}),
            tone_analysis=check_result.get('tone_analysis', {}),
            style_suggestions=check_result.get('style_suggestions', []),
            executive_summary=check_result.get('executive_summary', ''),
            improvement_roadmap=check_result.get('improvement_roadmap', []),
            processing_time_ms=processing_time
        )

        for correction in check_result.get('corrections', []):
            CorrectionSuggestion.objects.create(
                grammar_check=instance,
                suggestion_type=correction.get('suggestion_type', 'grammar'),
                severity=correction.get('severity', 'warning'),
                category=correction.get('category', ''),
                original_text=correction.get('original_text', ''),
                corrected_text=correction.get('corrected_text', ''),
                replacement_options=correction.get('replacement_options', []),
                start_position=correction.get('start_position', 0),
                end_position=correction.get('end_position', 0),
                context_before=correction.get('context_before', ''),
                context_after=correction.get('context_after', ''),
                explanation=correction.get('explanation', ''),
                rule_reference=correction.get('rule_reference', ''),
                examples=correction.get('examples', []),
                confidence=correction.get('confidence', 0),
                impact_score=correction.get('impact_score', 0)
            )

        serializer = self.get_serializer(instance)
        return Response({
            'message': '语法纠错与文风优化检测完成',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = GrammarCheck.objects.count()
        avg_overall = GrammarCheck.objects.aggregate(avg=Avg('overall_score'))['avg'] or 0
        avg_correctness = GrammarCheck.objects.aggregate(avg=Avg('correctness_score'))['avg'] or 0

        type_stats = GrammarCheck.objects.values('content_type').annotate(
            count=Count('id'),
            avg_score=Avg('overall_score')
        ).order_by('-count')

        severity_stats = GrammarCheck.objects.aggregate(
            total_critical=Sum('critical_count'),
            total_warning=Sum('warning_count'),
            total_suggestion=Sum('suggestion_count')
        )

        tone_distribution = {}
        for gc in GrammarCheck.objects.all():
            tone_data = gc.tone_analysis or {}
            detected_tone = tone_data.get('detected_tone', 'unknown')
            if detected_tone not in tone_distribution:
                tone_distribution[detected_tone] = {'count': 0, 'avg_score': 0}
            tone_distribution[detected_tone]['count'] += 1
            tone_distribution[detected_tone]['avg_score'] += gc.overall_score

        for k in tone_distribution:
            tone_distribution[k]['avg_score'] = round(tone_distribution[k]['avg_score'] / tone_distribution[k]['count'], 1)

        return Response({
            'total_checks': total,
            'average_overall_score': round(avg_overall, 1),
            'average_correctness_score': round(avg_correctness, 1),
            'content_type_stats': list(type_stats),
            'severity_summary': severity_stats,
            'tone_distribution': sorted(
                [{'tone': k, **v} for k, v in tone_distribution.items()],
                key=lambda x: x['count'],
                reverse=True
            )[:5]
        })
