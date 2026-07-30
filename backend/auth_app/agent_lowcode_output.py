# ============================================================
# Agent 低代码输出引擎 - 一鉴到底
#
# 功能:
#   1. 根据Agent验证结果生成低代码输出
#   2. 支持多种输出格式（JSON Schema、Form配置、API模板）
#   3. 自动生成前端组件配置
#   4. 支持代码片段生成（React/Vue/Python）
#
# 使用场景:
#   - Agent验证完成后，输出可执行的低代码配置
#   - 用户根据输出快速部署/集成
# ============================================================

import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class LowCodeOutputType(Enum):
    """低代码输出类型"""
    JSON_SCHEMA = "json_schema"       # JSON数据结构
    FORM_CONFIG = "form_config"       # 表单配置
    API_TEMPLATE = "api_template"     # API请求模板
    REACT_COMPONENT = "react_component"  # React组件代码
    VUE_COMPONENT = "vue_component"   # Vue组件代码
    PYTHON_SCRIPT = "python_script"   # Python脚本
    WORKFLOW_CONFIG = "workflow_config"  # 工作流配置
    DASHBOARD_CONFIG = "dashboard_config"  # 仪表盘配置


@dataclass
class LowCodeOutput:
    """低代码输出结果"""
    output_type: str
    content: Dict[str, Any]
    metadata: Dict[str, Any]
    executable: bool  # 是否可直接执行
    preview_url: Optional[str] = None
    dependencies: List[str] = None
    
    def to_dict(self):
        return asdict(self)


class AgentLowCodeEngine:
    """
    Agent低代码输出引擎
    
    核心能力:
    1. 智能识别Agent输出中的结构化数据
    2. 自动转换为低代码配置
    3. 支持多格式输出
    4. 验证输出可执行性
    """
    
    def __init__(self):
        self.output_templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, Any]:
        """加载低代码模板"""
        return {
            # 表单配置模板
            'form_config': {
                'schema': {
                    'type': 'object',
                    'properties': {},
                    'required': []
                },
                'ui_schema': {},
                'validation': {}
            },
            # API模板
            'api_template': {
                'method': 'POST',
                'endpoint': '',
                'headers': {},
                'body': {},
                'response_schema': {}
            },
            # React组件模板
            'react_component': {
                'imports': [],
                'props': [],
                'state': {},
                'render': '',
                'hooks': []
            },
            # 工作流模板
            'workflow_config': {
                'steps': [],
                'triggers': [],
                'conditions': []
            }
        }
    
    def generate_output(
        self,
        agent_result: Dict[str, Any],
        output_types: List[str] = None,
        user_context: Dict[str, Any] = None
    ) -> List[LowCodeOutput]:
        """
        根据Agent结果生成低代码输出
        
        参数:
            agent_result: Agent验证/分析结果
            output_types: 需要的输出类型列表
            user_context: 用户上下文（用于定制输出）
        
        返回:
            低代码输出列表
        """
        if output_types is None:
            output_types = ['json_schema', 'form_config']
        
        outputs = []
        
        for output_type in output_types:
            try:
                output = self._generate_single_output(
                    output_type,
                    agent_result,
                    user_context
                )
                outputs.append(output)
            except Exception as e:
                logger.error(f"[LowCode] 生成{output_type}失败: {str(e)}")
        
        return outputs
    
    def _generate_single_output(
        self,
        output_type: str,
        agent_result: Dict[str, Any],
        user_context: Dict[str, Any] = None
    ) -> LowCodeOutput:
        """生成单个类型的低代码输出"""
        
        generator_map = {
            'json_schema': self._generate_json_schema,
            'form_config': self._generate_form_config,
            'api_template': self._generate_api_template,
            'react_component': self._generate_react_component,
            'vue_component': self._generate_vue_component,
            'python_script': self._generate_python_script,
            'workflow_config': self._generate_workflow_config,
            'dashboard_config': self._generate_dashboard_config,
        }
        
        generator = generator_map.get(output_type)
        if not generator:
            raise ValueError(f"不支持的输出类型: {output_type}")
        
        content = generator(agent_result, user_context)
        
        return LowCodeOutput(
            output_type=output_type,
            content=content,
            metadata={
                'agent_type': agent_result.get('agent_type', 'unknown'),
                'generated_at': agent_result.get('timestamp'),
                'version': '1.0.0',
            },
            executable=self._validate_executable(output_type, content),
            dependencies=self._get_dependencies(output_type, content)
        )
    
    # ============================================================
    # JSON Schema生成器
    # ============================================================
    
    def _generate_json_schema(
        self,
        agent_result: Dict[str, Any],
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        从Agent结果生成JSON Schema
        
        用途:
        - 定义数据结构
        - 用于前端表单验证
        - 用于API请求/响应验证
        """
        extracted_data = agent_result.get('result', {})
        
        schema = {
            'type': 'object',
            'title': agent_result.get('title', 'Agent Result Schema'),
            'description': agent_result.get('description', ''),
            'properties': {},
            'required': []
        }
        
        # 分析数据结构
        for key, value in extracted_data.items():
            prop_def = self._infer_property_type(key, value)
            schema['properties'][key] = prop_def
            
            # 必填字段判断
            if value is not None and not isinstance(value, (list, dict)) or \
               (isinstance(value, (list, dict)) and len(value) > 0):
                schema['required'].append(key)
        
        return schema
    
    def _infer_property_type(self, key: str, value: Any) -> Dict[str, Any]:
        """推断属性类型"""
        if isinstance(value, bool):
            return {'type': 'boolean', 'title': key}
        elif isinstance(value, int):
            return {'type': 'integer', 'title': key}
        elif isinstance(value, float):
            return {'type': 'number', 'title': key}
        elif isinstance(value, str):
            return {'type': 'string', 'title': key, 'maxLength': len(value) * 2}
        elif isinstance(value, list):
            return {
                'type': 'array',
                'title': key,
                'items': {'type': 'string'} if value and isinstance(value[0], str) 
                         else {'type': 'object'}
            }
        elif isinstance(value, dict):
            return {
                'type': 'object',
                'title': key,
                'properties': {k: self._infer_property_type(k, v) 
                              for k, v in value.items()}
            }
        else:
            return {'type': 'string', 'title': key}
    
    # ============================================================
    # 表单配置生成器
    # ============================================================
    
    def _generate_form_config(
        self,
        agent_result: Dict[str, Any],
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        生成前端表单配置
        
        支持:
        - Ant Design Form
        - React Hook Form
        - Formily
        """
        extracted_data = agent_result.get('result', {})
        form_type = user_context.get('form_type', 'antd')
        
        config = {
            'form_type': form_type,
            'layout': 'vertical',
            'fields': [],
            'initialValues': {},
            'validationRules': {}
        }
        
        for key, value in extracted_data.items():
            field_config = self._generate_field_config(key, value, form_type)
            config['fields'].append(field_config)
            config['initialValues'][key] = value
        
        return config
    
    def _generate_field_config(
        self,
        key: str,
        value: Any,
        form_type: str
    ) -> Dict[str, Any]:
        """生成字段配置"""
        
        # 字段类型映射
        type_map = {
            bool: 'switch',
            int: 'inputNumber',
            float: 'inputNumber',
            str: 'input' if len(str(value)) < 100 else 'textarea',
            list: 'select' if value and isinstance(value[0], str) else 'jsonEditor',
            dict: 'jsonEditor',
        }
        
        input_type = type_map.get(type(value), 'input')
        
        return {
            'name': key,
            'label': self._generate_label(key),
            'type': input_type,
            'placeholder': f'请输入{self._generate_label(key)}',
            'required': True,
            'rules': self._generate_validation_rules(key, value, form_type),
            'props': {
                'maxLength': 200 if isinstance(value, str) and len(value) < 100 else None,
            }
        }
    
    def _generate_label(self, key: str) -> str:
        """生成中文标签"""
        # 简单的英文->中文映射
        common_labels = {
            'name': '名称',
            'title': '标题',
            'content': '内容',
            'description': '描述',
            'status': '状态',
            'type': '类型',
            'url': '链接',
            'email': '邮箱',
            'phone': '电话',
            'address': '地址',
            'date': '日期',
            'time': '时间',
            'amount': '金额',
            'quantity': '数量',
            'remark': '备注',
            'result': '结果',
            'score': '分数',
            'risk_level': '风险等级',
        }
        return common_labels.get(key.lower(), key)
    
    def _generate_validation_rules(
        self,
        key: str,
        value: Any,
        form_type: str
    ) -> List[Dict[str, Any]]:
        """生成验证规则"""
        rules = [{'required': True, 'message': f'{self._generate_label(key)}不能为空'}]
        
        if isinstance(value, str):
            if 'email' in key.lower():
                rules.append({'type': 'email', 'message': '邮箱格式不正确'})
            elif 'url' in key.lower() or 'link' in key.lower():
                rules.append({'type': 'url', 'message': '链接格式不正确'})
            elif 'phone' in key.lower():
                rules.append({'pattern': r'^\d{11}$', 'message': '电话号码格式不正确'})
        
        return rules
    
    # ============================================================
    # React组件生成器
    # ============================================================
    
    def _generate_react_component(
        self,
        agent_result: Dict[str, Any],
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        生成React组件代码
        
        输出:
        - 完整的React组件代码
        - 可直接复制使用
        """
        extracted_data = agent_result.get('result', {})
        component_name = user_context.get('component_name', 'AgentResult')
        
        # 组件代码模板
        code = f'''import React from 'react';
import {{ Card, Descriptions, Tag, Button }} from 'antd';

/**
 * {component_name} - 自动生成的Agent结果展示组件
 * 生成时间: {agent_result.get('timestamp', 'now')}
 */

interface {component_name}Props {{
  data: {{
    {self._generate_typescript_interface(extracted_data)}
  }};
  onAction?: (action: string) => void;
}}

const {component_name}: React.FC<{component_name}Props> = ({{ data, onAction }}) => {{
  return (
    <Card title="{agent_result.get('title', 'Agent验证结果')}">
      <Descriptions bordered column={{1}}>
        {self._generate_descriptions_items(extracted_data)}
      </Descriptions>
      <div style={{ marginTop: 16 }}>
        <Button type="primary" onClick={() => onAction?.('confirm')}>
          确认结果
        </Button>
        <Button onClick={() => onAction?.('retry')}>
          重新验证
        </Button>
      </div>
    </Card>
  );
};

export default {component_name};
'''
        
        return {
            'code': code,
            'file_name': f'{component_name}.tsx',
            'dependencies': ['react', 'antd'],
            'usage_example': f'''
import {component_name} from './{component_name}';

// 使用示例
<{component_name} 
  data={json.dumps(extracted_data, indent=2)}
  onAction={{(action) => console.log(action)}}
/>
'''
        }
    
    def _generate_typescript_interface(self, data: Dict) -> str:
        """生成TypeScript接口定义"""
        lines = []
        for key, value in data.items():
            ts_type = self._infer_typescript_type(value)
            lines.append(f"{key}: {ts_type};")
        return '\n    '.join(lines)
    
    def _infer_typescript_type(self, value: Any) -> str:
        """推断TypeScript类型"""
        if isinstance(value, bool):
            return 'boolean'
        elif isinstance(value, int):
            return 'number'
        elif isinstance(value, float):
            return 'number'
        elif isinstance(value, str):
            return 'string'
        elif isinstance(value, list):
            if value and isinstance(value[0], str):
                return 'string[]'
            elif value and isinstance(value[0], dict):
                return 'object[]'
            return 'any[]'
        elif isinstance(value, dict):
            return 'object'
        else:
            return 'any'
    
    def _generate_descriptions_items(self, data: Dict) -> str:
        """生成Antd Descriptions Items"""
        items = []
        for key, value in data.items():
            label = self._generate_label(key)
            if isinstance(value, bool):
                value_str = f'<Tag color="{{value ? "success" : "error"}}">{value ? "是" : "否"}</Tag>'
            elif isinstance(value, list):
                value_str = f'{value}'
            else:
                value_str = str(value)
            items.append(f'<Descriptions.Item label="{label}">{{{value_str}}}</Descriptions.Item>')
        return '\n        '.join(items)
    
    # ============================================================
    # Python脚本生成器
    # ============================================================
    
    def _generate_python_script(
        self,
        agent_result: Dict[str, Any],
        user_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        生成Python脚本
        
        用途:
        - 数据处理脚本
        - API调用脚本
        - 自动化脚本
        """
        extracted_data = agent_result.get('result', {})
        
        code = f'''#!/usr/bin/env python3
"""
Agent验证结果处理脚本
生成时间: {agent_result.get('timestamp', 'now')}
"""

import json
import requests
from typing import Dict, Any

# Agent结果数据
AGENT_RESULT = {json.dumps(extracted_data, indent=2, ensure_ascii=False)}

def process_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理Agent验证结果
    
    Args:
        result: Agent返回的结果数据
    
    Returns:
        处理后的数据
    """
    processed = {{
        'status': 'processed',
        'timestamp': result.get('timestamp'),
        'data': {}
    }}
    
    # 数据处理逻辑
    for key, value in result.items():
        if isinstance(value, str):
            processed['data'][key] = value.strip()
        elif isinstance(value, (int, float)):
            processed['data'][key] = value
        elif isinstance(value, list):
            processed['data'][key] = [item for item in value if item]
    
    return processed


def submit_to_api(processed_data: Dict[str, Any], api_url: str) -> bool:
    """
    提交处理后的数据到API
    
    Args:
        processed_data: 处理后的数据
        api_url: API地址
    
    Returns:
        是否成功
    """
    try:
        response = requests.post(
            api_url,
            json=processed_data,
            headers={{'Content-Type': 'application/json'}}
        )
        return response.status_code == 200
    except Exception as e:
        print(f"提交失败: {{e}}")
        return False


if __name__ == '__main__':
    # 处理结果
    processed = process_result(AGENT_RESULT)
    print(json.dumps(processed, indent=2, ensure_ascii=False))
    
    # 可选: 提交到API
    # submit_to_api(processed, 'https://api.example.com/submit')
'''
        
        return {
            'code': code,
            'file_name': f'agent_result_processor.py',
            'dependencies': ['requests'],
            'usage': 'python agent_result_processor.py'
        }
    
    # ============================================================
    # 其他生成器（简化实现）
    # ============================================================
    
    def _generate_vue_component(self, agent_result, user_context=None):
        """生成Vue组件"""
        extracted_data = agent_result.get('result', {})
        return {
            'template': f'<div class="agent-result">{extracted_data}</div>',
            'script': 'export default { data() { return {} } }',
            'dependencies': ['vue']
        }
    
    def _generate_api_template(self, agent_result, user_context=None):
        """生成API请求模板"""
        return {
            'method': 'POST',
            'endpoint': '/api/agent/result',
            'body': agent_result.get('result', {}),
            'headers': {'Authorization': 'Bearer <token>'}
        }
    
    def _generate_workflow_config(self, agent_result, user_context=None):
        """生成工作流配置"""
        return {
            'steps': [
                {'name': 'validate', 'action': 'agent_verify'},
                {'name': 'process', 'action': 'data_transform'},
                {'name': 'output', 'action': 'lowcode_generate'}
            ],
            'triggers': ['on_agent_complete'],
            'conditions': []
        }
    
    def _generate_dashboard_config(self, agent_result, user_context=None):
        """生成仪表盘配置"""
        return {
            'charts': [
                {'type': 'pie', 'dataKey': 'risk_distribution'},
                {'type': 'bar', 'dataKey': 'validation_scores'}
            ],
            'metrics': agent_result.get('result', {})
        }
    
    # ============================================================
    # 验证与依赖
    # ============================================================
    
    def _validate_executable(self, output_type: str, content: Dict) -> bool:
        """验证输出是否可执行"""
        if output_type in ['react_component', 'vue_component', 'python_script']:
            return 'code' in content and len(content['code']) > 0
        elif output_type in ['json_schema', 'form_config']:
            return 'properties' in content or 'fields' in content
        return True
    
    def _get_dependencies(self, output_type: str, content: Dict) -> List[str]:
        """获取所需依赖"""
        return content.get('dependencies', [])


# ============================================================
# Agent集成接口
# ============================================================

def generate_lowcode_from_agent(
    agent_code: str,
    agent_result: Dict[str, Any],
    output_types: List[str] = None,
    user_id: int = None
) -> Dict[str, Any]:
    """
    Agent执行完成后生成低代码输出的主入口
    
    使用方式:
    在agent_views.py中调用:
    
    result = generate_lowcode_from_agent(
        'auditor',
        verification_result,
        ['json_schema', 'form_config', 'react_component'],
        request.user.id
    )
    """
    engine = AgentLowCodeEngine()
    
    outputs = engine.generate_output(
        agent_result,
        output_types,
        {'user_id': user_id, 'agent_code': agent_code}
    )
    
    return {
        'agent_code': agent_code,
        'outputs': [o.to_dict() for o in outputs],
        'count': len(outputs),
        'generated_at': agent_result.get('timestamp'),
    }