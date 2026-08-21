#!/usr/bin/env python
"""
一鉴到底 - 审计报告生成器
支持导出 JSON、HTML 格式的审计报告
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ReportConfig:
    """报告配置"""
    report_id: str
    title: str = "一鉴到底 AI 行为审计报告"
    issuer: str = "一鉴到底 AI 行为审计系统"
    version: str = "1.0.0"


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, config: ReportConfig = None):
        self.config = config or ReportConfig(
            report_id=datetime.now().strftime('%Y%m%d%H%M%S')
        )
    
    def generate_json_report(self, records: List[Dict], chain_status: Dict) -> Dict:
        """生成 JSON 格式报告"""
        
        report = {
            'report_id': self.config.report_id,
            'generated_at': datetime.now().isoformat(),
            'issuer': self.config.issuer,
            'version': self.config.version,
            'chain_status': {
                'valid': chain_status['valid'],
                'total_records': chain_status['total_records'],
                'last_hash': chain_status['last_hash']
            },
            'summary': self._generate_summary(records),
            'records': records,
            'legal_notice': {
                'disclaimer': '本报告由一鉴到底 AI 行为审计系统自动生成，仅供参考，不构成最终安全结论。',
                'copyright': '© 2026 一鉴到底 版权所有',
                'contact': '湖南省湘潭市'
            }
        }
        
        return report
    
    def generate_html_report(self, records: List[Dict], chain_status: Dict) -> str:
        """生成 HTML 格式报告"""
        
        summary = self._generate_summary(records)
        
        html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{self.config.title}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            line-height: 1.6;
            padding: 40px;
        }}
        
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
            padding: 40px;
            color: white;
        }}
        
        .header h1 {{
            font-size: 28px;
            margin-bottom: 16px;
        }}
        
        .header-meta {{
            font-size: 14px;
            opacity: 0.9;
        }}
        
        .content {{
            padding: 40px;
        }}
        
        .section {{
            margin-bottom: 32px;
        }}
        
        .section-title {{
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #238636;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        
        .summary-card {{
            background: #21262d;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        
        .summary-value {{
            font-size: 32px;
            font-weight: 700;
            color: #58a6ff;
        }}
        
        .summary-label {{
            font-size: 12px;
            color: #8b949e;
            margin-top: 4px;
        }}
        
        .chain-status {{
            background: {('#0e4429' if chain_status['valid'] else '#490202')};
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
        }}
        
        .chain-status.valid {{
            background: #0e4429;
            border: 1px solid #238636;
        }}
        
        .chain-status.invalid {{
            background: #490202;
            border: 1px solid #f85149;
        }}
        
        .records-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .records-table th {{
            background: #21262d;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: #8b949e;
            border-bottom: 1px solid #30363d;
        }}
        
        .records-table td {{
            padding: 12px;
            border-bottom: 1px solid #30363d;
            font-size: 13px;
        }}
        
        .risk-badge {{
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }}
        
        .risk-critical {{
            background: #f8514920;
            color: #f85149;
        }}
        
        .risk-high {{
            background: #d2992220;
            color: #d29922;
        }}
        
        .risk-medium {{
            background: #89550220;
            color: #895502;
        }}
        
        .risk-low {{
            background: #23863620;
            color: #3fb950;
        }}
        
        .hash {{
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 11px;
            color: #8b949e;
        }}
        
        .footer {{
            background: #21262d;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #8b949e;
        }}
        
        .footer a {{
            color: #58a6ff;
            text-decoration: none;
        }}
        
        @media print {{
            body {{
                background: white;
                color: black;
            }}
            
            .container {{
                border: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{self.config.title}</h1>
            <div class="header-meta">
                <div>报告编号: {self.config.report_id}</div>
                <div>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
                <div>签发机构: {self.config.issuer}</div>
            </div>
        </div>
        
        <div class="content">
            <!-- 链状态 -->
            <div class="section">
                <div class="section-title">区块链状态</div>
                <div class="chain-status {'valid' if chain_status['valid'] else 'invalid'}">
                    <strong>哈希链完整性: {'✓ 有效' if chain_status['valid'] else '✗ 无效'}</strong><br>
                    <span>总记录数: {chain_status['total_records']}</span><br>
                    <span>最后哈希: <code class="hash">{chain_status['last_hash']}</code></span>
                </div>
            </div>
            
            <!-- 统计摘要 -->
            <div class="section">
                <div class="section-title">统计摘要</div>
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="summary-value">{summary['total_records']}</div>
                        <div class="summary-label">总审计记录</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">{summary['by_decision'].get('block', 0)}</div>
                        <div class="summary-label">已拦截</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">{summary['by_decision'].get('allow', 0)}</div>
                        <div class="summary-label">已放行</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">{len(summary['by_agent'])}</div>
                        <div class="summary-label">监控 Agent</div>
                    </div>
                </div>
            </div>
            
            <!-- 审计记录 -->
            <div class="section">
                <div class="section-title">审计记录</div>
                <table class="records-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>时间</th>
                            <th>Agent</th>
                            <th>操作</th>
                            <th>风险</th>
                            <th>决策</th>
                            <th>审计哈希</th>
                        </tr>
                    </thead>
                    <tbody>
                        {self._generate_records_html(records)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            <div>本报告由一鉴到底 AI 行为审计系统自动生成，仅供参考，不构成最终安全结论。</div>
            <div style="margin-top: 8px;">
                © 2026 一鉴到底 版权所有 | 
                <a href="https://yijiandaodi.com">yijiandaodi.com</a> |
                湖南省湘潭市
            </div>
            <div style="margin-top: 8px;">
                湘ICP备2025151710号-3 | 
                <a href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431">湘公网安备43030402000431号</a>
            </div>
        </div>
    </div>
</body>
</html>'''
        
        return html
    
    def _generate_summary(self, records: List[Dict]) -> Dict:
        """生成统计摘要"""
        summary = {
            'total_records': len(records),
            'by_risk_level': {},
            'by_agent': {},
            'by_decision': {}
        }
        
        for record in records:
            level = record.get('risk_level', 'unknown')
            summary['by_risk_level'][level] = summary['by_risk_level'].get(level, 0) + 1
            
            agent = record.get('agent_name', 'unknown')
            summary['by_agent'][agent] = summary['by_agent'].get(agent, 0) + 1
            
            decision = record.get('decision', 'unknown')
            summary['by_decision'][decision] = summary['by_decision'].get(decision, 0) + 1
        
        return summary
    
    def _generate_records_html(self, records: List[Dict]) -> str:
        """生成记录表格 HTML"""
        rows = []
        
        for i, record in enumerate(records, 1):
            risk_class = f"risk-{record.get('risk_level', 'low')}"
            
            row = f'''<tr>
                <td>{i}</td>
                <td>{record.get('timestamp', '')[:19]}</td>
                <td>{record.get('agent_name', '')}</td>
                <td>{record.get('operation_content', '')[:50]}...</td>
                <td><span class="risk-badge {risk_class}">{record.get('risk_level', '')}</span></td>
                <td>{record.get('decision', '')}</td>
                <td><code class="hash">{record.get('record_hash', '')[:16]}...</code></td>
            </tr>'''
            
            rows.append(row)
        
        return '\n'.join(rows)
    
    def save_report(self, report: Dict, filepath: str, format: str = 'json'):
        """保存报告到文件"""
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        if format == 'json':
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        
        elif format == 'html':
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(report)
        
        return filepath


def test_report_generator():
    """测试报告生成器"""
    print("\n" + "="*60)
    print("   报告生成器测试")
    print("="*60)
    
    from hashchain_evidence import HashChainEvidence
    
    chain = HashChainEvidence('data/test_report_chain.db')
    
    for i in range(3):
        chain.add_record({
            'timestamp': datetime.now().isoformat(),
            'agent_name': ['Trae CN', 'Cursor', 'Copilot'][i],
            'operation_type': 'code_generate',
            'operation_content': f'生成代码 #{i+1}',
            'risk_level': ['critical', 'high', 'low'][i],
            'risk_score': [90, 70, 10][i],
            'risk_tags': [['硬编码密钥'], ['敏感文件'], []][i],
            'decision': ['block', 'ask_user', 'allow'][i]
        })
    
    records = chain.get_all_records()
    chain_status = chain.verify_chain()
    
    generator = ReportGenerator()
    
    print("\n[生成 JSON 报告]")
    json_report = generator.generate_json_report(records, chain_status)
    json_path = generator.save_report(json_report, 'data/report.json', 'json')
    print(f"   ✓ 已保存: {json_path}")
    
    print("\n[生成 HTML 报告]")
    html_report = generator.generate_html_report(records, chain_status)
    html_path = generator.save_report(html_report, 'data/report.html', 'html')
    print(f"   ✓ 已保存: {html_path}")
    
    print("\n" + "="*60)


if __name__ == '__main__':
    test_report_generator()