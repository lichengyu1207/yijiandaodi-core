"""
消费费用分析（P1-2 计费落库）
基于 APICallLog 提供费用分解视图，供 cost-breakdown 与消费趋势分析使用。
"""
from decimal import Decimal

from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .stats_views import (
    _parse_date_range,
    _build_trend_buckets,
    _percentile,
    _mark_anomalies,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cost_breakdown(request):
    """消费费用分解：按用户 / 时间 / 模型聚合 APICallLog 费用。

    GET /api/usage/cost-breakdown?start_date=&end_date=&days=&group_by=user|day|model
    返回：总费用/总tokens/总调用 + 指定维度明细（Top 列表）。
    """
    from .billing_models import APICallLog

    try:
        start_dt, end_dt, days, _granularity = _parse_date_range(request, 30)
    except Exception:
        start_dt, end_dt, days = None, None, 30

    qs = APICallLog.objects.all()
    if start_dt and end_dt:
        qs = qs.filter(created_at__gte=start_dt, created_at__lt=end_dt)

    totals = qs.aggregate(
        total_cost=Sum('cost'),
        total_tokens=Sum('total_tokens'),
        total_calls=Count('id'),
    )
    total_cost = totals['total_cost'] or Decimal('0')
    total_tokens = totals['total_tokens'] or 0
    total_calls = totals['total_calls'] or 0

    group_by = request.GET.get('group_by', 'user')

    if group_by == 'model':
        items = list(
            qs.values('model')
            .annotate(cost=Sum('cost'), tokens=Sum('total_tokens'), calls=Count('id'))
            .order_by('-cost')[:20]
        )
    elif group_by == 'day':
        items = list(
            qs.annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(cost=Sum('cost'), tokens=Sum('total_tokens'), calls=Count('id'))
            .order_by('date')
        )
    else:  # user
        items = list(
            qs.values('user_id')
            .annotate(cost=Sum('cost'), tokens=Sum('total_tokens'), calls=Count('id'))
            .order_by('-cost')[:20]
        )

    for it in items:
        it['cost'] = float(it['cost'] or 0)
        it['tokens'] = int(it['tokens'] or 0)
        it['calls'] = int(it['calls'] or 0)

    return Response({
        'success': True,
        'data': {
            'summary': {
                'total_cost': float(total_cost),
                'total_tokens': int(total_tokens),
                'total_calls': total_calls,
                'period_days': days,
                'avg_cost_per_call': round(float(total_cost) / max(total_calls, 1), 6),
            },
            'group_by': group_by,
            'items': items,
        },
    })


def _build_suggestions(total_cost, total_calls, total_tokens, error_rate, model_breakdown, trend):
    """基于聚合结果生成规则驱动的消费优化建议（P2 分析一期）。"""
    suggestions = []

    if total_calls == 0:
        return [{
            'type': 'info',
            'title': '暂无调用数据',
            'detail': '当前时间范围内没有 API 调用记录，发起调用后将在此展示消费趋势分析。',
            'action': '',
        }]

    # 1. 单一模型成本集中
    if model_breakdown and model_breakdown[0]['share'] >= 60:
        m = model_breakdown[0]
        suggestions.append({
            'type': 'cost',
            'title': f"模型 {m['model'] or '未知'} 成本占比 {m['share']}%",
            'detail': '单一模型开销占比过高，可按场景切换更经济的模型，或对高开销场景降级模型。',
            'action': '设置 > API 密钥',
        })

    # 2. 长尾高额调用（p95 明显高于 p50）
    p50s = [p['p50'] for p in trend if p['calls'] > 0]
    p95s = [p['p95'] for p in trend if p['calls'] > 0]
    if p50s and p95s and max(p95s) > max(p50s) * 3:
        suggestions.append({
            'type': 'warning',
            'title': '存在长尾高额调用',
            'detail': '单次调用费用 p95 明显高于 p50，建议排查高消耗场景并优化输入长度与上下文。',
            'action': 'Top 10 昂贵调用',
        })

    # 3. 异常消费峰值（3σ）
    if any(p.get('anomaly') for p in trend):
        suggestions.append({
            'type': 'warning',
            'title': '检测到异常消费峰值',
            'detail': '时间序列中出现超过均值 3σ 的消费高峰，建议定位对应时段的高额调用并检查原因。',
            'action': 'Top 10 昂贵调用',
        })

    # 4. 错误率偏高
    if error_rate > 5:
        suggestions.append({
            'type': 'error',
            'title': f'调用错误率偏高（{error_rate}%）',
            'detail': '错误调用占比超过 5%，建议检查模型接口稳定性与重试策略，避免无效调用产生费用。',
            'action': '实时审计',
        })

    # 5. token 效率
    avg_tokens = int(total_tokens / max(total_calls, 1))
    if avg_tokens > 5000:
        suggestions.append({
            'type': 'cost',
            'title': '单次调用 token 偏大',
            'detail': f'平均每次调用 {avg_tokens} tokens，建议精简提示词与上下文以减少费用。',
            'action': '',
        })

    return suggestions


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trend_analysis(request):
    """消费趋势反向分析（P2 分析一期）。

    GET /api/usage/trend-analysis?start_date=&end_date=&days=
    返回：
    - trend: 每日/每周消费折线（cost/calls/tokens/error_rate + 单次费用分位 + 异常标记）
    - cost_breakdown: 按模型/场景的成本分解（饼图）
    - top_expensive: Top 10 昂贵调用（runId/时间/模型/token/费用/场景）
    - suggestions: 规则驱动的优化建议卡片
    """
    from .billing_models import APICallLog

    try:
        start_dt, end_dt, days, granularity = _parse_date_range(request, 30)
    except Exception:
        start_dt, end_dt, days, granularity = None, None, 30, 'day'

    qs = APICallLog.objects.all()
    if start_dt and end_dt:
        qs = qs.filter(created_at__gte=start_dt, created_at__lt=end_dt)

    totals = qs.aggregate(
        total_cost=Sum('cost'),
        total_tokens=Sum('total_tokens'),
        total_calls=Count('id'),
        error_calls=Count('id', filter=Q(status='error')),
    )
    total_cost = float(totals['total_cost'] or 0)
    total_tokens = int(totals['total_tokens'] or 0)
    total_calls = totals['total_calls'] or 0
    error_calls = totals['error_calls'] or 0
    error_rate = round(error_calls / max(total_calls, 1) * 100, 2)

    gran = granularity if granularity in ('hour', 'day', 'week', 'month') else 'day'

    trend = []
    if start_dt and end_dt:
        for b_start, b_end in _build_trend_buckets(start_dt, end_dt, gran):
            logs = list(qs.filter(created_at__gte=b_start, created_at__lt=b_end))
            if not logs:
                # 仅返回实际有调用的桶，空数据时 trend 为 []
                continue
            costs = [float(x.cost or 0) for x in logs]
            errs = [1 if x.status == 'error' else 0 for x in logs]
            trend.append({
                'date': b_start.isoformat(),
                'cost': round(sum(costs), 6),
                'calls': len(logs),
                'tokens': sum(x.total_tokens or 0 for x in logs),
                'error_rate': round((sum(errs) / max(len(logs), 1)) * 100, 2),
                'p50': round(_percentile(costs, 50), 6),
                'p95': round(_percentile(costs, 95), 6),
                'p99': round(_percentile(costs, 99), 6),
            })
        _mark_anomalies(trend, 'cost')

    # 成本分解（按模型 / 场景）
    model_breakdown = list(
        qs.values('model')
        .annotate(cost=Sum('cost'), tokens=Sum('total_tokens'), calls=Count('id'))
        .order_by('-cost')[:10]
    )
    for it in model_breakdown:
        it['cost'] = float(it['cost'] or 0)
        it['tokens'] = int(it['tokens'] or 0)
        it['calls'] = int(it['calls'] or 0)
        it['share'] = round(it['cost'] / max(total_cost, 1e-9) * 100, 2)

    scenario_breakdown = list(
        qs.values('scenario')
        .annotate(cost=Sum('cost'), calls=Count('id'))
        .order_by('-cost')[:10]
    )
    for it in scenario_breakdown:
        it['cost'] = float(it['cost'] or 0)
        it['calls'] = int(it['calls'] or 0)
        it['share'] = round(it['cost'] / max(total_cost, 1e-9) * 100, 2)

    # Top 10 昂贵调用
    top_expensive = list(
        qs.order_by('-cost')[:10]
        .values('run_id', 'model', 'scenario', 'input_tokens', 'output_tokens',
                'total_tokens', 'cost', 'created_at', 'status')
    )
    for it in top_expensive:
        it['cost'] = float(it['cost'] or 0)
        it['time'] = it.pop('created_at')
        it['tokens'] = it.pop('total_tokens')

    suggestions = _build_suggestions(
        total_cost, total_calls, total_tokens, error_rate, model_breakdown, trend
    )

    return Response({
        'success': True,
        'data': {
            'summary': {
                'total_cost': round(total_cost, 6),
                'total_calls': total_calls,
                'total_tokens': total_tokens,
                'avg_cost_per_call': round(total_cost / max(total_calls, 1), 6),
                'error_rate': error_rate,
                'period_days': days,
            },
            'granularity': gran,
            'trend': trend,
            'cost_breakdown': {
                'by_model': model_breakdown,
                'by_scenario': scenario_breakdown,
            },
            'top_expensive': top_expensive,
            'suggestions': suggestions,
        },
    })
