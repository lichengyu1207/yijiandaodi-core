"""
Git操作模拟器
模拟Git操作流程，测试泄露检测和版本控制

功能：
1. 初始化Git仓库
2. 模拟提交操作
3. 模拟分支操作
4. 模拟远程推送
5. 模拟冲突解决
"""

import os
import subprocess
import json
from datetime import datetime
from pathlib import Path


class GitSimulator:
    def __init__(self, repo_path="."):
        self.repo_path = Path(repo_path)
        self.logs = []
        
    def log(self, action, success, message=""):
        """记录操作日志"""
        entry = {
            "action": action,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self.logs.append(entry)
        status = "✅" if success else "❌"
        print(f"{status} {action}: {message}")
        
    def run_command(self, command, check=True):
        """执行命令"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=check
            )
            return True, result.stdout.strip()
        except subprocess.CalledProcessError as e:
            return False, e.stderr.strip()
    
    def init_repo(self):
        """初始化仓库"""
        print("\n=== 1. 初始化Git仓库 ===")
        
        # 检查是否已初始化
        git_dir = self.repo_path / ".git"
        if git_dir.exists():
            self.log("初始化仓库", True, "仓库已存在，跳过初始化")
            return True
        
        # 初始化
        success, output = self.run_command("git init")
        if success:
            self.log("初始化仓库", True, "Git仓库初始化成功")
        else:
            self.log("初始化仓库", False, f"初始化失败: {output}")
        return success
    
    def config_user(self):
        """配置用户信息"""
        print("\n=== 2. 配置Git用户信息 ===")
        
        # 配置用户名
        success1, _ = self.run_command('git config user.name "Test User"', check=False)
        
        # 配置邮箱
        success2, _ = self.run_command('git config user.email "test@example.com"', check=False)
        
        if success1 and success2:
            self.log("配置用户", True, "Git用户信息配置成功")
            return True
        else:
            self.log("配置用户", False, "配置失败")
            return False
    
    def create_test_file(self):
        """创建测试文件"""
        print("\n=== 3. 创建测试文件 ===")
        
        # 创建普通文件
        test_file = self.repo_path / "test.txt"
        test_file.write_text("This is a test file\nCreated at: " + datetime.now().isoformat())
        self.log("创建文件", True, f"创建测试文件: {test_file}")
        
        # 创建敏感文件（模拟泄露）
        sensitive_file = self.repo_path / "config.env"
        sensitive_file.write_text("""# 测试配置文件
API_KEY=sk-test-1234567890abcdef
DATABASE_URL=postgres://user:password@localhost:5432/mydb
SECRET_KEY=django-insecure-test-key-123456
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
""")
        self.log("创建敏感文件", True, f"创建敏感文件: {sensitive_file}")
        
        return True
    
    def add_files(self):
        """添加文件到暂存区"""
        print("\n=== 4. 添加文件到暂存区 ===")
        
        success, output = self.run_command("git add .")
        if success:
            self.log("添加文件", True, "所有文件已添加到暂存区")
        else:
            self.log("添加文件", False, f"添加失败: {output}")
        return success
    
    def commit_changes(self, message="Initial commit"):
        """提交更改"""
        print(f"\n=== 5. 提交更改: {message} ===")
        
        success, output = self.run_command(f'git commit -m "{message}"')
        if success:
            self.log("提交", True, f"提交成功: {message}")
        else:
            self.log("提交", False, f"提交失败: {output}")
        return success
    
    def check_status(self):
        """检查仓库状态"""
        print("\n=== 6. 检查仓库状态 ===")
        
        success, output = self.run_command("git status")
        if success:
            self.log("状态检查", True, f"仓库状态:\n{output}")
        else:
            self.log("状态检查", False, f"检查失败: {output}")
        return success
    
    def view_log(self):
        """查看提交历史"""
        print("\n=== 7. 查看提交历史 ===")
        
        success, output = self.run_command("git log --oneline -5")
        if success:
            self.log("查看历史", True, f"提交历史:\n{output}")
        else:
            self.log("查看历史", False, f"查看失败: {output}")
        return success
    
    def create_branch(self, branch_name="test-branch"):
        """创建分支"""
        print(f"\n=== 8. 创建分支: {branch_name} ===")
        
        success, output = self.run_command(f"git branch {branch_name}")
        if success:
            self.log("创建分支", True, f"分支 {branch_name} 创建成功")
        else:
            self.log("创建分支", False, f"创建失败: {output}")
        return success
    
    def switch_branch(self, branch_name="test-branch"):
        """切换分支"""
        print(f"\n=== 9. 切换到分支: {branch_name} ===")
        
        success, output = self.run_command(f"git checkout {branch_name}")
        if success:
            self.log("切换分支", True, f"已切换到分支 {branch_name}")
        else:
            self.log("切换分支", False, f"切换失败: {output}")
        return success
    
    def simulate_remote(self):
        """模拟远程操作"""
        print("\n=== 10. 模拟远程推送 ===")
        
        # 添加远程仓库（模拟）
        success1, output1 = self.run_command(
            'git remote add origin https://github.com/test/test.git',
            check=False
        )
        
        if success1 or "already exists" in output1:
            self.log("添加远程", True, "远程仓库已配置")
        else:
            self.log("添加远程", False, f"添加失败: {output1}")
            return False
        
        # 模拟推送（不实际推送，只检查命令）
        self.log("模拟推送", True, "已准备推送（跳过实际推送）")
        return True
    
    def run_all_simulations(self):
        """运行所有模拟"""
        print("\n" + "="*50)
        print("Git操作模拟器")
        print("="*50)
        print(f"仓库路径: {self.repo_path.absolute()}")
        
        results = []
        
        # 执行模拟
        results.append(("初始化仓库", self.init_repo()))
        results.append(("配置用户", self.config_user()))
        results.append(("创建文件", self.create_test_file()))
        results.append(("添加文件", self.add_files()))
        results.append(("提交更改", self.commit_changes("Initial commit: 测试提交")))
        results.append(("检查状态", self.check_status()))
        results.append(("查看历史", self.view_log()))
        results.append(("创建分支", self.create_branch("test-branch")))
        results.append(("切换分支", self.switch_branch("test-branch")))
        results.append(("模拟远程", self.simulate_remote()))
        
        # 统计结果
        print("\n" + "="*50)
        print("模拟结果汇总")
        print("="*50)
        
        passed = sum(1 for _, success in results if success)
        total = len(results)
        
        for step, success in results:
            status = "✅ 成功" if success else "❌ 失败"
            print(f"{status} - {step}")
        
        print(f"\n总计: {passed}/{total} 通过")
        
        return {
            "passed": passed,
            "total": total,
            "success_rate": f"{(passed/total*100):.1f}%",
            "logs": self.logs
        }


if __name__ == "__main__":
    print("一鉴到底 - Git操作模拟器")
    print("="*50)
    
    simulator = GitSimulator(".")
    result = simulator.run_all_simulations()
    
    print("\n模拟完成！")
    
    # 保存结果
    with open("git_simulation_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"详细结果已保存到 git_simulation_result.json")
    print("\n提示：可以使用泄露检测工具扫描敏感文件")
    print("运行：python tools/git_leak_detector.py .")