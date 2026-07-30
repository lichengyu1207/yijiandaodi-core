"""
一鉴到底 SDK - Python 版本
用于在 AI Agent 中集成安全校验能力
"""

import requests
from typing import Dict, Optional
import json


class YiJianDaoDiSDK:
    """
    一鉴到底 Python SDK
    
    用法示例:
        sdk = YiJianDaoDiSDK()
        
        # AI Agent 执行前校验
        result = sdk.verify(
            operation="git push origin main",
            context="Cursor AI 准备推送代码到生产环境",
            agent="Cursor AI"
        )
        
        if result['should_block']:
            print(f"操作被拦截: {result['explanation']}")
        else:
            print("操作已放行")
    """
    
    def __init__(self, api_url: str = "http://localhost:9090"):
        """
        初始化 SDK
        
        Args:
            api_url: 一鉴到底 API 地址，默认为 localhost:9090
        """
        self.api_url = api_url
        self.verify_endpoint = f"{api_url}/verify"
        self.health_endpoint = f"{api_url}/health"
    
    def verify(
        self,
        operation: str,
        context: str = "",
        agent: str = "Unknown AI Agent",
        user_id: str = "default"
    ) -> Dict:
        """
        校验操作是否安全
        
        Args:
            operation: 操作内容，如 "git push origin main"
            context: 上下文描述
            agent: AI Agent 名称
            user_id: 用户标识
            
        Returns:
            dict: 校验结果
                - risk_level: 风险等级 (low/medium/high/critical)
                - risk_score: 风险分数 (0-100)
                - should_block: 是否应拦截
                - explanation: 风险解释
                - recommendation: 建议
                - audit_hash: 审计哈希
        """
        payload = {
            "operation": operation,
            "context": context,
            "agent": agent,
            "user_id": user_id
        }
        
        try:
            response = requests.post(
                self.verify_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "risk_level": "unknown",
                "should_block": False
            }
    
    def check_health(self) -> bool:
        """检查 API 服务是否健康"""
        try:
            response = requests.get(self.health_endpoint, timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def before_execute(self, operation: str, context: str = "", agent: str = "") -> bool:
        """
        执行前钩子，用于 AI Agent 集成
        
        Args:
            operation: 操作内容
            context: 上下文
            agent: AI Agent 名称
            
        Returns:
            bool: True 表示可以执行，False 表示应拦截
        """
        result = self.verify(operation, context, agent)
        
        if result.get("success") and result.get("should_block"):
            print(f"\n⚠️  一鉴到底巡检提醒")
            print(f"操作: {operation}")
            print(f"风险等级: {result.get('risk_level', 'unknown')}")
            print(f"原因: {result.get('explanation', '未知')}")
            print(f"建议: {result.get('recommendation', '无')}")
            return False
        
        return True


# 便捷函数
def verify_operation(operation: str, context: str = "", agent: str = "") -> Dict:
    """
    快捷校验函数
    
    用法:
        result = verify_operation("git push", "推送到生产环境")
        if result['should_block']:
            # 拦截操作
            pass
    """
    sdk = YiJianDaoDiSDK()
    return sdk.verify(operation, context, agent)


# 装饰器版本
def secure_execution(agent: str = "AI Agent"):
    """
    安全执行装饰器
    
    用法:
        @secure_execution(agent="Cursor AI")
        def push_code():
            # 执行 git push
            pass
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            sdk = YiJianDaoDiSDK()
            operation = func.__name__
            
            result = sdk.verify(operation, "", agent)
            if result.get("should_block"):
                print(f"操作被拦截: {result['explanation']}")
                return None
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


if __name__ == "__main__":
    # 示例用法
    print("一鉴到底 SDK 示例\n")
    
    sdk = YiJianDaoDiSDK()
    
    # 检查服务状态
    print(f"API 服务状态: {'运行中' if sdk.check_health() else '未启动'}\n")
    
    # 示例 1: 正常操作
    print("示例 1: 正常操作")
    result = sdk.verify(
        operation="npm install",
        context="安装依赖包",
        agent="Cursor AI"
    )
    print(f"结果: {result.get('risk_level')} - {result.get('explanation')}\n")
    
    # 示例 2: 高风险操作
    print("示例 2: 高风险操作")
    result = sdk.verify(
        operation="git push origin main",
        context="推送代码到生产环境，包含数据库配置修改",
        agent="Cursor AI"
    )
    print(f"结果: {result.get('risk_level')} - {result.get('explanation')}")
    print(f"建议: {result.get('recommendation')}")
    print(f"审计哈希: {result.get('audit_hash')}")