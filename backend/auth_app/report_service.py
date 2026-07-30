"""
报告生成服务 - 三份报告交付

功能：
1. 创作时间线报告 - 记录创作过程、时间戳证据链
2. 素材风险报告 - 图片AI生成概率、版权风险评估
3. 账号资产报告 - 校验历史、安全积分、行为图谱
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
from django.template.loader import render_to_string

from .report_models import UserReport, CreationTimeline, MaterialRiskRecord, AccountAsset
from .agent_models import AgentSession, AgentMessage


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, user):
        self.user = user
        self.reports_dir = os.path.join(settings.MEDIA_ROOT, 'reports')
        os.makedirs(self.reports_dir, exist_ok=True)
    
    def generate_timeline_report(self, start_date=None, end_date=None):
        """生成创作时间线报告"""
        
        # 创建报告记录
        report = UserReport.objects.create(
            user=self.user,
            report_type='timeline',
            title=f'创作时间线报告 - {datetime.now().strftime("%Y-%m-%d")}',
            start_date=start_date,
            end_date=end_date or timezone.now(),
        )
        
        try:
            # 收集时间线数据
            timeline_data = self._collect_timeline_data(start_date, end_date)
            
            # 生成证据链哈希
            evidence_chain = self._generate_evidence_chain(timeline_data)
            
            # 构建报告数据
            report_data = {
                'user_info': {
                    'username': self.user.username,
                    'email': self.user.email,
                    'member_since': self.user.date_joined.isoformat(),
                },
                'timeline': timeline_data,
                'evidence_chain': evidence_chain,
                'statistics': {
                    'total_events': len(timeline_data),
                    'content_creates': sum(1 for e in timeline_data if e['event_type'] == 'content_create'),
                    'content_detects': sum(1 for e in timeline_data if e['event_type'] == 'content_detect'),
                    'image_uploads': sum(1 for e in timeline_data if e['event_type'] == 'image_upload'),
                    'evidences_saved': sum(1 for e in timeline_data if e['event_type'] == 'evidence_save'),
                },
                'generated_at': datetime.now().isoformat(),
            }
            
            report.data = report_data
            report.total_checks = report_data['statistics']['total_events']
            
            # 生成HTML报告
            html_content = self._render_timeline_html(report_data)
            
            # 保存文件
            file_name = f'timeline_{report.id}.html'
            file_path = os.path.join(self.reports_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            report.file_path = file_path
            report.file_size = os.path.getsize(file_path)
            report.status = 'completed'
            report.save()
            
            return report
            
        except Exception as e:
            report.status = 'failed'
            report.summary = str(e)
            report.save()
            raise
    
    def generate_material_risk_report(self, start_date=None, end_date=None):
        """生成素材风险报告"""
        
        report = UserReport.objects.create(
            user=self.user,
            report_type='material_risk',
            title=f'素材风险报告 - {datetime.now().strftime("%Y-%m-%d")}',
            start_date=start_date,
            end_date=end_date or timezone.now(),
        )
        
        try:
            # 收集素材风险数据
            materials = self._collect_material_risks(start_date, end_date)
            
            # 计算风险统计
            risk_stats = {
                'total_materials': len(materials),
                'safe_count': sum(1 for m in materials if m['risk_level'] == 'safe'),
                'warning_count': sum(1 for m in materials if m['risk_level'] == 'warning'),
                'danger_count': sum(1 for m in materials if m['risk_level'] == 'danger'),
                'avg_ai_probability': sum(m['ai_probability'] for m in materials) / len(materials) if materials else 0,
            }
            
            report_data = {
                'user_info': {
                    'username': self.user.username,
                    'email': self.user.email,
                },
                'materials': materials,
                'risk_statistics': risk_stats,
                'recommendations': self._generate_risk_recommendations(materials),
                'generated_at': datetime.now().isoformat(),
            }
            
            report.data = report_data
            report.total_checks = risk_stats['total_materials']
            report.total_risks = risk_stats['warning_count'] + risk_stats['danger_count']
            report.safety_score = (risk_stats['safe_count'] / risk_stats['total_materials'] * 100) if risk_stats['total_materials'] > 0 else 100
            
            # 生成HTML报告
            html_content = self._render_material_risk_html(report_data)
            
            file_name = f'material_risk_{report.id}.html'
            file_path = os.path.join(self.reports_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            report.file_path = file_path
            report.file_size = os.path.getsize(file_path)
            report.status = 'completed'
            report.save()
            
            return report
            
        except Exception as e:
            report.status = 'failed'
            report.summary = str(e)
            report.save()
            raise
    
    def generate_account_asset_report(self):
        """生成账号资产报告"""
        
        report = UserReport.objects.create(
            user=self.user,
            report_type='account_asset',
            title=f'账号资产报告 - {datetime.now().strftime("%Y-%m-%d")}',
        )
        
        try:
            # 获取或创建账号资产
            asset, created = AccountAsset.objects.get_or_create(user=self.user)
            asset.update_from_checks()
            
            # 构建行为图谱
            behavior_graph = self._build_behavior_graph()
            asset.behavior_graph = behavior_graph
            asset.save()
            
            report_data = {
                'user_info': {
                    'username': self.user.username,
                    'email': self.user.email,
                    'member_since': self.user.date_joined.isoformat(),
                },
                'asset': {
                    'safety_points': asset.safety_points,
                    'trust_score': asset.trust_score,
                    'total_checks': asset.total_checks,
                    'text_checks': asset.text_checks,
                    'image_checks': asset.image_checks,
                    'marketing_checks': asset.marketing_checks,
                    'total_risks': asset.total_risks,
                    'total_evidences': asset.total_evidences,
                    'evidence_chain_length': asset.evidence_chain_length,
                },
                'behavior_graph': behavior_graph,
                'achievements': self._get_achievements(asset),
                'recommendations': self._get_asset_recommendations(asset),
                'generated_at': datetime.now().isoformat(),
            }
            
            report.data = report_data
            report.total_checks = asset.total_checks
            report.safety_score = asset.trust_score
            report.summary = f'安全积分: {asset.safety_points} | 信任评分: {asset.trust_score:.1f}'
            
            # 生成HTML报告
            html_content = self._render_account_asset_html(report_data)
            
            file_name = f'account_asset_{report.id}.html'
            file_path = os.path.join(self.reports_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            report.file_path = file_path
            report.file_size = os.path.getsize(file_path)
            report.status = 'completed'
            report.save()
            
            return report
            
        except Exception as e:
            report.status = 'failed'
            report.summary = str(e)
            report.save()
            raise
    
    def generate_full_report(self, start_date=None, end_date=None):
        """生成综合报告（三合一）"""
        
        report = UserReport.objects.create(
            user=self.user,
            report_type='full',
            title=f'综合报告 - {datetime.now().strftime("%Y-%m-%d")}',
            start_date=start_date,
            end_date=end_date or timezone.now(),
        )
        
        try:
            # 生成三份报告数据
            timeline_report = self.generate_timeline_report(start_date, end_date)
            material_report = self.generate_material_risk_report(start_date, end_date)
            asset_report = self.generate_account_asset_report()
            
            # 合并数据
            report_data = {
                'user_info': {
                    'username': self.user.username,
                    'email': self.user.email,
                    'member_since': self.user.date_joined.isoformat(),
                },
                'timeline': timeline_report.data,
                'material_risk': material_report.data,
                'account_asset': asset_report.data,
                'generated_at': datetime.now().isoformat(),
            }
            
            report.data = report_data
            report.total_checks = timeline_report.total_checks + material_report.total_checks
            report.safety_score = asset_report.safety_score
            
            # 生成HTML报告
            html_content = self._render_full_report_html(report_data)
            
            file_name = f'full_report_{report.id}.html'
            file_path = os.path.join(self.reports_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            report.file_path = file_path
            report.file_size = os.path.getsize(file_path)
            report.status = 'completed'
            report.save()
            
            return report
            
        except Exception as e:
            report.status = 'failed'
            report.summary = str(e)
            report.save()
            raise
    
    # ===== 数据收集方法 =====
    
    def _collect_timeline_data(self, start_date, end_date):
        """收集时间线数据"""
        
        sessions = AgentSession.objects.filter(user=self.user)
        if start_date:
            sessions = sessions.filter(created_at__gte=start_date)
        if end_date:
            sessions = sessions.filter(created_at__lte=end_date)
        
        timeline = []
        for session in sessions:
            # 内容检测事件
            timeline.append({
                'event_type': 'content_detect',
                'event_title': f'{session.get_scenario_display()} - {session.title[:30]}',
                'event_description': f'检测场景: {session.get_scenario_display()}',
                'session_id': session.session_id,
                'created_at': session.created_at.isoformat(),
                'message_count': session.message_count,
            })
        
        # 按时间排序
        timeline.sort(key=lambda x: x['created_at'], reverse=True)
        return timeline
    
    def _collect_material_risks(self, start_date, end_date):
        """收集素材风险数据"""
        
        # 从检测会话中提取图片检测数据
        sessions = AgentSession.objects.filter(
            user=self.user,
            scenario='image'
        )
        if start_date:
            sessions = sessions.filter(created_at__gte=start_date)
        if end_date:
            sessions = sessions.filter(created_at__lte=end_date)
        
        materials = []
        for session in sessions:
            # 获取检测结果
            messages = AgentMessage.objects.filter(session=session, role='assistant')
            for msg in messages:
                try:
                    result = json.loads(msg.content) if msg.content.startswith('{') else {}
                    materials.append({
                        'material_name': session.title,
                        'material_type': 'image',
                        'ai_probability': result.get('aiProbability', 0),
                        'confidence': result.get('confidence', 0),
                        'risk_level': result.get('level', 'safe'),
                        'risk_score': result.get('aiProbability', 0),
                        'created_at': session.created_at.isoformat(),
                        'session_id': session.session_id,
                    })
                except:
                    pass
        
        return materials
    
    def _generate_evidence_chain(self, timeline_data):
        """生成证据链"""
        
        evidence_chain = []
        prev_hash = '0' * 64  # 初始哈希
        
        for event in timeline_data:
            # 五元组联合哈希
            data_str = f"{event['event_type']}{event['event_title']}{event['created_at']}{prev_hash}"
            current_hash = hashlib.sha256(data_str.encode()).hexdigest()
            
            evidence_chain.append({
                'event_id': event['session_id'],
                'event_type': event['event_type'],
                'timestamp': event['created_at'],
                'hash': current_hash,
                'prev_hash': prev_hash,
            })
            
            prev_hash = current_hash
        
        return evidence_chain
    
    def _build_behavior_graph(self):
        """构建行为图谱"""
        
        sessions = AgentSession.objects.filter(user=self.user)
        
        # 统计场景分布
        scenario_dist = {}
        for session in sessions:
            scenario = session.scenario or 'unknown'
            scenario_dist[scenario] = scenario_dist.get(scenario, 0) + 1
        
        # 统计时间分布
        hour_dist = {}
        for session in sessions:
            hour = session.created_at.hour
            hour_dist[hour] = hour_dist.get(hour, 0) + 1
        
        return {
            'scenario_distribution': scenario_dist,
            'hour_distribution': hour_dist,
            'total_sessions': sessions.count(),
        }
    
    def _get_achievements(self, asset):
        """获取成就列表"""
        
        achievements = []
        
        if asset.total_checks >= 100:
            achievements.append({'name': '检测达人', 'desc': '完成100次检测', 'icon': '🏆'})
        if asset.total_checks >= 500:
            achievements.append({'name': '检测专家', 'desc': '完成500次检测', 'icon': '🎯'})
        if asset.safety_points >= 100:
            achievements.append({'name': '安全卫士', 'desc': '安全积分达到100', 'icon': '🛡️'})
        if asset.evidence_chain_length >= 10:
            achievements.append({'name': '证据链构建者', 'desc': '证据链长度达到10', 'icon': '🔗'})
        
        return achievements
    
    def _generate_risk_recommendations(self, materials):
        """生成风险建议"""
        
        recommendations = []
        
        high_risk = [m for m in materials if m['risk_level'] == 'danger']
        if high_risk:
            recommendations.append(f'发现{len(high_risk)}个高风险素材，建议立即处理')
        
        ai_generated = [m for m in materials if m['ai_probability'] > 70]
        if ai_generated:
            recommendations.append(f'发现{len(ai_generated)}个疑似AI生成素材，建议标注来源')
        
        return recommendations
    
    def _get_asset_recommendations(self, asset):
        """获取资产建议"""
        
        recommendations = []
        
        if asset.trust_score < 60:
            recommendations.append('信任评分较低，建议增加检测频率')
        if asset.total_evidences < 10:
            recommendations.append('存证数量较少，建议对重要作品进行存证')
        
        return recommendations
    
    # ===== HTML渲染方法 =====
    
    def _render_timeline_html(self, data):
        """渲染时间线报告HTML"""
        
        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>创作时间线报告 - 一鉴到底</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .header h1 {{ color: #165DFF; margin-bottom: 10px; }}
        .header .subtitle {{ color: #666; }}
        .section {{ margin-bottom: 40px; }}
        .section h2 {{ color: #165DFF; border-bottom: 2px solid #165DFF; padding-bottom: 10px; }}
        .timeline-item {{ border-left: 3px solid #165DFF; padding-left: 20px; margin-bottom: 20px; }}
        .timeline-item .time {{ color: #666; font-size: 14px; }}
        .timeline-item .title {{ font-weight: bold; margin: 5px 0; }}
        .timeline-item .desc {{ color: #666; }}
        .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 30px; }}
        .stat-card {{ background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }}
        .stat-card .value {{ font-size: 32px; font-weight: bold; color: #165DFF; }}
        .stat-card .label {{ color: #666; margin-top: 5px; }}
        .evidence-chain {{ background: #f9f9f9; padding: 20px; border-radius: 8px; }}
        .evidence-item {{ font-family: monospace; font-size: 12px; margin-bottom: 10px; }}
        .footer {{ text-align: center; margin-top: 60px; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 创作时间线报告</h1>
        <div class="subtitle">一鉴到底 AI内容安全检测平台</div>
        <div class="subtitle">生成时间: {data['generated_at']}</div>
    </div>
    
    <div class="section">
        <h2>用户信息</h2>
        <p>用户名: {data['user_info']['username']}</p>
        <p>注册时间: {data['user_info']['member_since']}</p>
    </div>
    
    <div class="section">
        <h2>统计数据</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="value">{data['statistics']['total_events']}</div>
                <div class="label">总事件数</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['statistics']['content_detects']}</div>
                <div class="label">检测次数</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['statistics']['image_uploads']}</div>
                <div class="label">图片上传</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['statistics']['evidences_saved']}</div>
                <div class="label">存证数量</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>时间线详情</h2>
        {''.join(f'''
        <div class="timeline-item">
            <div class="time">{event['created_at']}</div>
            <div class="title">{event['event_title']}</div>
            <div class="desc">{event['event_description']}</div>
        </div>
        ''' for event in data['timeline'][:20])}
    </div>
    
    <div class="section">
        <h2>证据链哈希</h2>
        <div class="evidence-chain">
            <p>基于SHA-256的五元组联合哈希算法</p>
            {''.join(f'''
            <div class="evidence-item">
                [{event['timestamp']}] {event['hash'][:32]}...
            </div>
            ''' for event in data['evidence_chain'][:10])}
        </div>
    </div>
    
    <div class="footer">
        <p>一鉴到底 | yijiandaodi.com</p>
        <p>本报告由系统自动生成，仅供内部参考使用</p>
    </div>
</body>
</html>'''
    
    def _render_material_risk_html(self, data):
        """渲染素材风险报告HTML"""
        
        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>素材风险报告 - 一鉴到底</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .header h1 {{ color: #FF7D00; margin-bottom: 10px; }}
        .risk-card {{ background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 20px; }}
        .risk-card.safe {{ border-left: 4px solid #00B42A; }}
        .risk-card.warning {{ border-left: 4px solid #FF7D00; }}
        .risk-card.danger {{ border-left: 4px solid #F53F3F; }}
        .risk-header {{ display: flex; justify-content: space-between; align-items: center; }}
        .risk-title {{ font-weight: bold; }}
        .risk-level {{ padding: 4px 12px; border-radius: 4px; font-size: 12px; }}
        .risk-level.safe {{ background: #E8FFEA; color: #00B42A; }}
        .risk-level.warning {{ background: #FFF7E8; color: #FF7D00; }}
        .risk-level.danger {{ background: #FFECE8; color: #F53F3F; }}
        .ai-prob {{ margin-top: 10px; }}
        .ai-prob-bar {{ height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }}
        .ai-prob-fill {{ height: 100%; background: linear-gradient(90deg, #00B42A, #FF7D00, #F53F3F); }}
        .footer {{ text-align: center; margin-top: 60px; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🖼️ 素材风险报告</h1>
        <div class="subtitle">一鉴到底 AI内容安全检测平台</div>
        <div class="subtitle">生成时间: {data['generated_at']}</div>
    </div>
    
    <div class="section">
        <h2>风险统计</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="value">{data['risk_statistics']['total_materials']}</div>
                <div class="label">素材总数</div>
            </div>
            <div class="stat-card">
                <div class="value" style="color: #00B42A;">{data['risk_statistics']['safe_count']}</div>
                <div class="label">安全</div>
            </div>
            <div class="stat-card">
                <div class="value" style="color: #FF7D00;">{data['risk_statistics']['warning_count']}</div>
                <div class="label">低风险</div>
            </div>
            <div class="stat-card">
                <div class="value" style="color: #F53F3F;">{data['risk_statistics']['danger_count']}</div>
                <div class="label">高风险</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>素材详情</h2>
        {''.join(f'''
        <div class="risk-card {m['risk_level']}">
            <div class="risk-header">
                <div class="risk-title">{m['material_name']}</div>
                <div class="risk-level {m['risk_level']}">
                    安全
                </div>
            </div>
            <div class="ai-prob">
                <div>AI生成概率: {m['ai_probability']:.1f}%</div>
                <div class="ai-prob-bar">
                    <div class="ai-prob-fill" style="width: {m['ai_probability']}%;"></div>
                </div>
            </div>
            <div style="margin-top: 10px; color: #666; font-size: 12px;">
                检测时间: {m['created_at']}
            </div>
        </div>
        ''' for m in data['materials'][:20])}
    </div>
    
    <div class="section">
        <h2>风险建议</h2>
        <ul>
            {''.join(f'<li>{r}</li>' for r in data['recommendations'])}
        </ul>
    </div>
    
    <div class="footer">
        <p>一鉴到底 | yijiandaodi.com</p>
    </div>
</body>
</html>'''
    
    def _render_account_asset_html(self, data):
        """渲染账号资产报告HTML"""
        
        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>账号资产报告 - 一鉴到底</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .header h1 {{ color: #722ED1; margin-bottom: 10px; }}
        .score-circle {{ width: 200px; height: 200px; border-radius: 50%; background: linear-gradient(135deg, #722ED1, #165DFF); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }}
        .score-value {{ color: white; font-size: 48px; font-weight: bold; }}
        .score-label {{ text-align: center; color: #666; }}
        .achievements {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }}
        .achievement {{ background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }}
        .achievement .icon {{ font-size: 32px; }}
        .achievement .name {{ font-weight: bold; margin: 10px 0 5px; }}
        .achievement .desc {{ color: #666; font-size: 12px; }}
        .footer {{ text-align: center; margin-top: 60px; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>💎 账号资产报告</h1>
        <div class="subtitle">一鉴到底 AI内容安全检测平台</div>
        <div class="subtitle">生成时间: {data['generated_at']}</div>
    </div>
    
    <div class="section">
        <h2>安全评分</h2>
        <div class="score-circle">
            <div class="score-value">{data['asset']['safety_points']}</div>
        </div>
        <div class="score-label">安全积分 | 信任评分: {data['asset']['trust_score']:.1f}</div>
    </div>
    
    <div class="section">
        <h2>资产统计</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="value">{data['asset']['total_checks']}</div>
                <div class="label">检测总数</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['asset']['total_evidences']}</div>
                <div class="label">存证数量</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['asset']['evidence_chain_length']}</div>
                <div class="label">证据链长度</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>检测分布</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="value">{data['asset']['text_checks']}</div>
                <div class="label">文本检测</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['asset']['image_checks']}</div>
                <div class="label">图片检测</div>
            </div>
            <div class="stat-card">
                <div class="value">{data['asset']['marketing_checks']}</div>
                <div class="label">营销文案</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>成就徽章</h2>
        <div class="achievements">
            {''.join(f'''
            <div class="achievement">
                <div class="icon">{a['icon']}</div>
                <div class="name">{a['name']}</div>
                <div class="desc">{a['desc']}</div>
            </div>
            ''' for a in data['achievements']) if data['achievements'] else '<p>暂无成就</p>'}
        </div>
    </div>
    
    <div class="section">
        <h2>建议</h2>
        <ul>
            {''.join(f'<li>{r}</li>' for r in data['recommendations']) if data['recommendations'] else '<li>继续保持良好使用习惯</li>'}
        </ul>
    </div>
    
    <div class="footer">
        <p>一鉴到底 | yijiandaodi.com</p>
    </div>
</body>
</html>'''
    
    def _render_full_report_html(self, data):
        """渲染综合报告HTML"""
        
        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>综合报告 - 一鉴到底</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 40px; padding: 40px; background: linear-gradient(135deg, #165DFF, #722ED1); color: white; border-radius: 12px; }}
        .header h1 {{ margin-bottom: 10px; }}
        .section {{ margin-bottom: 50px; padding: 30px; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }}
        .section h2 {{ color: #165DFF; border-bottom: 2px solid #165DFF; padding-bottom: 15px; margin-top: 0; }}
        .footer {{ text-align: center; margin-top: 60px; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 综合报告</h1>
        <div>创作时间线 + 素材风险 + 账号资产</div>
        <div style="margin-top: 20px;">用户: {data['user_info']['username']}</div>
        <div>生成时间: {data['generated_at']}</div>
    </div>
    
    <div class="section">
        <h2>一、创作时间线</h2>
        <p>总事件数: {data['timeline']['statistics']['total_events']}</p>
        <p>检测次数: {data['timeline']['statistics']['content_detects']}</p>
    </div>
    
    <div class="section">
        <h2>二、素材风险</h2>
        <p>素材总数: {data['material_risk']['risk_statistics']['total_materials']}</p>
        <p>平均AI生成概率: {data['material_risk']['risk_statistics']['avg_ai_probability']:.1f}%</p>
    </div>
    
    <div class="section">
        <h2>三、账号资产</h2>
        <p>安全积分: {data['account_asset']['asset']['safety_points']}</p>
        <p>信任评分: {data['account_asset']['asset']['trust_score']:.1f}</p>
    </div>
    
    <div class="footer">
        <p>一鉴到底 | yijiandaodi.com</p>
        <p>本报告由系统自动生成，仅供内部参考使用</p>
    </div>
</body>
</html>'''