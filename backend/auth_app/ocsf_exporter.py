"""
统一安全接口 - OCSF 标准格式输出
Open Cybersecurity Schema Framework
让企业安全系统直接消费一鉴到底的数据
"""
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


# OCSF 标准分类
class OCSFCategory(Enum):
    """OCSF 事件分类"""
    SYSTEM_ACTIVITY = 1
    FINDINGS = 2
    SECURITY_FINDINGS = 3
    AUDIT_FINDINGS = 4


class OCSFClass(Enum):
    """OCSF 事件类别"""
    PROCESS_ACTIVITY = 100799      # 进程活动
    FILE_SYSTEM_ACTIVITY = 100899  # 文件系统活动
    NETWORK_ACTIVITY = 100599      # 网络活动
    SECURITY_FINDING = 200199      # 安全发现
    AUDIT_FINDING = 200299         # 审计发现


@dataclass
class OCSFActor:
    """操作主体"""
    name: str = ""
    uid: str = ""
    type: str = "User Account"
    email: str = ""


@dataclass
class OCSFResource:
    """操作对象"""
    name: str = ""
    type: str = ""
    uid: str = ""


@dataclass
class OCSFEvent:
    """OCSF 标准事件格式"""
    # 必填字段
    metadata: Dict[str, Any] = field(default_factory=dict)
    severity: int = 0  # 0=Unknown, 1=Low, 2=Medium, 3=High, 4=Critical, 5=Fatal
    status: str = "Success"
    status_code: str = ""
    status_detail: str = ""
    
    # 时间戳
    time: int = 0  # Unix 时间戳（毫秒）
    
    # 分类
    category_uid: int = 2  # Findings
    class_uid: int = 200199  # Security Finding
    type_uid: int = 20019901  # Security Finding: Create
    
    # 主体和对象
    actor: Dict[str, Any] = field(default_factory=dict)
    resources: List[Dict[str, Any]] = field(default_factory=list)
    
    # 消息
    message: str = ""
    remediation: Dict[str, Any] = field(default_factory=dict)
    
    # 原始数据
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为 OCSF 标准字典"""
        return {
            "metadata": self.metadata,
            "severity": self.severity,
            "severity_id": self.severity,
            "status": self.status,
            "status_id": self._status_to_id(self.status),
            "status_code": self.status_code,
            "status_detail": self.status_detail,
            "time": self.time,
            "time_dt": datetime.fromtimestamp(self.time / 1000).isoformat() if self.time else "",
            "category_uid": self.category_uid,
            "category_name": "Findings",
            "class_uid": self.class_uid,
            "class_name": self._class_name(),
            "type_uid": self.type_uid,
            "type_name": "Security Finding: Create",
            "actor": self.actor,
            "resources": self.resources,
            "message": self.message,
            "remediation": self.remediation,
            "raw_data": self.raw_data,
            "unmapped": {
                "source": "一鉴到底",
                "version": "2.0.0"
            }
        }

    def _status_to_id(self, status: str) -> int:
        """状态转 ID"""
        mapping = {
            "Success": 1,
            "Failure": 2,
            "Unknown": 0,
            "Warning": 3
        }
        return mapping.get(status, 0)

    def _class_name(self) -> str:
        """类别名称"""
        mapping = {
            200199: "Security Finding",
            200299: "Audit Finding",
            100799: "Process Activity",
            100899: "File System Activity",
            100599: "Network Activity"
        }
        return mapping.get(self.class_uid, "Unknown")


class OCSFExporter:
    """OCSF 标准格式导出器"""

    @staticmethod
    def convert_operation(operation: Dict[str, Any]) -> OCSFEvent:
        """
        将一鉴到底的操作记录转换为 OCSF 格式
        """
        # 风险等级转严重度
        severity_mapping = {
            "low": 1,
            "medium": 2,
            "high": 3,
            "critical": 4,
            "unknown": 0
        }
        
        risk_level = operation.get("risk_level", "unknown")
        severity = severity_mapping.get(risk_level, 0)
        
        # 状态转 OCSF 状态
        status_mapping = {
            "normal": "Success",
            "warning": "Warning",
            "blocked": "Failure"
        }
        status = status_mapping.get(operation.get("status", "unknown"), "Unknown")
        
        # 时间戳
        timestamp_str = operation.get("timestamp", "")
        try:
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            time_ms = int(dt.timestamp() * 1000)
        except:
            time_ms = int(datetime.now().timestamp() * 1000)
        
        # 构建 OCSF 事件
        event = OCSFEvent(
            metadata={
                "product": {
                    "name": "一鉴到底",
                    "version": "2.0.0",
                    "vendor": {"name": "一鉴到底"}
                },
                "version": "1.0.0",
                "correlation_id": operation.get("audit_id", ""),
            },
            severity=severity,
            status=status,
            status_code=operation.get("mode", "unknown"),
            status_detail=operation.get("analysis", ""),
            time=time_ms,
            class_uid=OCSFClass.SECURITY_FINDING.value,
            actor={
                "name": operation.get("user_id", "unknown"),
                "uid": str(operation.get("user_id", "")),
                "type": "User Account"
            },
            resources=[
                {
                    "name": operation.get("title", ""),
                    "type": operation.get("type", "unknown"),
                    "uid": operation.get("id", "")
                }
            ],
            message=operation.get("analysis", ""),
            remediation={
                "desc": operation.get("recommendation", "")
            },
            raw_data=operation
        )
        
        return event

    @staticmethod
    def export_to_json(operations: List[Dict]) -> List[Dict]:
        """批量导出为 OCSF JSON 格式"""
        return [
            OCSFExporter.convert_operation(op).to_dict()
            for op in operations
        ]

    @staticmethod
    def export_to_file(operations: List[Dict], filepath: str):
        """导出为 OCSF JSON 文件"""
        ocsf_events = OCSFExporter.export_to_json(operations)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(ocsf_events, f, ensure_ascii=False, indent=2)
        
        return filepath


class OpenTelemetryExporter:
    """OpenTelemetry 格式导出器（兼容）"""

    @staticmethod
    def convert_operation(operation: Dict[str, Any]) -> Dict[str, Any]:
        """转换为 OpenTelemetry Span 格式"""
        return {
            "traceId": operation.get("audit_id", ""),
            "spanId": operation.get("id", ""),
            "parentSpanId": "",
            "operationName": operation.get("title", ""),
            "startTime": operation.get("timestamp", ""),
            "endTime": "",
            "kind": 1,  # INTERNAL
            "status": {
                "code": 2 if operation.get("status") == "blocked" else 1
            },
            "attributes": {
                "risk.level": operation.get("risk_level", ""),
                "risk.analysis": operation.get("analysis", ""),
                "user.id": str(operation.get("user_id", "")),
                "operation.type": operation.get("type", ""),
                "audit.hash": operation.get("audit_hash", "")
            }
        }


class SecuritySystemIntegration:
    """安全系统集成"""

    @staticmethod
    def generate_splunk_query(ocsf_events: List[Dict]) -> str:
        """生成 Splunk 查询语句"""
        return """
# 一鉴到底 - 安全事件查询
index=security source="一鉴到底"
| stats count by severity_id, class_name
| sort -count

# 高风险事件
index=security source="一鉴到底" severity_id>=3
| table time, actor.name, message, remediation.desc
"""

    @staticmethod
    def generate_elastic_query(ocsf_events: List[Dict]) -> Dict:
        """生成 Elasticsearch 查询"""
        return {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"metadata.product.name": "一鉴到底"}},
                        {"range": {"severity_id": {"gte": 3}}}
                    ]
                }
            },
            "aggs": {
                "severity_distribution": {
                    "terms": {"field": "severity_id"}
                }
            }
        }


# ===== 使用示例 =====

def demo_ocsf_export():
    """演示 OCSF 导出"""

    # 模拟操作记录
    operations = [
        {
            "id": "op-001",
            "type": "code",
            "title": "Git Push - 推送到 GitHub",
            "content": "修改文件: config.py, utils/helper.py",
            "timestamp": "2026-07-20T10:30:00Z",
            "status": "blocked",
            "risk_level": "high",
            "analysis": "检测到敏感配置变更",
            "recommendation": "建议二次确认",
            "user_id": "user-123",
            "audit_id": "audit-001",
            "audit_hash": "abc123",
            "mode": "local",
            "confidence": 0.95
        }
    ]

    # 导出为 OCSF 格式
    ocsf_events = OCSFExporter.export_to_json(operations)

    print("[OCSF 标准格式]")
    print(json.dumps(ocsf_events[0], indent=2, ensure_ascii=False))

    # 生成 Splunk 查询
    print("\n[Splunk 查询]")
    print(SecuritySystemIntegration.generate_splunk_query(ocsf_events))

    # 生成 Elastic 查询
    print("\n[Elasticsearch 查询]")
    print(json.dumps(
        SecuritySystemIntegration.generate_elastic_query(ocsf_events),
        indent=2
    ))

    return ocsf_events


if __name__ == "__main__":
    demo_ocsf_export()