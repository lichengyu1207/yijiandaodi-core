"""
Grok Tools - AI Agent 工具集
从 Grok Python SDK 移植的核心工具
"""
import os
import re
import json
import subprocess
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
from abc import ABC, abstractmethod


@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    output: str
    error: Optional[str] = None


class BaseTool(ABC):
    """工具基类"""

    name: str = "base_tool"
    description: str = "Base tool"
    parameters: Dict[str, Any] = {}

    @abstractmethod
    def execute(self, **kwargs) -> ToolResult:
        """执行工具"""
        pass

    def to_definition(self) -> Dict[str, Any]:
        """生成工具定义（供 AI 调用）"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }


class ReadFileTool(BaseTool):
    """读取文件工具"""

    name = "read_file"
    description = "读取指定路径的文件内容"
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文件的绝对路径"
            }
        },
        "required": ["path"]
    }

    def execute(self, path: str) -> ToolResult:
        try:
            if not os.path.exists(path):
                return ToolResult(False, "", f"File not found: {path}")

            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 限制大小
            max_size = 100000
            if len(content) > max_size:
                content = content[:max_size] + "\n... (truncated)"

            return ToolResult(True, content)
        except Exception as e:
            return ToolResult(False, "", str(e))


class ListDirTool(BaseTool):
    """列出目录工具"""

    name = "list_dir"
    description = "列出指定目录下的文件和子目录"
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "目录的绝对路径"
            }
        },
        "required": ["path"]
    }

    def execute(self, path: str) -> ToolResult:
        try:
            if not os.path.exists(path):
                return ToolResult(False, "", f"Directory not found: {path}")

            if not os.path.isdir(path):
                return ToolResult(False, "", f"Not a directory: {path}")

            items = os.listdir(path)
            result = []

            for item in items:
                full_path = os.path.join(path, item)
                is_dir = os.path.isdir(full_path)
                size = os.path.getsize(full_path) if not is_dir else 0
                result.append({
                    "name": item,
                    "type": "directory" if is_dir else "file",
                    "size": size
                })

            return ToolResult(True, json.dumps(result, indent=2))
        except Exception as e:
            return ToolResult(False, "", str(e))


class GrepTool(BaseTool):
    """搜索文件内容工具"""

    name = "grep"
    description = "在文件中搜索匹配正则表达式的行"
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "正则表达式模式"
            },
            "path": {
                "type": "string",
                "description": "搜索路径（文件或目录）"
            },
            "file_pattern": {
                "type": "string",
                "description": "文件名模式（可选，如 *.py）"
            }
        },
        "required": ["pattern", "path"]
    }

    def execute(self, pattern: str, path: str, file_pattern: str = "*") -> ToolResult:
        try:
            if not os.path.exists(path):
                return ToolResult(False, "", f"Path not found: {path}")

            results = []
            regex = re.compile(pattern)

            def search_file(file_path: str):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append({
                                    "file": file_path,
                                    "line": i,
                                    "content": line.strip()[:200]
                                })
                                if len(results) >= 100:  # 限制结果数量
                                    return
                except Exception:
                    pass

            if os.path.isfile(path):
                search_file(path)
            else:
                import fnmatch
                for root, dirs, files in os.walk(path):
                    for file in files:
                        if fnmatch.fnmatch(file, file_pattern):
                            search_file(os.path.join(root, file))

            return ToolResult(True, json.dumps(results, indent=2))
        except Exception as e:
            return ToolResult(False, "", str(e))


class BashTool(BaseTool):
    """执行 Bash 命令工具"""

    name = "run_terminal_command"
    description = "在终端执行命令（受限模式）"
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "要执行的命令"
            },
            "timeout": {
                "type": "integer",
                "description": "超时时间（秒）",
                "default": 30
            }
        },
        "required": ["command"]
    }

    # 允许的命令白名单
    ALLOWED_COMMANDS = [
        'ls', 'dir', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
        'python', 'python3', 'pip', 'npm', 'node', 'git', 'gh',
        'echo', 'pwd', 'whoami', 'date', 'uname'
    ]

    def execute(self, command: str, timeout: int = 30) -> ToolResult:
        try:
            # 安全检查
            cmd_parts = command.split()
            if not cmd_parts:
                return ToolResult(False, "", "Empty command")

            base_cmd = cmd_parts[0]
            if base_cmd not in self.ALLOWED_COMMANDS:
                return ToolResult(False, "", f"Command not allowed: {base_cmd}")

            # 执行命令
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            output = result.stdout or result.stderr
            return ToolResult(result.returncode == 0, output)
        except subprocess.TimeoutExpired:
            return ToolResult(False, "", f"Command timeout after {timeout}s")
        except Exception as e:
            return ToolResult(False, "", str(e))


class WebSearchTool(BaseTool):
    """Web 搜索工具"""

    name = "web_search"
    description = "在网络上搜索信息"
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词"
            }
        },
        "required": ["query"]
    }

    def execute(self, query: str) -> ToolResult:
        # 这里可以接入真实搜索 API
        return ToolResult(
            True,
            f"Web search for '{query}' - Please implement with actual search API"
        )


class WebFetchTool(BaseTool):
    """Web 获取工具"""

    name = "web_fetch"
    description = "获取指定 URL 的内容"
    parameters = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "要获取的 URL"
            }
        },
        "required": ["url"]
    }

    def execute(self, url: str) -> ToolResult:
        try:
            import requests
            response = requests.get(url, timeout=10)
            return ToolResult(response.status_code == 200, response.text[:10000])
        except Exception as e:
            return ToolResult(False, "", str(e))


class TodoWriteTool(BaseTool):
    """Todo 列表工具"""

    name = "todo_write"
    description = "管理任务列表"
    parameters = {
        "type": "object",
        "properties": {
            "todos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "content": {"type": "string"},
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]}
                    }
                }
            }
        },
        "required": ["todos"]
    }

    def __init__(self):
        self.todos = []

    def execute(self, todos: List[Dict]) -> ToolResult:
        self.todos = todos
        return ToolResult(True, json.dumps(todos, indent=2))


# ===== 工具注册中心 =====

class ToolRegistry:
    """工具注册中心"""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        """注册工具"""
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        """获取工具"""
        return self._tools.get(name)

    def list_tools(self) -> List[str]:
        """列出所有工具"""
        return list(self._tools.keys())

    def get_definitions(self) -> List[Dict[str, Any]]:
        """获取所有工具定义"""
        return [tool.to_definition() for tool in self._tools.values()]

    def execute(self, name: str, **kwargs) -> ToolResult:
        """执行工具"""
        tool = self.get(name)
        if not tool:
            return ToolResult(False, "", f"Tool not found: {name}")
        return tool.execute(**kwargs)


# 创建全局工具注册中心
tool_registry = ToolRegistry()

# 注册内置工具
tool_registry.register(ReadFileTool())
tool_registry.register(ListDirTool())
tool_registry.register(GrepTool())
tool_registry.register(BashTool())
tool_registry.register(WebSearchTool())
tool_registry.register(WebFetchTool())
tool_registry.register(TodoWriteTool())


def get_tool_registry() -> ToolRegistry:
    """获取工具注册中心"""
    return tool_registry