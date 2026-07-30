"""权限控制系统 - 最小权限原则+实时审计+Agent Registry"""

from django.db import models
from django.conf import settings
from datetime import datetime
from typing import Dict, List, Tuple


class PermissionControlAuditLog(models.Model):
    """权限控制审计日志"""
    agent_code = models.CharField(max_length=50, db_index=True)
    operation = models.CharField(max_length=100)
    resource = models.CharField(max_length=200)
    allowed = models.BooleanField(default=False)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'permission_control_audit_log'


class AgentRegistry(models.Model):
    """Agent注册表"""
    agent_code = models.CharField(max_length=50, unique=True, db_index=True)
    agent_name = models.CharField(max_length=100)
    permissions = models.JSONField(default=list)
    minimal_permissions = models.JSONField(default=list)
    excessive_permissions = models.JSONField(default=list)
    status = models.CharField(max_length=20, default='minimal')
    registered_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    
    class Meta:
        db_table = 'agent_registry'


class PermissionViolation(models.Model):
    """权限违规记录"""
    agent_code = models.CharField(max_length=50, db_index=True)
    violation_type = models.CharField(max_length=50)
    operation = models.CharField(max_length=100)
    resource = models.CharField(max_length=200)
    severity = models.CharField(max_length=20, default='high')
    detected_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'permission_violation'


class PermissionController:
    """权限控制器"""
    
    minimal_permissions = {
        'auditor': ['read:content', 'read:policy'],
        'verifier': ['read:content', 'write:report'],
        'archiver': ['read:content', 'write:archive'],
        'judge': ['read:content', 'write:decision']
    }
    
    def check_permission(self, agent_code: str, operation: str) -> Tuple[bool, str]:
        """检查权限"""
        allowed = self.minimal_permissions.get(agent_code, [])
        if operation in allowed:
            return True, '权限符合最小权限原则'
        return False, f'权限过度授予: {operation}超出{agent_code}所需权限'
    
    def audit_access(self, agent_code: str, operation: str, resource: str) -> Dict:
        """审计访问"""
        allowed, message = self.check_permission(agent_code, operation)
        
        PermissionControlAuditLog.objects.create(
            agent_code=agent_code,
            operation=operation,
            resource=resource,
            allowed=allowed,
            message=message
        )
        
        if not allowed:
            PermissionViolation.objects.create(
                agent_code=agent_code,
                violation_type='excessive_permission',
                operation=operation,
                resource=resource
            )
        
        return {'allowed': allowed, 'message': message}
    
    def register_agent(self, agent_code: str, permissions: List[str]) -> Dict:
        """注册Agent"""
        minimal = self.minimal_permissions.get(agent_code, [])
        excessive = [p for p in permissions if p not in minimal]
        
        registry = AgentRegistry.objects.create(
            agent_code=agent_code,
            agent_name=agent_code,
            permissions=permissions,
            minimal_permissions=minimal,
            excessive_permissions=excessive,
            status='excessive' if excessive else 'minimal'
        )
        
        return {
            'agent_code': agent_code,
            'status': registry.status,
            'excessive_count': len(excessive)
        }
    
    def detect_shadow_ai(self) -> List[Dict]:
        """检测Shadow AI"""
        registered = AgentRegistry.objects.values_list('agent_code', flat=True)
        shadow = []
        
        for agent in ['auditor', 'verifier', 'archiver', 'judge']:
            if agent not in registered:
                shadow.append({'agent_code': agent, 'status': 'shadow_ai'})
        
        return shadow


permission_controller = PermissionController()