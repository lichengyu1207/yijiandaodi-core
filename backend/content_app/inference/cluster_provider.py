"""集群推理 Provider（P3 M4：ComputeProvider 集群客户端）

实现 InferenceProvider 接口，使集群推理与本地推理在路由层透明互换：
  - 提交 → 轮询 → 聚合，全程能力透明（provider='cluster'，无品牌名）
  - 无在线节点 / 调度失败 / 超时 → ClusterUnavailableError（交由路由回退公开 API）
"""

import logging
import time
from typing import Any, Dict, List, Optional

from .base import Completion, InferenceProvider
from .cluster_gateway import ClusterGateway, P2PClusterGateway
from .exceptions import ClusterUnavailableError

logger = logging.getLogger(__name__)

_POLL_INTERVAL_SEC = 0.5


class ClusterProvider(InferenceProvider):
    """集群推理客户端：把 P2P 管道包装为统一推理接口。"""

    name = 'cluster'

    def __init__(
        self,
        gateway: Optional[ClusterGateway] = None,
        timeout_sec: Optional[float] = None,
    ) -> None:
        self._gateway = gateway or P2PClusterGateway()
        self.timeout_sec = timeout_sec or 30.0

    @property
    def gateway(self) -> ClusterGateway:
        return self._gateway

    def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kw: Any,
    ) -> Completion:
        caller = kw.pop('caller', None)
        start = time.time()

        task_id = self._gateway.submit(messages, model, caller)
        if task_id is None:
            raise ClusterUnavailableError('no_online_nodes')

        while time.time() - start < self.timeout_sec:
            text = self._gateway.fetch_result(task_id)
            if text:
                return Completion(
                    content=text,
                    provider=self.name,
                    model=model or '',
                    messages=messages,
                    usage={},
                    latency_ms=int((time.time() - start) * 1000),
                )
            time.sleep(_POLL_INTERVAL_SEC)

        self._gateway.abort(task_id)
        logger.warning('[集群推理] 任务超时中止: %s', task_id)
        raise ClusterUnavailableError('cluster_timeout')
