# -*- coding: utf-8 -*-
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """自定义用户模型"""
    phone = models.CharField('手机号', max_length=11, unique=True, null=True, blank=True)
    real_name = models.CharField('真实姓名', max_length=50, null=True, blank=True)
    id_card = models.CharField('身份证号后4位', max_length=4, null=True, blank=True)
    is_realname = models.BooleanField('是否实名认证', default=False)
    face_registered = models.BooleanField('是否注册人脸', default=False)
    
    class Meta:
        db_table = 'auth_user'
        verbose_name = '用户'
        verbose_name_plural = '用户'
    
    def __str__(self):
        return self.username