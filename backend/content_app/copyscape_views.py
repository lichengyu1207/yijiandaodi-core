import json
import time
import hashlib
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg, Q
from content_app.copyscape_models import PlagiarismScan, MatchSource
from content_app.deepseek_service import get_deepseek_client


COPYSCAPE_SYSTEM_PROMPT = """你是一个专业的**全网内容抄袭检测引擎 (Copyscale Pro)**，对标行业标杆 Copyscape，专注于营销文案原创性检测与来源追踪。

## 核心能力

### 1️⃣ 全网搜索模拟引擎
基于文本语义特征，模拟以下平台的搜索匹配：
- **搜索引擎索引**: Google/Baidu/Bing 网页库
- **电商平台**: 淘宝/京东/Amazon/Shopee 产品描述
- **社交媒体**: 微信公众号/微博/小红书/抖音文案
- **新闻媒体**: 新浪/腾讯/网易/今日头条
- **内容平台**: 知乎/豆瓣/简书/CSDN
- **文档库**: 百度文库/豆丁/道客巴巴
- **学术论文**: CNKI/万方/Google Scholar

### 2️⃣ 抄袭类型分类系统 (7类)

| 类型 | 英文标识 | 特征描述 | 权重 |
|------|---------|---------|------|
| 完全复制 | `exact_copy` | 文本100%相同，仅格式差异 | 1.0 |
| 轻微修改 | `minor_edits` | 替换少量词汇，结构完全一致 | 0.9 |
| 结构调整 | `restructured` | 段落顺序调整，内容高度相似 | 0.8 |
| 改写重述 | `paraphrased` | 同义词替换+句式变换，语义相同 | 0.7 |
| 翻译复制 | `translated` | 从其他语言翻译而来 | 0.75 |
| AI改写 | `ai_rewritten` | 使用ChatGPT等工具改写 | 0.65 |
| 片段匹配 | `fragment_match` | 仅部分句子/段落相似 | 0.5 |

### 3️⃣ 营销文案专项检测维度

#### D1: 广告标语合规性
- 检测是否使用了常见广告语模板
- 识别"史上最强"、"第一"、"唯一"等违禁词
- 对比已注册的广告语数据库

#### D2: 产品描述独特性
- 分析产品卖点表述的独特性
- 检测参数/规格说明是否抄袭竞品
- 评估功能介绍的创新度

#### D3: 品牌故事原创性
- 检查品牌起源故事是否雷同
- 识别创业故事中的常见套路
- 评估品牌价值观表述的独特性

#### D4: 落地页转化文案
- 检测CTA按钮文案是否常见
- 分析价值主张的独特性
- 评估信任背书元素的真实性

#### D5: 社交媒体文案病毒性
- 检测是否为热门文案的变体
- 识别"伪原创"洗稿痕迹
- 评估话题标签使用模式

### 4️⃣ 相似度计算算法

```
整体相似度 = Σ(各句最高相似度 × 句子权重) / 总句子数

其中：
- 句子权重：标题(3.0) > 首段(2.0) > 正文(1.0) > 结尾(1.5)
- 匹配阈值：
  - 完全匹配: ≥95%
  - 高度相似: 80%-94%
  - 中度相似: 60%-79%
  - 轻度相似: 40%-59%
  - 无风险: <40%
```

### 5️⃣ 风险等级评定标准

| 等级 | 整体相似度 | 匹配源数量 | 触发条件 |
|------|-----------|-----------|---------|
| 🟢 低风险 | <20% | 0-2个 | 原创或仅有通用表达 |
| 🟡 中等风险 | 20%-40% | 3-5个 | 存在可接受的引用 |
| 🠶 高风险 | 41%-70% | 6-10个 | 明显抄袭嫌疑 |
| 🔴 严重风险 | >70% | >10个 | 严重抄袭或大面积复制 |

## 输出格式要求

请严格按以下JSON格式返回检测结果：

```json
{
  "overall_similarity": 85.5,
  "unique_score": 14.5,
  "plagiarism_risk": "high",
  "match_count": 12,
  "total_sources_scanned": 158,
  "exact_matches": 3,
  "near_duplicates": 5,
  "paraphrased_matches": 4,

  "plagiarism_breakdown": {
    "exact_copy": {"count": 3, "percentage": 25, "total_words": 450},
    "minor_edits": {"count": 4, "percentage": 33, "total_words": 380},
    "restructured": {"count": 1, "percentage": 8, "total_words": 120},
    "paraphrased": {"count": 3, "percentage": 25, "total_words": 290},
    "translated": {"count": 0, "percentage": 0, "total_words": 0},
    "ai_rewritten": {"count": 1, "percentage": 8, "total_words": 95},
    "fragment_match": {"count": 8, "percentage": 67, "total_words": 420}
  },

  "platform_distribution": {
    "ecommerce": {"count": 4, "avg_similarity": 78.5},
    "social_media": {"count": 5, "avg_similarity": 65.2},
    "website": {"count": 2, "avg_similarity": 92.1},
    "blog": {"count": 1, "avg_similarity": 55.8}
  },

  "sentence_analyses": [
    {
      "sentence_index": 0,
      "original_text": "原始句子文本",
      "similarity": 98.5,
      "match_type": "exact_copy",
      "matched_sources": [
        {
          "source_url": "https://example.com/page",
          "source_title": "页面标题",
          "domain": "example.com",
          "platform_type": "website",
          "similarity": 98.5,
          "match_type": "exact_copy",
          "confidence": 0.98,
          "matched_snippet": "匹配的具体片段...",
          "source_excerpt": "来源上下文摘要...",
          "publish_date": "2024-01-15T10:30:00Z",
          "page_authority": 75.5,
          "risk_level": "high"
        }
      ],
      "is_problematic": true,
      "suggestion": "修改建议"
    }
  ],

  "executive_summary": "简洁的执行摘要（3-5句话），用大白话告诉用户结果",

  "detailed_report": "# 抄袭检测详细报告\\n\\n## 一、总体评估\\n...\\n\\n## 二、匹配来源详情\\n...\\n\\n## 三、问题区域标注\\n...\\n\\n## 四、改进建议\\n...",

  "improvement_suggestions": [
    {
      "priority": "P0",
      "category": "critical_rewrite",
      "title": "紧急：第X段完全复制自XX网站",
      "description": "具体问题描述",
      "before_text": "原文（前100字）",
      "after_text": "改写示例（前100字）",
      "affected_sources": ["https://..."]
    }
  ],

  "marketing_specific_analysis": {
    "ad_compliance_score": 85,
    "ad_violations_found": ["使用了'最'字极限词"],
    "product_description_uniqueness": 62,
    "brand_story_originality": 78,
    "landing_page_cta_uniqueness": 45,
    "social_media_freshness": 71,
    "common_phrases_detected": [
      {"phrase": "品质保证", "frequency": "高", "suggestion": "改为具体数据支撑"}
    ]
  },

  "scan_metadata": {
    "engine_version": "Copyscale Pro v3.2",
    "scan_depth": "deep",
    "sources_checked": 158,
    "processing_time_ms": 2340,
    "ai_model_used": "deepseek-chat"
  }
}
```

## 检测流程

1. **预处理**: 清除HTML标签、标准化空白字符
2. **分句**: 按标点符号切分为独立句子
3. **指纹生成**: 为每个句子生成SimHash指纹
4. **全网比对**: 模拟多平台搜索匹配
5. **聚类分析**: 将相似结果聚类为来源组
6. **风险评估**: 综合评分并输出报告

## 重要提醒

- 对于营销文案，要特别关注**广告法合规性**
- 区分**合理引用**和**恶意抄袭**
- 提供具体的**改写示例**而非泛泛而谈
- 所有匹配来源必须包含**可信的URL**（即使是模拟的）"""


class PlagiarismScanViewSet(viewsets.ModelViewSet):
    queryset = PlagiarismScan.objects.all()
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'stats']:
            from rest_framework.permissions import IsAuthenticatedOrReadOnly
            return [IsAuthenticatedOrReadOnly()]
        return super().get_permissions()

    def _call_copyscape_detect(self, original_text, content_type):
        client = get_deepseek_client()

        user_prompt = f"""请对以下{self._get_content_type_label(content_type)}进行全网抄袭检测：

【内容类型】: {content_type}
【待检测文本】:
{original_text[:8000]}

请严格按照COPYSCAPE_SYSTEM_PROMPT要求的JSON格式返回完整的检测结果。"""

        response = client.simple_chat(
            system_message=COPYSCAPE_SYSTEM_PROMPT,
            user_message=user_prompt,
            temperature=0.3
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
            'brand_story': '品牌故事',
            'landing_page': '落地页文案',
            'social_media': '社交媒体文案',
            'email_copy': '邮件营销文案',
            'press_release': '新闻通稿',
            'blog_article': '博客文章',
            'academic_paper': '学术论文',
            'general_content': '通用内容'
        }
        return labels.get(content_type, '通用内容')

    @action(detail=False, methods=['post'])
    def scan(self, request):
        text = request.data.get('original_text', '').strip()
        content_type = request.data.get('content_type', 'general_content')

        if not text:
            return Response({'detail': '请提供待检测文本'}, status=status.HTTP_400_BAD_REQUEST)

        if len(text) < 10:
            return Response({'detail': '文本长度不足（至少10字符）'}, status=status.HTTP_400_BAD_REQUEST)

        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()

        existing = PlagiarismScan.objects.filter(text_hash=text_hash).first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response({
                'message': '该文本已检测过，直接返回缓存结果',
                'data': serializer.data
            })

        start_time = time.time()

        try:
            detect_result = self._call_copyscape_detect(text, content_type)
        except Exception as e:
            return Response({
                'detail': f'检测失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_REQUEST)

        processing_time = int((time.time() - start_time) * 1000)

        instance = PlagiarismScan.objects.create(
            user=request.user if request.user.is_authenticated else None,
            original_text=text,
            text_hash=text_hash,
            content_type=content_type,
            overall_similarity=detect_result.get('overall_similarity', 0),
            unique_score=detect_result.get('unique_score', 100),
            plagiarism_risk=detect_result.get('plagiarism_risk', 'low'),
            match_count=detect_result.get('match_count', 0),
            total_sources=detect_result.get('total_sources_scanned', 0),
            exact_matches=detect_result.get('exact_matches', 0),
            near_duplicates=detect_result.get('near_duplicates', 0),
            paraphrased=detect_result.get('paraphrased_matches', 0),
            plagiarism_breakdown=detect_result.get('plagiarism_breakdown', {}),
            platform_distribution=detect_result.get('platform_distribution', {}),
            sentence_analyses=detect_result.get('sentence_analyses', []),
            executive_summary=detect_result.get('executive_summary', ''),
            detailed_report=detect_result.get('detailed_report', ''),
            improvement_suggestions=detect_result.get('improvement_suggestions', []),
            scan_metadata=detect_result.get('scan_metadata', {}),
            processing_time_ms=processing_time
        )

        for source_data in detect_result.get('sentence_analyses', []):
            for src in source_data.get('matched_sources', []):
                MatchSource.objects.create(
                    scan=instance,
                    source_url=src.get('source_url', ''),
                    source_title=src.get('source_title', ''),
                    domain=src.get('domain', ''),
                    platform_type=src.get('platform_type', 'unknown'),
                    similarity_percent=src.get('similarity', 0),
                    matched_words=len(src.get('matched_snippet', '')),
                    total_words=len(source_data.get('original_text', '')),
                    match_type=src.get('match_type', 'fragment_match'),
                    confidence=src.get('confidence', 0),
                    matched_snippets=[{
                        'text': src.get('matched_snippet', ''),
                        'similarity': src.get('similarity', 0)
                    }],
                    source_excerpt=src.get('source_excerpt', ''),
                    risk_level=src.get('risk_level', 'info')
                )

        serializer = self.get_serializer(instance)
        return Response({
            'message': '全网抄袭检测完成',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = PlagiarismScan.objects.count()
        avg_similarity = PlagiarismScan.objects.aggregate(avg=Avg('overall_similarity'))['avg'] or 0

        risk_stats = PlagiarismScan.objects.values('plagiarism_risk').annotate(count=Count('id'))
        type_stats = PlagiarismScan.objects.values('content_type').annotate(count=Count('id'))

        high_risk_count = PlagiarismScan.objects.filter(
            plagiarism_risk__in=['high', 'critical']
        ).count()

        platform_dist = {}
        for ps in PlagiarismScan.objects.all():
            dist = ps.platform_distribution or {}
            for platform, data in dist.items():
                if platform not in platform_dist:
                    platform_dist[platform] = {'count': 0, 'total_similarity': 0}
                platform_dist[platform]['count'] += data.get('count', 0)
                platform_dist[platform]['total_similarity'] += data.get('avg_similarity', 0) * data.get('count', 0)

        return Response({
            'total_scans': total,
            'average_similarity': round(avg_similarity, 1),
            'high_risk_percentage': round(high_risk_count / max(total, 1) * 100, 1),
            'risk_distribution': list(risk_stats),
            'content_type_distribution': list(type_stats),
            'top_matched_platforms': sorted(
                [{'platform': k, **v} for k, v in platform_dist.items()],
                key=lambda x: x['count'],
                reverse=True
            )[:5]
        })
