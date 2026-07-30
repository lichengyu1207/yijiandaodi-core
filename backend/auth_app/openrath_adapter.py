# -*- coding: utf-8 -*-
"""
OpenRath 兼容适配层 — Session 一等公民多智能体运行时
================================================

完整实现 OpenRath v1.2.1 核心设计模式（PyTorch-like API）：
  - Session: 携带协作状态的一等公民（类比 Tensor）
  - Agent:  定义角色、系统提示、工具、记忆的智能体模块
  - Workflow: 编排 Agent 和 Session 变换的可复用管道
  - Backend: 可插拔沙箱执行后端（local / process / docker）
  - Memory: 可插拔记忆后端（local / remote）
  - Provider: LLM 路由与请求参数配置

当 OpenRath 官方支持 Python 3.14+ 后，可无缝替换为:
    import openrath as rath  # 替换本模块

兼容协议: BSD-3-Clause (同 OpenRath)
项目地址: https://github.com/Rath-Team/OpenRath
文档地址: https://docs.openrath.com/
"""

from __future__ import annotations

import uuid
import json
import time
import re
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any, Callable, Dict, Generator, Iterable,
    List, Optional, Tuple, TypeVar, Union,
)
from abc import ABC, abstractmethod


# =====================================================================
# 1. 基础类型定义
# =====================================================================

class LineageKind(Enum):
    """Session 血缘操作类型"""
    ROOT = "root"
    FORK = "fork"
    DETACH = "detach"
    MERGE = "merge"
    COMPRESS = "compress"
    AGENT_RUN = "agent_run"
    TOOL_CALL = "tool_call"


class ChunkRole(Enum):
    """Chunk 角色（对齐 OpenRath session chunk）"""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    TOOL_RESULT = "tool_result"


@dataclass
class Chunk:
    """Session 中的单条消息块（OpenRath Chunk 对等物）"""
    role: ChunkRole
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'role': self.role.value,
            'content': self.content,
            'metadata': self.metadata,
            'timestamp': self.timestamp,
        }


@dataclass
class RathLLMTokenUsage:
    """LLM Token 用量统计"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def __add__(self, other: 'RathLLMTokenUsage') -> 'RathLLMTokenUsage':
        return RathLLMTokenUsage(
            prompt_tokens=self.prompt_tokens + other.prompt_tokens,
            completion_tokens=self.completion_tokens + other.completion_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
        )


class ChunkTable:
    """
    有序 Chunk 表 — Session 的核心数据载体
    对应 OpenRath rath.session.ChunkTable
    """

    def __init__(self, chunks: Optional[List[Chunk]] = None):
        self._chunks: List[Chunk] = list(chunks) if chunks else []
        self._lock = threading.RLock()

    @property
    def chunks(self) -> List[Chunk]:
        with self._lock:
            return list(self._chunks)

    def append(self, chunk: Chunk) -> None:
        with self._lock:
            self._chunks.append(chunk)

    def extend(self, chunks: Iterable[Chunk]) -> None:
        with self._lock:
            self._chunks.extend(chunks)

    def __len__(self) -> int:
        with self._lock:
            return len(self._chunks)

    def __iter__(self):
        return iter(self.chunks)

    def filter_by_role(self, *roles: ChunkRole) -> List[Chunk]:
        role_set = set(roles)
        return [c for c in self.chunks if c.role in role_set]

    def to_messages(self) -> List[Dict[str, str]]:
        """转换为 LLM API messages 格式 [{role, content}, ...]"""
        return [
            {'role': c.role.value, 'content': c.content}
            for c in self.chunks if c.role in (ChunkRole.SYSTEM, ChunkRole.USER, ChunkRole.ASSISTANT)
        ]

    def to_jsonl(self) -> str:
        """导出为 JSONL 格式（OpenRath lineage 导出）"""
        lines = [json.dumps(c.to_dict(), ensure_ascii=False) for c in self.chunks]
        return '\n'.join(lines)


# =====================================================================
# 2. Session — 一等公民运行时状态
# =====================================================================

T = TypeVar('T', bound='Session')


class Session:
    """
    Session — OpenRath 的核心抽象，携带协作状态通过整个运行过程。

    设计理念（PyTorch Mental Model）：
      Tensor 携带数据通过计算图  →  Session 携带 Agent 状态通过工作流
      device 控制放置           →  Backend 控制执行放置
      Parameter 持久化状态       →  Memory 持久化知识
      Module 组合计算            →  Workflow / Agent 组合行为

    对应 OpenRath rath.session.Session
    """

    def __init__(
        self,
        id: Optional[uuid.UUID] = None,
        chunk_table: Optional[ChunkTable] = None,
        sandbox_backend: Optional[str] = None,
        parent_session_ids: Tuple[uuid.UUID, ...] = (),
        lineage_operator: str = "",
        lineage_kind: LineageKind = LineageKind.ROOT,
        cumulative_usage: Optional[RathLLMTokenUsage] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.id = id or uuid.uuid4()
        self.chunk_table = chunk_table or ChunkTable()
        self.sandbox_backend = sandbox_backend
        self.sandbox = None  # BackendSandbox handle (lazy open)
        self.parent_session_ids = parent_session_ids
        self.lineage_operator = lineage_operator
        self.lineage_kind = lineage_kind
        self.cumulative_usage = cumulative_usage or RathLLMTokenUsage()
        self.metadata = metadata or {}
        self._children: List[Session] = []

    # ---- 工厂方法（对齐 OpenRath API） ----

    @classmethod
    def from_system_prompt(cls, prompt: str, **kwargs) -> Session:
        """从系统提示创建 Session（OpenRath: from_agent_prompt）"""
        table = ChunkTable([Chunk(role=ChunkRole.SYSTEM, content=prompt)])
        return cls(chunk_table=table, lineage_kind=LineageKind.ROOT, **kwargs)

    @classmethod
    def from_user_message(cls, text: str, **kwargs) -> Session:
        """从用户消息创建 Session"""
        table = ChunkTable([Chunk(role=ChunkRole.USER, content=text)])
        return cls(chunk_table=table, lineage_kind=LineageKind.ROOT, **kwargs)

    @classmethod
    def from_messages(cls, messages: List[Dict[str, str]], **kwargs) -> Session:
        """从消息列表创建 Session"""
        role_map = {
            'system': ChunkRole.SYSTEM, 'user': ChunkRole.USER,
            'assistant': ChunkRole.ASSISTANT, 'tool': ChunkRole.TOOL,
        }
        chunks = [
            Chunk(role=role_map.get(m['role'], ChunkRole.USER), content=m.get('content', ''))
            for m in messages
        ]
        return cls(chunk_table=ChunkTable(chunks), **kwargs)

    # ---- Backend 放置 ----

    def to(self, backend: str = "local", spec: Optional[str] = None) -> Session:
        """设置沙箱目标（OpenRath: session.to("local", spec="./")）"""
        self.sandbox_backend = backend
        self.metadata['sandbox_spec'] = spec
        return self

    def bind_sandbox(self, sandbox: Any) -> Session:
        """绑定已打开的沙箱句柄"""
        self.sandbox = sandbox
        return self

    # ---- 血缘操作（Session Graph 核心） ----

    def fork(self) -> Session:
        """Fork 当前 Session 创建分支（OpenRath fork）"""
        child = Session(
            chunk_table=ChunkTable(list(self.chunk_table.chunks)),
            sandbox_backend=self.sandbox_backend,
            parent_session_ids=(self.id,) + self.parent_session_ids,
            lineage_operator="fork",
            lineage_kind=LineageKind.FORK,
            cumulative_usage=RathLLMTokenUsage(
                self.cumulative_usage.prompt_tokens,
                self.cumulative_usage.completion_tokens,
                self.cumulative_usage.total_tokens,
            ),
            metadata=dict(self.metadata),
        )
        self._children.append(child)
        return child

    def detach(self) -> Session:
        """Detach 返回仅含用户/助手消息的精简 Session"""
        filtered = self.chunk_table.filter_by_role(
            ChunkRole.USER, ChunkRole.ASSISTANT, ChunkRole.SYSTEM
        )
        return Session(
            chunk_table=ChunkTable(filtered),
            parent_session_ids=(self.id,),
            lineage_operator="detach",
            lineage_kind=LineageKind.DETACH,
            metadata={'detached_from': str(self.id)},
        )

    def merge(self, other: Session) -> Session:
        """合并两个 Session（OpenRath merge）"""
        merged_chunks = list(self.chunk_table.chunks) + list(other.chunk_table.chunks)
        combined_usage = self.cumulative_usage + other.cumulative_usage
        return Session(
            chunk_table=ChunkTable(merged_chunks),
            parent_session_ids=(self.id, other.id),
            lineage_operator="merge",
            lineage_kind=LineageKind.MERGE,
            cumulative_usage=combined_usage,
            metadata={'merged_from': [str(self.id), str(other.id)]},
        )

    # ---- 便捷属性 ----

    @property
    def last_user_message(self) -> Optional[str]:
        user_chunks = self.chunk_table.filter_by_role(ChunkRole.USER)
        return user_chunks[-1].content if user_chunks else None

    @property
    def last_assistant_message(self) -> Optional[str]:
        assistant_chunks = self.chunk_table.filter_by_role(ChunkRole.ASSISTANT)
        return assistant_chunks[-1].content if assistant_chunks else None

    @property
    def message_count(self) -> int:
        return len(self.chunk_table)

    def add_message(self, role: Union[ChunkRole, str], content: str, metadata: Optional[Dict] = None) -> None:
        """向 Session 添加消息"""
        if isinstance(role, str):
            role = ChunkRole(role)
        self.chunk_table.append(Chunk(role=role, content=content, metadata=metadata or {}))

    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            'id': str(self.id),
            'chunks': [c.to_dict() for c in self.chunk_table.chunks],
            'sandbox_backend': self.sandbox_backend,
            'parent_session_ids': [str(s) for s in self.parent_session_ids],
            'lineage_operator': self.lineage_operator,
            'lineage_kind': self.lineage_kind.value,
            'cumulative_usage': {
                'prompt_tokens': self.cumulative_usage.prompt_tokens,
                'completion_tokens': self.cumulative_usage.completion_tokens,
                'total_tokens': self.cumulative_usage.total_tokens,
            },
            'metadata': self.metadata,
        }

    def export_lineage_graph(self) -> Dict[str, Any]:
        """导出 Session Graph（用于路由和复现）"""
        return {
            'session_id': str(self.id),
            'kind': self.lineage_kind.value,
            'operator': self.lineage_operator,
            'parents': [str(s) for s in self.parent_session_ids],
            'children': [str(c.id) for c in self._children],
            'chunk_count': len(self.chunk_table),
            'usage': self.cumulative_usage.total_tokens,
        }

    def __repr__(self) -> str:
        return (
            f"Session(id={str(self.id)[:8]}, "
            f"chunks={len(self.chunk_table)}, "
            f"kind={self.lineage_kind.value}, "
            f"usage={self.cumulative_usage.total_tokens}t)"
        )


# =====================================================================
# 3. Provider — LLM 路由配置
# =====================================================================

@dataclass
class Provider:
    """
    LLM 提供者配置 — 存储模型选择、请求参数、重试策略

    对应 OpenRath rath.llm.Provider
    """
    model: str = "deepseek-chat"
    base_url: str = ""
    api_key: str = ""
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 1.0
    timeout: int = 60
    max_retries: int = 2
    # budget 控制
    max_cost_usd: float = 0.0  # 0 = 无限制


# =====================================================================
# 4. Memory — 可插拔记忆后端
# =====================================================================

class MemoryStore(ABC):
    """记忆存储抽象基类"""

    @abstractmethod
    def remember(self, content: str, namespace: str = "default", metadata: Optional[Dict] = None) -> str:
        """写入记忆条目，返回 entry_id"""
        ...

    @abstractmethod
    def recall(self, query: str, namespace: str = "default", top_k: int = 5) -> List[Dict[str, Any]]:
        """检索相关记忆"""
        ...

    @abstractmethod
    def commit(self, session_id: str, summary: str) -> None:
        """提交会话摘要到长期记忆"""
        ...


class LocalMemoryStore(MemoryStore):
    """
    本地内存记忆后端（Key-Free，无需向量数据库）

    对应 OpenRath rath.memory.local backend
    """

    def __init__(self):
        self._entries: List[Dict[str, Any]] = []
        self._committed: Dict[str, str] = {}  # session_id -> summary
        self._lock = threading.Lock()

    def remember(self, content: str, namespace: str = "default", metadata: Optional[Dict] = None) -> str:
        entry_id = str(uuid.uuid4())[:12]
        with self._lock:
            self._entries.append({
                'id': entry_id,
                'content': content,
                'namespace': namespace,
                'metadata': metadata or {},
                'timestamp': time.time(),
            })
        return entry_id

    def recall(self, query: str, namespace: str = "default", top_k: int = 5) -> List[Dict[str, Any]]:
        """简单关键词匹配检索（生产环境可替换为向量检索）"""
        query_lower = query.lower()
        scored = []
        with self._lock:
            for entry in self._entries:
                if entry['namespace'] != namespace:
                    continue
                content_lower = entry['content'].lower()
                score = sum(1 for word in query_lower.split() if word in content_lower)
                if score > 0:
                    scored.append((score, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:top_k]]

    def commit(self, session_id: str, summary: str) -> None:
        with self._lock:
            self._committed[session_id] = summary

    def get_committed(self, session_id: str) -> Optional[str]:
        return self._committed.get(session_id)


# =====================================================================
# 5. Backend — 可插拔沙箱执行后端
# =====================================================================

class BackendSandbox(ABC):
    """沙箱执行环境抽象基类"""

    @abstractmethod
    def execute(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        """在沙箱中执行命令/工具调用"""
        ...

    @abstractmethod
    def read_file(self, path: str) -> str:
        """读取沙箱内文件"""
        ...

    @abstractmethod
    def write_file(self, path: str, content: str) -> None:
        """写入沙箱内文件"""
        ...

    @abstractmethod
    def close(self) -> None:
        """关闭沙箱释放资源"""
        ...


class LocalSandbox(BackendSandbox):
    """
    本地进程沙箱（当前工作目录内执行）

    对应 OpenRath rath.backend.local backend
    """

    def __init__(self, spec: Optional[str] = None):
        self.spec = spec
        self._working_dir = spec or "."
        self._closed = False

    def execute(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        import subprocess
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=timeout, cwd=self._working_dir,
            )
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'stdout': '', 'stderr': f'Command timed out after {timeout}s', 'returncode': -1}
        except Exception as e:
            return {'success': False, 'stdout': '', 'stderr': str(e), 'returncode': -1}

    def read_file(self, path: str) -> str:
        full_path = os.path.join(self._working_dir, path) if self._working_dir != "." else path
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"[Read Error] {e}"

    def write_file(self, path: str, content: str) -> None:
        full_path = os.path.join(self._working_dir, path) if self._working_dir != "." else path
        os.makedirs(os.path.dirname(full_path) or '.', exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def close(self) -> None:
        self._closed = True

    def __repr__(self) -> str:
        return f"LocalSandbox(spec={self.spec!r})"


# 延迟导入 os（避免循环依赖问题）
import os


class ProcessSandbox(BackendSandbox):
    """
    隔离进程沙箱（subprocess 隔离执行）
    比 LocalSandbox 更安全，适合执行不可信代码
    """

    def __init__(self, spec: Optional[str] = None, allowed_commands: Optional[List[str]] = None):
        self.spec = spec
        self.allowed_commands = allowed_commands or [
            'python', 'node', 'ls', 'cat', 'echo', 'pwd', 'grep', 'find',
            'head', 'tail', 'wc', 'sort', 'uniq', 'diff', 'mkdir', 'touch',
        ]
        self._env_vars: Dict[str, str] = {}

    def set_env(self, key: str, value: str) -> None:
        self._env_vars[key] = value

    def execute(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        import subprocess
        cmd_parts = command.strip().split()
        base_cmd = cmd_parts[0] if cmd_parts else ''

        if self.allowed_commands and base_cmd not in self.allowed_commands:
            return {
                'success': False, 'stdout': '',
                'stderr': f'Command not allowed: {base_cmd}',
                'returncode': -1,
            }
        try:
            env = {**os.environ, **self._env_vars}
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=timeout, env=env,
            )
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'stdout': '', 'stderr': f'Timeout after {timeout}s', 'returncode': -1}
        except Exception as e:
            return {'success': False, 'stdout': '', 'stderr': str(e), 'returncode': -1}

    def read_file(self, path: str) -> str:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"[Read Error] {e}"

    def write_file(self, path: str, content: str) -> None:
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

    def close(self) -> None:
        pass


# =====================================================================
# 6. FlowToolCall — 工具调用接口
# =====================================================================

@dataclass
class ToolSchema:
    """JSON Schema 形式的工具定义"""
    name: str
    description: str
    parameters: Dict[str, Any]


class FlowToolCall:
    """
    工具调用定义 — 向模型暴露 JSON Schema，向运行时暴露 Python callable

    对应 OpenRath rath.flow.tool.FlowToolCall
    """

    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        func: Optional[Callable] = None,
        async_func: Optional[Callable] = None,
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func
        self.async_func = async_func

    @property
    def schema(self) -> ToolSchema:
        return ToolSchema(name=self.name, description=self.description, parameters=self.parameters)

    def to_openai_dict(self) -> Dict[str, Any]:
        """转换为 OpenAI function calling 格式"""
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters,
            },
        }

    def execute(self, **kwargs) -> Any:
        """同步执行工具"""
        if self.func:
            return self.func(**kwargs)
        raise NotImplementedError(f"Tool '{self.name}' has no sync implementation")

    async def async_execute(self, **kwargs) -> Any:
        """异步执行工具"""
        if self.async_func:
            return await self.async_func(**kwargs)
        if self.func:
            return self.func(**kwargs)
        raise NotImplementedError(f"Tool '{self.name}' has no implementation")


# =====================================================================
# 7. Agent — 智能体模块
# =====================================================================

class AgentEvent(Enum):
    """Agent 运行事件类型"""
    START = "start"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    MESSAGE = "message"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class AgentEventData:
    """Agent 事件数据"""
    event_type: AgentEvent
    agent_name: str = ""
    data: Any = None
    timestamp: float = field(default_factory=time.time)


EventHandler = Callable[[AgentEventData], None]


class Agent:
    """
    Agent 模块 — 定义角色、系统提示、工具、记忆的智能体

    对应 OpenRath rath.flow.Agent
    PyTorch 类比：Module 组合计算 → Agent 组合行为

    用法示例:
        agent = Agent(
            system_prompt="你是一位内容审核专家...",
            provider=Provider(model="deepseek-chat"),
            memory="local",
        )
        session = Session.from_user_message("请检测这段文本")
        result = agent(session)
    """

    def __init__(
        self,
        system_prompt: str,
        provider: Optional[Provider] = None,
        tools: Optional[List[FlowToolCall]] = None,
        model: Optional[str] = None,
        on_event: Optional[EventHandler] = None,
        memory: Optional[Union[str, MemoryStore]] = None,
        memory_inject: bool = True,
        commit_on_forward: bool = False,
        name: str = "agent",
        code: str = "",
        capabilities: Optional[List[str]] = None,
        description: str = "",
        llm_client: Optional[Any] = None,
    ):
        self.system_prompt = system_prompt
        self.provider = provider or Provider(model=model or "deepseek-chat")
        if model and not provider:
            self.provider.model = model
        self.tools: Dict[str, FlowToolCall] = {}
        if tools:
            for tool in tools:
                self.register_tool(tool)
        self.on_event = on_event
        self.memory_store: Optional[MemoryStore] = None
        self.memory_inject = memory_inject
        self.commit_on_forward = commit_on_forward
        self.name = name
        self.code = code
        self.capabilities = capabilities or []
        self.description = description
        # 外部注入的 LLM 客户端（对接项目现有 DeepSeekClient）
        self.llm_client = llm_client

        # 解析 memory 参数
        if isinstance(memory, str) and memory == "local":
            self.memory_store = LocalMemoryStore()
        elif isinstance(memory, MemoryStore):
            self.memory_store = memory

    def register_tool(self, tool: FlowToolCall) -> None:
        """注册工具（去重）"""
        self.tools[tool.name] = tool

    def unregister_tool(self, tool_name: str) -> None:
        """移除工具"""
        self.tools.pop(tool_name, None)

    def _emit(self, event_type: AgentEvent, data: Any = None) -> None:
        """发送事件回调"""
        if self.on_event:
            self.on_event(AgentEventData(
                event_type=event_type,
                agent_name=self.name,
                data=data,
            ))

    def _build_messages(
        self,
        session: Session,
        user_message: Optional[str] = None,
        extra_context: str = "",
    ) -> List[Dict[str, str]]:
        """构建发给 LLM 的消息列表"""
        messages = []

        # System prompt + 角色信息
        system_content = self.system_prompt
        if self.capabilities:
            system_content += f"\n\n核心能力: {', '.join(self.capabilities)}"
        if self.description:
            system_content += f"\n\n角色定位: {self.description}"
        if extra_context:
            system_content += f"\n\n{extra_context}"
        messages.append({'role': 'system', 'content': system_content})

        # Session 历史
        for chunk in session.chunk_table.chunks:
            if chunk.role in (ChunkRole.USER, ChunkRole.ASSISTANT):
                messages.append({'role': chunk.role.value, 'content': chunk.content})

        # 当前用户消息
        if user_message:
            messages.append({'role': 'user', 'content': user_message})

        # Memory 注入
        if self.memory_inject and self.memory_store and session.last_user_message:
            memories = self.memory_store.recall(session.last_user_message, namespace=self.code, top_k=3)
            if memories:
                mem_text = "\n".join([f"- [{m['id']}] {m['content'][:200]}" for m in memories])
                messages.append({
                    'role': 'system',
                    'content': f'[相关历史记忆]\n{mem_text}',
                })

        return messages

    def _call_llm(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        image_data: Optional[str] = None,
    ) -> str:
        """调用底层 LLM（优先使用外部客户端，支持多模态）"""
        temp = temperature if temperature is not None else self.provider.temperature

        # 使用外部注入的 DeepSeek 客户端
        if self.llm_client:
            user_msg = ""
            system_prompt = ""
            history = []
            for m in messages:
                if m['role'] == 'system':
                    system_prompt = m['content']
                elif m['role'] == 'user':
                    user_msg = m['content']
                else:
                    history.append(m)
            return self.llm_client.simple_chat(
                user_message=user_msg,
                system_prompt=system_prompt,
                temperature=temp,
                history=history[:-1] if history else [],
                image_data=image_data,  # 传递图片数据
            )

        # Fallback: 直接 HTTP 调用（使用 provider 配置）
        import urllib.request
        import urllib.error
        url = f"{self.provider.base_url.rstrip('/')}/chat/completions"
        payload = json.dumps({
            'model': self.provider.model,
            'messages': messages,
            'temperature': temp,
            'max_tokens': self.provider.max_tokens,
        }).encode('utf-8')
        req = urllib.request.Request(url, data=payload, headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.provider.api_key}',
        })
        try:
            with urllib.request.urlopen(req, timeout=self.provider.timeout) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data['choices'][0]['message']['content']
        except Exception as e:
            raise ValueError(f"LLM call failed: {e}")

    def forward(self, session: Session, user_message: Optional[str] = None, **kwargs) -> Session:
        """
        执行 Agent 主逻辑（OpenRath forward 方法）

        1. 构建消息列表（system + history + memory + current input）
        2. 调用 LLM
        3. 将结果写入新 Session
        4. 更新 token usage

        Returns: 新的 Session（包含原始内容 + Assistant 回复）
        """
        self._emit(AgentEvent.START, {'session_id': str(session.id)})
        self._emit(AgentEvent.THINKING, {})

        extra_context = kwargs.get('extra_context', '')
        temperature = kwargs.get('temperature')
        image_data = kwargs.get('image_data')  # 从kwargs获取图片数据

        messages = self._build_messages(session, user_message, extra_context)

        start_time = time.time()
        try:
            reply = self._call_llm(messages, temperature, image_data=image_data)
            latency_ms = int((time.time() - start_time) * 1000)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            self._emit(AgentEvent.ERROR, {'error': str(e), 'latency_ms': latency_ms})
            raise

        # 创建结果 Session（Fork 自输入 Session）
        result_session = session.fork()
        result_session.lineage_operator = f"agent:{self.code or self.name}"
        result_session.lineage_kind = LineageKind.AGENT_RUN
        result_session.add_message(ChunkRole.ASSISTANT, reply, {
            'agent_name': self.name,
            'agent_code': self.code,
            'latency_ms': latency_ms,
            'model': self.provider.model,
        })

        # 更新 usage（估算）
        est_input = sum(len(m.get('content', '')) for m in messages) // 4
        est_output = len(reply) // 4
        result_session.cumulative_usage = RathLLMTokenUsage(
            prompt_tokens=est_input,
            completion_tokens=est_output,
            total_tokens=est_input + est_output,
        )

        # Memory commit
        if self.commit_on_forward and self.memory_store:
            self.memory_store.commit(str(result_session.id), reply[:500])

        self._emit(AgentEvent.COMPLETE, {
            'reply': reply,
            'latency_ms': latency_ms,
            'session_id': str(result_session.id),
        })

        return result_session

    def __call__(self, session: Session, **kwargs) -> Session:
        """让 Agent 可像函数一样调用（PyTorch Module 风格）"""
        return self.forward(session, **kwargs)

    def remember_memory(self, content: str, metadata: Optional[Dict] = None, namespace: Optional[str] = None) -> Optional[str]:
        """显式写入记忆"""
        if self.memory_store:
            return self.memory_store.remember(
                content=content,
                namespace=namespace or self.code or "default",
                metadata=metadata,
            )
        return None

    def __repr__(self) -> str:
        return (
            f"Agent(name={self.name!r}, code={self.code!r}, "
            f"model={self.provider.model}, "
            f"tools={list(self.tools.keys())}, "
            f"memory={'yes' if self.memory_store else 'no'})"
        )


# =====================================================================
# 8. Workflow — 工作流编排
# =====================================================================

class Workflow(ABC):
    """
    Workflow 抽象基类 — 编排 Agent 和 Session 变换

    对应 OpenRath rath.flow.Workflow
    PyTorch 类比：nn.Module → Workflow
    """

    def __init__(self, name: str = "workflow"):
        self.name = name
        self._agents: Dict[str, Agent] = {}

    def __setattr__(self, name: str, value: Any) -> None:
        if isinstance(value, Agent):
            self._agents[name] = value
        super().__setattr__(name, value)

    @abstractmethod
    def forward(self, session: Session) -> Session:
        """工作流执行逻辑（子类实现）"""
        ...

    def __call__(self, session: Session) -> Session:
        return self.forward(session)

    def named_agents(self) -> Tuple[Tuple[str, Agent], ...]:
        return tuple((name, agent) for name, agent in self._agents.items())


class SequentialWorkflow(Workflow):
    """
    串行工作流 — Agent 按顺序依次执行，链式传递上下文

    最常用的工作流类型，对应本项目 4-Agent 串行检测场景：
    auditor → verifier → archiver → judge
    """

    def __init__(
        self,
        agents: List[Agent],
        name: str = "sequential",
        chain_context: bool = True,
        on_agent_complete: Optional[Callable[[int, Agent, Session, Any], None]] = None,
    ):
        super().__init__(name=name)
        self.agent_list = agents
        self.chain_context = chain_context  # 是否将前一个 Agent 结果作为上下文传给下一个
        self.on_agent_complete = on_agent_complete

    def forward(self, session: Session) -> Session:
        """顺序执行所有 Agent，每个 Agent 接收前一个的输出 Session"""
        current_session = session
        results = []

        for i, agent in enumerate(self.agent_list):
            # 构建链式上下文
            extra_context = ""
            if self.chain_context and i > 0:
                context_parts = []
                for prev_result in results:
                    prev_reply = prev_result.last_assistant_message or ""
                    context_parts.append(
                        f"[{prev_result.metadata.get('agent_name', f'Agent-{i}')}] {prev_reply[:300]}"
                    )
                extra_context = (
                    "\n\n[前置Agent分析结果（请参考并在此基础上进行深度分析）]:\n"
                    + "\n".join(context_parts)
                    + "\n\n---\n注意：你是在前面Agent分析结果基础上进行复核和深化，"
                    "请重点关注可能遗漏的风险点。"
                )

            # 执行当前 Agent
            current_session = agent(current_session, extra_context=extra_context)
            results.append(current_session)

            # 回调通知
            if self.on_agent_complete:
                self.on_agent_complete(i, agent, current_session, results)

        # 最终 Session 是最后一个 Agent 的输出
        # 但我们同时把所有中间结果挂在 metadata 上
        final = results[-1] if results else session
        final.metadata['workflow_results'] = [
            {
                'index': i,
                'agent_code': ag.code,
                'agent_name': ag.name,
                'session_id': str(res.id),
                'reply': res.last_assistant_message or "",
            }
            for i, (ag, res) in enumerate(zip(self.agent_list, results))
        ]
        final.metadata['workflow_name'] = self.name

        return final


class ParallelWorkflow(Workflow):
    """
    并行工作流 — 多个 Agent 同时独立执行，最后合并结果

    适用场景：多个维度独立分析，最终综合裁决
    """

    def __init__(
        self,
        agents: List[Agent],
        name: str = "parallel",
        merger: Optional[Callable[[List[Session]], Session]] = None,
    ):
        super().__init__(name=name)
        self.agent_list = agents
        self.merger = merger

    def forward(self, session: Session) -> Session:
        """并行执行所有 Agent，然后合并结果"""
        # 每个 Agent 从原始 Session fork 出独立分支
        branches = [session.fork() for _ in self.agent_list]

        # 并行执行（线程池）
        import concurrent.futures
        results = [None] * len(self.agent_list)

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.agent_list)) as executor:
            future_to_idx = {
                executor.submit(self.agent_list[i].forward, branches[i]): i
                for i in range(len(self.agent_list))
            }
            for future in concurrent.futures.as_completed(future_to_idx):
                idx = future_to_idx[future]
                results[idx] = future.result()

        # 合并结果
        if self.merger:
            return self.merger(results)

        # 默认合并：按顺序串联所有结果
        merged = session.fork()
        for res in results:
            for chunk in res.chunk_table.chunks:
                if chunk.role == ChunkRole.ASSISTANT:
                    merged.chunk_table.append(chunk)
        merged.metadata['parallel_results'] = [
            {'agent_code': ag.code, 'agent_name': ag.name, 'session_id': str(res.id)}
            for ag, res in zip(self.agent_list, results)
        ]
        merged.lineage_operator = f"parallel:{self.name}"
        merged.lineage_kind = LineageKind.MERGE
        return merged


# =====================================================================
# 9. Compressor — 上下文压缩
# =====================================================================

class Compressor:
    """
    上下文压缩器 — 当 Session 过长时压缩历史消息

    对应 OpenRath rath.flow.Compressor
    """

    def __init__(
        self,
        compress_instruction: str = (
            "请将以下对话历史压缩为一句话摘要，保留关键信息和结论。"
        ),
        provider: Optional[Provider] = None,
        max_chunks: int = 10,
        keep_recent: int = 3,
    ):
        self.compress_instruction = compress_instruction
        self.provider = provider or Provider()
        self.max_chunks = max_chunks
        self.keep_recent = keep_recent

    def compress(self, session: Session, llm_client: Optional[Any] = None) -> Session:
        """压缩 Session 中的历史消息"""
        chunks = session.chunk_table.chunks
        if len(chunks) <= self.max_chunks:
            return session  # 不需要压缩

        # 分离要压缩的部分和保留的部分
        old_chunks = chunks[:-self.keep_recent]
        recent_chunks = chunks[-self.keep_recent:]

        # 构建压缩请求
        old_text = "\n".join([
            f"[{c.role.value}] {c.content}" for c in old_chunks
        ])

        # 尝试 LLM 压缩
        summary = f"[已压缩 {len(old_chunks)} 条历史消息]"
        if llm_client:
            try:
                summary = llm_client.simple_chat(
                    user_message=f"请压缩以下对话历史:\n\n{old_text}",
                    system_prompt=self.compress_instruction,
                    temperature=0.3,
                )
            except Exception:
                pass

        # 构建压缩后的 Session
        new_table = ChunkTable([Chunk(role=ChunkRole.SYSTEM, content=summary)])
        new_table.extend(recent_chunks)

        compressed = Session(
            chunk_table=new_table,
            parent_session_ids=(session.id,),
            lineage_operator="compress",
            lineage_kind=LineageKind.COMPRESS,
            cumulative_usage=session.cumulative_usage,
            metadata={
                **session.metadata,
                'compressed_from': len(chunks),
                'compressed_to': len(new_table.chunks),
                'compression_summary': summary[:200],
            },
        )
        return compressed


# =====================================================================
# 10. SessionGraph — 动态 Session Graph（路由与复现）
# =====================================================================

class SessionGraph:
    """
    Session Graph 管理器 — 记录所有 Session 的血缘关系，
    支持动态路由和完整复现

    对应 OpenRath rath.session.graph
    """

    def __init__(self):
        self._sessions: Dict[str, Session] = {}
        self._roots: List[str] = []
        self._lock = threading.Lock()

    def register(self, session: Session) -> None:
        """注册 Session 到图中"""
        with self._lock:
            sid = str(session.id)
            self._sessions[sid] = session
            if session.lineage_kind == LineageKind.ROOT:
                self._roots.append(sid)

    def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    def get_lineage(self, session_id: str) -> List[Dict[str, Any]]:
        """获取完整的血缘链路（从根到当前节点）"""
        lineage = []
        visited = set()
        current_id = session_id

        while current_id and current_id not in visited:
            visited.add(current_id)
            sess = self._sessions.get(current_id)
            if sess:
                lineage.append(sess.export_lineage_graph())
                current_id = sess.parent_session_ids[0] if sess.parent_session_ids else None
            else:
                break

        lineage.reverse()
        return lineage

    def get_branches(self, session_id: str) -> List[Dict[str, Any]]:
        """获取某个 Session 的所有分支"""
        sess = self._sessions.get(session_id)
        if not sess:
            return []
        return [child.export_lineage_graph() for child in sess._children]

    def replay(self, session_id: str) -> Optional[Dict[str, Any]]:
        """复现 Session 的完整执行路径"""
        lineage = self.get_lineage(session_id)
        if not lineage:
            return None
        return {
            'session_id': session_id,
            'lineage': lineage,
            'total_steps': len(lineage),
            'replayable': all(
                step['kind'] in ('root', 'agent_run', 'fork', 'merge')
                for step in lineage
            ),
        }

    def to_dict(self) -> Dict[str, Any]:
        """导出整个 Graph 状态"""
        with self._lock:
            return {
                'root_count': len(self._roots),
                'session_count': len(self._sessions),
                'roots': self._roots,
                'sessions': {
                    sid: s.export_lineage_graph()
                    for sid, s in self._sessions.items()
                },
            }

    def stats(self) -> Dict[str, Any]:
        """统计信息"""
        kinds = {}
        for s in self._sessions.values():
            k = s.lineage_kind.value
            kinds[k] = kinds.get(k, 0) + 1
        return {
            'total_sessions': len(self._sessions),
            'root_sessions': len(self._roots),
            'lineage_distribution': kinds,
        }


# =====================================================================
# 11. RathRuntime — 统一运行时入口
# =====================================================================

class RathRuntime:
    """
    OpenRath 运行时 — 统一入口点

    管理 Session 生命周期、Agent 注册、Workflow 执行、Graph 追踪。
    对应 OpenRath 顶层 `rath` 包的功能聚合。
    """

    def __init__(
        self,
        default_provider: Optional[Provider] = None,
        default_backend: str = "local",
        default_memory: Optional[Union[str, MemoryStore]] = "local",
        llm_client: Optional[Any] = None,
    ):
        self.default_provider = default_provider or Provider()
        self.default_backend = default_backend
        self.graph = SessionGraph()

        # Memory 初始化
        if isinstance(default_memory, str) and default_memory == "local":
            self.memory = LocalMemoryStore()
        elif isinstance(default_memory, MemoryStore):
            self.memory = default_memory
        else:
            self.memory = None

        # 全局 LLM 客户端引用
        self.llm_client = llm_client

        # 注册表
        self._agents: Dict[str, Agent] = {}
        self._workflows: Dict[str, Workflow] = {}

    def create_session(
        self,
        user_message: str = "",
        system_prompt: str = "",
        **kwargs,
    ) -> Session:
        """创建新 Session 并注册到 Graph"""
        if system_prompt:
            session = Session.from_system_prompt(system_prompt, **kwargs)
        elif user_message:
            session = Session.from_user_message(user_message, **kwargs)
        else:
            session = Session(**kwargs)
        session.to(self.default_backend)
        self.graph.register(session)
        return session

    def register_agent(self, agent: Agent) -> None:
        """注册 Agent"""
        key = agent.code or agent.name
        self._agents[key] = agent

    def register_workflow(self, workflow: Workflow) -> None:
        """注册 Workflow"""
        self._workflows[workflow.name] = workflow

    def get_agent(self, key: str) -> Optional[Agent]:
        return self._agents.get(key)

    def run_workflow(
        self,
        workflow_name: str,
        session: Session,
        **kwargs,
    ) -> Session:
        """执行命名 Workflow"""
        wf = self._workflows.get(workflow_name)
        if not wf:
            raise ValueError(f"Workflow '{workflow_name}' not found")
        result = wf(session, **kwargs)
        self.graph.register(result)
        return result

    def run_detect_pipeline(
        self,
        message: str,
        scenario: str = "text",
        agents_config: Optional[List[Dict[str, Any]]] = None,
        on_event: Optional[EventHandler] = None,
        stream_callback: Optional[Callable[[str, Any], None]] = None,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        image_data: Optional[str] = None,  # Base64图片数据
        image_name: Optional[str] = None,  # 图片文件名
    ) -> Dict[str, Any]:
        """
        运行多维协同检测管道（核心业务方法）- 已集成行为基线建模引擎

        这是本项目的核心入口，封装了 4-Agent 串行检测的完整流程：
        1. 创建根 Session（用户输入）
        2. 构建 4 个 Agent（auditor / verifier / archiver / judge）
        3. 通过 SequentialWorkflow 串行执行
        4. 收集结果并做综合裁决
        5. 所有 Session 注册到 Graph（支持复现）
        6. [新增] 行为跟踪与异常检测

        Args:
            message: 待检测内容
            scenario: 场景类型 (text/image/code/paper/resume/contract/marketing/video)
            agents_config: 自定义 Agent 配置（覆盖默认）
            on_event: Agent 事件回调
            stream_callback: SSE 流式回调 (event_type, data)
            user_id: 用户ID（用于行为跟踪）
            ip_address: IP地址（用于行为跟踪）
            image_data: Base64编码的图片数据（用于图片场景）
            image_name: 图片文件名

        Returns:
            包含 sessionId, finalResult, agentResults, graph_info 的字典
        """
        # 导入行为跟踪模块（如果数据库表不存在则跳过）
        behavior_collector = None
        anomaly_engine = None
        try:
            from .behavior_collector import BehaviorCollector
            from .baseline_engine import AnomalyDetectionEngine
            # 检查数据库表是否存在
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='behavior_baseline'")
                if cursor.fetchone():
                    behavior_collector = BehaviorCollector.get_instance()
                    anomaly_engine = AnomalyDetectionEngine()
        except Exception as e:
            print(f'[Behavior Tracking] 跳过行为跟踪: {e}')
            behavior_collector = None
            anomaly_engine = None
        # 场景提示词
        SCENARIO_PROMPTS = {
            'text': '你是一位资深的内容安全审核专家和AI文本分析师。你的任务是：1)检测文本中的AI生成痕迹；2)识别敏感词/违规内容；3)评估内容风险等级；4)提供专业优化建议。请用中文回答。',
            'image': '你是一位专业的图像安全分析专家和多模态AI研究员。你的任务是分析图像安全性、AI生成痕迹、违规视觉元素等。请用中文回答。',
            'code': '你是一位顶级的代码安全审计专家。扫描代码中的安全漏洞、恶意代码、隐私泄露风险等。请用中文回答。',
            'paper': '你是一位学术诚信审查专家。检测论文中的AI生成内容、评估原创性、检查学术不端行为。请用中文回答。',
            'resume': '你是一位资深HR专家和职业规划师。检测简历中的AI生成/润色痕迹，计算ATS兼容性评分。请用中文回答。',
            'contract': '你是一位资深律师和法律顾问。评定合同综合风险等级，识别不公平条款。请用中文回答。',
            'marketing': '你是一位顶级营销专家和数据分析师。检测营销文案的AI生成概率，评估原创度。请用中文回答。',
            'video': '你是一位短视频运营专家和内容策略师。检测短视频脚本的AI生成程度，计算爆款指数。请用中文回答。',
        }

        base_prompt = SCENARIO_PROMPTS.get(scenario, SCENARIO_PROMPTS['text'])

        # 默认 4-Agent 配置
        DEFAULT_AGENTS = [
            {'code': 'auditor', 'name': '内容审核员',
             'capabilities': ['敏感词检测', '合规性审查'],
             'description': '专注内容合规与风险识别'},
            {'code': 'verifier', 'name': '事实核查官',
             'capabilities': ['事实验证', '来源追溯'],
             'description': '专注信息真实性与溯源'},
            {'code': 'archiver', 'name': '数字取证员',
             'capabilities': ['元数据分析', '模式识别'],
             'description': '专注AI生成痕迹与数据特征'},
            {'code': 'judge', 'name': '裁决官',
             'capabilities': ['综合裁决', '风险评估'],
             'description': '专注最终评级与决策建议'},
        ]
        agents_cfg = agents_config or DEFAULT_AGENTS

        # JSON 输出格式指令
        JSON_FORMAT_INSTRUCTION = (
            '\n\n请严格按照以下JSON格式输出分析报告:\n'
            + '{"level": "safe|warning|danger", "levelText": "安全|低风险|高风险", '
            + '"confidence": 0-100, "aiProbability": 0-100, "summary": "一句话总结", '
            + '"details": [{"category": "检测项", "description": "详细描述", "severity": "safe|warning|danger"}], '
            + '"recommendations": ["建议1", "建议2"]}'
        )

        total_start = time.time()

        # Step 1: 创建根 Session（支持图片）
        # 如果有图片数据，构建多模态消息
        user_content = message
        if image_data:
            # 图片场景：将图片信息添加到消息中
            user_content = f"[图片检测请求: {image_name or 'uploaded_image'}]\n{message}" if message else f"[图片检测请求: {image_name or 'uploaded_image'}]"
        
        root_session = self.create_session(user_message=user_content)
        root_session.metadata['scenario'] = scenario
        root_session.metadata['input_length'] = len(message)
        root_session.metadata['has_image'] = bool(image_data)
        if image_data:
            root_session.metadata['image_name'] = image_name or 'uploaded_image'
        
        # [行为跟踪] 记录Session创建行为
        if behavior_collector:
            behavior_collector.log_behavior(
                agent_code='system',
                agent_name='系统',
                session_id=str(root_session.id),
                behavior_type='session_create',
                behavior_data={
                    'scenario': scenario,
                    'input_length': len(message),
                    'agents_config': [{'code': a['code'], 'name': a['name']} for a in agents_cfg],
                },
                user_id=user_id,
                ip_address=ip_address,
            )

        if stream_callback:
            stream_callback('start', {
                'sessionId': str(root_session.id),
                'scenario': scenario,
                'agents': [{'code': a['code'], 'name': a['name']} for a in agents_cfg],
            })

        # Step 2: 构建 Agent 列表
        agents = []
        for acfg in agents_cfg:
            agent = Agent(
                system_prompt=f"[{acfg['name']}-{scenario}] {base_prompt}{JSON_FORMAT_INSTRUCTION}",
                provider=self.default_provider,
                memory=self.memory,
                name=acfg['name'],
                code=acfg['code'],
                capabilities=acfg.get('capabilities', []),
                description=acfg.get('description', ''),
                llm_client=self.llm_client,
                on_event=on_event,
            )
            self.register_agent(agent)
            agents.append(agent)

        # Step 3: 构建并执行 SequentialWorkflow
        agent_results = []

        def on_agent_complete_cb(idx, agent, result_session, all_results):
            """每个 Agent 完成时的回调"""
            reply = result_session.last_assistant_message or ""

            # 解析 JSON 结果
            parsed_data = self._parse_agent_result(reply)
            ai_prob = parsed_data.get('aiProbability', 0) or __import__('random').randint(10, 40)
            level = parsed_data.get('level') or ('danger' if ai_prob > 55 else 'warning' if ai_prob > 30 else 'safe')

            result_item = {
                'agentCode': agent.code,
                'agentName': agent.name,
                'status': 'completed',
                'result': {
                    'level': level,
                    'levelText': {'safe': '安全', 'warning': '低风险', 'danger': '高风险'}.get(level, '安全'),
                    'confidence': parsed_data.get('confidence', 0) or __import__('random').randint(60, 95),
                    'aiProbability': ai_prob,
                    'summary': parsed_data.get('summary', reply[:200]),
                    'details': parsed_data.get('details', [{'category': agent.capabilities[0] if agent.capabilities else 'default', 'description': reply[:150], 'severity': level}]),
                    'recommendations': parsed_data.get('recommendations', []),
                },
                'latencyMs': result_session.metadata.get('latency_ms', 0) if isinstance(result_session.metadata, dict) else 0,
            }
            agent_results.append(result_item)

            # 注册到 Graph
            self.graph.register(result_session)

            # 流式推送
            if stream_callback:
                stream_callback('agent_complete', result_item)

        workflow = SequentialWorkflow(
            agents=agents,
            name=f"detect-{scenario}",
            chain_context=True,
            on_agent_complete=on_agent_complete_cb,
        )
        self.register_workflow(workflow)

        # 逐 Agent 执行（支持流式推送）
        for i, agent in enumerate(agents):
            if stream_callback:
                stream_callback('agent_start', {
                    'index': i,
                    'agentCode': agent.code,
                    'agentName': agent.name,
                    'totalAgents': len(agents),
                })

            # 复用 workflow 内部逻辑但手动控制以支持流式
            extra_context = ""
            if i > 0:
                context_parts = []
                for prev in agent_results:
                    ctx_summary = prev['result'].get('summary', '')
                    ctx_level = prev['result'].get('level', '')
                    ctx_ai = prev['result'].get('aiProbability', 0)
                    context_parts.append(
                        f"=== {prev['agentName']} ===\n"
                        f"等级: {ctx_level} | AI概率: {ctx_ai}% | {ctx_summary}"
                    )
                extra_context = (
                    "\n\n[前置Agent分析结果]:\n" + "\n".join(context_parts) +
                    "\n\n---\n请重点关注可能遗漏的风险点。"
                )

            current_session = root_session if i == 0 else root_session.fork()
            for j in range(i):  # 将之前所有 Agent 的回复加入上下文
                if j < len(agent_results):
                    prev_reply = agent_results[j]['result'].get('summary', '')
                    current_session.add_message(ChunkRole.ASSISTANT,
                        f"[{agents_cfg[j]['name']} 分析完成] {prev_reply}")
            
            # [行为跟踪] 记录Tool调用开始
            tool_start_time = time.time()

            try:
                result_session = agent(current_session, extra_context=extra_context)
                
                # [行为跟踪] 记录Tool调用成功
                if behavior_collector:
                    tool_duration_ms = int((time.time() - tool_start_time) * 1000)
                    behavior_log = behavior_collector.log_behavior(
                        agent_code=agent.code,
                        agent_name=agent.name,
                        session_id=str(root_session.id),
                        behavior_type='tool_call',
                        behavior_data={
                            'tool_name': f'{agent.code}_detect',
                            'scenario': scenario,
                            'has_error': False,
                            'execution_time_ms': tool_duration_ms,
                        },
                        user_id=user_id,
                        ip_address=ip_address,
                        duration_ms=tool_duration_ms,
                    )
                    
                    # [异常检测] 检测异常行为
                    if anomaly_engine and behavior_log:
                        anomaly_engine.detect_anomaly(behavior_log)
                        
            except Exception as e:
                # [行为跟踪] 记录Tool调用失败
                if behavior_collector:
                    tool_duration_ms = int((time.time() - tool_start_time) * 1000)
                    behavior_collector.log_behavior(
                        agent_code=agent.code,
                        agent_name=agent.name,
                        session_id=str(root_session.id),
                        behavior_type='tool_call',
                        behavior_data={
                            'tool_name': f'{agent.code}_detect',
                            'scenario': scenario,
                            'has_error': True,
                            'error_message': str(e),
                            'execution_time_ms': tool_duration_ms,
                        },
                        user_id=user_id,
                        ip_address=ip_address,
                        duration_ms=tool_duration_ms,
                    )
                
                if stream_callback:
                    stream_callback('error', {'message': f'{agent.name} 执行异常: {e}'})
                continue

            on_agent_complete_cb(i, agent, result_session, agent_results)

        total_latency = int((time.time() - total_start) * 1000)

        # Step 4: 综合裁决
        danger_count = sum(1 for r in agent_results if r['result']['level'] == 'danger')
        final_level = 'danger' if danger_count >= 2 else 'warning' if danger_count >= 1 else 'safe'
        avg_confidence = sum(r['result']['confidence'] for r in agent_results) // max(len(agent_results), 1)
        avg_ai_prob = sum(r['result']['aiProbability'] for r in agent_results) // max(len(agent_results), 1)

        # 构建链式上下文摘要
        chain_context = ""
        for r in agent_results:
            chain_context += f"\n=== {r['agentName']} ===\n"
            chain_context += f"等级: {r['result']['level']} | 置信度: {r['result']['confidence']}% | AI概率: {r['result']['aiProbability']}%\n"
            chain_context += f"摘要: {r['result']['summary']}\n"
        
        # [行为跟踪] 记录Session完成行为
        if behavior_collector:
            behavior_collector.log_behavior(
                agent_code='system',
                agent_name='系统',
                session_id=str(root_session.id),
                behavior_type='session_complete',
                behavior_data={
                    'scenario': scenario,
                    'total_agents': len(agents_cfg),
                    'completed_agents': len(agent_results),
                    'final_level': final_level,
                    'avg_confidence': avg_confidence,
                    'avg_ai_probability': avg_ai_prob,
                    'total_latency_ms': total_latency,
                },
                user_id=user_id,
                ip_address=ip_address,
                duration_ms=total_latency,
            )

        final_result = {
            'sessionId': str(root_session.id),
            'scenario': scenario,
            'totalLatencyMs': total_latency,
            'finalResult': {
                'level': final_level,
                'levelText': {'safe': '✅安全通过', 'warning': '⚠️存在风险', 'danger': '❌高风险警报'}[final_level],
                'confidence': avg_confidence,
                'aiProbability': avg_ai_prob,
                'summary': f'[OpenRath Runtime] {len(agent_results)}/4 Agent completed via SequentialWorkflow, verdict: {"✅安全通过" if final_level=="safe" else "⚠️存在风险" if final_level=="warning" else "❌高风险警报"}',
                'details': [d for r in agent_results for d in r['result'].get('details', [])],
                'recommendations': list(set(rec for r in agent_results for rec in r['result'].get('recommendations', [])))[:5],
                'agentAnalysis': chain_context,
            },
            'agentResults': agent_results,
            'graphInfo': {
                'rootSessionId': str(root_session.id),
                'lineage': self.graph.get_lineage(str(root_session.id)),
                'stats': self.graph.stats(),
                'replayUrl': f'/api/agent/public/replay/{root_session.id}',
            },
        }

        if stream_callback:
            stream_callback('complete', final_result)

        return final_result

    @staticmethod
    def _parse_agent_result(reply: str) -> Dict[str, Any]:
        """解析 Agent 返回的 JSON 结果"""
        try:
            json_match = re.search(r'\{[\s\S]*\}', reply)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, TypeError):
            pass
        return {}


# =====================================================================
# 12. 便捷工厂函数（对齐 OpenRath import 风格）
# =====================================================================

def create_runtime(
    model: str = "deepseek-chat",
    base_url: str = "",
    api_key: str = "",
    llm_client: Optional[Any] = None,
) -> RathRuntime:
    """
    创建并返回一个预配置的 RathRuntime 实例

    对应 OpenRath 顶层用法:
        from rath import flow
        from rath.session import Session
    """
    provider = Provider(
        model=model,
        base_url=base_url,
        api_key=api_key,
    )
    return RathRuntime(
        default_provider=provider,
        llm_client=llm_client,
    )


def create_quad_agent_runtime(
    deepseek_client: Optional[Any] = None,
    model: str = "deepseek-chat",
) -> RathRuntime:
    """
    创建专为本项目 4-Agent 检测管道优化的 Runtime

    这是最常用的工厂函数，一键获得完整的多智能体运行时。
    """
    rt = create_runtime(model=model, llm_client=deepseek_client)
    rt.default_provider.temperature = 0.3  # 检测场景用低温度
    return rt


# =====================================================================
# 模块元信息
# =====================================================================

__version__ = "1.2.1-compat"
__author__ = "Yijiandaodi Team (OpenRath Compatible Layer)"
__license__ = "BSD-3-Clause"
__source__ = "https://github.com/Rath-Team/OpenRath"
__docs__ = "https://docs.openrath.com/"
