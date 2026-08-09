# 其他任务模块异常处理改进建议

## 📊 检查结果

### ✅ 已修复的任务（auth_app/tasks.py）

| 任务名称 | 状态 | 异常处理 |
|---------|------|----------|
| build_trajectory_async | ✅ 完整 | 结构化日志 + 堆栈追踪 + 错误类型 |
| archive_old_trajectories_async | ✅ 完整 | 结构化日志 + 堆栈追踪 + 错误类型 |
| cleanup_old_activities_task | ✅ 完整 | 结构化日志 + 堆栈追踪 + 错误类型 |

### ❌ 需要修复的任务（auth_app/tasks.py）

| 任务名称 | 状态 | 缺失内容 |
|---------|------|----------|
| check_disk_space_task | ❌ 不完整 | 缺少try-except和堆栈追踪 |
| get_table_sizes_task | ❌ 不完整 | 缺少try-except和堆栈追踪 |

---

## 🔍 详细分析

### **check_disk_space_task**

#### 当前代码（不完整）
```python
@shared_task
def check_disk_space_task() -> dict:
    """异步检查磁盘空间任务"""
    from .data_cleanup_service import DataCleanupService

    db_path = '/data'
    disk_info = DataCleanupService.check_disk_space(db_path)

    return disk_info
```

#### 问题
1. ❌ 没有try-except捕获异常
2. ❌ 没有结构化日志
3. ❌ 没有错误类型记录
4. ❌ 没有堆栈追踪

#### 建议改进
```python
@shared_task
def check_disk_space_task() -> dict:
    """异步检查磁盘空间任务"""
    import time
    import sys
    import traceback
    
    from .data_cleanup_service import DataCleanupService
    
    task_start = time.time()
    
    logger.info("异步磁盘检查任务开始")
    
    try:
        db_path = '/data'
        disk_info = DataCleanupService.check_disk_space(db_path)
        
        task_duration = (time.time() - task_start) * 1000
        
        logger.info(
            "异步磁盘检查任务完成",
            **{
                'free_gb': disk_info.get('free_gb'),
                'used_percent': disk_info.get('used_percent'),
                'duration_ms': round(task_duration, 2),
            }
        )
        
        return {
            'success': True,
            **disk_info,
        }
        
    except Exception as e:
        task_duration = (time.time() - task_start) * 1000
        
        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        
        logger.error(
            "异步磁盘检查任务失败",
            **{
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )
        
        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(f"详细堆栈追踪:\n{traceback_str}")
        
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }
```

---

### **get_table_sizes_task**

#### 当前代码（需要读取完整版本）
```python
@shared_task
def get_table_sizes_task() -> dict:
    """异步获取表数据量任务"""
    # ...（待读取）
```

#### 建议改进
应用相同的异常处理模式：
- ✅ try-except捕获所有异常
- ✅ 结构化JSON日志
- ✅ error_type字段记录错误类型
- ✅ traceback字段记录完整堆栈
- ✅ 单独记录详细堆栈（方便grep）

---

## 📝 统一的异常处理模式

所有Celery任务应遵循以下模式：

```python
@shared_task
def task_name(param: type) -> dict:
    """任务描述"""
    import time
    import sys
    import traceback
    
    task_start = time.time()
    
    logger.info("任务开始", **{'param': param})
    
    try:
        # 执行任务逻辑
        result = do_something(param)
        
        task_duration = (time.time() - task_start) * 1000
        
        logger.info(
            "任务完成",
            **{
                'result_key': result_value,
                'duration_ms': round(task_duration, 2),
            }
        )
        
        return {
            'success': True,
            'result': result,
        }
        
    except Exception as e:
        task_duration = (time.time() - task_start) * 1000
        
        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        
        logger.error(
            "任务失败",
            **{
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )
        
        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(f"详细堆栈追踪:\n{traceback_str}")
        
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }
```

---

## ✅ 关键要素清单

每个Celery任务都应包含：

1. ✅ **导入必要模块**
   ```python
   import time
   import sys
   import traceback
   ```

2. ✅ **任务开始日志**
   ```python
   logger.info("任务开始", **{...})
   ```

3. ✅ **try-except捕获异常**
   ```python
   try:
       # 执行任务
   except Exception as e:
       # 异常处理
   ```

4. ✅ **获取堆栈追踪**
   ```python
   exc_type, exc_value, exc_traceback = sys.exc_info()
   traceback_str = ''.join(traceback.format_exception(...))
   ```

5. ✅ **结构化错误日志**
   ```python
   logger.error(
       "任务失败",
       **{
           'error': str(e),
           'error_type': type(e).__name__,
           'traceback': traceback_str,
       }
   )
   ```

6. ✅ **单独记录堆栈**
   ```python
   logger.error(f"详细堆栈追踪:\n{traceback_str}")
   ```

7. ✅ **返回错误信息**
   ```python
   return {
       'success': False,
       'error': str(e),
       'error_type': type(e).__name__,
       'traceback': traceback_str,
   }
   ```

---

## 🎯 下一步行动

1. **修复check_disk_space_task**
   - 添加完整的异常处理逻辑
   - 应用统一的模式

2. **修复get_table_sizes_task**
   - 读取完整代码
   - 应用相同的改进

3. **运行测试验证**
   - 创建单元测试覆盖新逻辑
   - 验证堆栈追踪输出

---

**检查完成：发现2个任务需要应用相同的异常处理逻辑改进。**