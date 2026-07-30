# -*- coding: utf-8 -*-
"""
平台核心能力 API 层 — 统一暴露平台所有能力为 RESTful 接口
================================================

基于 OpenRath Runtime 驱动，提供：
  1. 能力列表（含输入/输出 Schema）
  2. 单 Agent 调用
  3. OpenRath 运行时信息查询
  4. 上下文压缩服务

API 前缀: /api/platform/v1/capabilities/

使用示例:
  GET  /api/platform/v1/capabilities/              # 所有能力列表
  GET  /api/platform/v1/capabilities/{skill_id}/    # 单个能力详情+Schema
  POST /api/platform/v1/capabilities/call-agent/     # 调用单个Agent
  GET  /api/platform/v1/capabilities/openrath-info/  # OpenRath运行时信息
  POST /api/platform/v1/capabilities/compress/        # 上下文压缩
"""

import json as json_module
import uuid
import time

from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from content_app.deepseek_service import get_deepseek_client
from .openrath_adapter import (
    RathRuntime, Session, Agent, SequentialWorkflow,
    Compressor, create_quad_agent_runtime, LocalMemoryStore,
    Provider, SessionGraph,
)


# =====================================================================
# 平台能力注册表（与 p2p_app/views.py PLATFORM_CAPABILITIES 同步）
# =====================================================================

CAPABILITY_REGISTRY = {
    'quad-agent-detect': {
        'name': '四Agent多维协同检测',
        'name_en': 'Quad-Agent Multi-Dimensional Detect',
        'category': 'AI检测',
        'version': 'v2.0.0',
        'description': '基于 OpenRath Runtime 的 4-Agent 串行检测引擎',
        'method': 'detect_pipeline',
        'endpoint': '/api/agent/public/detect/',
        'stream_endpoint': '/api/agent/public/detect-stream/',
        'input_schema': {
            'type': 'object',
            'required': ['message'],
            'properties': {
                'message': {'type': 'string', 'description': '待检测内容'},
                'scenario': {'type': 'string', 'enum': ['text', 'image', 'code', 'paper', 'resume', 'contract', 'marketing', 'video'], 'default': 'text'},
                'skills': {'type': 'array', 'items': {'type': 'string'}, 'description': '关联技能ID列表'},
            },
        },
        'output_schema': {
            'type': 'object',
            'properties': {
                'sessionId': {'type': 'string'},
                'finalResult': {'type': 'object'},
                'agentResults': {'type': 'array'},
                'graphInfo': {'type': 'object'},
            },
        },
    },
    'sse-stream-detect': {
        'name': 'SSE流式实时推送检测',
        'name_en': 'SSE Stream Real-time Detect',
        'category': 'AI检测',
        'version': 'v2.0.0',
        'description': 'Server-Sent Events 流式检测',
        'method': 'detect_stream',
        'endpoint': '/api/agent/public/detect-stream/',
        'input_schema': {
            'type': 'object',
            'required': ['message'],
            'properties': {
                'message': {'type': 'string'},
                'scenario': {'type': 'string', 'default': 'text'},
            },
        },
        'output_schema': {
            'type': 'object',
            'properties': {
                'event_type': {'type': 'string', 'enum': ['start', 'agent_start', 'agent_complete', 'complete', 'error']},
                'data': {'type': 'object'},
            },
        },
    },
    'session-manager': {
        'name': '会话历史管理',
        'name_en': 'Session History Manager',
        'category': '会话管理',
        'version': 'v1.5.0',
        'description': '检测会话持久化存储与历史加载',
        'method': 'sessions',
        'endpoint': '/api/agent/public/sessions/',
        'input_schema': {
            'type': 'object',
            'properties': {
                'limit': {'type': 'integer', 'default': 20, 'maximum': 50},
            },
        },
        'output_schema': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'sessionId': {'type': 'string'}, 'title': {'type': 'string'},
                    'messageCount': {'type': 'integer'}, 'messages': {'type': 'array'},
                },
            },
        },
    },
    'report-export': {
        'name': 'HTML检测报告导出',
        'name_en': 'HTML Report Export',
        'category': '报告导出',
        'version': 'v1.3.0',
        'description': '检测结果一键导出为HTML报告',
        'method': 'client_side',
        'endpoint': None,
        'input_schema': {
            'type': 'object',
            'required': ['detectResult'],
            'properties': {
                'detectResult': {'type': 'object', 'description': '完整检测结果数据'},
            },
        },
        'output_schema': {
            'type': 'object',
            'properties': {
                'filename': {'type': 'string'}, 'html': {'type': 'string'},
            },
        },
    },
    'context-compress': {
        'name': '上下文智能压缩',
        'name_en': 'Context Intelligence Compressor',
        'category': '上下文管理',
        'version': 'v1.2.0',
        'description': 'OpenRath Compressor 驱动的上下文压缩',
        'method': 'compress',
        'endpoint': '/api/platform/v1/capabilities/compress/',
        'input_schema': {
            'type': 'object',
            'required': ['messages'],
            'properties': {
                'messages': {'type': 'array', 'items': {'type': 'object', 'properties': {'role': {'type': 'string'}, 'content': {'type': 'string'}}}},
                'max_tokens': {'type': 'integer', 'default': 4000},
                'keep_recent': {'type': 'integer', 'default': 3},
            },
        },
        'output_schema': {
            'type': 'object',
            'properties': {
                'compressedMessages': {'type': 'array'},
                'originalCount': {'type': 'integer'},
                'compressedCount': {'type': 'integer'},
                'compressionRatio': {'type': 'number'},
            },
        },
    },
}


# 单 Agent 定义表（用于 call-agent 接口）
AGENT_DEFINITIONS = {
    'auditor': {
        'name': '内容审核员', 'code': 'auditor',
        'capabilities': ['敏感词检测', '合规性审查'],
        'description': '专注内容合规与风险识别',
        'system_prompt_template': '你是一位资深的内容安全审核专家和AI文本分析师。',
    },
    'verifier': {
        'name': '事实核查官', 'code': 'verifier',
        'capabilities': ['事实验证', '来源追溯'],
        'description': '专注信息真实性与溯源',
        'system_prompt_template': '你是一位专业的事实核查专家和信息验证分析师。',
    },
    'archiver': {
        'name': '数字取证员', 'code': 'archiver',
        'capabilities': ['元数据分析', '模式识别'],
        'description': '专注AI生成痕迹与数据特征',
        'system_prompt_template': '你是一位数字取证专家和多模态AI研究员。',
    },
    'judge': {
        'name': '裁决官', 'code': 'judge',
        'capabilities': ['综合裁决', '风险评估'],
        'description': '专注最终评级与决策建议',
        'system_prompt_template': '你是一位资深评审专家和风险分析师。',
    },
}

# 场景提示词映射
SCENARIO_PROMPTS = {
    'text': '你的任务是：1)检测文本中的AI生成痕迹；2)识别敏感词/违规内容；3)评估内容风险等级；4)提供专业优化建议。请用中文回答。',
    'image': '你的任务是分析图像安全性、AI生成痕迹、违规视觉元素等。请用中文回答。',
    'code': '你的任务是扫描代码中的安全漏洞、恶意代码、隐私泄露风险等。请用中文回答。',
    'paper': '你的任务是检测论文中的AI生成内容、评估原创性、检查学术不端行为。请用中文回答。',
    'resume': '你的任务是检测简历中的AI生成/润色痕迹，计算ATS兼容性评分。请用中文回答。',
    'contract': '你的任务是评定合同综合风险等级，识别不公平条款。请用中文回答。',
    'marketing': '你的任务是检测营销文案的AI生成概率，评估原创度。请用中文回答。',
    'video': '你的任务是检测短视频脚本的AI生成程度，计算爆款指数。请用中文回答。',
}


class PlatformCapabilitiesView(APIView):
    """平台能力统一 API — 列表、详情、调用"""

    authentication_classes = []
    permission_classes = []

    def get(self, request, capability_id=None):
        """获取能力列表或单个能力详情"""
        if capability_id:
            return self.capability_detail(request, capability_id)
        return self.capability_list(request)

    def post(self, request, action=None):
        """执行能力调用"""
        if action == 'call-agent':
            return self.call_agent(request)
        if action == 'compress':
            return self.compress(request)
        if action == 'detect':
            return self.detect(request)
        return Response({
            'success': False,
            'message': f'未知动作: {action}。支持: call-agent, compress, detect',
        }, status=status.HTTP_400_BAD_REQUEST)

    def capability_list(self, request):
        """GET /api/platform/v1/capabilities/ — 所有能力列表"""
        capabilities = []
        for cap_id, cap_def in CAPABILITY_REGISTRY.items():
            entry = {
                'id': cap_id,
                'name': cap_def['name'],
                'nameEn': cap_def.get('name_en', ''),
                'category': cap_def['category'],
                'version': cap_def['version'],
                'description': cap_def['description'],
                'method': cap_def['method'],
                'endpoint': cap_def.get('endpoint'),
                'hasStreamEndpoint': bool(cap_def.get('stream_endpoint')),
                'inputSchema': cap_def['input_schema'],
                'outputSchema': cap_def['output_schema'],
            }
            capabilities.append(entry)

        # 添加单 Agent 能力
        for agent_id, agent_def in AGENT_DEFINITIONS.items():
            capabilities.append({
                'id': f'agent-{agent_id}',
                'name': f'Agent: {agent_def["name"]}',
                'nameEn': f'Agent: {agent_def["name"]}',
                'category': '单Agent调用',
                'version': 'v2.0.0',
                'description': agent_def['description'],
                'method': 'call_agent',
                'endpoint': '/api/platform/v1/capabilities/call-agent/',
                'inputSchema': {
                    'type': 'object',
                    'required': ['message', 'agent_code'],
                    'properties': {
                        'agent_code': {'type': 'string', 'enum': list(AGENT_DEFINITIONS.keys())},
                        'message': {'type': 'string'},
                        'scenario': {'type': 'string', 'default': 'text'},
                        'extra_context': {'type': 'string'},
                    },
                },
                'outputSchema': {
                    'type': 'object',
                    'properties': {
                        'reply': {'type': 'string'},
                        'sessionId': {'type': 'string'},
                        'latencyMs': {'type': 'integer'},
                        'agentCode': {'type': 'string'},
                        'usage': {'type': 'object'},
                    },
                },
            })

        # 分类统计
        categories = {}
        for cap in capabilities:
            cat = cap['category']
            categories[cat] = categories.get(cat, 0) + 1

        return Response({
            'success': True,
            'message': '一鉴到底平台能力列表 (Powered by OpenRath v1.2.1)',
            'data': {
                'total': len(capabilities),
                'categories': categories,
                'capabilities': capabilities,
                '_docs': {
                    'github': 'https://github.com/Rath-Team/OpenRath',
                    'docs': 'https://docs.openrath.com/',
                    'openapi': '/api/platform/v1/capabilities/openapi/',  # 可扩展
                },
            },
        })

    def capability_detail(self, request, capability_id):
        """GET /api/platform/v1/capabilities/{id}/ — 单个能力详情"""
        # 先查预定义能力
        cap = CAPABILITY_REGISTRY.get(capability_id)
        if cap:
            return Response({
                'success': True,
                'data': {
                    'id': capability_id,
                    **cap,
                    'examples': self._get_examples(capability_id),
                    'rateLimits': {'requests_per_minute': 60, 'daily_quota': 1000},
                },
            })

        # 查单 Agent 能力
        if capability_id.startswith('agent-'):
            agent_code = capability_id.replace('agent-', '')
            agent_def = AGENT_DEFINITIONS.get(agent_code)
            if agent_def:
                return Response({
                    'success': True,
                    'data': {
                        'id': capability_id,
                        'name': f'Agent: {agent_def["name"]}',
                        'category': '单Agent调用',
                        **agent_def,
                        'supportedScenarios': list(SCENARIO_PROMPTS.keys()),
                        'examples': self._get_examples(capability_id),
                    },
                })

        return Response({
            'success': False,
            'message': f'能力 "{capability_id}" 不存在',
            'available': list(CAPABILITY_REGISTRY.keys()) + [f'agent-{k}' for k in AGENT_DEFINITIONS.keys()],
        }, status=status.HTTP_404_NOT_FOUND)

    def call_agent(self, request):
        """POST /api/platform/v1/capabilities/call-agent/ — 调用单个 Agent"""
        try:
            data = json_module.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        agent_code = data.get('agent_code', '')
        message = (data.get('message') or '').strip()
        scenario = data.get('scenario', 'text')
        extra_context = data.get('extra_context', '')

        if not agent_code or not message:
            return Response({'success': False, 'message': 'agent_code 和 message 为必填项'}, status=400)

        agent_def = AGENT_DEFINITIONS.get(agent_code)
        if not agent_def:
            return Response({
                'success': False,
                'message': f'未知 Agent: {agent_code}，可用: {list(AGENT_DEFINITIONS.keys())}',
            }, status=400)

        try:
            client = get_deepseek_client()
            runtime = create_quad_agent_runtime(deepseek_client=client)

            base_prompt = SCENARIO_PROMPTS.get(scenario, SCENARIO_PROMPTS['text'])
            full_system_prompt = (
                f"[{agent_def['name']}-{scenario}] "
                f"{agent_def['system_prompt_template']} {base_prompt}\n\n"
                f"角色定位: {agent_def['description']}\n"
                f"核心能力: {', '.join(agent_def['capabilities'])}"
                + (f"\n\n[上下文参考]:\n{extra_context}" if extra_context else "")
            )

            # 创建 OpenRath Agent 并执行
            agent = Agent(
                system_prompt=full_system_prompt,
                name=agent_def['name'],
                code=agent_def['code'],
                capabilities=agent_def['capabilities'],
                description=agent_def['description'],
                llm_client=client,
            )
            session = Session.from_user_message(message)

            start_time = time.time()
            result_session = agent(session)
            latency_ms = int((time.time() - start_time) * 1000)
            reply = result_session.last_assistant_message or ''

            return Response({
                'success': True,
                'message': f'{agent_def["name"]} 执行完成',
                'data': {
                    'reply': reply,
                    'sessionId': str(result_session.id),
                    'latencyMs': latency_ms,
                    'agentCode': agent_code,
                    'agentName': agent_def['name'],
                    'scenario': scenario,
                    'usage': {
                        'promptTokens': result_session.cumulative_usage.prompt_tokens,
                        'completionTokens': result_session.cumulative_usage.completion_tokens,
                        'totalTokens': result_session.cumulative_usage.total_tokens,
                    },
                    'lineage': result_session.export_lineage_graph(),
                },
            })

        except ValueError as e:
            return Response({'success': False, 'message': f'AI服务配置错误: {e}'}, status=503)
        except Exception as e:
            print(f'[Platform Call-Agent Error] {e}')
            import traceback
            traceback.print_exc()
            return Response({'success': False, 'message': f'执行异常: {e}'}, status=500)

    def detect(self, request):
        """POST /api/platform/v1/capabilities/detect/ — 通过平台API触发四Agent检测"""
        try:
            body = json_module.loads(request.body) if request.body else {}
        except Exception:
            body = {}

        message = (body.get('message') or '').strip()
        scenario = body.get('scenario', 'text')
        skills = body.get('skills', [])

        if not message:
            return Response({'success': False, 'message': 'message 必填'}, status=400)

        try:
            client = get_deepseek_client()
            runtime = create_quad_agent_runtime(deepseek_client=client)
            result = runtime.run_detect_pipeline(
                message=message,
                scenario=scenario,
                on_event=lambda e: None,
            )

            return Response({
                'success': True,
                'message': '[Platform API] 四Agent检测完成 (Powered by OpenRath)',
                'source': 'platform_capabilities_api',
                'data': result,
            })
        except ValueError as e:
            return Response({'success': False, 'message': str(e)}, status=503)
        except Exception as e:
            print(f'[Platform Detect Error] {e}')
            return Response({'success': False, 'message': str(e)}, status=500)

    def compress(self, request):
        """POST /api/platform/v1/capabilities/compress/ — 上下文压缩"""
        try:
            data = json_module.loads(request.body) if request.body else {}
        except Exception:
            data = {}

        messages = data.get('messages', [])
        max_tokens = data.get('max_tokens', 4000)
        keep_recent = data.get('keep_recent', 3)

        if not messages:
            return Response({'success': False, 'message': 'messages 不能为空'}, status=400)

        try:
            client = get_deepseek_client()
            compressor = Compressor(
                max_chunks=max_tokens,
                keep_recent=keep_recent,
                provider=Provider(model='deepseek-chat', temperature=0.3),
            )
            session = Session.from_messages(messages)
            compressed = compressor.compress(session, llm_client=client)

            return Response({
                'success': True,
                'data': {
                    'originalCount': len(messages),
                    'compressedCount': len(compressed.chunk_table),
                    'compressionRatio': round(len(compressed.chunk_table) / max(len(messages), 1), 2),
                    'compressedMessages': compressed.chunk_table.to_messages(),
                    'lineage': compressed.export_lineage_graph(),
                }
            })
        except Exception as e:
            return Response({'success': False, 'message': f'压缩失败: {e}'}, status=500)


class OpenRathInfoView(APIView):
    """OpenRath 运行时信息接口"""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        """GET /api/platform/v1/capabilities/openrath-info/"""
        from .openrath_adapter import __version__ as adapter_version

        action = request.GET.get('action', 'stats')

        if action == 'stats':
            return Response({
                'success': True,
                'data': {
                    'adapterVersion': adapter_version,
                    'officialVersion': 'v1.2.1',
                    'license': 'BSD-3-Clause',
                    'source': 'https://github.com/Rath-Team/OpenRath',
                    'docs': 'https://docs.openrath.com/',
                    'pypi': 'https://pypi.org/project/openrath/',
                    'coreModules': [
                        'Session', 'ChunkTable', 'Agent', 'Workflow',
                        'SequentialWorkflow', 'ParallelWorkflow',
                        'BackendSandbox', 'LocalSandbox', 'ProcessSandbox',
                        'MemoryStore', 'LocalMemoryStore',
                        'FlowToolCall', 'Compressor', 'SessionGraph',
                        'RathRuntime', 'Provider',
                    ],
                    'availableAgents': list(AGENT_DEFINITIONS.keys()),
                    'availableScenarios': list(SCENARIO_PROMPTS.keys()),
                    'capabilityCount': len(CAPABILITY_REGISTRY),
                    'agentCount': len(AGENT_DEFINITIONS),
                    'pythonCompat': '3.10-3.13 (official), 3.14+ (via compat layer)',
                },
            })

        if action == 'list_agents':
            agents = []
            for code, defn in AGENT_DEFINITIONS.items():
                agents.append({
                    'code': code,
                    'name': defn['name'],
                    'capabilities': defn['capabilities'],
                    'description': defn['description'],
                    'callEndpoint': '/api/platform/v1/capabilities/call-agent/',
                })
            return Response({'success': True, 'data': agents})

        if action == 'graph_info':
            # 返回全局 Graph 统计（如果有运行中的 Runtime 实例）
            return Response({
                'success': True,
                'data': {
                    'note': 'SessionGraph 在每次检测时自动创建并记录血缘关系',
                    'graphInfoEndpoint': '包含在 detect-stream 的 complete 事件 graphInfo 字段中',
                    'replayEndpoint': '/api/platform/v1/capabilities/replay/{session_id}/',
                },
            })

        # 默认返回概览
        return Response({
            'success': True,
            'data': {
                'name': '一鉴到底平台能力 API',
                'poweredBy': 'OpenRath v1.2.1 (Compat Layer)',
                'endpoints': {
                    'capabilities': 'GET /api/platform/v1/capabilities/',
                    'capabilityDetail': 'GET /api/platform/v1/capabilities/{id}/',
                    'callAgent': 'POST /api/platform/v1/capabilities/call-agent/',
                    'detect': 'POST /api/platform/v1/capabilities/detect/',
                    'compress': 'POST /api/platform/v1/capabilities/compress/',
                    'openrathInfo': 'GET /api/platform/v1/capabilities/openrath-info/',
                },
            },
        })

    @staticmethod
    def _get_examples(capability_id):
        """生成各能力的调用示例"""
        examples = {
            'quad-agent-detect': [
                {
                    'name': '文本检测',
                    'request': {'message': '这是一段需要检测的文本内容', 'scenario': 'text'},
                    'curl': "curl -X POST /api/platform/v1/capabilities/detect/ -H 'Content-Type: application/json' -d '{\"message\":\"测试文本\",\"scenario\":\"text\"}'",
                },
                {
                    'name': '代码检测',
                    'request': {'message': 'def foo():\n    exec(user_input)', 'scenario': 'code'},
                },
            ],
            'agent-auditor': [
                {
                    'name': '基础审核',
                    'request': {'agent_code': 'auditor', 'message': '待审核的文本内容', 'scenario': 'text'},
                },
            ],
            'context-compress': [
                {
                    'name': '压缩长对话',
                    'request': {
                        'messages': [{'role': 'user', 'content': 'msg1'}] * 20,
                        'max_tokens': 4000,
                        'keep_recent': 3,
                    },
                },
            ],
        }
        return examples.get(capability_id, [])
