# -*- coding: utf-8 -*-
import random

a = random.choice(["系统", "应用", "中间件", "数据库"])
b = random.choice(["安全配置不当", "默认账户未修改", "不必要的端口和服务", "缺少安全补丁"])
issue2_desc=f'{a}层面存在{b}问题。'
print(issue2_desc)
print("OK")
