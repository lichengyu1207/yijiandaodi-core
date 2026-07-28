"""
Git源码泄露检测工具
- 扫描暂存文件中的敏感信息
- 扫描提交历史中的敏感信息
- 生成泄露风险报告
"""

import os
import re
import json
import git
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any


class GitLeakDetector:
    """Git源码泄露检测器"""

    SENSITIVE_PATTERNS = {
        'api_key': [
            r'api[_-]?key[_-]?.*?[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?',
            r'API_KEY\s*=\s*["\']([^"\']+)["\']'
        ],
        'password': [
            r'password[_-]?[:=]\s*["\']([^"\']+)["\']',
            r'PASSWORD\s*=\s*["\']([^"\']+)["\']'
        ],
        'secret': [
            r'secret[_-]?[:=]\s*["\']([^"\']+)["\']',
            r'SECRET_KEY\s*=\s*["\']([^"\']+)["\']'
        ],
        'private_key': [
            r'-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----',
            r'private[_-]?key[_-]?[:=]\s*["\']([^"\']+)["\']'
        ],
        'database_url': [
            r'(?:mysql|postgres|mongodb)://[^:]+:([^@]+)@',
        ],
        'aws_access_key': [
            r'AKIA[0-9A-Z]{16}'
        ],
        'jwt_token': [
            r'eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*'
        ]
    }

    IGNORE_PATTERNS = [
        r'\.env\.example',
        r'readme\.md',
        r'\.gitignore',
        r'package-lock\.json',
        r'venv/',
        r'node_modules/',
        r'\.pyc$'
    ]

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        try:
            self.repo = git.Repo(repo_path)
        except git.InvalidGitRepositoryError:
            raise ValueError(f"Not a git repository: {repo_path}")

        self.leaks = []

    def scan_staged_files(self) -> List[Dict[str, Any]]:
        """扫描暂存文件"""
        leaks = []

        # 获取暂存文件列表
        try:
            staged_files = [item.a_path for item in self.repo.index.diff(None)]
        except Exception:
            staged_files = []

        for file_path in staged_files:
            full_path = self.repo_path / file_path

            if not full_path.exists():
                continue

            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # 检测敏感信息
                file_leaks = self.detect_sensitive_info(content, file_path)
                leaks.extend(file_leaks)
            except Exception as e:
                print(f'Error reading file {file_path}: {e}')

        return leaks

    def scan_commit_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """扫描提交历史"""
        leaks = []

        # 获取最近N次提交
        commits = list(self.repo.iter_commits())[:limit]

        for commit in commits:
            # 获取提交的文件变更
            try:
                diff = commit.diff(commit.parents[0] if commit.parents else None)

                for diff_item in diff:
                    file_path = diff_item.a_path

                    try:
                        content = diff_item.a_blob.data_stream.read().decode('utf-8', errors='ignore')

                        # 检测敏感信息
                        commit_leaks = self.detect_sensitive_info(content, file_path)

                        commit_leaks = [
                            {
                                **leak,
                                'commit': commit.hexsha,
                                'commit_message': commit.message.strip(),
                                'author': commit.author.name,
                                'date': commit.committed_datetime.isoformat()
                            }
                            for leak in commit_leaks
                        ]

                        leaks.extend(commit_leaks)
                    except Exception:
                        pass
            except Exception:
                pass

        return leaks

    def detect_sensitive_info(self, content: str, file_path: str) -> List[Dict[str, Any]]:
        """检测敏感信息"""
        leaks = []

        # 检查是否在忽略列表中
        for pattern in self.IGNORE_PATTERNS:
            if re.search(pattern, file_path, re.IGNORECASE):
                return leaks

        # 检测各类敏感信息
        for leak_type, patterns in self.SENSITIVE_PATTERNS.items():
            for pattern in patterns:
                try:
                    matches = re.finditer(pattern, content, re.IGNORECASE)

                    for match in matches:
                        leak = {
                            'type': leak_type,
                            'file': file_path,
                            'line_number': content[:match.start()].count('\n') + 1,
                            'match': self.mask_sensitive_data(match.group(0)),
                            'risk_level': self.get_risk_level(leak_type)
                        }

                        leaks.append(leak)
                except Exception:
                    pass

        return leaks

    def mask_sensitive_data(self, data: str) -> str:
        """掩码敏感数据"""
        if len(data) > 20:
            return data[:10] + '***' + data[-10:]
        return data[:5] + '***' if len(data) > 5 else '***'

    def get_risk_level(self, leak_type: str) -> str:
        """获取风险等级"""
        high_risk = ['private_key', 'password', 'secret', 'aws_access_key']
        medium_risk = ['api_key', 'database_url', 'jwt_token']

        if leak_type in high_risk:
            return 'HIGH'
        elif leak_type in medium_risk:
            return 'MEDIUM'
        else:
            return 'LOW'

    def generate_report(self, leaks: List[Dict[str, Any]], output_file: str = None):
        """生成泄露报告"""
        report = {
            'scan_time': datetime.now().isoformat(),
            'repo_path': str(self.repo_path),
            'total_leaks': len(leaks),
            'by_risk_level': {
                'HIGH': len([l for l in leaks if l['risk_level'] == 'HIGH']),
                'MEDIUM': len([l for l in leaks if l['risk_level'] == 'MEDIUM']),
                'LOW': len([l for l in leaks if l['risk_level'] == 'LOW'])
            },
            'by_type': {},
            'leaks': leaks[:100]  # 只显示前100个
        }

        # 按类型统计
        for leak in leaks:
            leak_type = leak['type']
            if leak_type not in report['by_type']:
                report['by_type'][leak_type] = 0
            report['by_type'][leak_type] += 1

        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)

        return report

    def scan_all(self, output_file: str = 'git_leak_report.json') -> Dict[str, Any]:
        """扫描所有"""
        print('扫描暂存文件...')
        staged_leaks = self.scan_staged_files()

        print('扫描提交历史（最近100次提交）...')
        history_leaks = self.scan_commit_history()

        all_leaks = staged_leaks + history_leaks

        report = self.generate_report(all_leaks, output_file)

        return report


if __name__ == '__main__':
    import sys

    repo_path = sys.argv[1] if len(sys.argv) > 1 else '.'

    try:
        detector = GitLeakDetector(repo_path)
        report = detector.scan_all()

        print(f"\n扫描完成:")
        print(f"  总计泄露: {report['total_leaks']}")
        print(f"  高风险: {report['by_risk_level']['HIGH']}")
        print(f"  中风险: {report['by_risk_level']['MEDIUM']}")
        print(f"  低风险: {report['by_risk_level']['LOW']}")

        if report['total_leaks'] > 0:
            print("\n详细信息请查看: git_leak_report.json")
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)