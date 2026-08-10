# 日志清理脚本CI/CD集成指南

## 一、集成概述

将日志清理脚本集成到项目的CI/CD流程中，每次构建后自动检查日志状态。

---

## 二、CI/CD配置文件

### 2.1 GitHub Actions配置

**文件位置**：[.github/workflows/backend-ci.yml](file:///c:/MsSafeData/Desktop/yijiandaodi/.github/workflows/backend-ci.yml)

**核心步骤**：
```yaml
- name: Check log files status
  run: |
    cd backend
    python cleanup_logs.py --auto
```

---

### 2.2 工作流程

```
代码提交 → CI触发 → 安装依赖 → 运行测试 → 检查日志状态 → 上传报告
```

---

## 三、清理脚本使用方法

### 3.1 交互模式（本地开发）

**基本用法**：
```bash
cd backend
python cleanup_logs.py
```

**输出示例**：
```log
================================================================================
日志文件检查报告
================================================================================

【hippocampus.log】
  当前文件: hippocampus.log
  大小: 0.00 MB
  ✅ 大小正常

【performance.log】
  当前文件: performance.log
  大小: 0.00 MB
  ✅ 大小正常

================================================================================
总日志文件大小: 0.50 MB
文件总数: 4
发现问题: 0

✅ 所有日志文件符合策略要求
================================================================================
```

---

### 3.2 自动模式（CI/CD环境）

**检查日志状态**：
```bash
python cleanup_logs.py --auto
```

**退出码说明**：
- `0`: 所有日志文件正常
- `1`: 发现问题（需关注）
- `2`: 清理失败（错误）

**输出格式**：JSON
```json
{
  "timestamp": "2026-08-10T14:50:00",
  "total_size_mb": 0.5,
  "total_files": 4,
  "issues": [],
  "log_groups": {
    "hippocampus.log": {
      "current_file": {
        "name": "hippocampus.log",
        "size_mb": 0.00
      },
      "issues": []
    }
  }
}
```

---

### 3.3 自动清理模式

**发现问题自动清理**：
```bash
python cleanup_logs.py --auto --clean
```

**说明**：
- 只清理备份数量超限的问题
- 超过大小限制的文件等待自动轮转
- 清理成功返回退出码0

---

## 四、CI/CD集成示例

### 4.1 GitHub Actions

**完整配置**：
```yaml
name: Backend CI/CD

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-ci.yml'

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        cd backend
        python -m pip install --upgrade pip
        pip install -r requirements.txt

    - name: Run tests
      run: |
        cd backend
        pytest

    - name: Check log files status
      run: |
        cd backend
        python cleanup_logs.py --auto

    - name: Upload log check report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: log-check-report
        path: backend/log_check_report.json
```

---

### 4.2 GitLab CI

**.gitlab-ci.yml示例**：
```yaml
stages:
  - test
  - log-check

log_check:
  stage: log-check
  script:
    - cd backend
    - python cleanup_logs.py --auto
  artifacts:
    paths:
      - backend/log_check_report.json
    expire_in: 1 week
  only:
    - main
    - develop
```

---

### 4.3 Jenkins Pipeline

**Jenkinsfile示例**：
```groovy
pipeline {
    agent any

    stages {
        stage('Test') {
            steps {
                sh 'cd backend && pytest'
            }
        }

        stage('Log Check') {
            steps {
                sh 'cd backend && python cleanup_logs.py --auto'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'backend/log_check_report.json', fingerprint: true
                }
            }
        }
    }

    post {
        failure {
            echo 'Log check failed! Please review the report.'
        }
    }
}
```

---

## 五、报告文件说明

### 5.1 JSON报告结构

```json
{
  "timestamp": "ISO8601时间戳",
  "log_dir": "日志目录路径",
  "total_size": "总字节数",
  "total_size_mb": "总MB数",
  "total_files": "文件总数",
  "backup_files": "备份文件数",
  "issues": [
    {
      "type": "问题类型",
      "file": "文件名",
      "size_mb": "文件大小",
      "severity": "严重程度"
    }
  ],
  "log_groups": {
    "日志文件名": {
      "policy": {
        "max_size_mb": "最大大小",
        "backup_count": "备份数量限制"
      },
      "current_file": {
        "name": "文件名",
        "size_mb": "大小"
      },
      "backup_files": [
        {
          "name": "备份文件名",
          "size_mb": "大小"
        }
      ],
      "issues": []
    }
  }
}
```

---

### 5.2 问题类型说明

| 问题类型 | 严重程度 | 说明 | 处理方式 |
|---------|---------|------|----------|
| `size_exceeded` | warning | 当前文件超过大小限制 | 等待自动轮转 |
| `backup_count_exceeded` | error | 备份文件数量超限 | 手动/自动清理 |
| `backup_size_exceeded` | warning | 备份文件超过大小限制 | 等待自动轮转 |

---

## 六、监控与告警

### 6.1 CI/CD失败处理

**场景1：退出码1（发现问题）**

**处理步骤**：
1. 查看CI日志，确认问题类型
2. 下载log_check_report.json查看详情
3. 本地运行清理脚本：`python cleanup_logs.py`
4. 或者让CI自动清理：`python cleanup_logs.py --auto --clean`

---

**场景2：退出码2（清理失败）**

**处理步骤**：
1. 检查文件权限
2. 检查磁盘空间
3. 手动清理备份文件
4. 重新运行CI

---

### 6.2 定期检查

**建议频率**：
- 每次构建后自动检查（CI/CD）
- 每周手动检查一次（预防）

**手动检查命令**：
```bash
cd backend
python cleanup_logs.py
```

---

## 七、最佳实践

### 7.1 日志轮转配置

**确保配置正确**（settings.py）：
```python
LOGGING = {
    'handlers': {
        'hippocampus_file': {
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 10,
        }
    }
}
```

---

### 7.2 CI/CD集成建议

1. **测试阶段后检查**：确保测试后日志正常
2. **上传报告**：便于后续分析
3. **失败时告警**：及时通知开发团队
4. **自动清理**：减少人工干预

---

### 7.3 预防措施

1. **定期检查**：每周运行一次检查脚本
2. **磁盘监控**：设置磁盘空间告警（<20%）
3. **日志级别优化**：生产环境使用INFO级别
4. **备份策略**：定期备份重要日志文件

---

## 八、故障排查

### 8.1 CI失败常见原因

**原因1：日志文件过大**
```log
"issues": [
  {
    "type": "size_exceeded",
    "file": "hippocampus.log",
    "size_mb": 12.5
  }
]
```

**解决方法**：
- 等待自动轮转（达到maxBytes时自动轮转）
- 或手动触发轮转（重启应用）

---

**原因2：备份文件过多**
```log
"issues": [
  {
    "type": "backup_count_exceeded",
    "log_name": "hippocampus.log",
    "current_count": 15,
    "max_count": 10
  }
]
```

**解决方法**：
- CI自动清理：`python cleanup_logs.py --auto --clean`
- 或手动清理：`python cleanup_logs.py` → 输入y

---

### 8.2 清理失败

**错误：Permission denied**

**解决方法**：
```bash
# 检查文件权限
ls -la logs/

# 修改权限
chmod 644 logs/*.log*
```

---

**错误：Disk quota exceeded**

**解决方法**：
```bash
# 检查磁盘空间
df -h

# 清理其他文件
rm -rf logs/*.log.*
```

---

## 九、总结

✅ **CI/CD集成完成**：
- 每次构建后自动检查日志状态
- 生成JSON格式报告便于分析
- 支持自动清理模式
- 失败时自动告警

**推荐工作流**：
```
开发提交代码 → CI自动运行测试 → CI检查日志状态 → 上传报告 → （失败则告警）
```

**相关文件**：
- CI配置：[backend-ci.yml](file:///c:/MsSafeData/Desktop/yijiandaodi/.github/workflows/backend-ci.yml)
- 清理脚本：[cleanup_logs.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/cleanup_logs.py)
- 配置文档：[LOG_ROTATION_CONFIG.md](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/LOG_ROTATION_CONFIG.md)