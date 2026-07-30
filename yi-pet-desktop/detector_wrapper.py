#!/usr/bin/env python
"""
一鉴到底桌宠 - 本地检测引擎包装器

功能：
1. 提供简洁的API接口
2. 集成realtime_interceptor和enhanced_code_security
3. 支持文件监听
4. 输出JSON格式结果
"""

import sys
import json
import time
import argparse
from pathlib import Path

# 导入检测引擎
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from realtime_interceptor import analyze_file_operation, analyze_code_content
    from enhanced_code_security import analyze_code_enhanced, generate_security_report
except ImportError as e:
    print(f"导入检测引擎失败: {e}", file=sys.stderr)
    sys.exit(1)

class PetDetector:
    """桌宠检测器"""

    def __init__(self, mode='realtime'):
        """
        初始化检测器

        Args:
            mode: 检测模式 (realtime/enhanced)
        """
        self.mode = mode
        self.stats = {
            'total_checks': 0,
            'risks_found': 0,
            'files_checked': 0
        }

    def analyze_file(self, file_path, content=None):
        """
        分析文件安全性

        Args:
            file_path: 文件路径
            content: 文件内容（可选）

        Returns:
            dict: 分析结果
        """
        self.stats['total_checks'] += 1
        self.stats['files_checked'] += 1

        try:
            # 读取文件内容
            if content is None:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

            # 根据模式选择检测引擎
            if self.mode == 'enhanced':
                result = analyze_code_enhanced(content, file_path)
            else:
                # 使用实时检测器
                file_result = analyze_file_operation(file_path, 'write')
                code_result = analyze_code_content(content)

                # 合并结果
                risks = list(set(file_result.get('risks', []) + code_result.get('risks', [])))
                risk_score = max(file_result.get('risk_score', 0), code_result.get('risk_score', 0))

                result = {
                    'file_path': file_path,
                    'risks': risks,
                    'risk_score': risk_score,
                    'risk_level': self._calculate_risk_level(risk_score),
                    'decision': self._get_decision(risk_score),
                    'timestamp': time.time()
                }

            # 统计风险数量
            if result.get('risk_score', 0) > 50:
                self.stats['risks_found'] += 1

            return result

        except Exception as e:
            return {
                'error': str(e),
                'file_path': file_path,
                'risk_level': 'unknown',
                'risk_score': 0
            }

    def analyze_text(self, text, context=''):
        """
        分析文本内容安全性

        Args:
            text: 文本内容
            context: 上下文信息

        Returns:
            dict: 分析结果
        """
        self.stats['total_checks'] += 1

        try:
            if self.mode == 'enhanced':
                result = analyze_code_enhanced(text, context)
            else:
                code_result = analyze_code_content(text)

                result = {
                    'context': context,
                    'risks': code_result.get('risks', []),
                    'risk_score': code_result.get('risk_score', 0),
                    'risk_level': self._calculate_risk_level(code_result.get('risk_score', 0)),
                    'decision': self._get_decision(code_result.get('risk_score', 0)),
                    'timestamp': time.time()
                }

            if result.get('risk_score', 0) > 50:
                self.stats['risks_found'] += 1

            return result

        except Exception as e:
            return {
                'error': str(e),
                'risk_level': 'unknown',
                'risk_score': 0
            }

    def get_stats(self):
        """获取统计信息"""
        return self.stats

    def _calculate_risk_level(self, risk_score):
        """计算风险等级"""
        if risk_score >= 80:
            return 'critical'
        elif risk_score >= 60:
            return 'high'
        elif risk_score >= 40:
            return 'medium'
        elif risk_score >= 20:
            return 'low'
        else:
            return 'safe'

    def _get_decision(self, risk_score):
        """获取决策"""
        if risk_score >= 80:
            return 'block'
        elif risk_score >= 50:
            return 'ask_user'
        else:
            return 'allow'

def output_json(data):
    """输出JSON格式结果"""
    print(json.dumps(data, ensure_ascii=False))

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='一鉴到底桌宠 - 本地检测引擎')
    parser.add_argument('--mode', choices=['realtime', 'enhanced'], default='realtime',
                       help='检测模式')
    parser.add_argument('--file', help='分析指定文件')
    parser.add_argument('--text', help='分析文本内容')
    parser.add_argument('--stdin', action='store_true', help='从标准输入读取')
    parser.add_argument('--watch', action='store_true', help='监控模式（持续检测）')
    parser.add_argument('--stats', action='store_true', help='显示统计信息')

    args = parser.parse_args()

    # 创建检测器
    detector = PetDetector(mode=args.mode)

    # 处理不同输入
    if args.file:
        # 分析文件
        result = detector.analyze_file(args.file)
        output_json(result)

    elif args.text:
        # 分析文本
        result = detector.analyze_text(args.text)
        output_json(result)

    elif args.stdin:
        # 从标准输入读取
        for line in sys.stdin:
            line = line.strip()
            if line:
                result = detector.analyze_text(line)
                output_json(result)

    elif args.watch:
        # 监控模式
        output_json({'status': 'watching', 'mode': args.mode})

        try:
            while True:
                # 等待输入（可以从Electron接收命令）
                line = sys.stdin.readline()
                if not line:
                    break

                command = json.loads(line.strip())

                if command.get('action') == 'analyze':
                    result = detector.analyze_text(command.get('text', ''), command.get('context', ''))
                    output_json(result)

                elif command.get('action') == 'analyze_file':
                    result = detector.analyze_file(command.get('file_path'))
                    output_json(result)

                elif command.get('action') == 'get_stats':
                    output_json(detector.get_stats())

        except KeyboardInterrupt:
            output_json({'status': 'stopped'})

    elif args.stats:
        # 显示统计信息
        output_json(detector.get_stats())

    else:
        # 默认：显示帮助
        parser.print_help()

if __name__ == '__main__':
    main()