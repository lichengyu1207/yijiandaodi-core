# -*- coding: utf-8 -*-
# P1-1 统计一期：APIKeyUsageLog 增加 region 维度字段
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('auth_app', '0058_userproviderkey'),
    ]

    operations = [
        migrations.AddField(
            model_name='apikeyusagelog',
            name='region',
            field=models.CharField('区域', max_length=10,
                                   choices=[('cn', '中国大陆'), ('us', '北美'),
                                            ('eu', '欧洲'), ('all', '其他/全局')],
                                   default='all', db_index=True),
        ),
    ]
