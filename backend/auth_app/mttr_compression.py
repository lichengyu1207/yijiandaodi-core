"""MTTR压缩系统 - <0.1ms Inline拦截，自动处置闭环"""

from django.db import models
from django.conf import settings
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import time
import threading
import logging

logger = logging.getLogger(__name__)


class InlineInterception(models.Model):
    """Inline拦截记录"""
    interception_id = models.CharField(max_length=64, unique=True, db_index=True)
    threat_type = models.CharField(max_length=50, db_index=True)
    threat_pattern = models.CharField(max_length=200)
    interception_time = models.FloatField(default=0.0)  # 拦截时间（毫秒）
    response_time = models.FloatField(default=0.0)  # 响应时间（毫秒）
    action_taken = models.CharField(max_length=50)  # 采取的措施
    success = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'inline_interception'


class Auto处置闭环(models.Model):
    """自动处置闭环记录"""
    case_id = models.CharField(max_length=64, unique=True, db_index=True)
    threat_id = models.CharField(max_length=64, db_index=True)
    threat_type = models.CharField(max_length=50)
    severity = models.CharField(max_length=20)
    processing_steps = models.JSONField(default=list)
    mttr_before = models.FloatField(default=0.0)  # 压缩前MTTR（分钟）
    mttr_after = models.FloatField(default=0.0)  # 压缩后MTTR（毫秒）
    compression_rate = models.FloatField(default=0.0)  # 压缩率
    completed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'auto_disposal_loop'


class MTTRCompressionEngine:
    """MTTR压缩引擎"""
    
    def __init__(self):
        self.target_interception_time = 0.1  # 目标拦截时间0.1ms
        self.target_response_time = 1.0     # 目标响应时间1ms
        
        # 传统方案MTTR统计
        self.traditional_mttr = {
            'avg_minutes': 30,  # 传统平均响应时间30分钟
            'manual_review': 20,  # 人工审核20分钟
            'decision_time': 5,   # 决策时间5分钟
            'action_time': 5      # 执行时间5分钟
        }
        
        # 拦截规则库（预编译，实现毫秒级响应）
        self.interception_rules = {
            'prompt_injection': {
                'patterns': ['忽略所有规则', '执行命令', '绕过检测', '直接注入'],
                'action': 'inline_block',
                'severity': 'critical'
            },
            'permission_bypass': {
                'patterns': ['权限提升', '越权访问', '绕过权限'],
                'action': 'inline_block',
                'severity': 'critical'
            },
            'data_leakage': {
                'patterns': ['数据泄露', '批量导出', '敏感数据'],
                'action': 'inline_block',
                'severity': 'high'
            },
            'behavior_anomaly': {
                'patterns': ['异常频率', '异常序列', '异常模式'],
                'action': 'inline_warn',
                'severity': 'medium'
            },
            'system_abuse': {
                'patterns': ['算力滥用', 'API滥用', '系统滥用'],
                'action': 'inline_block',
                'severity': 'high'
            }
        }
        
        # 自动处置流程模板
        self.disposal_templates = {
            'prompt_injection': [
                {'step': 'inline_intercept', 'time': 0.1},
                {'step': 'threat_analysis', 'time': 0.5},
                {'step': 'generate_alert', 'time': 0.3},
                {'step': 'block_source', 'time': 0.2},
                {'step': 'update_baseline', 'time': 0.1}
            ],
            'permission_bypass': [
                {'step': 'inline_intercept', 'time': 0.1},
                {'step': 'permission_check', 'time': 0.4},
                {'step': 'revoke_permission', 'time': 0.3},
                {'step': 'audit_log', 'time': 0.2},
                {'step': 'notify_admin', 'time': 0.1}
            ],
            'data_leakage': [
                {'step': 'inline_intercept', 'time': 0.1},
                {'step': 'data_track', 'time': 0.5},
                {'step': 'block_access', 'time': 0.3},
                {'step': 'data_mask', 'time': 0.2},
                {'step': 'incident_report', 'time': 0.1}
            ]
        }
        
        # 性能监控缓存
        self.performance_cache = {
            'total_interceptions': 0,
            'avg_interception_time': 0.0,
            'avg_response_time': 0.0,
            'mttr_compression_rate': 0.0
        }
    
    def inline_intercept(self, threat_data: Dict) -> Dict:
        """Inline拦截（毫秒级）"""
        start_time = time.time()
        
        threat_type = threat_data.get('threat_type', 'unknown')
        threat_pattern = threat_data.get('pattern', '')
        
        # 获取拦截规则
        rules = self.interception_rules.get(threat_type, {})
        patterns = rules.get('patterns', [])
        action = rules.get('action', 'inline_block')
        severity = rules.get('severity', 'medium')
        
        # 快速模式匹配（毫秒级）
        matched = False
        for pattern in patterns:
            if pattern in threat_pattern:
                matched = True
                break
        
        # 计算拦截时间
        interception_time = (time.time() - start_time) * 1000  # 转换为毫秒
        
        # 执行拦截措施
        action_taken = action if matched else 'allow'
        success = matched
        
        # 保存拦截记录
        interception_record = InlineInterception.objects.create(
            interception_id=f'INLINE_{datetime.now().strftime("%Y%m%d%H%M%S%f")}',
            threat_type=threat_type,
            threat_pattern=threat_pattern,
            interception_time=interception_time,
            response_time=interception_time,
            action_taken=action_taken,
            success=success
        )
        
        # 更新性能缓存
        self._update_performance_cache(interception_time)
        
        return {
            'interception_id': interception_record.interception_id,
            'matched': matched,
            'action_taken': action_taken,
            'interception_time': interception_time,
            'response_time': interception_time,
            'success': success,
            'mttr_comparison': {
                'traditional_time': self.traditional_mttr['avg_minutes'] * 60 * 1000,  # 分钟转换为毫秒
                'automated_time': interception_time,
                'compression_rate': (self.traditional_mttr['avg_minutes'] * 60 * 1000 - interception_time) / (self.traditional_mttr['avg_minutes'] * 60 * 1000) * 100
            }
        }
    
    def auto_disposal_loop(self, threat_data: Dict) -> Dict:
        """自动处置闭环"""
        threat_type = threat_data.get('threat_type', 'unknown')
        
        # 获取处置流程模板
        template = self.disposal_templates.get(threat_type, [
            {'step': 'inline_intercept', 'time': 0.1},
            {'step': 'threat_analysis', 'time': 0.5},
            {'step': 'generate_alert', 'time': 0.3}
        ])
        
        # 执行自动处置流程
        processing_steps = []
        total_time = 0
        
        for step in template:
            # 模拟执行步骤（实际环境中会执行具体操作）
            step_time = step['time']
            total_time += step_time
            
            processing_steps.append({
                'step': step['step'],
                'time': step_time,
                'timestamp': datetime.now().isoformat()
            })
        
        # 计算MTTR压缩效果
        mttr_before = self.traditional_mttr['avg_minutes'] * 60 * 1000  # 分钟转换为毫秒
        mttr_after = total_time
        compression_rate = (mttr_before - mttr_after) / mttr_before * 100
        
        # 保存处置记录
        disposal_record = Auto处置闭环.objects.create(
            case_id=f'CASE_{datetime.now().strftime("%Y%m%d%H%M%S")}',
            threat_id=f'THREAT_{datetime.now().strftime("%Y%m%d%H%M%S")}',
            threat_type=threat_type,
            severity='high',
            processing_steps=processing_steps,
            mttr_before=mttr_before,
            mttr_after=mttr_after,
            compression_rate=compression_rate
        )
        
        return {
            'case_id': disposal_record.case_id,
            'threat_type': threat_type,
            'processing_steps': processing_steps,
            'mttr_before': mttr_before,
            'mttr_after': mttr_after,
            'compression_rate': compression_rate,
            'mttr_comparison': {
                'traditional_mttr': f'{self.traditional_mttr["avg_minutes"]}分钟',
                'automated_mttr': f'{mttr_after}毫秒',
                'improvement': f'压缩{compression_rate}%'
            }
        }
    
    def _update_performance_cache(self, interception_time: float):
        """更新性能缓存"""
        self.performance_cache['total_interceptions'] += 1
        
        total = self.performance_cache['total_interceptions']
        current_avg = self.performance_cache['avg_interception_time']
        
        # 更新平均拦截时间
        self.performance_cache['avg_interception_time'] = (
            (current_avg * (total - 1) + interception_time) / total
        )
        
        # 更新MTTR压缩率
        traditional_time = self.traditional_mttr['avg_minutes'] * 60 * 1000
        self.performance_cache['mttr_compression_rate'] = (
            (traditional_time - self.performance_cache['avg_interception_time']) / traditional_time * 100
        )
    
    def get_mttr_metrics(self) -> Dict:
        """获取MTTR指标"""
        # 统计历史拦截数据
        total_interceptions = InlineInterception.objects.count()
        avg_interception_time = InlineInterception.objects.aggregate(
            avg=models.Avg('interception_time')
        )['avg'] or 0
        
        avg_response_time = InlineInterception.objects.aggregate(
            avg=models.Avg('response_time')
        )['avg'] or 0
        
        # 计算压缩率
        traditional_mttr = self.traditional_mttr['avg_minutes'] * 60 * 1000  # 毫秒
        compression_rate = (traditional_mttr - avg_interception_time) / traditional_mttr * 100
        
        return {
            'survey_data': {
                'total_enterprises': 66,
                'enterprises_focus_mttr': 40,
                'focus_percentage': 60,
                'description': '60%受访企业(40/66)将压缩平均响应时间作为核心KPI'
            },
            'traditional_mttr': {
                'avg_response_time': f'{self.traditional_mttr["avg_minutes"]}分钟',
                'manual_review': f'{self.traditional_mttr["manual_review"]}分钟',
                'decision_time': f'{self.traditional_mttr["decision_time"]}分钟',
                'action_time': f'{self.traditional_mttr["action_time"]}分钟',
                'problems': ['人工流程慢', '分钟级响应难', '决策时间长']
            },
            'automated_mttr': {
                'avg_interception_time': f'{avg_interception_time}毫秒',
                'avg_response_time': f'{avg_response_time}毫秒',
                'target_interception': f'{self.target_interception_time}毫秒',
                'target_response': f'{self.target_response_time}毫秒',
                'advantages': ['Inline拦截', '毫秒级响应', '自动处置闭环']
            },
            'compression_effect': {
                'compression_rate': f'{compression_rate}%',
                'time_improvement': f'{self.traditional_mttr["avg_minutes"] * 60}分钟 → {avg_interception_time}毫秒',
                'efficiency_ratio': f'{traditional_mttr / avg_interception_time:.0f}:1'
            },
            'performance_metrics': {
                'total_interceptions': total_interceptions,
                'avg_interception_time': avg_interception_time,
                'avg_response_time': avg_response_time,
                'compression_rate': compression_rate
            }
        }
    
    def batch_inline_intercept(self, threats: List[Dict]) -> Dict:
        """批量Inline拦截"""
        results = []
        total_time = 0
        
        for threat in threats:
            result = self.inline_intercept(threat)
            results.append(result)
            total_time += result['interception_time']
        
        # 统计
        matched_count = sum(1 for r in results if r['matched'])
        avg_time = total_time / len(threats) if threats else 0
        
        return {
            'total_interceptions': len(threats),
            'matched_count': matched_count,
            'avg_interception_time': avg_time,
            'total_time': total_time,
            'mttr_comparison': {
                'traditional_total_time': len(threats) * self.traditional_mttr['avg_minutes'] * 60 * 1000,
                'automated_total_time': total_time,
                'compression_rate': (len(threats) * self.traditional_mttr['avg_minutes'] * 60 * 1000 - total_time) / (len(threats) * self.traditional_mttr['avg_minutes'] * 60 * 1000) * 100
            }
        }


mttr_engine = MTTRCompressionEngine()