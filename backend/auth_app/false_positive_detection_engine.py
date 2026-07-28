"""
误报检测引擎 - 将误报率控制在2.5%以下
基于行为基线+上下文推理，解决SOC分析师倦怠问题
"""

from typing import Dict, Tuple, List
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import numpy as np
import logging

logger = logging.getLogger(__name__)


class FalsePositiveDetector:
    """误报检测引擎"""
    
    def __init__(self):
        self.target_fp_rate = 2.5
        self.baseline = defaultdict(list)
        self.context_history = defaultdict(list)
        self.fp_features = {
            'known_patterns': ['routine_api', 'scheduled_task', 'batch_process', 'normal_login', 'admin_approved'],
            'low_risk_keywords': ['正常', '常规', '例行', '定时', '批量', '测试'],
            'whitelist_entities': ['system_admin', 'trusted_service', 'internal_tool']
        }
        
        self.fp_stats = {
            'total_alerts': 0,
            'false_positives': 0,
            'filtered': 0,
            'true_positives': 0,
            'current_fp_rate': 0.0,
            'analyst_time_saved': 0.0
        }
        
        self.weights = {
            'user_history': 0.35,
            'time_context': 0.15,
            'sequence_context': 0.20,
            'risk_level': 0.30
        }
    
    def update_baseline(self, behavior: Dict) -> None:
        """更新行为基线"""
        user = behavior.get('user_id', 'unknown')
        self.baseline[user].append({
            'type': behavior.get('behavior_type'),
            'pattern': behavior.get('behavior_pattern', {}),
            'timestamp': behavior.get('timestamp', datetime.now())
        })
        self.context_history[user].append(behavior)
    
    def check_user_history(self, alert: Dict) -> Tuple[bool, float, str]:
        """用户历史上下文检查"""
        user = alert.get('user_id', 'unknown')
        behavior = alert.get('behavior_type', 'unknown')
        history = self.baseline.get(user, [])
        
        if len(history) < 20:
            return False, 0.5, "历史样本不足"
        
        freq = Counter([h['type'] for h in history]).get(behavior, 0) / len(history)
        
        if freq > 0.3:
            return True, 0.85, f"历史频率{freq*100:.1f}%，正常行为"
        elif freq > 0.1:
            return False, 0.6, f"历史频率{freq*100:.1f}%，需关注"
        return False, 0.3, f"历史频率{freq*100:.1f}%，罕见行为"
    
    def check_time_context(self, alert: Dict) -> Tuple[bool, float, str]:
        """时间上下文检查"""
        ts = alert.get('timestamp', datetime.now())
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        
        hour = ts.hour
        # 工作时间判断
        if 9 <= hour <= 18:
            return True, 0.75, f"工作时间{hour}:00，正常"
        # 加班时间
        elif 18 <= hour <= 21:
            return True, 0.55, f"加班时间{hour}:00，可能正常"
        return False, 0.4, f"非工作时间{hour}:00，需关注"
    
    def check_sequence_context(self, alert: Dict) -> Tuple[bool, float, str]:
        """序列上下文检查"""
        user = alert.get('user_id', 'unknown')
        sequence = alert.get('behavior_sequence', [])
        history = self.context_history.get(user, [])
        
        if len(history) < 10:
            return False, 0.5, "序列历史不足"
        
        similarities = []
        for h in history:
            h_seq = h.get('behavior_sequence', [])
            sim = self._lcs_similarity(sequence, h_seq)
            similarities.append(sim)
        
        avg_sim = np.mean(similarities) if similarities else 0
        
        if avg_sim > 0.7:
            return True, 0.8, f"序列相似度{avg_sim*100:.1f}%，正常序列"
        elif avg_sim > 0.5:
            return False, 0.6, f"序列相似度{avg_sim*100:.1f}%，需分析"
        return False, 0.35, f"序列相似度{avg_sim*100:.1f}%，异常序列"
    
    def check_risk_level(self, alert: Dict) -> Tuple[bool, float, str]:
        """风险级别检查"""
        score = alert.get('risk_score', 0)
        deviation = alert.get('baseline_deviation', 0)
        attack_type = alert.get('attack_type', '')
        desc = alert.get('description', '')
        
        # 已知误报模式
        if attack_type in self.fp_features['known_patterns']:
            return True, 0.95, f"已知误报模式: {attack_type}"
        
        # 白名单实体
        entity = alert.get('source_entity', '')
        if entity in self.fp_features['whitelist_entities']:
            return True, 0.9, f"白名单实体: {entity}"
        
        # 低风险关键词
        kw_match = [k for k in self.fp_features['low_risk_keywords'] if k in desc]
        if kw_match:
            return True, 0.85, f"低风险关键词: {kw_match}"
        
        # 低风险评分
        if score < 20:
            return True, 0.85, f"低风险评分{score}"
        
        # 低偏离度
        if deviation < 0.5:
            return True, 0.8, f"低偏离度{deviation:.2f}"
        
        return False, 0.3, f"风险评分{score}，偏离度{deviation:.2f}"
    
    def _lcs_similarity(self, seq1: List, seq2: List) -> float:
        """计算序列相似度(LCS)"""
        if not seq1 or not seq2:
            return 0.0
        m, n = len(seq1), len(seq2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if seq1[i-1] == seq2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        return dp[m][n] / max(m, n)
    
    def detect_fp(self, alert: Dict) -> Dict:
        """综合误报检测"""
        checks = {
            'user_history': self.check_user_history(alert),
            'time_context': self.check_time_context(alert),
            'sequence_context': self.check_sequence_context(alert),
            'risk_level': self.check_risk_level(alert)
        }
        
        # 加权计算误报概率
        fp_prob = sum([
            confidence * self.weights[name] if is_fp else (1 - confidence) * self.weights[name]
            for name, (is_fp, confidence, _) in checks.items()
        ])
        
        is_fp = fp_prob > 0.6
        confidence = fp_prob if is_fp else (1 - fp_prob)
        
        # 更新统计
        self.fp_stats['total_alerts'] += 1
        if is_fp:
            self.fp_stats['false_positives'] += 1
            if confidence > 0.8:
                self.fp_stats['filtered'] += 1
        else:
            self.fp_stats['true_positives'] += 1
        
        self.fp_stats['current_fp_rate'] = (
            self.fp_stats['false_positives'] / self.fp_stats['total_alerts'] * 100
            if self.fp_stats['total_alerts'] > 0 else 0
        )
        
        # 计算分析师节省时间
        self.fp_stats['analyst_time_saved'] = (
            self.fp_stats['filtered'] * 5 / 480 * 100  # 每条误报5分钟，每天8小时
        )
        
        return {
            'is_false_positive': is_fp,
            'confidence': round(confidence, 2),
            'fp_probability': round(fp_prob, 2),
            'check_results': checks,
            'reasons': [r for _, _, r in checks.values()],
            'recommendation': self._get_recommendation(is_fp, confidence),
            'statistics': self.fp_stats
        }
    
    def batch_detect(self, alerts: List[Dict]) -> Dict:
        """批量检测误报"""
        results = [self.detect_fp(a) for a in alerts]
        return {
            'batch_results': results,
            'overall_stats': self.fp_stats
        }
    
    def _get_recommendation(self, is_fp: bool, conf: float) -> str:
        """生成处理建议"""
        if is_fp:
            if conf > 0.85:
                return "高置信度误报，建议直接过滤"
            elif conf > 0.7:
                return "中等置信度误报，建议标记后延后处理"
            return "低置信度误报，建议快速审核"
        if conf > 0.8:
            return "高置信度威胁，建议立即处理"
        elif conf > 0.6:
            return "中等置信度威胁，建议优先处理"
        return "需人工审核确认"
    
    def get_stats(self) -> Dict:
        """获取完整统计数据"""
        return {
            'current_fp_rate': round(self.fp_stats['current_fp_rate'], 2),
            'target_fp_rate': self.target_fp_rate,
            'gap': round(self.target_fp_rate - self.fp_stats['current_fp_rate'], 2),
            'improvement': round(99.0 - self.fp_stats['current_fp_rate'], 2),
            'analyst_time_saved': round(self.fp_stats['analyst_time_saved'], 2),
            'total_alerts': self.fp_stats['total_alerts'],
            'false_positives': self.fp_stats['false_positives'],
            'filtered': self.fp_stats['filtered'],
            'true_positives': self.fp_stats['true_positives'],
            'comparison': {
                'traditional_soc': {
                    'daily_alerts': 11000,
                    'fp_rate': 99.0,
                    'analyst_fp_time': 25.0
                },
                'yijiandaodi': {
                    'fp_rate': round(self.fp_stats['current_fp_rate'], 2),
                    'analyst_time_saved': round(self.fp_stats['analyst_time_saved'], 2)
                }
            },
            'status': '已达标' if self.fp_stats['current_fp_rate'] <= self.target_fp_rate else '需优化',
            'recommendations': self._get_recommendations()
        }
    
    def _get_recommendations(self) -> List[str]:
        """生成优化建议"""
        recs = []
        curr_rate = self.fp_stats['current_fp_rate']
        
        if curr_rate > self.target_fp_rate:
            recs.append(f"当前误报率{curr_rate:.1f}%高于目标{self.target_fp_rate}%，建议增加行为基线样本")
        
        baseline_size = sum(len(v) for v in self.baseline.values())
        if baseline_size < 100:
            recs.append(f"基线样本{baseline_size}条较少，建议增加正常行为数据收集")
        
        filtered = self.fp_stats['filtered']
        if filtered == 0:
            recs.append("暂无自动过滤误报，建议启用高置信度误报自动过滤")
        
        return recs


# 全局实例
fp_detector = FalsePositiveDetector()