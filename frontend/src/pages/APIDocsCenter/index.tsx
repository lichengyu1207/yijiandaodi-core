import React, { useState } from 'react';

interface ApiEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  params?: Array<{ name: string; type: string; required: boolean; desc: string }>;
  response: Record<string, any>;
  codeExample: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'POST', path: '/api/auth/login/', summary: '用户登录',
    description: '使用用户名和密码登录，返回JWT访问令牌和刷新令牌',
    auth: false,
    params: [{ name: 'username', type: 'string', required: true, desc: '用户名' }, { name: 'password', type: 'string', required: true, desc: '密码' }],
    response: { success: true, message: 'ok', data: { access: 'eyJ...', refresh: 'eyJ...', user: { id: 1, username: 'admin' } } },
    codeExample: `POST /api/auth/login/
Content-Type: application/json

{"username": "your_username", "password": "your_password"}

# Response
{
  "success": true,
  "message": "ok",
  "data": {
    "access": "eyJhbGciOiJIUzI1NiIs...",
    "refresh": "eyJhbGciOiJIUzI1NiIs...",
    "user": {"id": 1, "username": "admin"}
  }
}`,
  },
  {
    method: 'GET', path: '/api/recommendation/recommendations', summary: '获取AI推荐列表',
    description: '基于用户行为数据的个性化推荐引擎，支持4种策略变体(balanced/conversion_optimized/engagement_focused/discovery_driven)',
    auth: true,
    params: [
      { name: 'count', type: 'int', required: false, desc: '返回数量(默认20)' },
      { name: 'strategy', type: 'string', required: false, desc: '推荐策略: auto/balanced/conversion_optimized/engagement_focused/discovery_driven' },
      { name: 'tier', type: 'string', required: false, desc: '技能等级过滤' },
    ],
    response: { success: true, message: 'ok', data: { recommendations: [], strategy_used: 'conversion_optimized', algorithm_version: 'v2.0' } },
    codeExample: `GET /api/recommendation/recommendations?count=10&strategy=auto
Authorization: Bearer <your_access_token>

# Response
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "skill_id": "skill_001",
        "name": "AIGC内容检测",
        "match_score": 0.95,
        "reason": "基于您的使用偏好推荐"
      }
    ],
    "strategy_used": "conversion_optimized",
    "algorithm_version": "v2.0"
  }
}`,
  },
  {
    method: 'POST', path: '/api/agent/chat/send', summary: 'AI对话接口',
    description: '四角色AI Agent协作引擎，支持安全检测/内容审核/RAG知识库检索等多轮对话',
    auth: true,
    params: [
      { name: 'message', type: 'string', required: true, desc: '用户消息' },
      { name: 'session_id', type: 'string', required: false, desc: '会话ID(多轮对话)' },
      { name: 'agent_role', type: 'string', required: false, desc: 'Agent角色: security/content/rag/general' },
    ],
    response: { success: true, message: 'ok', data: { reply: '', session_id: '', agent_used: '', tokens_used: 0 } },
    codeExample: `POST /api/agent/chat/send
Authorization: Bearer <your_access_token>
Content-Type: application/json

{
  "message": "请检测这段文本是否为AI生成",
  "session_id": "sess_abc123",
  "agent_role": "security"
}`,
  },
  {
    method: 'GET', path: '/api/skill-config/skills/', summary: '技能配置列表',
    description: '获取200+技能矩阵完整列表，支持分类筛选、搜索、分页',
    auth: true,
    params: [
      { name: 'category', type: 'string', required: false, desc: '分类: security/content/productivity/creative' },
      { name: 'search', type: 'string', required: false, desc: '关键词搜索' },
      { name: 'page', type: 'int', required: false, desc: '页码(默认1)' },
      { name: 'page_size', type: 'int', required: false, desc: '每页数量(默认50)' },
    ],
    response: { success: true, data: { results: [], total: 200, page: 1 } },
    codeExample: `GET /api/skill-config/skills/?category=security&page_size=20
Authorization: Bearer <your_access_token>`,
  },
  {
    method: 'GET', path: '/api/stats/overview', summary: '数据统计总览',
    description: '平台级数据聚合：DAU/WAU/MAU、留存率、营收数据、转化漏斗等核心指标',
    auth: true,
    params: [
      { name: 'days', type: 'int', required: false, desc: '时间范围天数(默认7)' },
    ],
    response: { success: true, data: { dau: 1200, wau: 3500, mau: 8500, revenue: '15000.00' } },
    codeExample: `GET /api/stats/overview?days=30
Authorization: Bearer <your_access_token>`,
  },
  {
    method: 'POST', path: '/api/payment/create-order', summary: '创建支付订单',
    description: '创建会员套餐或场景组合套餐的支付订单，支持7种套餐类型',
    auth: true,
    params: [
      { name: 'order_type', type: 'string', required: true, desc: '订单类型: vip_monthly/vip_yearly_199/combo_security/combo_content/combo_enterprise_full/enterprise_starter_2999/enterprise_premium_19999' },
      { name: 'affiliate_code', type: 'string', required: false, desc: '分销邀请码(佣金归属)' },
    ],
    response: { success: true, data: { order_id: '', order_no: '', amount: '19999.00', pay_url: '' } },
    codeExample: `POST /api/payment/create-order
Authorization: Bearer <your_access_token>

{"order_type": "enterprise_premium_19999", "affiliate_code": "INVITE123"}`,
  },
  {
    method: 'GET', path: '/api/enterprise/my-enterprise', summary: '企业信息查询',
    description: '查询当前企业账号详情：余额、API用量、成员数、密钥状态等',
    auth: true,
    response: { success: true, data: { name: '', plan_type: 'enterprise_premium', balance: '150000.00', api_calls_remaining: 99999 } },
    codeExample: `GET /api/enterprise/my-enterprise
X-API-Key: yjd_<your_32_char_key>`,
  },
  {
    method: 'POST', path: '/api/enterprise/keys/create', summary: '创建API密钥',
    description: '为企业账号生成新的API密钥(SHA-256加密)，支持production/sandbox/readonly三种类型',
    auth: true,
    params: [
      { name: 'name', type: 'string', required: true, desc: '密钥名称' },
      { name: 'key_type', type: 'string', required: false, desc: '类型: production(默认)/sandbox/readonly' },
      { name: 'rate_limit', type: 'int', required: false, desc: '每分钟速率限制(默认120)' },
      { name: 'daily_quota', type: 'int', required: false, desc: '日调用限额(默认5000)' },
    ],
    response: { success: true, data: { key_id: 1, key: 'yjd_abc123...full_key_here...', key_preview: 'yjd_****c3d8' } },
    codeExample: `POST /api/enterprise/keys/create
Authorization: Bearer <your_admin_token>

{"name": "生产环境-主服务", "key_type": "production", "rate_limit": 300}`,
  },
  {
    method: 'POST', path: '/api/enterprise/recharge/submit', summary: '提交充值申请',
    description: '提交企业批量充值申请(余额/API额额度/套餐升级/续费延长)，需管理员审核',
    auth: true,
    params: [
      { name: 'amount', type: 'decimal', required: true, desc: '充值金额(最低100元)' },
      { name: 'recharge_type', type: 'string', required: false, desc: '类型: balance(默认)/api_quota/plan_upgrade/extension' },
      { name: 'payment_method', type: 'string', required: false, desc: '支付方式: bank_transfer/alipay/wechat/system' },
      { name: 'invoice_requested', type: 'bool', required: false, desc: '是否需要发票' },
    ],
    response: { success: true, data: { recharge_id: 1, transaction_no: 'RC20260528001ABCDEF', amount: '50000.00', status: 'pending' } },
    codeExample: `POST /api/enterprise/recharge/submit
Authorization: Bearer <your_admin_token>

{"amount": 50000, "recharge_type": "balance", "payment_method": "bank_transfer", "invoice_requested": true}`,
  },
  {
    method: 'GET', path: '/api/enterprise/dashboard', summary: '企业Dashboard数据',
    description: '企业控制台核心指标：今日/本月用量、日趋势图、Top接口排行、活跃成员列表、最近操作日志',
    auth: true,
    response: { success: true, data: { overview: {}, today: {}, month: {}, daily_trend: [], top_endpoints: [], active_members: [], recent_logs: [] } },
    codeExample: `GET /api/enterprise/dashboard
X-API-Key: yjd_<your_api_key>`,
  },
  // ====== 平台能力 API (Platform Capabilities) ======
  {
    method: 'GET', path: '/api/platform/v1/capabilities/', summary: '平台能力列表',
    description: '获取所有平台核心能力清单，含输入/输出Schema定义、分类统计、OpenRath文档链接',
    auth: true,
    params: [
      { name: 'category', type: 'string', required: false, desc: '分类过滤: detect/agent/compress/runtime' },
    ],
    response: { success: true, data: { total: 12, categories: { detect: 2, agent: 4, compress: 1, runtime: 5 }, capabilities: [], _docs: { github: '', docs: '' } } },
    codeExample: `GET /api/platform/v1/capabilities/
Authorization: Bearer <your_access_token>

# Response
{
  "success": true,
  "data": {
    "total": 12,
    "categories": { "detect": 2, "agent": 4, "compress": 1, "runtime": 5 },
    "capabilities": [
      {
        "id": "quad-agent-detect",
        "name": "四Agent多维协同检测",
        "category": "detect",
        "version": "1.0.0",
        "method": "POST",
        "endpoint": "/api/platform/v1/capabilities/detect/",
        "inputSchema": { "message": "string", "scenario": "string" },
        "outputSchema": { "sessionId": "string", "finalResult": "object" }
      }
    ]
  }
}`,
  },
  {
    method: 'GET', path: '/api/platform/v1/capabilities/{id}/', summary: '能力详情',
    description: '获取单个平台能力的完整定义，含调用示例代码（Python/curl/TypeScript）',
    auth: true,
    params: [
      { name: 'id', type: 'path', required: true, desc: '能力ID: quad-agent-detect/sse-stream-detect/...' },
    ],
    response: { success: true, data: { id: '', name: '', version: '', inputSchema: {}, outputSchema: {}, examples: [] } },
    codeExample: `GET /api/platform/v1/capabilities/quad-agent-detect/
Authorization: Bearer <your_access_token>`,
  },
  {
    method: 'POST', path: '/api/platform/v1/capabilities/call-agent/', summary: '调用单个Agent',
    description: '通过 OpenRath Runtime 独立调用指定的 Agent（auditor/verifier/archiver/judge），返回分析结果和血缘信息',
    auth: true,
    params: [
      { name: 'agent_code', type: 'string', required: true, desc: 'Agent编码: auditor|verifier|archiver|judge' },
      { name: 'message', type: 'string', required: true, desc: '待检测内容' },
      { name: 'scenario', type: 'string', required: false, desc: '场景: code_audit/content_verify/ai_detect/general' },
      { name: 'extra_context', type: 'string', required: false, desc: '附加上下文' },
    ],
    response: { success: true, data: { reply: '', sessionId: '', latencyMs: 0, agentCode: '', usage: {} } },
    codeExample: `POST /api/platform/v1/capabilities/call-agent/
Authorization: Bearer <your_access_token>
Content-Type: application/json

{
  "agent_code": "auditor",
  "message": "请审查这段代码的安全性",
  "scenario": "code_audit"
}

# Response
{
  "success": true,
  "data": {
    "reply": "审计结果：发现3个潜在安全问题...",
    "sessionId": "sess_a1b2c3d4",
    "latencyMs": 1234,
    "agentCode": "auditor",
    "agentName": "安全审计员",
    "usage": { "promptTokens": 450, "completionTokens": 220, "totalTokens": 670 }
  }
}`,
  },
  {
    method: 'POST', path: '/api/platform/v1/capabilities/detect/', summary: '触发四Agent完整检测',
    description: '通过 OpenRath SequentialWorkflow 执行完整的四Agent检测流水线（auditor→verifier→archiver→judge），返回综合判定结果',
    auth: true,
    params: [
      { name: 'message', type: 'string', required: true, desc: '待检测内容' },
      { name: 'scenario', type: 'string', required: false, desc: '检测场景' },
      { name: 'skills', type: 'string[]', required: false, desc: '启用的技能ID列表' },
    ],
    response: { success: true, data: { sessionId: '', scenario: '', totalLatencyMs: 0, finalResult: {}, agentResults: [], graphInfo: {} } },
    codeExample: `POST /api/platform/v1/capabilities/detect/
Authorization: Bearer <your_access_token>
Content-Type: application/json

{
  "message": "检测这段文本是否为AI生成内容",
  "scenario": "ai_detect",
  "skills": ["aigc-text", "deepfake-image"]
}

# Response
{
  "success": true,
  "source": "openrath-runtime",
  "data": {
    "sessionId": "sess_quad_abc123",
    "scenario": "ai_detect",
    "totalLatencyMs": 5678,
    "finalResult": { "verdict": "high_risk", "confidence": 0.92 },
    "agentResults": [
      { "agent": "auditor", "status": "ok", "latencyMs": 1200 },
      { "agent": "verifier", "status": "ok", "latencyMs": 1500 },
      { "agent": "archiver", "status": "ok", "latencyMs": 800 },
      { "agent": "judge", "status": "ok", "latencyMs": 2178 }
    ],
    "graphInfo": { "nodes": 5, "edges": 4, "rootSession": "sess_quad_abc123" }
  }
}`,
  },
  {
    method: 'POST', path: '/api/platform/v1/capabilities/compress/', summary: '上下文智能压缩',
    description: '基于 OpenRath Compressor 的上下文压缩服务，自动提取关键信息、丢弃冗余内容，支持配置保留最近N轮对话',
    auth: true,
    params: [
      { name: 'messages', type: 'array', required: true, desc: '消息列表 [{role, content}]' },
      { name: 'max_tokens', type: 'int', required: false, desc: '最大token数(默认4000)' },
      { name: 'keep_recent', type: 'int', required: false, desc: '保留最近N轮(默认3)' },
    ],
    response: { success: true, data: { originalCount: 20, compressedCount: 8, compressionRatio: 0.4, compressedMessages: [] } },
    codeExample: `POST /api/platform/v1/capabilities/compress/
Authorization: Bearer <your_access_token>
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "第一轮问题..."},
    {"role": "assistant", "content": "第一轮回答..."},
    {"role": "user", "content": "第二轮问题..."}
  ],
  "max_tokens": 4000,
  "keep_recent": 3
}

# Response
{
  "success": true,
  "data": {
    "originalCount": 20,
    "compressedCount": 8,
    "compressionRatio": 0.4,
    "compressedMessages": [
      {"role": "system", "content": "[压缩摘要] 对话涵盖代码审计、安全检测..."},
      {"role": "user", "content": "最近一轮用户问题..."},
      {"role": "assistant", "content": "最近一轮助手回答..."}
    ]
  }
}`,
  },
  {
    method: 'GET', path: '/api/platform/v1/capabilities/openrath-info/', summary: 'OpenRath运行时信息',
    description: '查询 OpenRath 兼容适配层的运行时状态：版本信息、可用Agent列表、支持场景、模块统计',
    auth: true,
    params: [
      { name: 'action', type: 'string', required: false, desc: '操作: stats(默认)|list_agents|graph_info' },
    ],
    response: { success: true, data: { adapterVersion: '1.2.1-compat', officialVersion: 'v1.2.1', coreModules: [], availableAgents: [], availableScenarios: [] } },
    codeExample: `GET /api/platform/v1/capabilities/openrath-info/?action=list_agents
Authorization: Bearer <your_access_token>

# Response
{
  "success": true,
  "data": {
    "adapterVersion": "1.2.1-compat",
    "officialVersion": "v1.2.1",
    "license": "BSD-3-Clause",
    "coreModules": ["Session", "Agent", "Workflow", "Compressor", ...],
    "availableAgents": ["auditor", "verifier", "archiver", "judge"],
    "availableScenarios": ["code_audit", "content_verify", "ai_detect", ...],
    "capabilityCount": 12,
    "agentCount": 4
  }
}`,
  },
];

const METHOD_COLOR: Record<string, string> = {
  GET: '#3B82F6', POST: '#10B981', PUT: '#F59E0B', DELETE: '#EF4444', PATCH: '#8B5CF6',
};

const CATS = ['全部', '认证授权', 'AI推荐', 'Agent对话', '技能管理', '数据统计', '支付订单', '企业版', '平台能力'];

export default function APIDocsCenter() {
  const [activeCat, setActiveCat] = useState('全部');
  const [selectedEp, setSelectedEp] = useState<ApiEndpoint | null>(null);
  const [showSdk, setShowSdk] = useState(false);

  const filtered = activeCat === '全部' ? API_ENDPOINTS : API_ENDPOINTS.filter(ep => {
    if (activeCat === '认证授权') return ep.path.includes('/auth/');
    if (activeCat === 'AI推荐') return ep.path.includes('/recommendation/');
    if (activeCat === 'Agent对话') return ep.path.includes('/agent/');
    if (activeCat === '技能管理') return ep.path.includes('/skill-config/');
    if (activeCat === '数据统计') return ep.path.includes('/stats/') || ep.path.includes('/ab/');
    if (activeCat === '支付订单') return ep.path.includes('/payment/') || ep.path.includes('/affiliate/');
    if (activeCat === '企业版') return ep.path.includes('/enterprise/');
    if (activeCat === '平台能力') return ep.path.includes('/platform/');
    return true;
  });

  return (
    <div className="apidocs-page" style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>一鉴到底 - AI Agent行为安全平台 API 文档中心</h2>
        <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14 }}>OpenAPI 3.0 规范 · RESTful 接口 · JWT/API Key 双重认证 · Agent行为监控API</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {CATS.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: '1px solid ' + (activeCat === cat ? '#3B82F6' : '#E5E7EB'),
                background: activeCat === cat ? '#EFF6FF' : '#fff', color: activeCat === cat ? '#3B82F6' : '#6B7280',
                cursor: 'pointer', fontSize: 13, fontWeight: activeCat === cat ? 600 : 400,
              }}>{cat}</button>
          ))}
          <button onClick={() => setShowSdk(!showSdk)} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #8B5CF6', background: '#FAF5FF', color: '#8B5CF6', cursor: 'pointer', fontSize: 13, fontWeight: 500, marginLeft: 'auto' }}>SDK下载</button>
        </div>
      </div>

      {showSdk && (
        <div style={{ background: 'linear-gradient(135deg,#667eea15,#764ba215)', border: '1px solid #E5E7EB', borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>SDK & 工具包</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { name: 'Python SDK', lang: 'Python 3.8+', icon: '[Py]', cmd: 'pip install yijiandaodi-sdk' },
              { name: 'TypeScript SDK', lang: 'TypeScript 5+', icon: '[TS]', cmd: 'npm install @yijiandaodi/sdk' },
              { name: 'Java SDK', lang: 'Java 17+', icon: '[Jv]', cmd: 'mvn add com.yijiandaodi:sdk:1.0.0' },
              { name: 'Go SDK', lang: 'Go 1.21+', icon: '[Go]', cmd: 'go get github.com/yijiandaodi/go-sdk' },
              { name: 'OpenAPI JSON', lang: 'JSON Spec', icon: '[API]', cmd: 'Download openapi.json' },
              { name: 'Postman Collection', lang: 'Postman', icon: '[PM]', cmd: 'Import collection' },
            ].map(sdk => (
              <div key={sdk.name} style={{ background: '#fff', borderRadius: 6, padding: 14, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span>{sdk.icon}</span><strong style={{ fontSize: 14 }}>{sdk.name}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{sdk.lang}</div>
                <code style={{ display: 'block', padding: '6px 8px', background: '#F9FAFB', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', color: '#374151' }}>{sdk.cmd}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="apidocs-split-layout" style={{ display: 'grid', gridTemplateColumns: selectedEp ? '320px 1fr' : '1fr', gap: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ borderRight: selectedEp ? '1px solid #E5E7EB' : 'none', overflowY: 'auto', maxHeight: 700 }}>
          {filtered.map((ep, i) => (
            <div key={i} onClick={() => setSelectedEp(ep)}
              style={{
                padding: '14px 18px', cursor: 'pointer', borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                background: selectedEp?.path === ep.path ? '#EFF6FF' : 'transparent',
                borderLeft: selectedEp?.path === ep.path ? '3px solid #3B82F6' : '3px solid transparent',
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: METHOD_COLOR[ep.method] || '#6B7280', minWidth: 52, textAlign: 'center' }}>{ep.method}</span>
                <span style={{ fontWeight: 500, fontSize: 13, color: '#111827' }}>{ep.summary}</span>
              </div>
              <code style={{ display: 'block', fontSize: 11, color: '#6B7280', fontFamily: 'monospace', paddingLeft: 60 }}>{ep.path}</code>
            </div>
          ))}
        </div>

        {selectedEp ? (
          <div style={{ padding: 28, overflowY: 'auto', maxHeight: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: METHOD_COLOR[selectedEp.method] }}>{selectedEp.method}</span>
              <code style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{selectedEp.path}</code>
              {selectedEp.auth && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#FEF3C7', color: '#D97706' }}>需要认证</span>}
            </div>
            <p style={{ color: '#4B5563', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{selectedEp.description}</p>

            {selectedEp.params && selectedEp.params.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>请求参数</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
                  <thead><tr style={{ background: '#F9FAFB' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: 500, color: '#6B7280' }}>参数名</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: 500, color: '#6B7280' }}>类型</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #E5E7EB', fontWeight: 500, color: '#6B7280' }}>必填</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: 500, color: '#6B7280' }}>说明</th>
                  </tr></thead>
                  <tbody>
                    {selectedEp.params.map((p, j) => {
                      const reqText = p.required ? 'YES' : 'NO';
                      const reqColor = p.required ? '#EF4444' : '#9CA3AF';
                      return (
                      <tr key={j} style={{ borderBottom: j < selectedEp.params!.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                        <td style={{ padding: '8px 12px' }}><code style={{ fontSize: 12, color: '#3B82F6' }}>{p.name}</code></td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#6B7280' }}>{p.type}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}><span style={{ color: reqColor, fontSize: 12 }}>{reqText}</span></td>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>{p.desc}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>响应示例</h4>
              <pre style={{ background: '#1E293B', color: '#E2E8F0', borderRadius: 6, padding: 16, fontSize: 12, fontFamily: 'Consolas, monospace', overflowX: 'auto', lineHeight: 1.5 }}>
                {JSON.stringify(selectedEp.response, null, 2)}
              </pre>
            </div>

            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>代码示例</h4>
              <pre style={{ background: '#1E293B', color: '#E2E8F0', borderRadius: 6, padding: 16, fontSize: 12, fontFamily: 'Consolas, monospace', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedEp.codeExample}
              </pre>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9CA3AF', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 40 }}>[docs]</span>
            <span style={{ fontSize: 15 }}>选择左侧接口查看详细文档</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, padding: 20, background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>[i]</span>
        <div>
          <strong style={{ color: '#92400E' }}>API 调用提示</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#92400E', fontSize: 13, lineHeight: 1.7 }}>
            <li>所有接口基础URL: <code style={{ background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>https://api.yijiandaodi.com</code></li>
            <li>认证方式: <code style={{ background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>Authorization: Bearer &lt;token&gt;</code> 或 <code style={{ background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>X-API-Key: yjd_&lt;key&gt;</code></li>
            <li>企业版API密钥前缀: <code style={{ background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>yjd_</code> + 32位随机字符，SHA-256哈希存储</li>
            <li>速率限制: 生产环境默认120次/分钟，可按密钥单独配置</li>
            <li>响应格式统一: <code style={{ background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>{'{success, message, data}'}</code></li>
          </ul>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .apidocs-split-layout {
            grid-template-columns: 1fr !important;
          }
          .apidocs-page {
            padding: 12px !important;
          }
        }
        @media (max-width: 480px) {
          .apidocs-page {
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
