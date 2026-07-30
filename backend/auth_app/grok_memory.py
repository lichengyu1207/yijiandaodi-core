"""
Grok Memory - AI Agent 记忆系统
从 Grok Python SDK 移植的记忆存储和检索
"""
import os
import json
import sqlite3
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class MemoryEntry:
    """记忆条目"""
    id: str
    content: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    relevance_score: float = 0.0


class MemoryStorage:
    """记忆存储 - SQLite + Markdown"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            # 默认存储路径
            base_dir = os.path.join(os.path.expanduser("~"), ".yijiandaodi", "memory")

        self.base_dir = base_dir
        self.db_path = os.path.join(base_dir, "memory.db")

        # 确保目录存在
        os.makedirs(base_dir, exist_ok=True)

        # 初始化数据库
        self._init_db()

    def _init_db(self):
        """初始化 SQLite 数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 创建记忆表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # 创建全文索引
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                id,
                content,
                content='memories',
                content_rowid='rowid'
            )
        """)

        conn.commit()
        conn.close()

    def _generate_id(self, content: str) -> str:
        """生成唯一 ID"""
        timestamp = datetime.now().isoformat()
        unique_str = f"{timestamp}:{content}"
        return hashlib.md5(unique_str.encode()).hexdigest()[:12]

    def save(self, content: str, metadata: Dict[str, Any] = None) -> MemoryEntry:
        """保存记忆"""
        if metadata is None:
            metadata = {}

        entry_id = self._generate_id(content)
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 插入记忆
        cursor.execute("""
            INSERT INTO memories (id, content, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (entry_id, content, metadata_json, now, now))

        # 更新全文索引
        cursor.execute("""
            INSERT INTO memories_fts (id, content)
            VALUES (?, ?)
        """, (entry_id, content))

        conn.commit()
        conn.close()

        return MemoryEntry(
            id=entry_id,
            content=content,
            metadata=metadata,
            created_at=datetime.fromisoformat(now),
            updated_at=datetime.fromisoformat(now)
        )

    def get(self, entry_id: str) -> Optional[MemoryEntry]:
        """获取单条记忆"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, content, metadata, created_at, updated_at
            FROM memories WHERE id = ?
        """, (entry_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return MemoryEntry(
                id=row[0],
                content=row[1],
                metadata=json.loads(row[2]),
                created_at=datetime.fromisoformat(row[3]),
                updated_at=datetime.fromisoformat(row[4])
            )
        return None

    def search(self, query: str, limit: int = 10) -> List[MemoryEntry]:
        """搜索记忆（全文搜索）"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # FTS5 全文搜索
        cursor.execute("""
            SELECT m.id, m.content, m.metadata, m.created_at, m.updated_at
            FROM memories m
            JOIN memories_fts fts ON m.id = fts.id
            WHERE memories_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit))

        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            results.append(MemoryEntry(
                id=row[0],
                content=row[1],
                metadata=json.loads(row[2]),
                created_at=datetime.fromisoformat(row[3]),
                updated_at=datetime.fromisoformat(row[4])
            ))
        return results

    def list_all(self, limit: int = 100) -> List[MemoryEntry]:
        """列出所有记忆"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, content, metadata, created_at, updated_at
            FROM memories
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))

        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            results.append(MemoryEntry(
                id=row[0],
                content=row[1],
                metadata=json.loads(row[2]),
                created_at=datetime.fromisoformat(row[3]),
                updated_at=datetime.fromisoformat(row[4])
            ))
        return results

    def delete(self, entry_id: str) -> bool:
        """删除记忆"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 删除记忆
        cursor.execute("DELETE FROM memories WHERE id = ?", (entry_id,))
        deleted = cursor.rowcount > 0

        # 删除索引
        if deleted:
            cursor.execute("DELETE FROM memories_fts WHERE id = ?", (entry_id,))

        conn.commit()
        conn.close()

        return deleted

    def export_to_markdown(self, output_path: str = None) -> str:
        """导出为 Markdown"""
        if output_path is None:
            output_path = os.path.join(self.base_dir, "memory_export.md")

        memories = self.list_all()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Memory Export\n\n")
            f.write(f"Exported at: {datetime.now().isoformat()}\n\n")
            f.write("---\n\n")

            for entry in memories:
                f.write(f"## {entry.id}\n\n")
                f.write(f"**Created:** {entry.created_at.isoformat()}\n\n")
                f.write(f"**Content:**\n\n{entry.content}\n\n")
                if entry.metadata:
                    f.write(f"**Metadata:**\n\n```json\n{json.dumps(entry.metadata, indent=2)}\n```\n\n")
                f.write("---\n\n")

        return output_path


class MemoryIndex:
    """记忆索引 - 用于快速检索"""

    def __init__(self, storage: MemoryStorage):
        self.storage = storage
        self._index: Dict[str, List[str]] = {}

    def rebuild(self):
        """重建索引"""
        memories = self.storage.list_all()
        self._index.clear()

        for entry in memories:
            # 简单的关键词索引
            words = entry.content.lower().split()
            for word in set(words):
                if len(word) > 2:  # 忽略太短的词
                    if word not in self._index:
                        self._index[word] = []
                    self._index[word].append(entry.id)

    def quick_search(self, keyword: str) -> List[str]:
        """快速搜索（基于索引）"""
        keyword = keyword.lower()
        return self._index.get(keyword, [])


class WorkspaceMemory:
    """工作区记忆 - 针对特定项目"""

    def __init__(self, workspace_id: str, base_dir: str = None):
        if base_dir is None:
            base_dir = os.path.join(os.path.expanduser("~"), ".yijiandaodi", "workspaces")

        self.workspace_dir = os.path.join(base_dir, workspace_id)
        self.storage = MemoryStorage(self.workspace_dir)

    def save_context(self, context: Dict[str, Any]) -> MemoryEntry:
        """保存上下文"""
        content = json.dumps(context, indent=2)
        return self.storage.save(content, {"type": "context"})

    def get_context(self) -> Optional[Dict[str, Any]]:
        """获取最新上下文"""
        memories = self.storage.list_all(limit=1)
        if memories:
            return json.loads(memories[0].content)
        return None

    def save_session_summary(self, summary: str) -> MemoryEntry:
        """保存会话摘要"""
        return self.storage.save(summary, {"type": "session_summary"})

    def save_tool_result(self, tool_name: str, result: str) -> MemoryEntry:
        """保存工具执行结果"""
        return self.storage.save(result, {"type": "tool_result", "tool": tool_name})


# 全局记忆存储实例
_global_memory: Optional[MemoryStorage] = None


def get_global_memory() -> MemoryStorage:
    """获取全局记忆存储"""
    global _global_memory
    if _global_memory is None:
        _global_memory = MemoryStorage()
    return _global_memory