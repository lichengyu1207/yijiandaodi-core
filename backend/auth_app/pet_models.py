"""
桌宠交互记录模型和API
"""

from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class PetInteractionLog(models.Model):
    """桌宠交互记录"""

    INTERACTION_TYPES = [
        ('click', '点击'),
        ('drag', '拖拽'),
        ('voice', '语音'),
        ('gesture', '手势'),
        ('emotion', '情感'),
        ('command', '命令')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pet_interactions')
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPES)
    interaction_data = models.JSONField(default=dict, help_text='交互详细数据')
    pet_state_before = models.CharField(max_length=20, help_text='交互前桌宠状态')
    pet_state_after = models.CharField(max_length=20, help_text='交互后桌宠状态')
    duration_ms = models.IntegerField(help_text='交互持续时间(毫秒)')
    created_at = models.DateTimeField(auto_now_add=True)
    synced = models.BooleanField(default=False, help_text='是否已同步到云端')

    class Meta:
        db_table = 'pet_interaction_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['interaction_type']),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.interaction_type} - {self.created_at}'