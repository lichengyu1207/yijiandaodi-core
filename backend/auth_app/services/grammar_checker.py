import json
import re
import time
import logging
from typing import Dict, Any, List, Optional

from content_app.deepseek_service import get_deepseek_client

logger = logging.getLogger(__name__)


GRAMMAR_CHECK_SYSTEM_PROMPT = """你是一个专业的AI语法纠错与文风优化引擎（Grammarly Style），专注于提升文本质量。

## 核心能力

### 1. 错误检测类型
- **grammar**: 语法错误（主谓一致、时态、语序等）
- **spelling**: 拼写错误（错别字、形近字）
- **punctuation**: 标点问题（缺失、多余、混用）
- **style**: 文风问题（正式度、风格不一致）

### 2. 检测要求
- 精确定位每个错误的起始和结束位置
- 提供具体的修改建议和原因说明
- 给出置信度评分(0-1)
- 标注规则名称

### 3. 输出格式
严格返回JSON格式，包含以下结构。"""

STYLE_ANALYSIS_SYSTEM_PROMPT = """你是一个专业的文本风格分析引擎，对标Grammarly的文风分析功能。

## 分析维度

### 1. 可读性分析
- reading_ease_score: 可读性评分(0-100)
- grade: 对应年级水平
- level: 等级描述

### 2. 语气分析(Tone)
- formality: 正式度(0-1, 1=非常正式)
- confidence: 自信度(0-1)
- clarity: 清晰度(0-1)

### 3. 语态分析
- voice: active(主动语态) / passive(被动语态)

### 4. 改进建议
基于分析结果给出具体可操作的改进建议

## 输出格式
严格返回JSON格式。"""

IMPROVE_TEXT_SYSTEM_PROMPT = """你是一个专业的AI文本改进引擎，对标Grammarly的文本优化功能。

## 改进模式

### fluency (流畅性)
- 修正语法错误
- 优化句子流畅度
- 改善表达自然度

### conciseness (简洁性)
- 删除冗余词汇
- 精简啰嗦表达
- 提高信息密度

### vocabulary (词汇升级)
- 替换基础词汇为高级词汇
- 增加表达丰富度
- 提升专业感

## 输出要求
- 保留原文核心意思
- 列出所有修改点及原因
- 返回完整改进后文本
- 严格返回JSON格式"""


class GrammarCheckerService:
    """语法检查服务 - 基于LLM的智能写作助手"""

    def __init__(self):
        self.client = None

    def _get_client(self):
        if self.client is None:
            self.client = get_deepseek_client()
        return self.client

    async def check_grammar(self, text: str) -> dict:
        """
        检测语法错误、拼写错误、标点问题

        返回格式:
        {
            "errors": [...],
            "overall_score": 85,
            "stats": {...}
        }
        """
        client = self._get_client()

        user_prompt = f"""请对以下文本进行全面的语法纠错检测：

【待检测文本】({len(text)}字符):
{text[:8000]}

请严格按照以下JSON格式返回检测结果：
{{
    "errors": [
        {{
            "error_type": "grammar|spelling|punctuation|style",
            "position": {{"start": 0, "end": 10}},
            "original_text": "错误文本",
            "correction": "修正文本",
            "suggestion": "修改建议说明",
            "confidence": 0.95,
            "rule_name": "主谓一致"
        }}
    ],
    "overall_score": 85,
    "stats": {{
        "word_count": {len(text)},
        "sentence_count": 25,
        "avg_sentence_length": 20,
        "error_count": 12
    }}
}}

注意：
1. position.start 和 position.end 是字符在原文中的位置索引（从0开始）
2. confidence 范围 0-1
3. overall_score 范围 0-100
4. 只返回JSON，不要其他文字"""

        try:
            response = client.simple_chat(
                user_message=user_prompt,
                system_prompt=GRAMMAR_CHECK_SYSTEM_PROMPT,
                temperature=0.2
            )

            result = self._parse_json_response(response)

            errors = result.get('errors', [])
            for err in errors:
                if 'position' not in err or 'start' not in err.get('position', {}):
                    err['position'] = {'start': 0, 'end': len(err.get('original_text', ''))}

            stats = result.get('stats', {})
            stats['word_count'] = len(text)

            sentences = re.split(r'[。！？.!?\n]+', text)
            stats['sentence_count'] = len([s for s in sentences if s.strip()])
            if stats['sentence_count'] > 0:
                stats['avg_sentence_length'] = round(len(text) / stats['sentence_count'], 1)
            stats['error_count'] = len(errors)

            return {
                'errors': errors,
                'overall_score': result.get('overall_score', self._calculate_score(errors, len(text))),
                'stats': stats
            }

        except Exception as e:
            logger.error(f'Grammar check error: {e}')
            return self._fallback_check(text)

    async def analyze_style(self, text: str) -> dict:
        """
        分析文风：正式度、语气、清晰度、参与感

        返回:
        {
            "readability": {...},
            "tone": {...},
            "voice": "...",
            "suggestions": [...]
        }
        """
        client = self._get_client()

        user_prompt = f"""请对以下文本进行全面的文风分析：

【待分析文本】({len(text)}字符):
{text[:6000]}

请严格按照以下JSON格式返回分析结果：
{{
    "readability": {{
        "score": 75,
        "grade": "8年级",
        "level": "中等"
    }},
    "tone": {{
        "formality": 0.7,
        "confidence": 0.8,
        "clarity": 0.85
    }},
    "voice": "active",
    "suggestions": ["建议使用更主动的语态", "..."]
}}

注意：
1. formality/confidence/clarity 范围都是 0-1
2. voice 只能是 "active" 或 "passive"
3. readability.score 范围 0-100
4. suggestions 提供3-5条具体建议
5. 只返回JSON"""

        try:
            response = client.simple_chat(
                user_message=user_prompt,
                system_prompt=STYLE_ANALYSIS_SYSTEM_PROMPT,
                temperature=0.3
            )

            result = self._parse_json_response(response)

            readability = result.get('readability', {})
            tone = result.get('tone', {})

            if not readability.get('score'):
                readability = self._calculate_readability(text)

            if not tone.get('formality'):
                tone = {'formality': 0.6, 'confidence': 0.7, 'clarity': 0.75}

            return {
                'readability': readability,
                'tone': tone,
                'voice': result.get('voice', 'active'),
                'suggestions': result.get('suggestions', [
                    '保持句式多样性',
                    '注意段落间的逻辑衔接',
                    '适当使用过渡词增强连贯性'
                ])
            }

        except Exception as e:
            logger.error(f'Style analysis error: {e}')
            return self._fallback_style_analysis(text)

    async def improve_text(self, text: str, mode: str = 'fluency') -> dict:
        """
        文本改进: fluency/conciseness/vocabulary

        返回:
        {
            "improved_text": "...",
            "changes": [...]
        }
        """
        valid_modes = ['fluency', 'conciseness', 'vocabulary']
        if mode not in valid_modes:
            mode = 'fluency'

        mode_labels = {
            'fluency': '流畅性优化',
            'conciseness': '简洁性优化',
            'vocabulary': '词汇升级'
        }

        client = self._get_client()

        user_prompt = f"""请对以下文本进行「{mode_labels[mode]}」改进：

【原始文本】({len(text)}字符):
{text[:8000]}

【改进模式】: {mode} ({mode_labels[mode]})

请严格按照以下JSON格式返回改进结果：
{{
    "improved_text": "完整的改进后文本...",
    "changes": [
        {{
            "original": "原文片段",
            "improved": "改进后片段",
            "reason": "修改原因说明",
            "type": "grammar|style|vocabulary|clarity"
        }}
    ]
}}

注意：
1. improved_text 必须是完整的改进后全文，不能省略任何内容
2. changes 列出所有主要修改点
3. type 只能是 grammar/style/vocabulary/clarity 之一
4. 保持原文核心含义不变
5. 只返回JSON"""

        try:
            response = client.simple_chat(
                user_message=user_prompt,
                system_prompt=IMPROVE_TEXT_SYSTEM_PROMPT,
                temperature=0.4 if mode == 'vocabulary' else 0.3
            )

            result = self._parse_json_response(response)

            improved = result.get('improved_text', '')
            if not improved or len(improved) < len(text) * 0.5:
                improved = text

            changes = result.get('changes', [])

            return {
                'improved_text': improved,
                'changes': changes,
                'mode': mode
            }

        except Exception as e:
            logger.error(f'Text improvement error: {e}')
            return {
                'improved_text': text,
                'changes': [],
                'mode': mode
            }

    def _parse_json_response(self, response: str) -> dict:
        """解析LLM返回的JSON响应"""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            if start_idx != -1 and end_idx > start_idx:
                try:
                    return json.loads(response[start_idx:end_idx])
                except json.JSONDecodeError:
                    pass
            raise ValueError(f'无法解析JSON响应: {response[:200]}')

    def _calculate_score(self, errors: list, text_len: int) -> int:
        """根据错误数量计算总体分数"""
        if not errors:
            return min(100, 70 + text_len // 10)

        critical_count = sum(1 for e in errors if e.get('error_type') in ('grammar', 'spelling'))
        warning_count = sum(1 for e in errors if e.get('error_type') in ('punctuation', 'style'))

        base_score = 100
        base_score -= critical_count * 8
        base_score -= warning_count * 3

        return max(0, min(100, base_score))

    def _calculate_readability(self, text: str) -> dict:
        """计算基础可读性指标"""
        char_count = len(text)
        sentences = re.split(r'[。！？.!?\n]+', text)
        sentence_count = len([s for s in sentences if s.strip()])

        if sentence_count == 0:
            sentence_count = 1

        avg_sentence_len = char_count / sentence_count

        words = re.findall(r'[\u4e00-\u9fa5a-zA-Z]+', text)
        word_count = len(words)

        unique_words = set(words)
        vocab_richness = len(unique_words) / max(word_count, 1)

        score = 100 - (avg_sentence_len - 20) * 2 - (1 - vocab_richness) * 30
        score = max(0, min(100, round(score)))

        if score >= 80:
            grade = '初中'
            level = '易读'
        elif score >= 60:
            grade = '高中'
            level = '中等'
        elif score >= 40:
            grade = '大学'
            level = '较难'
        else:
            grade = '专业'
            level = '困难'

        return {
            'score': score,
            'grade': grade,
            'level': level,
            'avg_sentence_length': round(avg_sentence_len, 1),
            'word_count': word_count,
            'vocab_richness': round(vocab_richness, 3)
        }

    def _fallback_check(self, text: str) -> dict:
        """降级检查方案"""
        basic_errors = []
        common_typos = [
            ('的', '地', '得'), ('在', '再'), ('已', '以'), ('像', '向'),
            ('必须', '必需'), ('反映', '反应'), ('启事', '启示'),
        ]

        for i, char_pair in enumerate(common_typos):
            pos = text.find(char_pair[0])
            if pos != -1:
                basic_errors.append({
                    'error_type': 'spelling',
                    'position': {'start': pos, 'end': pos + 1},
                    'original_text': char_pair[0],
                    'correction': char_pair[1],
                    'suggestion': f'可能是"{char_pair[1]}"的误用',
                    'confidence': 0.6,
                    'rule_name': f'常见易混词-{char_pair[0]}'
                })

        sentences = re.split(r'[。！？.!?\n]+', text)
        sentence_count = len([s for s in sentences if s.strip()])

        return {
            'errors': basic_errors[:8],
            'overall_score': 70 if basic_errors else 85,
            'stats': {
                'word_count': len(text),
                'sentence_count': sentence_count,
                'avg_sentence_length': round(len(text) / max(sentence_count, 1), 1),
                'error_count': len(basic_errors)
            }
        }

    def _fallback_style_analysis(self, text: str) -> dict:
        """降级文风分析"""
        readability = self._calculate_readability(text)

        passive_patterns = ['被', '由...所', '加以', '予以', '受到']
        passive_count = sum(1 for p in passive_patterns if p in text)
        voice = 'passive' if passive_count > 3 else 'active'

        return {
            'readability': readability,
            'tone': {
                'formality': 0.6,
                'confidence': 0.7,
                'clarity': readability['score'] / 100
            },
            'voice': voice,
            'suggestions': [
                '建议适当缩短过长的句子',
                '可以增加一些过渡词来增强连贯性',
                f'当前{"偏被动" if voice == "passive" else "偏主动"}语态，可根据需要调整'
            ]
        }


grammar_checker_service = GrammarCheckerService()
