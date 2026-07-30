import os
import json
import logging
import threading
from typing import Dict, Any, List, Optional, Generator

import requests

logger = logging.getLogger(__name__)


class DeepSeekKeyPool:
    """DeepSeek API Key 轮换池 - Round-Robin 负载均衡"""

    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        raw_keys = os.environ.get('DEEPSEEK_API_KEYS', '')
        # 兼容旧单 key 配置
        fallback = os.environ.get('DEEPSEEK_API_KEY', '')
        if raw_keys:
            self.keys = [k.strip() for k in raw_keys.split(',') if k.strip()]
        elif fallback:
            self.keys = [fallback]
        else:
            # 从 Django settings 回退（开发环境默认值）
            try:
                from django.conf import settings
                raw = getattr(settings, 'DEEPSEEK_API_KEYS', '')
                if raw:
                    self.keys = [k.strip() for k in raw.split(',') if k.strip()]
                else:
                    self.keys = []
            except Exception:
                self.keys = []
        self._index = 0
        self._local_index = threading.local()

    @classmethod
    def get_instance(cls) -> 'DeepSeekKeyPool':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def get_key(self) -> str:
        """Round-Robin 取下一个可用 Key"""
        if not self.keys:
            raise ValueError("未配置任何 DEEPSEEK_API_KEY(S)")
        idx = getattr(self._local_index, 'value', None)
        if idx is None:
            with self._lock:
                idx = self._index
                self._index = (self._index + 1) % len(self.keys)
            self._local_index.value = idx
        key = self.keys[idx]
        # 线程本地索引用完后重置，下次重新取
        self._local_index.value = None
        return key

    @property
    def available(self) -> int:
        return len(self.keys)

    def __repr__(self):
        return f"DeepSeekKeyPool(keys={len(self.keys)})"


class DeepSeekClient:
    """DeepSeek V4 大模型 API 客户端"""

    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        model: str = None,
        max_tokens: int = 4096,
    ):
        # 优先使用传入的 key，否则从 KeyPool 动态获取（支持轮换）
        if api_key:
            self._api_key = api_key
            self._use_pool = False
        else:
            self._key_pool = DeepSeekKeyPool.get_instance()
            self._use_pool = True
            self._api_key = None
        self.base_url = (base_url or os.environ.get(
            'DEEPSEEK_BASE_URL',
            'https://api.deepseek.com/v1'
        )).rstrip('/')
        self.model = model or os.environ.get(
            'DEEPSEEK_MODEL',
            'deepseek-chat'
        )
        self.max_tokens = max_tokens or int(os.environ.get('DEEPSEEK_MAX_TOKENS', 4096))

    @property
    def api_key(self) -> str:
        """每次调用时从池中取 Key（支持轮换）"""
        if self._use_pool:
            return self._key_pool.get_key()
        return self._api_key

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        top_p: float = 1.0,
        stream: bool = False,
        image_data: str = None,  # Base64图片数据
        **kwargs,
    ) -> Dict[str, Any]:
        """
        调用 DeepSeek Chat Completion API（支持多模态）

        Args:
            messages: 对话消息列表 [{"role": "user"|"system"|"assistant", "content": "..."}]
            temperature: 温度参数（0-2，越高越随机）
            top_p: 核采样参数（0-1）
            stream: 是否流式返回
            image_data: Base64图片数据（用于多模态）
            **kwargs: 其他API参数

        Returns:
            完整的API响应字典
        """
        url = f"{self.base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # 如果有图片数据，修改最后一条用户消息为多模态格式
        if image_data:
            # 查找最后一条用户消息
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]['role'] == 'user':
                    original_text = messages[i]['content']
                    messages[i]['content'] = [
                        {"type": "text", "text": original_text},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                    ]
                    break

        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": self.max_tokens,
            "stream": stream,
            **kwargs,
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=60,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            logger.error("DeepSeek API request timed out")
            raise TimeoutError("请求超时，请稍后重试")
        except requests.exceptions.HTTPError as e:
            logger.error(f"DeepSeek API HTTP error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"API错误 ({e.response.status_code}): {e.response.text}")
        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            raise

    def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        top_p: float = 1.0,
        **kwargs,
    ) -> Generator[str, None, None]:
        """
        流式调用 DeepSeek API（逐token返回）

        Yields:
            每次生成的一个文本片段
        """
        url = f"{self.base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": self.max_tokens,
            "stream": True,
            **kwargs,
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=60,
                stream=True,
            )
            response.raise_for_status()

            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data_str = line[6:]
                        if data_str.strip() == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk['choices'][0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

        except Exception as e:
            logger.error(f"Stream error: {e}")
            raise

    def simple_chat(
        self,
        user_message: str,
        system_prompt: str = "",
        history: List[Dict[str, str]] = None,
        temperature: float = 0.7,
        image_data: str = None,  # Base64图片数据
    ) -> str:
        """
        简化的对话接口（直接返回文本，支持多模态）

        Args:
            user_message: 用户消息
            system_prompt: 系统提示词
            history: 历史消息 [{"role": "...", "content": "..."}]
            temperature: 温度
            image_data: Base64图片数据（用于多模态）

        Returns:
            模型生成的回复文本
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if history:
            messages.extend(history)

        messages.append({"role": "user", "content": user_message})

        result = self.chat_completion(messages, temperature=temperature, image_data=image_data)

        try:
            return result['choices'][0]['message']['content']
        except (KeyError, IndexError) as e:
            logger.error(f"Parse response error: {e}")
            return "抱歉，AI服务暂时不可用，请稍后重试。"


# 全局单例实例
_deepseek_client: Optional[DeepSeekClient] = None


def get_deepseek_client() -> DeepSeekClient:
    """获取全局 DeepSeek 客户端实例"""
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = DeepSeekClient()
    return _deepseek_client
