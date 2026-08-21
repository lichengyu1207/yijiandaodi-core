#!/usr/bin/env python
"""
一鉴到底 - 增强版代码安全检测引擎
提供 AI 代码特征检测、多种安全漏洞与敏感数据泄露检测
"""

import re
import json
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class CodeSecurityRule:
    """代码安全规则"""
    name: str
    pattern: str
    risk_score: int
    category: str
    description: str
    ai_related: bool = False  # 是否与AI相关


class EnhancedCodeSecurityAnalyzer:
    """增强版代码安全分析器"""

    # AI生成代码特征模式
    AI_CODE_PATTERNS = [
        CodeSecurityRule(
            name='AI生成代码-未验证',
            pattern=r'# (?:TODO|FIXME|NOTE|HACK|XXX):|// (?:TODO|FIXME|NOTE|HACK|XXX):',
            risk_score=20,
            category='ai_code',
            description='AI生成的代码可能存在未验证的逻辑',
            ai_related=True
        ),
        CodeSecurityRule(
            name='AI生成代码-示例代码',
            pattern=r'(?:example|sample|demo|test)\.(?:py|js|ts|java|go)',
            risk_score=30,
            category='ai_code',
            description='AI可能生成示例代码，不适合生产环境',
            ai_related=True
        ),
        CodeSecurityRule(
            name='AI生成代码-占位符',
            pattern=r'(?:INSERT|UPDATE|DELETE|CREATE|DROP)\s+(?:INTO|TABLE|DATABASE)\s+your_table',
            risk_score=40,
            category='ai_code',
            description='AI生成的SQL语句包含占位符表名',
            ai_related=True
        ),
    ]

    # 更多安全漏洞模式
    SECURITY_VULNERABILITY_PATTERNS = [
        # SSRF (服务端请求伪造)
        CodeSecurityRule(
            name='SSRF-用户输入URL',
            pattern=r'requests\.(?:get|post|put|delete)\s*\(\s*(?:request\.|user_input|input\(|input\()',
            risk_score=90,
            category='ssrf',
            description='用户输入直接用于URL请求，存在SSRF风险'
        ),
        CodeSecurityRule(
            name='SSRF-动态URL构建',
            pattern=r'base_url\s*\+\s*(?:request\.|user_input|input)',
            risk_score=85,
            category='ssrf',
            description='动态构建URL可能存在SSRF风险'
        ),

        # XXE (XML外部实体注入)
        CodeSecurityRule(
            name='XXE-不安全XML解析',
            pattern=r'xml\.etree\.ElementTree\.parse\s*\(|lxml\.etree\.parse\s*\(',
            risk_score=80,
            category='xxe',
            description='XML解析可能存在XXE风险'
        ),
        CodeSecurityRule(
            name='XXE-用户输入XML',
            pattern=r'fromstring\s*\(\s*(?:request\.|user_input|input)',
            risk_score=90,
            category='xxe',
            description='用户输入直接用于XML解析，存在XXE风险'
        ),

        # 反序列化漏洞
        CodeSecurityRule(
            name='反序列化-pickle',
            pattern=r'pickle\.loads?\s*\(|pickle\.load\s*\(',
            risk_score=95,
            category='deserialization',
            description='pickle反序列化可能导致代码执行'
        ),
        CodeSecurityRule(
            name='反序列化-yaml',
            pattern=r'yaml\.load\s*\([^)]*\)(?!.*Loader\s*=)',
            risk_score=90,
            category='deserialization',
            description='不安全的yaml.load可能导致代码执行'
        ),
        CodeSecurityRule(
            name='反序列化-marshal',
            pattern=r'marshal\.loads?\s*\(',
            risk_score=95,
            category='deserialization',
            description='marshal反序列化可能导致代码执行'
        ),

        # 原型链污染 (JavaScript)
        CodeSecurityRule(
            name='原型链污染-merge',
            pattern=r'Object\.assign\s*\([^)]*(?:request\.|user_input|input)',
            risk_score=85,
            category='prototype_pollution',
            description='Object.assign可能导致原型链污染'
        ),
        CodeSecurityRule(
            name='原型链污染-递归merge',
            pattern=r'__proto__|constructor\.prototype',
            risk_score=95,
            category='prototype_pollution',
            description='直接操作原型链，存在原型链污染风险'
        ),

        # 代码注入
        CodeSecurityRule(
            name='代码注入-eval',
            pattern=r'(?:eval|Function|new Function)\s*\(\s*(?:request\.|user_input|input)',
            risk_score=100,
            category='code_injection',
            description='用户输入直接用于eval，存在代码注入风险'
        ),
        CodeSecurityRule(
            name='代码注入-模板字符串',
            pattern=r'f["\'][^"\']*{(?:request\.|user_input|input)',
            risk_score=70,
            category='code_injection',
            description='模板字符串可能存在代码注入风险'
        ),

        # 敏感数据泄露
        CodeSecurityRule(
            name='敏感数据-日志记录',
            pattern=r'print\s*\([^)]*(?:password|token|secret|key|credential)',
            risk_score=80,
            category='data_leak',
            description='敏感数据可能被记录到日志'
        ),
        CodeSecurityRule(
            name='敏感数据-返回响应',
            pattern=r'return\s+[^;]*(?:password|token|secret|key)',
            risk_score=85,
            category='data_leak',
            description='敏感数据可能被返回给客户端'
        ),
        CodeSecurityRule(
            name='敏感数据-SQL查询',
            pattern=r'SELECT\s+\*\s+FROM\s+(?:users|accounts|credentials)',
            risk_score=70,
            category='data_leak',
            description='查询敏感表可能泄露用户数据'
        ),

        # 权限绕过
        CodeSecurityRule(
            name='权限绕过-硬编码',
            pattern=r'if\s+\w+\s*==\s*["\'](?:admin|root|superuser)["\']',
            risk_score=75,
            category='auth_bypass',
            description='硬编码权限检查可能被绕过'
        ),
        CodeSecurityRule(
            name='权限绕过-逻辑缺陷',
            pattern=r'if\s+not\s+(?:authenticated|logged_in|authorized)',
            risk_score=60,
            category='auth_bypass',
            description='权限检查逻辑可能存在缺陷'
        ),
    ]

    # AI Agent特有风险
    AI_AGENT_PATTERNS = [
        CodeSecurityRule(
            name='AI Agent-无限循环',
            pattern=r'while\s+True:|while\s+\(true\)|while\s+\(1\)',
            risk_score=50,
            category='ai_agent',
            description='AI Agent可能生成无限循环代码',
            ai_related=True
        ),
        CodeSecurityRule(
            name='AI Agent-资源消耗',
            pattern=r'for\s+\w+\s+in\s+range\s*\(\s*10{6,}\s*\)',
            risk_score=70,
            category='ai_agent',
            description='AI Agent可能生成资源消耗型代码',
            ai_related=True
        ),
        CodeSecurityRule(
            name='AI Agent-未捕获异常',
            pattern=r'(?:exec|eval)\s*\([^)]*\)(?!.*try\s*:)',
            risk_score=80,
            category='ai_agent',
            description='AI Agent生成的代码可能缺少异常处理',
            ai_related=True
        ),
        CodeSecurityRule(
            name='AI Agent-自动执行',
            pattern=r'subprocess\.(?:call|run)\s*\([^)]*shell\s*=\s*True',
            risk_score=95,
            category='ai_agent',
            description='AI Agent可能自动执行危险命令',
            ai_related=True
        ),
    ]

    def __init__(self):
        """初始化"""
        self.all_patterns = (
            self.AI_CODE_PATTERNS +
            self.SECURITY_VULNERABILITY_PATTERNS +
            self.AI_AGENT_PATTERNS
        )

    def analyze(self, code: str, file_path: str = '') -> Dict:
        """
        分析代码安全性

        Args:
            code: 代码内容
            file_path: 文件路径

        Returns:
            分析结果
        """
        risks = []
        risk_score = 0
        categories = set()
        ai_related_risks = []

        for rule in self.all_patterns:
            if re.search(rule.pattern, code, re.IGNORECASE | re.MULTILINE):
                risks.append(rule.name)
                risk_score = max(risk_score, rule.risk_score)
                categories.add(rule.category)

                if rule.ai_related:
                    ai_related_risks.append(rule.name)

        if risk_score >= 80:
            risk_level = 'critical'
            decision = 'block'
        elif risk_score >= 50:
            risk_level = 'high'
            decision = 'ask_user'
        elif risk_score >= 30:
            risk_level = 'medium'
            decision = 'ask_user'
        else:
            risk_level = 'low'
            decision = 'allow'

        return {
            'risks': risks,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'decision': decision,
            'categories': list(categories),
            'ai_related_risks': ai_related_risks,
            'total_patterns': len(self.all_patterns),
            'ai_patterns': len([r for r in self.all_patterns if r.ai_related]),
            'security_patterns': len([r for r in self.all_patterns if not r.ai_related]),
        }

    def get_enhanced_report(self, code: str, file_path: str = '') -> Dict:
        """
        生成增强版报告

        Args:
            code: 代码内容
            file_path: 文件路径

        Returns:
            详细报告
        """
        analysis = self.analyze(code, file_path)

        report = {
            'summary': {
                'file_path': file_path,
                'risk_level': analysis['risk_level'],
                'risk_score': analysis['risk_score'],
                'decision': analysis['decision'],
                'total_risks': len(analysis['risks']),
                'ai_related_risks': len(analysis['ai_related_risks']),
            },
            'details': {
                'risks': analysis['risks'],
                'categories': analysis['categories'],
                'ai_related_risks': analysis['ai_related_risks'],
            },
            'statistics': {
                'total_patterns_checked': analysis['total_patterns'],
                'ai_patterns_checked': analysis['ai_patterns'],
                'security_patterns_checked': analysis['security_patterns'],
            },
            'recommendations': self._generate_recommendations(analysis),
        }

        return report

    def _generate_recommendations(self, analysis: Dict) -> List[str]:
        """生成修复建议"""
        recommendations = []

        if 'ai_code' in analysis['categories']:
            recommendations.append('【AI代码】建议验证AI生成的代码，确保符合生产环境标准')

        if 'ssrf' in analysis['categories']:
            recommendations.append('【SSRF】建议对用户输入的URL进行白名单验证，限制访问内部资源')

        if 'xxe' in analysis['categories']:
            recommendations.append('【XXE】建议禁用外部实体解析，使用安全的XML解析器')

        if 'deserialization' in analysis['categories']:
            recommendations.append('【反序列化】建议避免使用pickle、yaml.load等不安全的反序列化方法')

        if 'prototype_pollution' in analysis['categories']:
            recommendations.append('【原型链污染】建议使用Object.create(null)或安全的merge方法')

        if 'code_injection' in analysis['categories']:
            recommendations.append('【代码注入】建议避免使用eval、Function等动态代码执行，使用安全的替代方案')

        if 'data_leak' in analysis['categories']:
            recommendations.append('【数据泄露】建议敏感数据脱敏处理，避免记录到日志或返回给客户端')

        if 'auth_bypass' in analysis['categories']:
            recommendations.append('【权限绕过】建议使用标准权限验证框架，避免硬编码权限检查')

        if analysis['ai_related_risks']:
            recommendations.append('【AI Agent】建议对AI生成的代码进行额外审查，重点关注资源消耗和异常处理')

        return recommendations


enhanced_code_analyzer = EnhancedCodeSecurityAnalyzer()


def analyze_code_enhanced(code: str, file_path: str = '') -> Dict:
    """
    分析代码安全性（增强版）

    Args:
        code: 代码内容
        file_path: 文件路径

    Returns:
        分析结果
    """
    return enhanced_code_analyzer.analyze(code, file_path)


def generate_security_report(code: str, file_path: str = '') -> Dict:
    """
    生成代码安全报告

    Args:
        code: 代码内容
        file_path: 文件路径

    Returns:
        详细报告
    """
    return enhanced_code_analyzer.get_enhanced_report(code, file_path)


if __name__ == '__main__':
    test_code = '''
import requests
import pickle
import yaml

# AI生成的代码 - 用户输入直接用于URL请求
response = requests.get(user_input)

# 不安全的反序列化
data = pickle.loads(user_data)

# XXE风险
import xml.etree.ElementTree as ET
tree = ET.parse(user_xml_file)

# 硬编码密钥
API_KEY = "sk-1234567890abcdef"
'''

    report = generate_security_report(test_code, 'test.py')
    print(json.dumps(report, ensure_ascii=False, indent=2))