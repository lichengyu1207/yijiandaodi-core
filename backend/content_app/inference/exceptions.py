"""推理集群接入（P3 M4）：路由异常定义

能力透明：异常信息只含内部标识（local/cluster/fallback），不出现品牌名。
"""


class InferenceOverloadError(Exception):
    """本地推理过载：熔断 / 配额超限 / 并发饱和 / 调用被预算闸门拦截。

    抛出方：本地 provider（或路由层对预算闸门 PermissionError 的归一）。
    处理方：InferenceRouter —— 触发「本地 → 集群」回退。
    """

    def __init__(self, reason: str = ''):
        self.reason = reason
        super().__init__(f'[推理过载] local: {reason}')


class ClusterUnavailableError(Exception):
    """集群不可用：无在线节点 / 调度失败 / 执行超时。

    抛出方：ClusterProvider。
    处理方：InferenceRouter —— 触发「集群 → 公开 API」回退；fallback 关闭时上抛。
    """

    def __init__(self, reason: str = ''):
        self.reason = reason
        super().__init__(f'[集群不可用] cluster: {reason}')
