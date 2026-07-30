import os
import re
import time
import base64
import logging
from typing import List, Dict, Any, Tuple, Optional
from django.db.models import Q
from .rag_models import (
    KnowledgeBaseCategory,
    KnowledgeDocument,
    DocumentChunk,
    RetrievalLog,
)

logger = logging.getLogger(__name__)


class DocumentParser:
    """文档解析器 - 支持多种格式"""

    @staticmethod
    def _clean_text(text: str) -> str:
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'&[a-zA-Z]+;', ' ', text)
        text = re.sub(r'[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffefa-zA-Z0-9\s\p{P}\p{N}', ' ', text, flags=re.UNICODE)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    @staticmethod
    def parse_file(file_path: str, file_type: str) -> Dict[str, Any]:
        """
        解析文件并提取文本内容

        Returns:
            {
                'text': str,           # 提取的文本内容
                'metadata': dict,      # 元数据（页数、作者等）
                'sections': list,      # 章节列表 [{'title': ..., 'content': ...}]
            }
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'File not found: {file_path}')

        try:
            if file_type == 'pdf':
                return DocumentParser._parse_pdf(file_path)
            elif file_type in ['word', 'docx']:
                return DocumentParser._parse_word(file_path)
            elif file_type in ['txt', 'markdown', 'md']:
                return DocumentParser._parse_text(file_path)
            elif file_type == 'json':
                return DocumentParser._parse_json(file_path)
            else:
                return DocumentParser._parse_text(file_path)
        except Exception as e:
            logger.error(f'Parse error: {e}')
            raise

    @staticmethod
    def _parse_pdf(file_path: str) -> Dict[str, Any]:
        """解析PDF（提取纯文本）"""
        try:
            import PyPDF2
            text_parts = []
            with open(file_path, 'rb') as f:
                try:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        page_text = page.extract_text() or ''
                        if page_text.strip():
                            text_parts.append(page_text)
                except Exception:
                    f.seek(0)
                    raw = f.read()
                    text = raw.decode('utf-8', errors='ignore')
                    text = DocumentParser._clean_text(text)
                    text_parts.append(text)
            content = '\n\n'.join(text_parts) if text_parts else ''
            sections = [s.strip() for s in content.split('\n\n') if s.strip()]
            return {
                'text': content,
                'metadata': {'pages': len(text_parts)},
                'sections': [{'title': f'第{i+1}页', 'content': s} for i, s in enumerate(sections[:50])],
            }
        except ImportError:
            with open(file_path, 'rb') as f:
                raw = f.read()
            content = raw.decode('utf-8', errors='ignore')
            content = DocumentParser._clean_text(content)
            return {
                'text': content,
                'metadata': {},
                'sections': [{'title': 'Content', 'content': content}],
            }

    @staticmethod
    def _parse_word(file_path: str) -> Dict[str, Any]:
        """解析Word/docx（提取纯文本）"""
        try:
            import zipfile
            from xml.etree import ElementTree as ET

            text_parts = []
            section_titles = []
            current_section = ''

            with zipfile.ZipFile(file_path, 'r') as z:
                if 'word/document.xml' not in z.namelist():
                    raise ValueError('Invalid docx file')

                xml_content = z.read('word/document.xml')
                root = ET.fromstring(xml_content)

                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

                for elem in root.iter():
                    if elem.tag == f"{{{ns['w']}}}p":
                        para_text = ''.join(
                            t.text or '' for t in elem.iter(f"{{{ns['w']}}}t")
                            if t.text
                        ).strip()
                        if para_text:
                            text_parts.append(para_text)

                    elif elem.tag == f"{{{ns['w']}}}pStyle":
                        style_id = elem.get(f"{{{ns['w']}}}val", '')
                        if style_id.startswith('Heading') or style_id.startswith('heading'):
                            pass

            content = '\n'.join(text_parts) if text_parts else ''
            content = DocumentParser._clean_text(content)

            sections = []
            buf = []
            for line in content.split('\n'):
                line = line.strip()
                if not line:
                    if buf:
                        sections.append('\n'.join(buf))
                        buf = []
                    continue
                buf.append(line)
            if buf:
                sections.append('\n'.join(buf))

            if not sections:
                sections = [{'title': 'Document', 'content': content}]

            return {
                'text': content,
                'metadata': {'paragraphs': len(text_parts)},
                'sections': [{'title': f'段落{i+1}', 'content': s} for i, s in enumerate(sections[:50])],
            }
        except Exception:
            with open(file_path, 'rb') as f:
                raw = f.read()
            content = raw.decode('utf-8', errors='ignore')
            content = DocumentParser._clean_text(content)
            return {
                'text': content,
                'metadata': {},
                'sections': [{'title': 'Document', 'content': content}],
            }

    @staticmethod
    def _parse_text(file_path: str) -> Dict[str, Any]:
        """解析纯文本/Markdown"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # 按标题分割章节（Markdown格式）
        sections = []
        current_title = 'Introduction'
        current_content = []

        for line in content.split('\n'):
            if line.startswith('#'):
                if current_content:
                    sections.append({'title': current_title, 'content': '\n'.join(current_content)})
                current_title = line.lstrip('# ').strip()
                current_content = []
            else:
                current_content.append(line)

        if current_content:
            sections.append({'title': current_title, 'content': '\n'.join(current_content)})

        if not sections:
            sections = [{'title': 'Content', 'content': content}]

        content = DocumentParser._clean_text(content)

        return {
            'text': content,
            'metadata': {},
            'sections': sections,
        }

    @staticmethod
    def _parse_json(file_path: str) -> Dict[str, Any]:
        """解析JSON"""
        import json
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        text = json.dumps(data, ensure_ascii=False, indent=2)
        return {
            'text': text,
            'metadata': {'keys': list(data.keys()) if isinstance(data, dict) else []},
            'sections': [{'title': 'JSON Data', 'content': text}],
        }


class TextChunker:
    """文本分块器"""

    DEFAULT_CHUNK_SIZE = 500       # 每个分块的最大字符数
    DEFAULT_CHUNK_OVERLAP = 50     # 分块之间的重叠字符数

    @classmethod
    def chunk_text(
        cls,
        text: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_CHUNK_OVERLAP,
        sections: List[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        将文本分割成多个块

        Returns:
            [
                {
                    'index': int,
                    'content': str,
                    'page_number': int,
                    'section_title': str,
                    'token_count': int,
                    'char_count': int,
                }
            ]
        """
        chunks = []
        index = 0

        if sections and len(sections) > 1:
            for section_idx, section in enumerate(sections):
                section_chunks = cls._split_section(
                    section['content'],
                    start_index=index,
                    page_number=section_idx + 1,
                    section_title=section.get('title', ''),
                    chunk_size=chunk_size,
                    overlap=overlap,
                )
                chunks.extend(section_chunks)
                index += len(section_chunks)
        else:
            chunks = cls._split_section(
                text,
                start_index=0,
                page_number=1,
                section_title='',
                chunk_size=chunk_size,
                overlap=overlap,
            )

        return chunks

    @classmethod
    def _split_section(
        cls,
        text: str,
        start_index: int,
        page_number: int,
        section_title: str,
        chunk_size: int,
        overlap: int,
    ) -> List[Dict[str, Any]]:
        """分割单个章节"""
        chunks = []
        text_len = len(text)

        if text_len <= chunk_size:
            chunks.append({
                'index': start_index,
                'content': text.strip(),
                'page_number': page_number,
                'section_title': section_title,
                'token_count': len(text.split()),
                'char_count': len(text),
            })
            return chunks

        start = 0
        while start < text_len:
            end = min(start + chunk_size, text_len)

            # 尝试在句子边界处分割
            if end < text_len:
                last_period = text.rfind('。', start, end)
                last_newline = text.rfind('\n', start, end)
                split_pos = max(last_period, last_newline)
                if split_pos > start + chunk_size // 2:
                    end = split_pos + 1

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    'index': start_index + len(chunks),
                    'content': chunk_text,
                    'page_number': page_number,
                    'section_title': section_title,
                    'token_count': len(chunk_text.split()),
                    'char_count': len(chunk_text),
                })

            start = end - overlap if end < text_len else end

        return chunks


class EmbeddingService:
    """向量化服务（模拟版，实际项目可接入OpenAI/本地模型）"""

    EMBEDDING_DIM = 1536  # OpenAI ada-002 维度

    @classmethod
    def generate_embedding(cls, text: str) -> List[float]:
        """
        生成文本向量（当前为模拟实现）

        实际项目中可替换为：
        - OpenAI: openai.Embedding.create(model="text-embedding-ada-002", input=text)
        - 本地模型: sentence-transformers
        """
        import hashlib

        # 基于文本哈希生成伪随机向量（仅用于演示）
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()

        vector = []
        for i in range(cls.EMBEDDING_DIM):
            byte_idx = (i * 4) % len(hash_bytes)
            val = (hash_bytes[byte_idx] / 255.0 - 0.5) * 2
            vector.append(val)

        # 归一化
        magnitude = sum(x * x for x in vector) ** 0.5
        if magnitude > 0:
            vector = [x / magnitude for x in vector]

        return vector

    @classmethod
    def encode_embedding_to_base64(cls, embedding: List[float]) -> str:
        """将向量编码为Base64字符串存储"""
        import struct
        packed = struct.pack(f'{len(embedding)}f', *embedding)
        return base64.b64encode(packed).decode('ascii')

    @classmethod
    def decode_embedding_from_base64(cls, encoded: str) -> List[float]:
        """从Base64解码向量"""
        import struct
        decoded = base64.b64decode(encoded)
        count = len(decoded) // 4
        return list(struct.unpack(f'{count}f', decoded))


class RetrievalService:
    """检索服务"""

    @staticmethod
    def semantic_search(
        query: str,
        category_slug: str = '',
        top_k: int = 5,
        min_score: float = 0.5,
    ) -> Tuple[List[Dict], int]:
        """
        语义检索（基于余弦相似度）

        Returns:
            (results_list, total_found)
        """
        start_time = time.time()

        query_embedding = EmbeddingService.generate_embedding(query)

        chunks = DocumentChunk.objects.all()
        if category_slug:
            chunks = chunks.filter(document__category__slug=category_slug, document__status='completed')

        results = []
        for chunk in chunks[:100]:  # 限制数量防止性能问题
            if not chunk.embedding:
                continue

            try:
                doc_embedding = EmbeddingService.decode_embedding_from_base64(chunk.embedding)
                score = RetrievalService._cosine_similarity(query_embedding, doc_embedding)

                if score >= min_score:
                    results.append({
                        'chunk_id': chunk.id,
                        'content': chunk.content,
                        'document_title': chunk.document.title,
                        'score': round(score, 4),
                        'metadata': chunk.metadata or {},
                        'page_number': chunk.page_number,
                        'section_title': chunk.section_title,
                    })
            except Exception as e:
                logger.warning(f'Embedding decode error for chunk {chunk.id}: {e}')
                continue

        results.sort(key=lambda x: x['score'], reverse=True)
        top_results = results[:top_k]

        response_time = int((time.time() - start_time) * 1000)
        return top_results, len(results), response_time

    @staticmethod
    def keyword_search(
        query: str,
        category_slug: str = '',
        top_k: int = 5,
    ) -> Tuple[List[Dict], int]:
        """
        关键词检索（基于TF-IDF简化版）
        """
        start_time = time.time()

        keywords = query.lower().split()
        chunks = DocumentChunk.objects.all()

        if category_slug:
            chunks = chunks.filter(document__category__slug=category_slug, document__status='completed')

        results = []
        for chunk in chunks[:100]:
            content_lower = chunk.content.lower()
            score = 0

            for kw in keywords:
                if kw in content_lower:
                    score += content_lower.count(kw)

            if score > 0:
                results.append({
                    'chunk_id': chunk.id,
                    'content': chunk.content,
                    'document_title': chunk.document.title,
                    'score': min(score / len(keywords), 1.0),
                    'metadata': chunk.metadata or {},
                    'page_number': chunk.page_number,
                    'section_title': chunk.section_title,
                })

        results.sort(key=lambda x: x['score'], reverse=True)
        top_results = results[:top_k]

        response_time = int((time.time() - start_time) * 1000)
        return top_results, len(results), response_time

    @staticmethod
    def hybrid_search(
        query: str,
        category_slug: str = '',
        top_k: int = 5,
        min_score: float = 0.3,
        semantic_weight: float = 0.6,
        keyword_weight: float = 0.4,
    ) -> Tuple[List[Dict], int]:
        """
        混合检索（语义+关键词加权融合）
        """
        semantic_results, _, _ = RetrievalService.semantic_search(
            query, category_slug, top_k * 2, min_score
        )
        keyword_results, _, _ = RetrievalService.keyword_search(
            query, category_slug, top_k * 2
        )

        merged = {}
        for r in semantic_results:
            merged[r['chunk_id']] = r.copy()
            merged[r['chunk_id']]['semantic_score'] = r['score']
            merged[r['chunk_id']]['keyword_score'] = 0

        for r in keyword_results:
            if r['chunk_id'] in merged:
                merged[r['chunk_id']]['keyword_score'] = r['score']
            else:
                merged[r['chunk_id']] = r.copy()
                merged[r['chunk_id']]['semantic_score'] = 0
                merged[r['chunk_id']]['keyword_score'] = r['score']

        final_results = []
        for chunk_id, r in merged.items():
            combined_score = (
                r.get('semantic_score', 0) * semantic_weight +
                r.get('keyword_score', 0) * keyword_weight
            )
            r['score'] = round(combined_score, 4)
            final_results.append(r)

        final_results.sort(key=lambda x: x['score'], reverse=True)
        return final_results[:top_k], len(final_results), 0

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """计算余弦相似度"""
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        magnitude_a = sum(a * a for a in vec_a) ** 0.5
        magnitude_b = sum(b * b for b in vec_b) ** 0.5

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)


class RAGPipeline:
    """RAG问答流水线"""

    @staticmethod
    def answer_question(
        question: str,
        category_slug: str = '',
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        执行RAG问答流程

        Returns:
            {
                'answer': str,
                'sources': [...],
                'confidence': float,
                'model_used': str,
                'response_time_ms': int,
            }
        """
        start_time = time.time()

        # Step 1: 检索相关文档片段
        sources, total, _ = RetrievalService.hybrid_search(
            question, category_slug, top_k
        )

        if not sources:
            return {
                'answer': '抱歉，知识库中未找到与您问题相关的信息。请尝试换个方式提问或联系管理员补充相关知识库。',
                'sources': [],
                'confidence': 0.0,
                'model_used': 'rag-pipeline',
                'response_time_ms': int((time.time() - start_time) * 1000),
            }

        # Step 2: 构建上下文
        context_parts = []
        for i, source in enumerate(sources):
            context_parts.append(
                f"[参考资料{i+1}] 来自《{source['document_title']}》:\n"
                f"{source['content']}\n"
                f"(相关度: {source['score']})"
            )

        context = '\n\n'.join(context_parts)

        # Step 3: 生成答案（模拟，实际接入LLM）
        answer = RAGPipeline._generate_answer(question, context, sources)

        confidence = sources[0]['score'] if sources else 0.0

        return {
            'answer': answer,
            'sources': sources,
            'confidence': round(confidence, 4),
            'model_used': 'DeepSeek-V4 (deepseek-chat)',
            'response_time_ms': int((time.time() - start_time) * 1000),
        }

    @staticmethod
    def _generate_answer(
        question: str,
        context: str,
        sources: List[Dict],
    ) -> str:
        """
        使用 DeepSeek V4 生成真实答案
        """
        from .deepseek_service import get_deepseek_client

        source_titles = list(set([s['document_title'] for s in sources]))

        system_prompt = """你是一个专业的安全知识助手。你的任务是根据提供的知识库参考资料，准确、专业地回答用户的问题。

要求：
1. 必须基于提供的参考资料回答，不要编造信息
2. 如果参考资料中没有相关信息，请明确说明
3. 回答要结构清晰、条理分明
4. 适当使用Markdown格式（列表、加粗等）提升可读性
5. 在关键处标注参考来源编号，如 [参考资料1]
6. 回答语言与用户提问语言保持一致"""

        user_prompt = f"""请根据以下知识库资料回答我的问题。

## 我的问题：
{question}

## 参考资料：
{context}

## 请基于以上资料给出专业、准确的回答："""

        try:
            client = get_deepseek_client()
            answer = client.simple_chat(
                user_message=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7,
            )

            if answer and len(answer) > 10:
                return f"""{answer}

---
**参考来源**: {'、'.join(source_titles)}
*以上回答由 DeepSeek AI 基于 {len(sources)} 篇知识库文档生成*
"""
            else:
                raise Exception("Empty response from DeepSeek")

        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")

            fallback_answer = f"""基于知识库检索结果，针对您的问题「{question}」，我找到以下相关信息：

{context}

---
**参考来源**: {'、'.join(source_titles)}

*注：AI服务暂时不可用，以上为原始检索内容。请稍后重试以获得更好的回答体验。*
"""
            return fallback_answer
        return answer
