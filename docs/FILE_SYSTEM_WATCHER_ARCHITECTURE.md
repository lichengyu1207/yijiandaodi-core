# 文件系统监控功能架构设计

## 需求分析

### 业务背景
漫剧用户的操作起点是"内容生产"，终点是"分发上架"。中间有大量操作在本地文件系统上完成。需要监控文件系统以保障桌面端安全能力。

### 核心需求
1. **监控指定目录的文件变动**：创建、修改、重命名、删除
2. **文件变动时触发校验流水线**：自动调用四官协同校验
3. **计算文件哈希并存储**：检测非预期变动
4. **高风险文件操作弹窗确认**：二次确认机制

### 解决的问题
- 用户在生产内容时是否被植入恶意代码？
- 用户的素材文件是否被篡改？
- 用户的操作链路是否完整可追溯？

## 系统架构

### 整体架构图
```
┌─────────────────────────────────────────────────────────────┐
│                        桌面端                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           文件系统监控模块 (FileWatcher)              │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Windows: ReadDirectoryChangesW                │  │   │
│  │  │  Mac: FSEvents                                 │  │   │
│  │  │  Linux: inotify                                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  文件变动事件处理器                              │  │   │
│  │  │  - 过滤器（忽略临时文件、系统文件）              │  │   │
│  │  │  - 哈希计算器                                   │  │   │
│  │  │  - 校验触发器                                   │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  高风险操作弹窗                                  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
                      HTTP API调用
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        后端服务                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  文件监控API                                          │   │
│  │  - POST /api/v1/file-watch/config/                   │   │
│  │  - GET /api/v1/file-watch/logs/                      │   │
│  │  - POST /api/v1/file-watch/verify/                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  四官协同校验系统                                      │   │
│  │  - 身份官：验证用户身份                               │   │
│  │  - 风险官：评估文件风险                               │   │
│  │  - 验证官：二次确认                                   │   │
│  │  - 决策官：最终决策                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        数据库                                 │
│  - file_watch_configs (监控配置)                             │
│  - file_operation_logs (操作日志)                            │
│  - file_hash_records (哈希记录)                              │
│  - file_risk_assessments (风险评估)                          │
└─────────────────────────────────────────────────────────────┘
```

## 数据库模型设计

### 1. FileWatchConfig (文件监控配置)

```python
class FileWatchConfig(models.Model):
    """
    文件监控配置
    
    用户可以配置需要监控的目录和监控规则
    """
    
    # 基本信息
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='file_watch_configs',
        verbose_name='所属用户'
    )
    
    watch_path = models.CharField(
        max_length=500,
        verbose_name='监控路径',
        help_text='绝对路径，如：C:\\漫剧\\素材'
    )
    
    watch_name = models.CharField(
        max_length=100,
        verbose_name='监控名称',
        help_text='用户自定义名称，如："素材目录"'
    )
    
    # 监控选项
    watch_create = models.BooleanField(
        default=True,
        verbose_name='监控文件创建'
    )
    
    watch_modify = models.BooleanField(
        default=True,
        verbose_name='监控文件修改'
    )
    
    watch_rename = models.BooleanField(
        default=True,
        verbose_name='监控文件重命名'
    )
    
    watch_delete = models.BooleanField(
        default=True,
        verbose_name='监控文件删除'
    )
    
    # 文件类型过滤
    file_extensions = models.JSONField(
        default=list,
        verbose_name='监控的文件扩展名',
        help_text='如：["jpg", "png", "mp4", "py", "js"]，空列表表示监控所有文件'
    )
    
    exclude_patterns = models.JSONField(
        default=list,
        verbose_name='排除模式',
        help_text='如：["*.tmp", "*.temp", "~*"]'
    )
    
    # 校验配置
    auto_verify = models.BooleanField(
        default=True,
        verbose_name='自动触发校验',
        help_text='文件变动时自动触发四官协同校验'
    )
    
    risk_threshold = models.CharField(
        max_length=20,
        choices=[
            ('low', '低风险'),
            ('medium', '中风险'),
            ('high', '高风险')
        ],
        default='medium',
        verbose_name='风险阈值',
        help_text='超过此风险等级时弹窗确认'
    )
    
    # 状态
    is_active = models.BooleanField(
        default=True,
        verbose_name='是否启用'
    )
    
    # 统计信息
    total_files = models.IntegerField(
        default=0,
        verbose_name='监控文件总数'
    )
    
    last_check_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后检查时间'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'file_watch_configs'
        ordering = ['-created_at']
        verbose_name = '文件监控配置'
        verbose_name_plural = '文件监控配置管理'
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['watch_path']),
        ]
```

### 2. FileOperationLog (文件操作日志)

```python
class FileOperationLog(models.Model):
    """
    文件操作日志
    
    记录所有文件变动事件的详细信息
    """
    
    OPERATION_TYPES = [
        ('create', '文件创建'),
        ('modify', '文件修改'),
        ('rename', '文件重命名'),
        ('delete', '文件删除'),
    ]
    
    RISK_LEVELS = [
        ('safe', '安全'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ]
    
    # 基本信息
    config = models.ForeignKey(
        FileWatchConfig,
        on_delete=models.CASCADE,
        related_name='operation_logs',
        verbose_name='监控配置'
    )
    
    # 文件信息
    file_path = models.CharField(
        max_length=1000,
        verbose_name='文件路径',
        help_text='文件的完整路径'
    )
    
    file_name = models.CharField(
        max_length=255,
        verbose_name='文件名'
    )
    
    file_extension = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='文件扩展名'
    )
    
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='文件大小(字节)'
    )
    
    # 操作信息
    operation_type = models.CharField(
        max_length=20,
        choices=OPERATION_TYPES,
        verbose_name='操作类型'
    )
    
    old_path = models.CharField(
        max_length=1000,
        blank=True,
        verbose_name='原路径',
        help_text='重命名操作时的原路径'
    )
    
    # 哈希信息
    file_hash = models.CharField(
        max_length=64,
        blank=True,
        verbose_name='文件哈希',
        help_text='SHA-256哈希值'
    )
    
    previous_hash = models.CharField(
        max_length=64,
        blank=True,
        verbose_name='前次哈希',
        help_text='用于检测非预期变动'
    )
    
    hash_changed = models.BooleanField(
        default=False,
        verbose_name='哈希是否改变',
        help_text='用于标识文件内容是否发生变化'
    )
    
    # 风险评估
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVELS,
        default='safe',
        verbose_name='风险等级'
    )
    
    risk_score = models.FloatField(
        default=0.0,
        verbose_name='风险分数'
    )
    
    risk_tags = models.JSONField(
        default=list,
        verbose_name='风险标签',
        help_text='如：["executable_file", "script_file"]'
    )
    
    # 校验结果
    verification_triggered = models.BooleanField(
        default=False,
        verbose_name='是否触发校验'
    )
    
    verification_result = models.JSONField(
        default=dict,
        verbose_name='校验结果',
        help_text='四官协同校验的详细结果'
    )
    
    # 用户确认
    user_confirmed = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='用户确认',
        help_text='高风险操作时的用户确认结果'
    )
    
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='确认时间'
    )
    
    confirmation_note = models.TextField(
        blank=True,
        verbose_name='确认备注'
    )
    
    # 时间戳
    operation_time = models.DateTimeField(
        default=timezone.now,
        verbose_name='操作时间',
        help_text='文件变动的实际发生时间'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='记录创建时间')
    
    class Meta:
        db_table = 'file_operation_logs'
        ordering = ['-operation_time']
        verbose_name = '文件操作日志'
        verbose_name_plural = '文件操作日志管理'
        indexes = [
            models.Index(fields=['config', '-operation_time']),
            models.Index(fields=['operation_type']),
            models.Index(fields=['risk_level']),
            models.Index(fields=['file_hash']),
        ]
```

### 3. FileHashRecord (文件哈希记录)

```python
class FileHashRecord(models.Model):
    """
    文件哈希记录
    
    存储文件的哈希历史，用于检测非预期变动
    """
    
    config = models.ForeignKey(
        FileWatchConfig,
        on_delete=models.CASCADE,
        related_name='hash_records',
        verbose_name='监控配置'
    )
    
    file_path = models.CharField(
        max_length=1000,
        verbose_name='文件路径'
    )
    
    file_hash = models.CharField(
        max_length=64,
        verbose_name='文件哈希(SHA-256)'
    )
    
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='文件大小(字节)'
    )
    
    # 版本信息
    version = models.IntegerField(
        default=1,
        verbose_name='版本号',
        help_text='同一文件的哈希更新次数'
    )
    
    # 状态
    is_current = models.BooleanField(
        default=True,
        verbose_name='是否为当前版本',
        help_text='只有最新版本的is_current为True'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'file_hash_records'
        ordering = ['-created_at']
        verbose_name = '文件哈希记录'
        verbose_name_plural = '文件哈希记录管理'
        indexes = [
            models.Index(fields=['file_path', '-created_at']),
            models.Index(fields=['file_hash']),
            models.Index(fields=['is_current']),
        ]
```

### 4. FileRiskAssessment (文件风险评估)

```python
class FileRiskAssessment(models.Model):
    """
    文件风险评估
    
    存储四官协同校验的详细结果
    """
    
    # 关联操作日志
    operation_log = models.OneToOneField(
        FileOperationLog,
        on_delete=models.CASCADE,
        related_name='risk_assessment',
        verbose_name='操作日志'
    )
    
    # 四官协同校验结果
    identity_check = models.JSONField(
        default=dict,
        verbose_name='身份官检查结果',
        help_text='验证用户身份、权限'
    )
    
    risk_check = models.JSONField(
        default=dict,
        verbose_name='风险官检查结果',
        help_text='评估文件风险'
    )
    
    verification_check = models.JSONField(
        default=dict,
        verbose_name='验证官检查结果',
        help_text='二次确认机制'
    )
    
    decision_check = models.JSONField(
        default=dict,
        verbose_name='决策官检查结果',
        help_text='最终决策'
    )
    
    # 综合评估
    overall_score = models.FloatField(
        default=0.0,
        verbose_name='综合评分'
    )
    
    overall_risk_level = models.CharField(
        max_length=20,
        choices=FileOperationLog.RISK_LEVELS,
        default='safe',
        verbose_name='综合风险等级'
    )
    
    # 建议
    recommendations = models.JSONField(
        default=list,
        verbose_name='安全建议',
        help_text='如：["建议隔离文件", "建议重新审核"]'
    )
    
    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'file_risk_assessments'
        ordering = ['-created_at']
        verbose_name = '文件风险评估'
        verbose_name_plural = '文件风险评估管理'
```

## API接口设计

### 1. 监控配置管理

```python
# POST /api/v1/file-watch/configs/
# 创建监控配置

# GET /api/v1/file-watch/configs/
# 获取用户的监控配置列表

# GET /api/v1/file-watch/configs/{id}/
# 获取单个监控配置详情

# PUT /api/v1/file-watch/configs/{id}/
# 更新监控配置

# DELETE /api/v1/file-watch/configs/{id}/
# 删除监控配置

# POST /api/v1/file-watch/configs/{id}/activate/
# 激活监控

# POST /api/v1/file-watch/configs/{id}/deactivate/
# 停止监控
```

### 2. 操作日志查询

```python
# GET /api/v1/file-watch/logs/
# 获取操作日志列表（支持按配置、操作类型、风险等级筛选）

# GET /api/v1/file-watch/logs/{id}/
# 获取单个操作日志详情

# POST /api/v1/file-watch/logs/{id}/confirm/
# 用户确认高风险操作
```

### 3. 文件校验

```python
# POST /api/v1/file-watch/verify/
# 手动触发文件校验

# GET /api/v1/file-watch/hash/{file_path}/
# 获取文件哈希历史
```

## 桌面端实现方案

### 1. 文件监控模块架构

```typescript
// Electron主进程
import { app, BrowserWindow, ipcMain } from 'electron'
import chokidar from 'chokidar'  // 跨平台文件监控库

class FileWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map()
  
  // 启动监控
  startWatch(config: FileWatchConfig) {
    const watcher = chokidar.watch(config.watchPath, {
      ignored: this.parseExcludePatterns(config.exclude_patterns),
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    })
    
    // 监听事件
    watcher.on('add', path => this.handleFileCreate(path, config))
    watcher.on('change', path => this.handleFileModify(path, config))
    watcher.on('unlink', path => this.handleFileDelete(path, config))
    watcher.on('addDir', path => this.handleDirCreate(path, config))
    watcher.on('unlinkDir', path => this.handleDirDelete(path, config))
    
    this.watchers.set(config.id, watcher)
  }
  
  // 文件创建处理
  async handleFileCreate(filePath: string, config: FileWatchConfig) {
    // 1. 计算文件哈希
    const hash = await this.calculateHash(filePath)
    
    // 2. 上传到后端
    await this.uploadOperationLog({
      config_id: config.id,
      file_path: filePath,
      operation_type: 'create',
      file_hash: hash
    })
    
    // 3. 触发校验（如果配置了自动校验）
    if (config.auto_verify) {
      await this.triggerVerification(filePath, hash)
    }
  }
  
  // 计算文件哈希
  async calculateHash(filePath: string): Promise<string> {
    const crypto = require('crypto')
    const fs = require('fs')
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
}
```

### 2. 高风险操作弹窗

```typescript
// 渲染进程
class RiskConfirmDialog {
  async showRiskConfirm(operationLog: FileOperationLog): Promise<boolean> {
    return new Promise((resolve) => {
      // 创建弹窗窗口
      const win = new BrowserWindow({
        width: 600,
        height: 400,
        modal: true,
        parent: BrowserWindow.getFocusedWindow(),
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      })
      
      // 加载确认页面
      win.loadFile('risk-confirm.html')
      
      // 发送风险信息
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('risk-info', {
          file_path: operationLog.file_path,
          operation_type: operationLog.operation_type,
          risk_level: operationLog.risk_level,
          risk_score: operationLog.risk_score,
          risk_tags: operationLog.risk_tags
        })
      })
      
      // 接收用户确认
      ipcMain.once('risk-confirm-response', (event, confirmed: boolean) => {
        resolve(confirmed)
        win.close()
      })
    })
  }
}
```

## 实施计划

### 第一周：后端基础架构
- [ ] Day 1-2: 创建数据模型和数据库迁移
- [ ] Day 3-4: 实现API接口和序列化器
- [ ] Day 5: 编写单元测试

### 第二周：桌面端监控模块
- [ ] Day 1-3: 实现文件监控模块（使用chokidar）
- [ ] Day 4-5: 实现哈希计算和上传逻辑

### 第三周：集成和测试
- [ ] Day 1-3: 集成四官协同校验系统
- [ ] Day 4-5: 实现高风险操作弹窗

### 第四周：优化和部署
- [ ] Day 1-2: 性能优化和压力测试
- [ ] Day 3-4: 编写使用文档
- [ ] Day 5: 部署和上线

## 技术选型

### 桌面端
- **文件监控**：chokidar（跨平台，基于Node.js）
  - Windows: 使用ReadDirectoryChangesW
  - Mac: 使用FSEvents
  - Linux: 使用inotify
- **哈希计算**：Node.js crypto模块（SHA-256）
- **IPC通信**：Electron ipcMain/ipcRenderer

### 后端
- **框架**：Django REST Framework
- **数据库**：SQLite（开发）/ PostgreSQL（生产）
- **任务队列**：Celery（异步校验）
- **缓存**：Redis（哈希缓存）

## 风险和挑战

### 技术风险
1. **性能问题**：监控大量文件可能影响性能
   - 解决方案：使用过滤器、延迟处理、异步队列

2. **跨平台兼容性**：不同操作系统的文件系统差异
   - 解决方案：使用chokidar库，它已经处理了跨平台问题

3. **哈希计算耗时**：大文件哈希计算可能阻塞
   - 解决方案：使用流式计算、异步处理

### 业务风险
1. **用户体验**：频繁弹窗可能影响用户操作
   - 解决方案：智能风险阈值、批量确认

2. **误报**：正常操作被误判为高风险
   - 解决方案：调整风险模型、用户反馈机制

## 成功指标

- ✅ 监控响应时间 < 2秒
- ✅ 哈希计算准确率 100%
- ✅ 风险检测准确率 > 95%
- ✅ 用户满意度 > 90%
- ✅ 系统稳定性 > 99.9%

## 后续优化方向

1. **智能风险模型**：基于历史数据训练AI模型
2. **自动化响应**：高风险文件自动隔离
3. **协作监控**：团队共享监控配置
4. **审计报告**：生成文件操作审计报告