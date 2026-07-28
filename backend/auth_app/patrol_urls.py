"""
常态化巡检 API - 核心入口
整合 Grok 分析能力，提供操作风险检测
集成本地分析引擎和不可变审计
"""
import json
import hashlib
import os
import requests
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

# 本地存储路径
DATA_DIR = os.path.join(os.path.dirname(__file__), '../../data/patrol')
OPERATIONS_FILE = os.path.join(DATA_DIR, 'operations.json')
REPORTS_FILE = os.path.join(DATA_DIR, 'reports.json')

# 导入本地分析引擎和不可变审计
try:
    from .local_engine import LocalAnalysisEngine, AnalysisMode
    from .immutable_audit import ImmutableAuditLog
    HAS_LOCAL_ENGINE = True
except ImportError:
    HAS_LOCAL_ENGINE = False

# 全局审计日志实例
_audit_log = None


def get_audit_log():
    """获取审计日志实例"""
    global _audit_log
    if _audit_log is None and HAS_LOCAL_ENGINE:
        _audit_log = ImmutableAuditLog()
    return _audit_log


def get_deepseek_config():
    """获取 DeepSeek API 配置"""
    return {
        'endpoint': os.environ.get('DEEPSEEK_ENDPOINT', 'https://api.deepseek.com'),
        'api_key': os.environ.get('DEEPSEEK_API_KEY', '')
    }


def analyze_with_grok(operation: dict) -> dict:
    """
    使用 Grok (DeepSeek) 分析操作风险
    优先使用本地分析引擎
    返回: { risk_level, analysis, recommendation, mode }
    """
    # 1. 尝试使用本地分析引擎
    if HAS_LOCAL_ENGINE:
        try:
            import asyncio
            
            config = get_deepseek_config()
            engine = LocalAnalysisEngine(
                ollama_url="http://localhost:11434",
                deepseek_url=config['endpoint'],
                deepseek_key=config['api_key'],
                prefer_local=True
            )
            
            # 运行异步分析
            loop = asyncio.new_event_loop()
            result = loop.run_until_complete(
                engine.analyze(operation.get('content', ''))
            )
            loop.close()
            
            return {
                'risk_level': result.risk_level,
                'analysis': result.analysis,
                'recommendation': result.recommendation,
                'mode': result.mode.value,
                'confidence': result.confidence
            }
        except Exception as e:
            pass  # 降级到简单分析
    
    # 2. 降级：简单规则分析
    return _fallback_analysis(operation)


def _fallback_analysis(operation: dict) -> dict:
    """降级分析：简单规则检查"""
    content = operation.get('content', '')
    
    # 敏感词检查
    sensitive_keywords = ['password', 'secret', 'token', 'key', 'credential']
    for keyword in sensitive_keywords:
        if keyword in content.lower():
            return {
                'risk_level': 'high',
                'analysis': f'检测到敏感关键词: {keyword}',
                'recommendation': '建议阻止或二次确认',
                'mode': 'rule'
            }
    
    # 默认低风险
    return {
        'risk_level': 'low',
        'analysis': '未检测到明显风险',
        'recommendation': '可以继续执行',
        'mode': 'rule'
    }


def generate_hash(content: str) -> str:
    """生成内容哈希"""
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def load_operations() -> list:
    """加载操作记录"""
    if os.path.exists(OPERATIONS_FILE):
        with open(OPERATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_operations(operations: list):
    """保存操作记录"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OPERATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(operations, f, ensure_ascii=False, indent=2)


# ===== API 端点 =====

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_patrol_status(request):
    """获取巡检状态"""
    operations = load_operations()
    
    # 统计
    total = len(operations)
    normal = len([o for o in operations if o.get('status') == 'normal'])
    warning = len([o for o in operations if o.get('status') == 'warning'])
    blocked = len([o for o in operations if o.get('status') == 'blocked'])
    
    return Response({
        'status': 'active',
        'operations_count': total,
        'stats': {
            'total': total,
            'normal': normal,
            'warning': warning,
            'blocked': blocked
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_operation(request):
    """
    分析操作风险（核心接口）
    请求体: { type, title, content, timestamp }
    返回: { id, risk_level, analysis, recommendation, hash }
    """
    data = request.data
    
    # 构建操作对象
    operation = {
        'id': generate_hash(f"{data.get('timestamp', '')}{data.get('content', '')}"),
        'type': data.get('type', 'unknown'),
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'timestamp': data.get('timestamp', datetime.now().isoformat()),
        'hash': generate_hash(data.get('content', '')),
        'user_id': request.user.id
    }
    
    # 调用 Grok 分析
    analysis_result = analyze_with_grok(operation)
    
    # 更新操作状态
    operation['risk_level'] = analysis_result['risk_level']
    operation['analysis'] = analysis_result['analysis']
    operation['recommendation'] = analysis_result['recommendation']
    operation['mode'] = analysis_result.get('mode', 'unknown')
    operation['confidence'] = analysis_result.get('confidence', 0.0)
    operation['status'] = {
        'low': 'normal',
        'medium': 'warning',
        'high': 'blocked',
        'unknown': 'warning'
    }.get(analysis_result['risk_level'], 'warning')

    # 记录到不可变审计日志
    audit_log = get_audit_log()
    if audit_log:
        try:
            audit_record = audit_log.add_record(
                operation_type=operation['type'],
                operation_id=operation['id'],
                user_id=str(operation['user_id']),
                content=json.dumps(operation, ensure_ascii=False),
                metadata={
                    'risk_level': operation['risk_level'],
                    'mode': operation['mode'],
                    'confidence': operation['confidence']
                }
            )
            operation['audit_id'] = audit_record.id
            operation['audit_hash'] = audit_record.content_hash
        except Exception as e:
            operation['audit_error'] = str(e)
    
    # 保存记录
    operations = load_operations()
    operations.insert(0, operation)
    operations = operations[:100]  # 最多保留100条
    save_operations(operations)
    
    return Response({
        'success': True,
        'operation': operation,
        'analysis': analysis_result
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_blocked_operation(request, operation_id):
    """
    确认被拦截的操作
    用户确认后，将状态改为 normal
    """
    operations = load_operations()
    
    for op in operations:
        if op['id'] == operation_id:
            op['status'] = 'normal'
            op['confirmed_at'] = datetime.now().isoformat()
            op['confirmed_by'] = request.user.id
            break
    
    save_operations(operations)
    
    return Response({
        'success': True,
        'message': '操作已确认'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_operations(request):
    """获取操作记录列表"""
    operations = load_operations()
    
    # 筛选
    status_filter = request.query_params.get('status')
    if status_filter:
        operations = [o for o in operations if o.get('status') == status_filter]
    
    # 分页
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size
    
    return Response({
        'total': len(operations),
        'page': page,
        'page_size': page_size,
        'operations': operations[start:end]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_report(request):
    """导出巡检报告"""
    operations = load_operations()
    format_type = request.query_params.get('format', 'json')  # json, ocsf, otel
    
    # 生成报告
    report = {
        'generated_at': datetime.now().isoformat(),
        'total_operations': len(operations),
        'summary': {
            'normal': len([o for o in operations if o.get('status') == 'normal']),
            'warning': len([o for o in operations if o.get('status') == 'warning']),
            'blocked': len([o for o in operations if o.get('status') == 'blocked'])
        },
        'operations': operations
    }
    
    # OCSF 标准格式导出
    if format_type == 'ocsf':
        try:
            from .ocsf_exporter import OCSFExporter
            report['ocsf_events'] = OCSFExporter.export_to_json(operations)
            report['format'] = 'OCSF v1.0.0'
        except ImportError:
            report['ocsf_error'] = 'OCSF exporter not available'
    
    # OpenTelemetry 格式导出
    elif format_type == 'otel':
        try:
            from .ocsf_exporter import OpenTelemetryExporter
            report['otel_spans'] = [
                OpenTelemetryExporter.convert_operation(op) 
                for op in operations
            ]
            report['format'] = 'OpenTelemetry'
        except ImportError:
            report['otel_error'] = 'OTel exporter not available'
    
    # 保存报告
    report_hash = generate_hash(json.dumps(report, ensure_ascii=False))
    report_path = os.path.join(DATA_DIR, f'report_{report_hash}.json')
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    return Response({
        'success': True,
        'report': report,
        'hash': report_hash,
        'path': report_path,
        'format': format_type
    })


# URL 配置
from django.urls import path

urlpatterns = [
    path('status/', get_patrol_status, name='patrol-status'),
    path('analyze/', analyze_operation, name='patrol-analyze'),
    path('confirm/<str:operation_id>/', confirm_blocked_operation, name='patrol-confirm'),
    path('operations/', get_operations, name='patrol-operations'),
    path('export/', export_report, name='patrol-export'),
]