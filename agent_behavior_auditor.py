#!/usr/bin/env python
"""
一鉴到底 - Agent行为审计引擎

应对Agent应用普及，提供全面的Agent行为审计能力

新增功能：
1. Agent行为轨迹追踪
2. Agent决策过程审计
3. Agent资源使用监控
4. Agent异常行为检测
5. Agent合规性验证
"""

import json
import time
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class AgentBehaviorType(Enum):
    """Agent行为类型"""
    CODE_GENERATION = "code_generation"          # 代码生成
    FILE_OPERATION = "file_operation"           # 文件操作
    API_CALL = "api_call"                       # API调用
    DATA_PROCESSING = "data_processing"         # 数据处理
    DECISION_MAKING = "decision_making"         # 决策制定
    RESOURCE_ALLOCATION = "resource_allocation" # 资源分配
    COMMUNICATION = "communication"             # 通信交互
    LEARNING = "learning"                       # 学习训练


class AgentRiskLevel(Enum):
    """Agent风险等级"""
    SAFE = "safe"           # 安全
    LOW = "low"             # 低风险
    MEDIUM = "medium"       # 中风险
    HIGH = "high"           # 高风险
    CRITICAL = "critical"   # 严重风险


@dataclass
class AgentBehavior:
    """Agent行为记录"""
    behavior_id: str
    agent_id: str
    agent_name: str
    behavior_type: AgentBehaviorType
    timestamp: float
    input_data: Dict
    output_data: Dict
    decision_process: Dict
    risk_level: AgentRiskLevel
    risk_score: int
    risks: List[str]
    context: Dict
    parent_behavior_id: Optional[str] = None


@dataclass
class AgentDecisionStep:
    """Agent决策步骤"""
    step_id: str
    step_name: str
    reasoning: str
    confidence: float
    alternatives: List[Dict]
    selected_action: str
    timestamp: float


class AgentBehaviorAuditor:
    """Agent行为审计器"""

    def __init__(self):
        """初始化"""
        self.behavior_history: List[AgentBehavior] = []
        self.decision_chains: Dict[str, List[AgentDecisionStep]] = {}
        self.resource_usage: Dict[str, Dict] = {}

    def record_behavior(
        self,
        agent_id: str,
        agent_name: str,
        behavior_type: AgentBehaviorType,
        input_data: Dict,
        output_data: Dict,
        decision_process: Optional[Dict] = None,
        parent_behavior_id: Optional[str] = None
    ) -> AgentBehavior:
        """
        记录Agent行为

        Args:
            agent_id: Agent ID
            agent_name: Agent名称
            behavior_type: 行为类型
            input_data: 输入数据
            output_data: 输出数据
            decision_process: 决策过程
            parent_behavior_id: 父行为ID

        Returns:
            行为记录
        """
        # 生成行为ID
        behavior_id = self._generate_behavior_id(agent_id, behavior_type)
        timestamp = time.time()

        # 风险评估
        risks, risk_score, risk_level = self._assess_behavior_risk(
            behavior_type, input_data, output_data
        )

        # 创建行为记录
        behavior = AgentBehavior(
            behavior_id=behavior_id,
            agent_id=agent_id,
            agent_name=agent_name,
            behavior_type=behavior_type,
            timestamp=timestamp,
            input_data=input_data,
            output_data=output_data,
            decision_process=decision_process or {},
            risk_level=risk_level,
            risk_score=risk_score,
            risks=risks,
            context={
                'timestamp_iso': datetime.fromtimestamp(timestamp).isoformat(),
                'behavior_sequence': len([b for b in self.behavior_history if b.agent_id == agent_id]),
            },
            parent_behavior_id=parent_behavior_id
        )

        # 记录到历史
        self.behavior_history.append(behavior)

        # 记录资源使用
        self._record_resource_usage(agent_id, behavior_type, input_data, output_data)

        return behavior

    def record_decision_chain(
        self,
        behavior_id: str,
        decision_steps: List[Dict]
    ) -> None:
        """
        记录决策链

        Args:
            behavior_id: 行为ID
            decision_steps: 决策步骤列表
        """
        steps = []
        for i, step in enumerate(decision_steps):
            decision_step = AgentDecisionStep(
                step_id=f"{behavior_id}_step_{i}",
                step_name=step.get('name', ''),
                reasoning=step.get('reasoning', ''),
                confidence=step.get('confidence', 0.0),
                alternatives=step.get('alternatives', []),
                selected_action=step.get('selected_action', ''),
                timestamp=time.time()
            )
            steps.append(decision_step)

        self.decision_chains[behavior_id] = steps

    def get_agent_trajectory(self, agent_id: str, limit: int = 100) -> List[Dict]:
        """
        获取Agent行为轨迹

        Args:
            agent_id: Agent ID
            limit: 限制数量

        Returns:
            行为轨迹列表
        """
        agent_behaviors = [
            asdict(b) for b in self.behavior_history
            if b.agent_id == agent_id
        ][-limit:]

        return agent_behaviors

    def get_agent_decision_audit(self, behavior_id: str) -> Dict:
        """
        获取Agent决策审计

        Args:
            behavior_id: 行为ID

        Returns:
            决策审计报告
        """
        # 查找行为
        behavior = None
        for b in self.behavior_history:
            if b.behavior_id == behavior_id:
                behavior = b
                break

        if not behavior:
            return {'error': '行为不存在'}

        # 获取决策链
        decision_chain = self.decision_chains.get(behavior_id, [])

        return {
            'behavior': asdict(behavior),
            'decision_chain': [asdict(step) for step in decision_chain],
            'audit_summary': {
                'total_steps': len(decision_chain),
                'avg_confidence': sum(s.confidence for s in decision_chain) / len(decision_chain) if decision_chain else 0,
                'decision_quality': self._assess_decision_quality(decision_chain),
            }
        }

    def detect_anomaly(self, agent_id: str) -> Dict:
        """
        检测Agent异常行为

        Args:
            agent_id: Agent ID

        Returns:
            异常检测结果
        """
        agent_behaviors = [b for b in self.behavior_history if b.agent_id == agent_id]

        if not agent_behaviors:
            return {'anomaly_detected': False, 'reason': '无行为记录'}

        anomalies = []

        # 1. 频率异常检测
        behavior_frequency = {}
        for behavior in agent_behaviors[-100:]:
            behavior_type = behavior.behavior_type.value
            behavior_frequency[behavior_type] = behavior_frequency.get(behavior_type, 0) + 1

        for behavior_type, count in behavior_frequency.items():
            if count > 20:  # 单一行为超过20次
                anomalies.append({
                    'type': 'frequency_anomaly',
                    'behavior_type': behavior_type,
                    'count': count,
                    'message': f'{behavior_type}行为频率异常（{count}次）'
                })

        # 2. 风险累积检测
        total_risk_score = sum(b.risk_score for b in agent_behaviors[-50:])
        if total_risk_score > 300:
            anomalies.append({
                'type': 'risk_accumulation',
                'total_risk_score': total_risk_score,
                'message': f'风险分数累积过高（{total_risk_score}分）'
            })

        # 3. 行为模式突变检测
        recent_behaviors = agent_behaviors[-10:]
        earlier_behaviors = agent_behaviors[-50:-10]

        if earlier_behaviors and recent_behaviors:
            recent_types = set(b.behavior_type.value for b in recent_behaviors)
            earlier_types = set(b.behavior_type.value for b in earlier_behaviors)

            new_types = recent_types - earlier_types
            if len(new_types) > 3:
                anomalies.append({
                    'type': 'pattern_change',
                    'new_behavior_types': list(new_types),
                    'message': f'行为模式突变，出现{len(new_types)}种新行为类型'
                })

        return {
            'anomaly_detected': len(anomalies) > 0,
            'anomalies': anomalies,
            'agent_id': agent_id,
            'total_behaviors': len(agent_behaviors),
        }

    def verify_compliance(self, agent_id: str, compliance_rules: Dict) -> Dict:
        """
        验证Agent合规性

        Args:
            agent_id: Agent ID
            compliance_rules: 合规规则

        Returns:
            合规性验证结果
        """
        agent_behaviors = [b for b in self.behavior_history if b.agent_id == agent_id]

        if not agent_behaviors:
            return {'compliant': True, 'reason': '无行为记录'}

        violations = []

        # 1. 数据处理合规性
        if compliance_rules.get('data_processing_required', False):
            data_behaviors = [b for b in agent_behaviors if b.behavior_type == AgentBehaviorType.DATA_PROCESSING]
            if not data_behaviors:
                violations.append({
                    'rule': 'data_processing_required',
                    'message': '缺少数据处理行为记录'
                })

        # 2. 决策透明性
        if compliance_rules.get('decision_transparency_required', False):
            for behavior in agent_behaviors:
                if behavior.behavior_type == AgentBehaviorType.DECISION_MAKING:
                    if behavior.behavior_id not in self.decision_chains:
                        violations.append({
                            'rule': 'decision_transparency_required',
                            'behavior_id': behavior.behavior_id,
                            'message': f'决策行为{behavior.behavior_id}缺少决策链记录'
                        })

        # 3. 风险限制
        max_risk_score = compliance_rules.get('max_risk_score', 100)
        for behavior in agent_behaviors:
            if behavior.risk_score > max_risk_score:
                violations.append({
                    'rule': 'max_risk_score',
                    'behavior_id': behavior.behavior_id,
                    'message': f'行为风险分数{behavior.risk_score}超过限制{max_risk_score}'
                })

        return {
            'compliant': len(violations) == 0,
            'violations': violations,
            'total_behaviors': len(agent_behaviors),
            'compliance_score': max(0, 100 - len(violations) * 10),
        }

    def _generate_behavior_id(self, agent_id: str, behavior_type: AgentBehaviorType) -> str:
        """生成行为ID"""
        timestamp = time.time()
        data = f"{agent_id}_{behavior_type.value}_{timestamp}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _assess_behavior_risk(
        self,
        behavior_type: AgentBehaviorType,
        input_data: Dict,
        output_data: Dict
    ) -> tuple:
        """评估行为风险"""
        risks = []
        risk_score = 0

        # 根据行为类型评估风险
        if behavior_type == AgentBehaviorType.CODE_GENERATION:
            # 检查生成的代码是否包含危险模式
            code = output_data.get('code', '')
            if 'eval(' in code or 'exec(' in code:
                risks.append('生成危险代码（eval/exec）')
                risk_score += 80

        elif behavior_type == AgentBehaviorType.FILE_OPERATION:
            # 检查文件操作是否安全
            file_path = input_data.get('file_path', '')
            if '.env' in file_path or 'credential' in file_path:
                risks.append('操作敏感文件')
                risk_score += 70

        elif behavior_type == AgentBehaviorType.API_CALL:
            # 检查API调用是否安全
            endpoint = input_data.get('endpoint', '')
            if 'delete' in endpoint.lower() or 'drop' in endpoint.lower():
                risks.append('危险API调用（delete/drop）')
                risk_score += 90

        # 计算风险等级
        if risk_score >= 80:
            risk_level = AgentRiskLevel.CRITICAL
        elif risk_score >= 50:
            risk_level = AgentRiskLevel.HIGH
        elif risk_score >= 30:
            risk_level = AgentRiskLevel.MEDIUM
        elif risk_score > 0:
            risk_level = AgentRiskLevel.LOW
        else:
            risk_level = AgentRiskLevel.SAFE

        return risks, risk_score, risk_level

    def _assess_decision_quality(self, decision_steps: List[AgentDecisionStep]) -> str:
        """评估决策质量"""
        if not decision_steps:
            return '无决策记录'

        avg_confidence = sum(s.confidence for s in decision_steps) / len(decision_steps)

        if avg_confidence >= 0.8:
            return '高质量决策（高置信度）'
        elif avg_confidence >= 0.6:
            return '中等质量决策'
        else:
            return '低质量决策（低置信度）'

    def _record_resource_usage(
        self,
        agent_id: str,
        behavior_type: AgentBehaviorType,
        input_data: Dict,
        output_data: Dict
    ) -> None:
        """记录资源使用"""
        if agent_id not in self.resource_usage:
            self.resource_usage[agent_id] = {
                'total_behaviors': 0,
                'behavior_types': {},
                'data_volume': 0,
            }

        usage = self.resource_usage[agent_id]
        usage['total_behaviors'] += 1

        behavior_type_key = behavior_type.value
        usage['behavior_types'][behavior_type_key] = usage['behavior_types'].get(behavior_type_key, 0) + 1

        # 估算数据量
        input_size = len(json.dumps(input_data))
        output_size = len(json.dumps(output_data))
        usage['data_volume'] += input_size + output_size


# 创建全局实例
agent_behavior_auditor = AgentBehaviorAuditor()


# 测试代码
if __name__ == '__main__':
    # 记录Agent行为
    behavior = agent_behavior_auditor.record_behavior(
        agent_id='agent_001',
        agent_name='CodeGenerator',
        behavior_type=AgentBehaviorType.CODE_GENERATION,
        input_data={'prompt': '生成一个计算斐波那契数列的函数'},
        output_data={'code': 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)'},
        decision_process={'reasoning': '用户需要斐波那契函数，我将生成递归版本'}
    )

    print(f"行为ID: {behavior.behavior_id}")
    print(f"风险等级: {behavior.risk_level.value}")

    # 检测异常
    anomaly = agent_behavior_auditor.detect_anomaly('agent_001')
    print(f"\n异常检测: {json.dumps(anomaly, ensure_ascii=False, indent=2)}")