import re
import time
import logging
from typing import List, Dict, Any, Tuple
from django.db.models import Q
from .security_models import AgentSecurityRule, AgentRiskLog

logger = logging.getLogger(__name__)


class SecurityChecker:
    """Agent安全检测核心服务"""

    @staticmethod
    def check_content(
        content: str,
        user_id: int = 0,
        session_id: str = '',
        agent_role: str = '',
        ip_address: str = '',
    ) -> Dict[str, Any]:
        """
        检测内容安全性

        Returns:
            {
                'is_safe': bool,
                'risk_level': str,          # low/medium/high/critical
                'action_taken': str,         # block/warn/mask/log_only/passed
                'matched_rules': list,       # 匹配的规则详情
                'warning_message': str,
                'masked_content': str,       # 脱敏后的内容（如有）
            }
        """
        start_time = time.time()

        if not content or not content.strip():
            return {
                'is_safe': True,
                'risk_level': 'low',
                'action_taken': 'passed',
                'matched_rules': [],
                'warning_message': '',
                'masked_content': content,
            }

        content_lower = content.lower()
        matched_rules = []
        highest_severity = 'info'
        final_action = 'passed'
        warning_messages = []
        masked_content = content

        # 获取所有启用的规则，按优先级排序
        rules = AgentSecurityRule.objects.filter(is_enabled=True).order_by('priority')

        for rule in rules:
            match_result = SecurityChecker._check_rule(rule, content, content_lower)

            if match_result['matched']:
                matched_rules.append({
                    'rule_id': rule.id,
                    'rule_name': rule.name,
                    'rule_type': rule.rule_type,
                    'severity': rule.severity,
                    'action': rule.action,
                    'detected_pattern': match_result['pattern'],
                })

                # 更新最高风险等级
                severity_order = {'info': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
                if severity_order.get(rule.severity, 0) > severity_order.get(highest_severity, 0):
                    highest_severity = rule.severity

                # 确定最终动作（优先级：block > warn > mask > log_only）
                action_priority = {'log_only': 0, 'passed': 1, 'warn': 2, 'mask': 3, 'block': 4}
                if action_priority.get(rule.action, 0) > action_priority.get(final_action, 0):
                    final_action = rule.action

                # 执行脱敏处理
                if rule.action == 'mask':
                    masked_content = SecurityChecker._mask_content(content, rule)

                # 添加警告消息
                if rule.action == 'warn' or rule.action == 'block':
                    warning_messages.append(f"[{rule.get_severity_display()}] {rule.name}")

        processing_time = int((time.time() - start_time) * 1000)

        # 记录日志（仅当有匹配或高风险时）
        if matched_rules and highest_severity in ['high', 'critical']:
            SecurityChecker._log_risk(
                session_id=session_id,
                user_id=user_id,
                agent_role=agent_role,
                risk_level=highest_severity,
                status='blocked' if final_action == 'block' else final_action,
                input_content=content[:500],
                matched_rules=matched_rules,
                action_taken=final_action,
                ip_address=ip_address,
                processing_time_ms=processing_time,
            )

        return {
            'is_safe': final_action != 'block',
            'risk_level': highest_severity,
            'action_taken': final_action,
            'matched_rules': matched_rules,
            'warning_message': '; '.join(warning_messages) if warning_messages else '',
            'masked_content': masked_content if final_action == 'mask' else content,
        }

    @staticmethod
    def _check_rule(rule: AgentSecurityRule, content: str, content_lower: str) -> Dict[str, Any]:
        """检查单条规则是否匹配"""
        pattern = rule.pattern

        try:
            if rule.pattern_type == 'keyword':
                # 关键词匹配（不区分大小写）
                keywords = [k.strip().lower() for k in pattern.split('|') if k.strip()]
                for keyword in keywords:
                    if keyword in content_lower:
                        return {'matched': True, 'pattern': keyword}

            elif rule.pattern_type == 'regex':
                # 正则表达式匹配
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    return {'matched': True, 'pattern': matches[0]}

            elif rule.pattern_type == 'ml_model':
                # ML模型检测（预留接口）
                pass

        except Exception as e:
            logger.error(f"Rule check error (ID={rule.id}): {e}")

        return {'matched': False, 'pattern': ''}

    @staticmethod
    def _mask_content(content: str, rule: AgentSecurityRule) -> str:
        """对内容进行脱敏处理"""
        metadata = rule.metadata or {}
        mask_char = metadata.get('mask_char', '*')
        keep_first_last = metadata.get('keep_first_last', 0)

        try:
            if rule.pattern_type == 'regex':
                def replace_match(match):
                    text = match.group(0)
                    if len(text) <= keep_first_last * 2:
                        return mask_char * len(text)
                    return text[:keep_first_last] + mask_char * (len(text) - keep_first_last * 2) + text[-keep_first_last:]

                masked = re.sub(rule.pattern, replace_mask, content, flags=re.IGNORECASE)
                return masked

            elif rule.pattern_type == 'keyword':
                keywords = [k.strip() for k in rule.pattern.split('|') if k.strip()]
                result = content
                for kw in keywords:
                    result = re.sub(re.escape(kw), mask_char * len(kw), result, flags=re.IGNORECASE)
                return result

        except Exception as e:
            logger.error(f"Masking error: {e}")

        return content

    @staticmethod
    def _log_risk(**kwargs):
        """记录风控日志"""
        try:
            matched_rules = kwargs.pop('matched_rules', [])
            first_rule_id = matched_rules[0]['rule_id'] if matched_rules else None

            log_entry = AgentRiskLog.objects.create(
                rule_id=first_rule_id,
                detected_pattern=matched_rules[0].get('detected_pattern', '') if matched_rules else '',
                **kwargs
            )
            logger.info(f"Risk logged: ID={log_entry.id}, Level={kwargs.get('risk_level')}")
        except Exception as e:
            logger.error(f"Failed to log risk: {e}")

    @staticmethod
    def check_tool_permission(
        tool_name: str,
        operation: str,
        user_id: int = 0,
        agent_role: str = '',
        **kwargs
    ) -> Dict[str, Any]:
        """
        检查工具调用权限

        Args:
            tool_name: 工具名称（如 exec_command, sql_query）
            operation: 操作类型（如 read, write, delete）
        """
        start_time = time.time()

        # 构造检查内容
        check_content = f"{tool_name} {operation}"

        # 获取工具权限相关规则
        rules = AgentSecurityRule.objects.filter(
            is_enabled=True,
            rule_type='tool_permission',
        ).order_by('priority')

        matched_rules = []
        is_allowed = True
        block_reason = ''

        for rule in rules:
            match_result = SecurityChecker._check_rule(
                rule,
                check_content,
                check_content.lower()
            )

            if match_result['matched']:
                matched_rules.append({
                    'rule_id': rule.id,
                    'rule_name': rule.name,
                    'detected_pattern': match_result['pattern'],
                })

                if rule.action == 'block':
                    is_allowed = False
                    block_reason = f"[BLOCKED] {rule.name}"

                    # 记录拦截日志
                    SecurityChecker._log_risk(
                        session_id=kwargs.get('session_id', ''),
                        user_id=user_id,
                        agent_role=agent_role,
                        risk_level=rule.severity,
                        status='blocked',
                        input_content=f"Tool: {tool_name}, Op: {operation}",
                        matched_rules=matched_rules,
                        action_taken='block',
                        ip_address=kwargs.get('ip_address', ''),
                        processing_time_ms=int((time.time() - start_time) * 1000),
                    )
                    break

        return {
            'allowed': is_allowed,
            'reason': block_reason if not is_allowed else '',
            'matched_rules': matched_rules,
        }
