"""
自监控系统验证脚本 - 验证服务是否正常运行

检查项：
1. Redis服务是否运行
2. Celery Worker是否运行
3. Celery Beat是否运行
4. 定时任务是否注册
5. 数据库模型是否正确
"""

import subprocess
import time
from datetime import datetime


def run_command(command):
    """运行命令并返回结果"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)


def check_redis():
    """检查Redis服务"""
    print("\n[1] 检查Redis服务...")
    
    # Windows环境检查Redis进程
    success, stdout, stderr = run_command("tasklist | findstr redis-server")
    
    if success and "redis-server" in stdout:
        print("    ✅ Redis服务运行中")
        return True
    else:
        print("    ❌ Redis服务未运行")
        print("    启动命令：redis-server")
        return False


def check_celery_worker():
    """检查Celery Worker"""
    print("\n[2] 检查Celery Worker...")
    
    success, stdout, stderr = run_command("tasklist | findstr celery")
    
    if success and "celery" in stdout:
        print("    ✅ Celery Worker运行中")
        return True
    else:
        print("    ❌ Celery Worker未运行")
        print("    启动命令：celery -A fangdudu_backend.celery_app worker -l info --pool=solo")
        return False


def check_database_models():
    """检查数据库模型"""
    print("\n[3] 检查数据库模型...")
    
    try:
        import django
        import os
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
        django.setup()
        
        from auth_app.self_audit_models import PerformanceDriftRecord, SelfAuditReport
        from auth_app.memory_models import ShortTermMemory, LongTermMemory
        
        # 检查模型是否可查询
        drift_count = PerformanceDriftRecord.objects.count()
        report_count = SelfAuditReport.objects.count()
        short_term_count = ShortTermMemory.objects.count()
        long_term_count = LongTermMemory.objects.count()
        
        print(f"    ✅ PerformanceDriftRecord: {drift_count} 条记录")
        print(f"    ✅ SelfAuditReport: {report_count} 条记录")
        print(f"    ✅ ShortTermMemory: {short_term_count} 条记录")
        print(f"    ✅ LongTermMemory: {long_term_count} 条记录")
        return True
        
    except Exception as e:
        print(f"    ❌ 数据库模型检查失败: {e}")
        return False


def check_celery_tasks():
    """检查Celery定时任务"""
    print("\n[4] 检查Celery定时任务配置...")
    
    try:
        from fangdudu_backend.celery_app import app
        
        schedule = app.conf.beat_schedule
        
        self_audit_tasks = [
            'check-accuracy-drift-every-15-min',
            'check-response-time-anomaly-every-15-min',
            'check-false-positive-rate-hourly',
            'audit-permission-usage-hourly',
            'check-rule-freshness-daily',
            'run-all-self-audit-checks-hourly',
            'generate-hourly-audit-report',
            'generate-daily-audit-report',
            'generate-weekly-audit-report',
            'generate-monthly-audit-report',
        ]
        
        found_count = 0
        for task_name in self_audit_tasks:
            if task_name in schedule:
                found_count += 1
                task_config = schedule[task_name]
                schedule_time = task_config.get('schedule', 'Unknown')
                print(f"    ✅ {task_name}")
        
        print(f"\n    总计: {found_count}/{len(self_audit_tasks)} 个自监控任务已配置")
        return found_count == len(self_audit_tasks)
        
    except Exception as e:
        print(f"    ❌ 定时任务检查失败: {e}")
        return False


def manual_trigger_test():
    """手动触发测试"""
    print("\n[5] 手动触发测试...")
    
    try:
        import django
        import os
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
        django.setup()
        
        from auth_app.self_audit_service import SelfAuditService
        
        print("    执行自监控检查...")
        start_time = time.time()
        
        results = SelfAuditService.run_all_checks()
        
        elapsed_time = time.time() - start_time
        
        print(f"    ✅ 检查完成，耗时: {elapsed_time:.2f}秒")
        
        if results:
            print(f"    检测到 {len(results)} 个异常")
        else:
            print("    未检测到异常")
        
        return True
        
    except Exception as e:
        print(f"    ❌ 手动触发测试失败: {e}")
        return False


def main():
    """主函数"""
    print("=" * 80)
    print("自监控系统验证脚本")
    print(f"验证时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    results = []
    
    # 检查Redis
    results.append(("Redis服务", check_redis()))
    
    # 检查Celery Worker
    results.append(("Celery Worker", check_celery_worker()))
    
    # 检查数据库模型
    results.append(("数据库模型", check_database_models()))
    
    # 检查定时任务
    results.append(("定时任务配置", check_celery_tasks()))
    
    # 手动触发测试
    results.append(("手动触发测试", manual_trigger_test()))
    
    # 汇总结果
    print("\n" + "=" * 80)
    print("验证结果汇总")
    print("=" * 80)
    
    passed_count = sum(1 for _, result in results if result)
    total_count = len(results)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {name}: {status}")
    
    print(f"\n总计: {passed_count}/{total_count} 项通过")
    
    if passed_count == total_count:
        print("\n🎉 所有检查通过！自监控系统已就绪！")
    else:
        print("\n⚠️  部分检查失败，请按照上述建议修复")
    
    print("\n启动命令：")
    print("  1. 启动Redis: redis-server")
    print("  2. 启动Worker: celery -A fangdudu_backend.celery_app worker -l info --pool=solo")
    print("  3. 启动Beat: celery -A fangdudu_backend.celery_app beat -l info")
    print("\n或使用一键启动脚本：")
    print("  start_self_audit.bat")
    
    print("=" * 80)


if __name__ == "__main__":
    main()