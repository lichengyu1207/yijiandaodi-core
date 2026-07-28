from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import re
from typing import Optional


class TaskType(Enum):
    TEXT = "text"
    IMAGE = "IMAGE"
    CODE = "code"
    FILE = "file"
    MIXED = "mixed"


@dataclass
class Shard:
    shard_id: str
    task_id: str
    sequence: int
    total_shards: int
    payload: bytes
    payload_hash: str
    dependencies: list[str]
    required_capabilities: list[str]
    estimated_resources: dict
    security_level: str
    data_sensitivity: str


@dataclass
class Task:
    task_id: str
    task_type: TaskType
    payload: bytes
    metadata: dict = field(default_factory=dict)


class ShardingStrategy(ABC):
    @abstractmethod
    def shard(self, task: Task) -> list[Shard]:
        """将任务拆分为多个分片"""


class TextShardingStrategy(ShardingStrategy):
    MAX_SHARD_SIZE = 1024 * 1024
    CONTEXT_WINDOW = 200

    def shard(self, task: Task) -> list[Shard]:
        if not task.payload:
            raise ValueError("Payload cannot be empty")

        try:
            text = task.payload.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(f"Failed to decode payload as UTF-8: {e}")

        paragraphs = text.split("\n\n")
        chunks: list[str] = []

        for paragraph in paragraphs:
            if len(paragraph.encode("utf-8")) <= self.MAX_SHARD_SIZE:
                chunks.append(paragraph)
            else:
                sentences = re.split(r"[。！？.!?\n]", paragraph)
                current_chunk = ""
                for sentence in sentences:
                    if not sentence.strip():
                        continue
                    test_chunk = (current_chunk + sentence).strip() if current_chunk else sentence.strip()
                    if len(test_chunk.encode("utf-8")) > self.MAX_SHARD_SIZE and current_chunk:
                        chunks.append(current_chunk.strip())
                        current_chunk = sentence
                    else:
                        current_chunk = test_chunk
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())

        if not chunks:
            chunks = [text]

        shards: list[Shard] = []
        total_shards = len(chunks)

        for i, chunk in enumerate(chunks):
            start_context = max(0, i - 1)
            end_context = min(len(chunks) - 1, i + 1)

            context_parts = []
            for j in range(start_context, end_context + 1):
                if j != i:
                    context_text = chunks[j]
                    if j < i:
                        context_parts.append(context_text[-self.CONTEXT_WINDOW:])
                    else:
                        context_parts.append(context_text[:self.CONTEXT_WINDOW])

            context_str = "".join(context_parts)
            payload_with_context = f"{context_str}\n{chunk}".encode("utf-8")
            payload_hash = hashlib.sha256(payload_with_context).hexdigest()

            dependencies = []
            if i > 0:
                prev_shard_id = f"{task.task_id}_shard_{i - 1}"
                dependencies.append(prev_shard_id)

            shard = Shard(
                shard_id=f"{task.task_id}_shard_{i}",
                task_id=task.task_id,
                sequence=i,
                total_shards=total_shards,
                payload=payload_with_context,
                payload_hash=payload_hash,
                dependencies=dependencies,
                required_capabilities=["text_processing"],
                estimated_resources={"cpu_cores": 1, "memory_mb": 256, "gpu_required": False},
                security_level="normal",
                data_sensitivity="public",
            )
            shards.append(shard)

        return shards


class ImageShardingStrategy(ShardingStrategy):
    TILE_SIZE = 1024

    def shard(self, task: Task) -> list[Shard]:
        if not task.payload:
            raise ValueError("Payload cannot be empty")

        shards: list[Shard] = []
        image_size = len(task.payload)

        tiles_x = max(1, (image_size + self.TILE_SIZE - 1) // self.TILE_SIZE)
        total_shards = tiles_x

        for i in range(total_shards):
            start = i * self.TILE_SIZE
            end = min(start + self.TILE_SIZE, image_size)
            tile_data = task.payload[start:end]

            metadata = {
                "tile_index": i,
                "start_offset": start,
                "end_offset": end,
                "total_tiles": total_shards,
                "original_size": image_size,
            }
            payload_with_metadata = f"{metadata}\n".encode("utf-8") + tile_data
            payload_hash = hashlib.sha256(payload_with_metadata).hexdigest()

            shard = Shard(
                shard_id=f"{task.task_id}_tile_{i}",
                task_id=task.task_id,
                sequence=i,
                total_shards=total_shards,
                payload=payload_with_metadata,
                payload_hash=payload_hash,
                dependencies=[],
                required_capabilities=["image_processing"],
                estimated_resources={"cpu_cores": 2, "memory_mb": 512, "gpu_required": True},
                security_level="normal",
                data_sensitivity="public",
            )
            shards.append(shard)

        return shards


class CodeShardingStrategy(ShardingStrategy):
    MAX_SHARD_SIZE = 1024 * 1024

    def shard(self, task: Task) -> list[Shard]:
        if not task.payload:
            raise ValueError("Payload cannot be empty")

        try:
            code = task.payload.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(f"Failed to decode payload as UTF-8: {e}")

        pattern = r"^(def |class |function |const |let |var |public |private |protected |async def )"
        lines = code.split("\n")
        chunks: list[str] = []
        current_chunk_lines: list[str] = []

        for line in lines:
            current_chunk_lines.append(line)
            current_chunk = "\n".join(current_chunk_lines)
            if re.match(pattern, line) and len(current_chunk.encode("utf-8")) > self.MAX_SHARD_SIZE // 2:
                if current_chunk_lines[:-1]:
                    chunks.append("\n".join(current_chunk_lines[:-1]))
                current_chunk_lines = [line]
            elif len(current_chunk.encode("utf-8")) > self.MAX_SHARD_SIZE:
                chunks.append(current_chunk)
                current_chunk_lines = []

        if current_chunk_lines:
            chunks.append("\n".join(current_chunk_lines))

        if not chunks:
            chunks = [code]

        shards: list[Shard] = []
        total_shards = len(chunks)

        for i, chunk in enumerate(chunks):
            payload_bytes = chunk.encode("utf-8")
            payload_hash = hashlib.sha256(payload_bytes).hexdigest()

            dependencies = []
            if i > 0:
                prev_shard_id = f"{task.task_id}_code_shard_{i - 1}"
                dependencies.append(prev_shard_id)

            shard = Shard(
                shard_id=f"{task.task_id}_code_shard_{i}",
                task_id=task.task_id,
                sequence=i,
                total_shards=total_shards,
                payload=payload_bytes,
                payload_hash=payload_hash,
                dependencies=dependencies,
                required_capabilities=["code_analysis", "syntax_parsing"],
                estimated_resources={"cpu_cores": 2, "memory_mb": 512, "gpu_required": False},
                security_level="high",
                data_sensitivity="internal",
            )
            shards.append(shard)

        return shards


class FileShardingStrategy(ShardingStrategy):
    CHUNK_SIZE = 512 * 1024

    def shard(self, task: Task) -> list[Shard]:
        if not task.payload:
            raise ValueError("Payload cannot be empty")

        file_size = len(task.payload)
        total_chunks = max(1, (file_size + self.CHUNK_SIZE - 1) // self.CHUNK_SIZE)

        shards: list[Shard] = []

        for i in range(total_chunks):
            start = i * self.CHUNK_SIZE
            end = min(start + self.CHUNK_SIZE, file_size)
            chunk_data = task.payload[start:end]

            metadata = {
                "chunk_index": i,
                "start_offset": start,
                "end_offset": end,
                "total_chunks": total_chunks,
                "original_file_size": file_size,
                "filename": task.metadata.get("filename", "unknown"),
            }
            payload_with_metadata = f"{metadata}\n".encode("utf-8") + chunk_data
            payload_hash = hashlib.sha256(payload_with_metadata).hexdigest()

            shard = Shard(
                shard_id=f"{task.task_id}_chunk_{i}",
                task_id=task.task_id,
                sequence=i,
                total_shards=total_chunks,
                payload=payload_with_metadata,
                payload_hash=payload_hash,
                dependencies=[],
                required_capabilities=["file_transfer"],
                estimated_resources={"cpu_cores": 1, "memory_mb": 128, "gpu_required": False},
                security_level="normal",
                data_sensitivity="public",
            )
            shards.append(shard)

        return shards


class ShardingEngine:
    STRATEGY_MAP = {
        TaskType.TEXT: TextShardingStrategy,
        TaskType.IMAGE: ImageShardingStrategy,
        TaskType.CODE: CodeShardingStrategy,
        TaskType.FILE: FileShardingStrategy,
    }

    def shard_task(self, task: Task) -> list[Shard]:
        strategy_class = self.STRATEGY_MAP.get(task.task_type)
        if not strategy_class:
            raise ValueError(f"Unsupported task type: {task.task_type}")
        return strategy_class().shard(task)

    @staticmethod
    def compute_payload_hash(payload: bytes) -> str:
        return hashlib.sha256(payload).hexdigest()
