import uuid
import json
from rest_framework import viewsets, status, mixins, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db import transaction
from django.utils import timezone

from .workflow_models import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowTemplate,
)


class WorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workflow
        fields = [
            'id', 'name', 'description', 'workflow_type', 'status',
            'version', 'icon', 'icon_background',
            'graph_data', 'environment_variables',
            'is_template', 'template_category',
            'use_count', 'like_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'use_count', 'like_count', 'created_at', 'updated_at']


class WorkflowNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowNode
        fields = [
            'id', 'node_id', 'node_type', 'title', 'desc',
            'position_x', 'position_y', 'config_data',
            'sort_order', 'created_at',
        ]


class WorkflowEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowEdge
        fields = [
            'id', 'edge_id', 'source_node_id', 'target_node_id',
            'source_handle', 'target_handle',
            'condition_data', 'label', 'created_at',
        ]


class WorkflowDetailSerializer(WorkflowSerializer):
    nodes = WorkflowNodeSerializer(many=True, read_only=True)
    edges = WorkflowEdgeSerializer(many=True, read_only=True)

    class Meta(WorkflowSerializer.Meta):
        fields = WorkflowSerializer.Meta.fields + ['nodes', 'edges']


class WorkflowExecutionSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)

    class Meta:
        model = WorkflowExecution
        fields = [
            'id', 'workflow', 'workflow_name', 'user', 'status',
            'inputs', 'outputs', 'error_message',
            'total_tokens', 'total_steps', 'elapsed_time_ms',
            'started_at', 'finished_at',
        ]


from rest_framework import serializers


class WorkflowViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Workflow.objects.all()
    serializer_class = WorkflowSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if self.action in ['list', 'retrieve']:
            is_template = self.request.query_params.get('is_template')
            if is_template == 'true':
                return qs.filter(is_template=True)
            
            workflow_type = self.request.query_params.get('type')
            if workflow_type:
                qs = qs.filter(workflow_type=workflow_type)
            
            return qs.filter(owner=user) | qs.filter(is_template=True)
        
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WorkflowDetailSerializer
        return WorkflowSerializer

    @action(detail=False, methods=['post'], url_path='save-graph')
    def save_graph(self, request):
        workflow_id = request.data.get('workflow_id')
        nodes = request.data.get('nodes', [])
        edges = request.data.get('edges', [])
        graph_data = request.data.get('graph_data', {})

        if not workflow_id:
            if request.data.get('create_new'):
                workflow = Workflow.objects.create(
                    owner=request.user,
                    name=request.data.get('name', '未命名工作流'),
                    workflow_type=request.data.get('workflow_type', 'chatflow'),
                    description=request.data.get('description', ''),
                    graph_data=graph_data,
                )
                workflow_id = str(workflow.id)
            else:
                return Response({'success': False, 'message': '缺少 workflow_id'}, status=400)

        try:
            workflow_obj = uuid.UUID(workflow_id)
        except ValueError:
            return Response({'success': False, 'message': '无效的 workflow_id'}, status=400)

        with transaction.atomic():
            workflow, created = Workflow.objects.update_or_create(
                id=workflow_obj,
                defaults={
                    'owner': request.user,
                    'name': request.data.get('name', '未命名工作流'),
                    'graph_data': graph_data,
                    'updated_at': timezone.now(),
                }
            )

            WorkflowNode.objects.filter(workflow=workflow).delete()
            for idx, node in enumerate(nodes):
                WorkflowNode.objects.create(
                    workflow=workflow,
                    node_id=node.get('id', ''),
                    node_type=node.get('type', ''),
                    title=node.get('data', {}).get('title', ''),
                    desc=node.get('data', {}).get('desc', ''),
                    position_x=node.get('position', {}).get('x', 0),
                    position_y=node.get('position', {}).get('y', 0),
                    config_data=node.get('data', {}),
                    sort_order=idx,
                )

            WorkflowEdge.objects.filter(workflow=workflow).delete()
            for edge in edges:
                WorkflowEdge.objects.create(
                    workflow=workflow,
                    edge_id=edge.get('id', ''),
                    source_node_id=edge.get('source', ''),
                    target_node_id=edge.get('target', ''),
                    source_handle=edge.get('sourceHandle', 'source'),
                    target_handle=edge.get('targetHandle', 'target'),
                    condition_data=edge.get('data', {}),
                    label=edge.get('data', {}).get('label', ''),
                )

        serializer = WorkflowDetailSerializer(workflow)
        return Response({
            'success': True,
            'message': '保存成功' if not created else '创建成功',
            'data': serializer.data,
        })

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        workflow = self.get_object()
        workflow.status = 'published'
        workflow.version += 1
        workflow.save(update_fields=['status', 'version'])
        
        return Response({
            'success': True,
            'message': f'工作流已发布（版本 {workflow.version}）',
            'data': {'version': workflow.version},
        })

    @action(detail=True, methods=['post'], url_path='execute')
    def execute(self, request, pk=None):
        workflow = self.get_object()
        inputs = request.data.get('inputs', {})

        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            user=request.user,
            status='running',
            inputs=inputs,
        )

        try:
            result = self._run_workflow(workflow, inputs, execution)
            
            execution.finish(
                status='succeeded',
                outputs=result.get('outputs', {}),
            )
            
            execution.total_tokens = result.get('total_tokens', 0)
            execution.total_steps = result.get('total_steps', 0)
            execution.save()

            return Response({
                'success': True,
                'execution_id': str(execution.id),
                'data': {
                    'status': 'succeeded',
                    'outputs': result.get('outputs', {}),
                    'tokens_used': result.get('total_tokens', 0),
                    'elapsed_time': execution.elapsed_time_ms,
                },
            })
        except Exception as e:
            execution.finish(status='failed', error=str(e))
            return Response({
                'success': False,
                'execution_id': str(execution.id),
                'message': f'执行失败: {str(e)}',
            }, status=500)

    def _run_workflow(self, workflow: Workflow, inputs: dict, execution: WorkflowExecution) -> dict:
        from content_app.rag_service import RAGPipeline
        from .deepseek_client import DeepSeekClient

        nodes = list(workflow.nodes.all().order_by('sort_order'))
        edges = list(workflow.edges.all())
        
        context = {**inputs}
        total_tokens = 0
        step_count = 0

        start_nodes = [n for n in nodes if n.node_type == 'start']
        if not start_nodes and nodes:
            start_nodes = [nodes[0]]

        processed = set()
        queue = list(start_nodes)

        while queue:
            current_node = queue.pop(0)
            if current_node.node_id in processed:
                continue
            processed.add(current_node.node_id)
            step_count += 1

            if current_node.node_type == 'llm':
                config = current_node.config_data or {}
                prompt_template = config.get('prompt', '')
                model = config.get('model', 'deepseek-chat')
                temperature = config.get('temperature', 0.7)
                
                formatted_prompt = prompt_template.format(**context)
                
                client = DeepSeekClient()
                response = client.chat_completion(
                    messages=[{"role": "user", "content": formatted_prompt}],
                    model=model,
                    temperature=temperature,
                )
                
                output_text = response.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = response.get('usage', {})
                total_tokens += usage.get('total_tokens', 0)
                
                output_key = current_node.config_data.get('output_variable', f'node_{current_node.node_id}_output')
                context[output_key] = output_text

            elif current_node.node_type == 'knowledge_retrieval':
                config = current_node.config_data or {}
                query = config.get('query', '').format(**context)
                category_slug = config.get('category_slug', '')
                top_k = config.get('top_k', 5)
                
                rag = RAGPipeline()
                results = rag.search(query, category_slug=category_slug, top_k=top_k)
                
                context[f'{current_node.node_id}_results'] = results
                context[f'{current_node.node_id}_context'] = '\n'.join([
                    r['content'] for r in results[:3]
                ])

            elif current_node.node_type == 'condition':
                config = current_node.config_data or {}
                conditions = config.get('conditions', [])
                
                for cond in conditions:
                    variable = cond.get('variable', '')
                    operator = cond.get('operator', 'equals')
                    value = cond.get('value', '')
                    
                    var_value = context.get(variable, '')
                    
                    match = False
                    if operator == 'equals':
                        match = str(var_value) == str(value)
                    elif operator == 'contains':
                        match = value.lower() in str(var_value).lower()
                    elif operator == 'greater_than':
                        try:
                            match = float(var_value) > float(value)
                        except (ValueError, TypeError):
                            match = False
                    
                    if match:
                        next_edge = WorkflowEdge.objects.filter(
                            workflow=workflow,
                            source_node_id=current_node.node_id,
                            label=cond.get('label', ''),
                        ).first()
                        
                        if next_edge:
                            next_node = workflow.nodes.filter(node_id=next_edge.target_node_id).first()
                            if next_node and next_node.node_id not in processed:
                                queue.append(next_node)
                        break

            elif current_node.node_type == 'http_request':
                config = current_node.config_data or {}
                import requests
                
                url = config.get('url', '').format(**context)
                method = config.get('method', 'GET').upper()
                headers = config.get('headers', {})
                body = config.get('body', {})
                
                resp = requests.request(method, url, headers=headers, json=body, timeout=30)
                
                context[f'{current_node.node_id}_response'] = resp.json() if resp.headers.get('content-type', '').startswith('application') else resp.text
                context[f'{current_node.node_id}_status'] = resp.status_code

            elif current_node.node_type == 'code':
                code = (current_node.config_data or {}).get('code', '')
                safe_globals = {'__builtins__': {}, **context}
                exec(code, safe_globals, context)

            elif current_node.node_type == 'tool':
                config = current_node.config_data or {}
                tool_name = config.get('tool_name', '')
                tool_params = {k: v.format(**context) if isinstance(v, str) else v for k, v in config.get('params', {}).items()}
                
                if tool_name == 'tipping_send':
                    from ..content_app.tipping_views import TipDonationViewSet
                    tip_view = TipDonationViewSet()
                    tip_view.format_kwarg = {}
                    tip_view.request = request
                    
                    tip_result = tip_view.send_tip(request._request if hasattr(request, '_request') else type('obj', (object,), {'data': tool_params})())
                    context[f'{current_node.node_id}_result'] = getattr(tip_result, 'data', {})
                
                elif tool_name == 'detector_scan':
                    scan_type = tool_params.get('scan_type', 'unified')
                    text_content = tool_params.get('text', '')
                    
                    api_map = {
                        'unified': '/api/unified-scan/unified-content-scan/scan/',
                        'dual_engine': '/api/dual-engine/dual-engine-scan/scan/',
                        'anti_fraud': '/api/anti-fraud/risk-event/report/',
                    }
                    
                    endpoint = api_map.get(scan_type, api_map['unified'])
                    context[f'{current_node.node_id}_result'] = {'endpoint': endpoint, 'text_preview': text_content[:200]}

            elif current_node.node_type == 'end':
                pass

            for edge in edges:
                if edge.source_node_id == current_node.node_id:
                    target_node = workflow.nodes.filter(node_id=edge.target_node_id).first()
                    if target_node and target_node.node_id not in processed:
                        if current_node.node_type != 'condition':
                            queue.append(target_node)

        return {
            'outputs': context,
            'total_tokens': total_tokens,
            'total_steps': step_count,
        }

    @action(detail=False, methods=['get'], url_path='templates')
    def templates(self, request):
        category = request.query_params.get('category')
        difficulty = request.query_params.get('difficulty')

        BUILTIN_TEMPLATES = [
            {
                'id': 'builtin-001',
                'name': 'AI 内容安全审计流水线',
                'description': '自动化的内容安全检测流程：输入文本 → LLM分析 → 条件判断风险等级 → 高风险自动标记通知',
                'category': 'security',
                'icon': 'Shield',
                'icon_color': '#EF4444',
                'difficulty': 'beginner',
                'tags': ['安全', '自动化', '内容审核'],
                'use_count': 1280,
                'rating': 4.8,
                'is_featured': True,
                'base_workflow_id': None,
                'workflow_type': 'workflow',
                'node_count': 5,
            },
            {
                'id': 'builtin-002',
                'name': '智能客服对话工作流',
                'description': '基于知识库的智能客服系统：用户提问 → 知识库检索 → LLM生成回答 → 满意度收集',
                'category': 'chatbot',
                'icon': 'MessageSquare',
                'icon_color': '#8B5CF6',
                'difficulty': 'intermediate',
                'tags': ['客服', 'RAG', '对话'],
                'use_count': 956,
                'rating': 4.6,
                'is_featured': True,
                'base_workflow_id': None,
                'workflow_type': 'chatflow',
                'node_count': 6,
            },
            {
                'id': 'builtin-003',
                'name': 'AI 文本检测与分析引擎',
                'description': '多维度文本分析流程：文本输入 → AI概率检测 → 抄袭比对 → 深度伪造检测 → 综合报告生成',
                'category': 'analysis',
                'icon': 'Search',
                'icon_color': '#3B82F6',
                'difficulty': 'advanced',
                'tags': ['AI检测', '抄袭', '深度伪造'],
                'use_count': 2340,
                'rating': 4.9,
                'is_featured': True,
                'base_workflow_id': None,
                'workflow_type': 'agent',
                'node_count': 8,
            },
            {
                'id': 'builtin-004',
                'name': 'API 数据采集与处理',
                'description': '定时采集外部API数据 → 数据清洗转换 → 条件筛选 → 存储或通知',
                'category': 'integration',
                'icon': 'Globe',
                'icon_color': '#F97316',
                'difficulty': 'beginner',
                'tags': ['API', '数据处理', 'ETL'],
                'use_count': 678,
                'rating': 4.4,
                'is_featured': False,
                'base_workflow_id': None,
                'workflow_type': 'workflow',
                'node_count': 5,
            },
            {
                'id': 'builtin-005',
                'name': '用户行为风控决策链',
                'description': '实时用户行为分析：行为数据采集 → 特征提取 → 规则引擎判断 → 风险评分 → 自动处置',
                'category': 'security',
                'icon': 'Shield',
                'icon_color': '#10B981',
                'difficulty': 'advanced',
                'tags': ['风控', '反欺诈', '实时'],
                'use_count': 1567,
                'rating': 4.7,
                'is_featured': True,
                'base_workflow_id': None,
                'workflow_type': 'agent',
                'node_count': 7,
            },
            {
                'id': 'builtin-006',
                'name': '内容创作辅助工作流',
                'description': '创意写作助手：主题输入 → 大纲生成(LLM) → 逐段扩写 → 质量评估 → 打赏激励',
                'category': 'creative',
                'icon': 'Sparkles',
                'icon_color': '#EC4899',
                'difficulty': 'intermediate',
                'tags': ['创作', '写作', 'AIGC'],
                'use_count': 892,
                'rating': 4.5,
                'is_featured': False,
                'base_workflow_id': None,
                'workflow_type': 'chatflow',
                'node_count': 6,
            },
        ]

        templates = WorkflowTemplate.objects.filter(is_official=True)

        if category:
            templates = templates.filter(category=category)
        if difficulty:
            templates = templates.filter(difficulty=difficulty)

        data = []
        for t in templates[:20]:
            wf = t.base_workflow
            data.append({
                'id': str(t.id),
                'name': t.name,
                'description': t.description,
                'category': t.category,
                'cover_image': t.cover_image,
                'icon': t.icon,
                'icon_color': t.icon_color,
                'difficulty': t.difficulty,
                'tags': t.tags,
                'use_count': t.use_count,
                'rating': t.rating,
                'is_featured': t.is_featured,
                'base_workflow_id': str(wf.id),
                'workflow_type': wf.workflow_type,
                'node_count': wf.nodes.count(),
            })

        if len(data) == 0:
            data = BUILTIN_TEMPLATES

        return Response({
            'success': True,
            'count': len(data),
            'data': data,
        })

    @action(detail=False, methods=['post'], url_path='duplicate')
    def duplicate(self, request):
        source_id = request.data.get('source_workflow_id')
        new_name = request.data.get('new_name', '')

        try:
            source = Workflow.objects.get(id=source_id)
        except (Workflow.DoesNotExist, ValueError):
            return Response({'success': False, 'message': '源工作流不存在'}, status=404)

        with transaction.atomic():
            new_wf = Workflow.objects.create(
                owner=request.user,
                name=new_name or f"{source.name} (副本)",
                description=source.description,
                workflow_type=source.workflow_type,
                icon=source.icon,
                icon_background=source.icon_background,
                graph_data=source.graph_data,
                environment_variables=list(source.environment_variables),
            )

            for node in source.nodes.all():
                WorkflowNode.objects.create(
                    workflow=new_wf,
                    node_id=node.node_id,
                    node_type=node.node_type,
                    title=node.title,
                    desc=node.desc,
                    position_x=node.position_x,
                    position_y=node.position_y,
                    config_data=dict(node.config_data),
                    sort_order=node.sort_order,
                )

            for edge in source.edges.all():
                WorkflowEdge.objects.create(
                    workflow=new_wf,
                    edge_id=edge.edge_id,
                    source_node_id=edge.source_node_id,
                    target_node_id=edge.target_node_id,
                    source_handle=edge.source_handle,
                    target_handle=edge.target_handle,
                    condition_data=dict(edge.condition_data),
                    label=edge.label,
                )

        return Response({
            'success': True,
            'message': '复制成功',
            'data': {'new_workflow_id': str(new_wf.id)},
        })


class WorkflowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = WorkflowExecutionSerializer

    def get_queryset(self):
        return WorkflowExecution.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='stop')
    def stop(self, request, pk=None):
        execution = self.get_object()
        if execution.status == 'running':
            execution.finish(status='stopped')
            return Response({'success': True, 'message': '执行已停止'})
        return Response({'success': False, 'message': '当前状态无法停止'}, status=400)
