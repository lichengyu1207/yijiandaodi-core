export interface SkillItem {
  id: number;
  name: string;
  category: string;
  mainScenario: string;
  keywords: string[];
  weight: number;
  devDays: number;
  monetizationType: string;
  tier: 'core' | 'security' | 'product' | 'vertical' | 'monetization' | 'multilingual' | 'professional' | 'special' | 'compliance' | 'ai-detect' | 'content-security' | 'ai-governance' | 'vertical-peer' | 'infoflow-detect' | 'traffic-optimize' | 'infoflow-compliance' | 'multimodal-infoflow' | 'context-understanding' | 'long-conversation' | 'context-risk-control' | 'vertical-context' | 'retrieval-system' | 'cluster-management' | 'file-operation' | 'voice-input' | 'general-agent' | 'enterprise-agent' | 'vertical-agent' | 'multi-agent-collab';
  icon?: string;
  color?: string;
}

export const SKILL_CATEGORIES = [
  { key: 'core', label: '核心鉴别场景', icon: 'Shield', color: '#165DFF', description: '8大基础鉴别能力' },
  { key: 'security', label: '安全融合层', icon: 'Lock', color: '#722ED1', description: '企业级安全防护' },
  { key: 'product', label: '产品融合层', icon: 'Layers', color: '#00B42A', description: 'Agent与工作流编排' },
  { key: 'vertical', label: '垂直场景层', icon: 'Target', color: '#FF7D00', description: '行业深度定制场景' },
  { key: 'monetization', label: '变现生态层', icon: 'CreditCard', color: '#F53F3F', description: '商业化闭环工具' },
  { key: 'multilingual', label: '多语言蓝海层', icon: 'Globe', color: '#14B8A6', description: '全球化多语言支持' },
  { key: 'professional', label: '专业领域层', icon: 'Briefcase', color: '#F97316', description: '垂直行业专业检测' },
  { key: 'special', label: '特殊内容层', icon: 'Sparkles', color: '#EC4899', description: '前沿技术鉴别' },
  { key: 'compliance', label: '合规审计层', icon: 'Scale', color: '#6366F1', description: '企业合规与治理' },
  { key: 'ai-detect', label: 'AI检测同行层', icon: 'BrainCircuit', color: '#8B5CF6', description: 'AI生成内容深度检测' },
  { key: 'content-security', label: '内容安全同行层', icon: 'ShieldAlert', color: '#DC2626', description: '企业级内容安全' },
  { key: 'ai-governance', label: 'AI治理同行层', icon: 'Building2', color: '#475569', description: 'AI风险管理与评估' },
  { key: 'vertical-peer', label: '垂直场景同行层', icon: 'FileSearch', color: '#0EA5E9', description: '垂直领域精细化检测' },
  { key: 'infoflow-detect', label: '信息流检测层', icon: 'Rss', color: '#F59E0B', description: '信息流实时审核' },
  { key: 'traffic-optimize', label: '流量优化层', icon: 'TrendingUp', color: '#10B981', description: '内容分发与增长' },
  { key: 'infoflow-compliance', label: '信息流合规层', icon: 'Gavel', color: '#EF4444', description: '信息流合规风控' },
  { key: 'multimodal-infoflow', label: '多模态信息流层', icon: 'Image', color: '#A855F7', description: '多模态内容审核' },
  { key: 'context-understanding', label: '上下文理解层', icon: 'MessageSquare', color: '#0EA5E9', description: '多轮对话语义分析' },
  { key: 'long-conversation', label: '长对话管理层', icon: 'Clock', color: '#F59E0B', description: '超长上下文缓存与检索' },
  { key: 'context-risk-control', label: '上下文风控层', icon: 'ShieldAlert', color: '#EF4444', description: '上下文安全与风险控制' },
  { key: 'vertical-context', label: '垂直上下文层', icon: 'Building2', color: '#6366F1', description: '行业垂直场景上下文' },
  { key: 'retrieval-system', label: '检索系统层', icon: 'Search', color: '#8B5CF6', description: '向量/全文/图谱检索' },
  { key: 'cluster-management', label: '集群管理层', icon: 'Server', color: '#DC2626', description: 'GPU调度与容器编排' },
  { key: 'file-operation', label: '文件操作层', icon: 'FileText', color: '#059669', description: '多格式文件解析与管理' },
  { key: 'voice-input', label: '语音输入层', icon: 'Mic', color: '#EC4899', description: '语音转写与合成' },
  { key: 'general-agent', label: '通用Agent层', icon: 'Bot', color: '#14B8A6', description: '多Agent协作与自主规划' },
  { key: 'enterprise-agent', label: '企业Agent层', icon: 'Building', color: '#475569', description: '可信AI与全链路审计' },
  { key: 'vertical-agent', label: '垂直Agent层', icon: 'Factory', color: '#F97316', description: '行业专属Agent系统' },
  { key: 'multi-agent-collab', label: '多Agent协作层', icon: 'Users', color: '#7C3AED', description: '多模型协同与互操作' },
];

export const MONETIZATION_TYPES = [
  { key: 'free+pay', label: '免费基础+按次付费', color: '#165DFF' },
  { key: 'member+pay', label: '会员免费+按次付费', color: '#FF7D00' },
  { key: 'pay+enterprise', label: '按次付费+企业定制', color: '#722ED1' },
  { key: 'enterprise', label: '企业定制', color: '#F53F3F' },
  { key: 'free', label: '完全免费', color: '#00B42A' },
];

export const SKILL_MATRIX: SkillItem[] = [
  { id: 1, name: 'AI文案鉴别(通用)', category: '核心鉴别场景', mainScenario: 'AI文案鉴别', keywords: ['文案鉴别', 'AI生成检测', '修改建议'], weight: 10, devDays: 3, monetizationType: '免费基础+按次付费', tier: 'core' },
  { id: 2, name: 'AI图片鉴别(通用)', category: '核心鉴别场景', mainScenario: 'AI图片鉴别', keywords: ['图片鉴别', 'AI生成检测', '热力图'], weight: 10, devDays: 3, monetizationType: '免费基础+按次付费', tier: 'core' },
  { id: 3, name: 'AI代码鉴别(通用)', category: '核心鉴别场景', mainScenario: 'AI代码鉴别', keywords: ['代码鉴别', '抄袭检测', '漏洞扫描'], weight: 10, devDays: 3, monetizationType: '免费基础+按次付费', tier: 'core' },
  { id: 4, name: 'AI论文鉴别(学生/学术)', category: '核心鉴别场景', mainScenario: 'AI论文鉴别', keywords: ['论文鉴别', '学术不端', '参考文献校验'], weight: 10, devDays: 3, monetizationType: '免费基础+按次付费', tier: 'core' },
  { id: 5, name: 'AI简历鉴别(HR/求职者)', category: '核心鉴别场景', mainScenario: 'AI简历鉴别', keywords: ['简历鉴别', '优化建议', '岗位匹配'], weight: 9, devDays: 3, monetizationType: '会员免费+按次付费', tier: 'core' },
  { id: 6, name: 'AI合同鉴别(企业/法务)', category: '核心鉴别场景', mainScenario: 'AI合同鉴别', keywords: ['合同鉴别', '风险识别', '法律合规'], weight: 9, devDays: 3, monetizationType: '会员免费+按次付费', tier: 'core' },
  { id: 7, name: 'AI营销文案鉴别(电商/新媒体)', category: '核心鉴别场景', mainScenario: 'AI营销文案鉴别', keywords: ['营销文案', '原创度', '转化率优化'], weight: 9, devDays: 3, monetizationType: '会员免费+按次付费', tier: 'core' },
  { id: 8, name: 'AI短视频脚本鉴别(短视频从业者)', category: '核心鉴别场景', mainScenario: 'AI短视频脚本鉴别', keywords: ['脚本鉴别', '爆款分析', '分镜优化'], weight: 9, devDays: 3, monetizationType: '会员免费+按次付费', tier: 'core' },
  { id: 9, name: 'AI医疗报告鉴别(医疗行业)', category: '核心鉴别场景', mainScenario: 'AI医疗报告鉴别', keywords: ['医疗报告', '数据篡改', '风险提示'], weight: 8, devDays: 5, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 10, name: 'AI法律文书鉴别(法律行业)', category: '核心鉴别场景', mainScenario: 'AI法律文书鉴别', keywords: ['法律文书', '判例对比', '合规审查'], weight: 8, devDays: 5, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 11, name: 'AI财务报表鉴别(金融行业)', category: '核心鉴别场景', mainScenario: 'AI财务报表鉴别', keywords: ['财务报表', '数据造假', '风控审计'], weight: 8, devDays: 5, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 12, name: 'AI设计稿鉴别(设计行业)', category: '核心鉴别场景', mainScenario: 'AI设计稿鉴别', keywords: ['设计稿', '抄袭检测', '版权验证'], weight: 8, devDays: 5, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 13, name: 'AI生成内容溯源(独家技术)', category: '核心鉴别场景', mainScenario: 'AI生成内容溯源', keywords: ['内容溯源', '模型追踪', '证据链'], weight: 7, devDays: 7, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 14, name: 'AI深度伪造视频鉴别(独家)', category: '核心鉴别场景', mainScenario: 'AI深度伪造视频鉴别', keywords: ['深度伪造', '换脸检测', '语音克隆'], weight: 7, devDays: 7, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 15, name: 'AI学术不端全链路检测(独家)', category: '核心鉴别场景', mainScenario: 'AI学术不端全链路检测', keywords: ['学术不端', '数据造假', '图片篡改'], weight: 7, devDays: 7, monetizationType: '按次付费+企业定制', tier: 'core' },
  { id: 16, name: '企业级AI内容安全审计(定制化)', category: '核心鉴别场景', mainScenario: '企业级AI内容安全审计', keywords: ['安全审计', '批量检测', 'API接口'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'core' },
  { id: 51, name: '全品类内容安全检测', category: '安全融合层', mainScenario: 'AI文案鉴别', keywords: ['内容审核', '多模态', '实时风控'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'security' },
  { id: 52, name: '账号反欺诈与异常行为检测', category: '安全融合层', mainScenario: 'AI文案鉴别', keywords: ['账号安全', '设备指纹', '行为分析'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'security' },
  { id: 53, name: '终端数据防泄漏', category: '安全融合层', mainScenario: 'AI文案鉴别', keywords: ['数据安全', '敏感信息', '泄露防护'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'security' },
  { id: 54, name: '内部员工行为审计与溯源', category: '安全融合层', mainScenario: 'AI文案鉴别', keywords: ['行为审计', '日志分析', '威胁溯源'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'security' },
  { id: 55, name: '低代码Agent可视化编排', category: '产品融合层', mainScenario: 'AI文案鉴别', keywords: ['Agent开发', '可视化', '插件集成'], weight: 9, devDays: 5, monetizationType: '会员免费+企业定制', tier: 'product' },
  { id: 56, name: 'AI工作流拖拽式编排', category: '产品融合层', mainScenario: 'AI文案鉴别', keywords: ['工作流', '自动化', '任务调度'], weight: 9, devDays: 7, monetizationType: '会员免费+企业定制', tier: 'product' },
  { id: 57, name: 'AI内容+抄袭双引擎检测', category: '产品融合层', mainScenario: 'AI文案鉴别', keywords: ['双引擎检测', '原创度', '重复率'], weight: 10, devDays: 3, monetizationType: '免费基础+按次付费', tier: 'product' },
  { id: 58, name: '学术论文分章节深度检测', category: '产品融合层', mainScenario: 'AI论文鉴别', keywords: ['分章节检测', '段落标注', '引用校验'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'product' },
  { id: 59, name: '全网内容抄袭比对', category: '产品融合层', mainScenario: 'AI文案鉴别', keywords: ['全网比对', '版权检测', '相似度'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'product' },
  { id: 60, name: '本地知识库双向链接', category: '产品融合层', mainScenario: 'AI文案鉴别', keywords: ['双向链接', '知识图谱', '关联推荐'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'product' },
  { id: 61, name: '学术论文引用格式自动修正', category: '垂直场景层', mainScenario: 'AI论文鉴别', keywords: ['引用格式', '自动修正', '高校标准'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'vertical' },
  { id: 62, name: '英文语法与拼写纠错', category: '垂直场景层', mainScenario: 'AI文案鉴别', keywords: ['语法纠错', '拼写检查', '润色'], weight: 9, devDays: 3, monetizationType: '免费基础', tier: 'vertical' },
  { id: 63, name: '简历关键词优化与匹配度分析', category: '垂直场景层', mainScenario: 'AI简历鉴别', keywords: ['关键词优化', '岗位匹配', 'ATS适配'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'vertical' },
  { id: 64, name: '合同条款风险点逐条标注', category: '垂直场景层', mainScenario: 'AI合同鉴别', keywords: ['风险标注', '逐条解析', '修改建议'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'vertical' },
  { id: 65, name: '发票与票据AI识别与验真', category: '垂直场景层', mainScenario: 'AI财务报表鉴别', keywords: ['发票识别', '验真', '数据提取'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical' },
  { id: 66, name: '设计稿原创度与版权比对', category: '垂直场景层', mainScenario: 'AI设计稿鉴别', keywords: ['原创度', '版权比对', '侵权检测'], weight: 8, devDays: 5, monetizationType: '按次付费', tier: 'vertical' },
  { id: 67, name: '论文查重与AI生成联合检测', category: '垂直场景层', mainScenario: 'AI论文鉴别', keywords: ['联合检测', '查重', 'AI生成'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'vertical' },
  { id: 68, name: '写作风格一致性检测', category: '垂直场景层', mainScenario: 'AI文案鉴别', keywords: ['风格检测', '一致性', '作者识别'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'vertical' },
  { id: 69, name: '多格式文档批量鉴别', category: '垂直场景层', mainScenario: 'AI文案鉴别', keywords: ['批量检测', '多格式', '批量导出'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'vertical' },
  { id: 70, name: '写作辅助与润色建议', category: '垂直场景层', mainScenario: 'AI文案鉴别', keywords: ['润色', '改写', '风格调整'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'vertical' },
  { id: 71, name: '创作者赞助与打赏系统', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['打赏', '赞助', '创作者分成'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 72, name: '付费邮件订阅与推送', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['邮件订阅', '推送', '付费内容'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'monetization' },
  { id: 73, name: '数字产品自动交付', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['自动交付', '数字产品', '订单管理'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 74, name: '联盟营销与佣金结算', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['联盟营销', '佣金', '结算'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 75, name: '全球多币种支付集成', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['多币种', '支付', '跨境结算'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 76, name: '用户行为分析与转化漏斗', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['行为分析', '转化漏斗', '数据统计'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 77, name: 'A/B测试与实验平台', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['A/B测试', '实验', '优化'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 78, name: '用户热力图与会话录制', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['热力图', '会话录制', '用户体验'], weight: 8, devDays: 5, monetizationType: '免费', tier: 'monetization' },
  { id: 79, name: '企业团队协作与权限管理', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['团队协作', '权限管理', '角色分配'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'monetization' },
  { id: 80, name: 'API接口与开发者文档', category: '变现生态层', mainScenario: 'AI文案鉴别', keywords: ['API', '开发者文档', 'SDK'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'monetization' },
  { id: 81, name: '多语言AI文本鉴别(20+小语种)', category: '多语言蓝海层', mainScenario: 'AI文案鉴别', keywords: ['多语言', '小语种', '文化适配'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'multilingual' },
  { id: 82, name: '中文方言AI语音鉴别(10+方言)', category: '多语言蓝海层', mainScenario: 'AI文案鉴别', keywords: ['方言', '语音鉴别', '声纹对比'], weight: 8, devDays: 5, monetizationType: '按次付费', tier: 'multilingual' },
  { id: 83, name: '跨境电商多语言文案合规检测', category: '多语言蓝海层', mainScenario: 'AI营销文案鉴别', keywords: ['跨境电商', '合规检测', '本地化'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'multilingual' },
  { id: 84, name: '非英语学术论文AI鉴别', category: '多语言蓝海层', mainScenario: 'AI论文鉴别', keywords: ['非英语', '学术论文', '引用格式'], weight: 8, devDays: 3, monetizationType: '按次付费', tier: 'multilingual' },
  { id: 85, name: '医疗器械说明书AI鉴别', category: '专业领域层', mainScenario: 'AI医疗报告鉴别', keywords: ['医疗器械', '说明书', '合规审核'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'professional' },
  { id: 86, name: '金融信托合同AI鉴别', category: '专业领域层', mainScenario: 'AI合同鉴别', keywords: ['信托合同', '风险识别', '收益测算'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'professional' },
  { id: 87, name: '建筑工程图纸AI鉴别', category: '专业领域层', mainScenario: 'AI设计稿鉴别', keywords: ['工程图纸', '合规检测', '质量评估'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'professional' },
  { id: 88, name: '药物临床试验报告AI鉴别', category: '专业领域层', mainScenario: 'AI医疗报告鉴别', keywords: ['临床试验', '数据验证', '伦理合规'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'professional' },
  { id: 89, name: '智能合约代码AI鉴别', category: '专业领域层', mainScenario: 'AI代码鉴别', keywords: ['智能合约', '漏洞扫描', '区块链'], weight: 8, devDays: 5, monetizationType: '按次付费', tier: 'professional' },
  { id: 90, name: 'K12/高校教育课件AI鉴别', category: '专业领域层', mainScenario: 'AI文案鉴别', keywords: ['教育课件', '质量评估', '合规检测'], weight: 8, devDays: 3, monetizationType: '企业定制', tier: 'professional' },
  { id: 91, name: '3D模型AI生成鉴别', category: '特殊内容层', mainScenario: 'AI图片鉴别', keywords: ['3D模型', 'STL/OBJ', '版权验证'], weight: 7, devDays: 7, monetizationType: '按次付费', tier: 'special' },
  { id: 92, name: 'AI生成音频与语音克隆鉴别', category: '特殊内容层', mainScenario: 'AI文案鉴别', keywords: ['音频鉴别', '语音克隆', '声纹验证'], weight: 8, devDays: 5, monetizationType: '按次付费', tier: 'special' },
  { id: 93, name: '电子签名AI伪造鉴别', category: '特殊内容层', mainScenario: 'AI图片鉴别', keywords: ['电子签名', '伪造检测', '身份验证'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'special' },
  { id: 94, name: '短视频字幕AI生成鉴别', category: '特殊内容层', mainScenario: 'AI短视频脚本鉴别', keywords: ['字幕鉴别', 'AI生成', '合规检测'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'special' },
  { id: 95, name: '直播弹幕AI实时鉴别', category: '特殊内容层', mainScenario: 'AI文案鉴别', keywords: ['直播弹幕', '实时检测', '敏感词过滤'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'special' },
  { id: 96, name: 'AI模型安全审计', category: '合规审计层', mainScenario: '企业级AI内容安全审计', keywords: ['模型审计', '数据泄露', '算法偏见'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'compliance' },
  { id: 97, name: '生成式AI应用合规检测', category: '合规审计层', mainScenario: '企业级AI内容安全审计', keywords: ['合规检测', '隐私保护', '内容安全'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'compliance' },
  { id: 98, name: '司法数字取证AI内容鉴别', category: '合规审计层', mainScenario: 'AI生成内容溯源', keywords: ['数字取证', '证据鉴定', '司法报告'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'compliance' },
  { id: 99, name: '企业AI内容安全运营中心', category: '合规审计层', mainScenario: '企业级AI内容安全审计', keywords: ['安全运营', '风险监控', '告警响应'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'compliance' },
  { id: 100, name: 'AI伦理与公平性评估', category: '合规审计层', mainScenario: '企业级AI内容安全审计', keywords: ['伦理评估', '公平性', '透明度'], weight: 7, devDays: 5, monetizationType: '企业定制', tier: 'compliance' },
  { id: 101, name: 'AI文本句子级概率标注', category: 'AI检测同行层', mainScenario: 'AI文案鉴别', keywords: ['句子级标注', '概率分布', '高亮显示'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'ai-detect' },
  { id: 102, name: '多模态AI批量检测', category: 'AI检测同行层', mainScenario: 'AI文案鉴别', keywords: ['多模态', '批量检测', 'API接口'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'ai-detect' },
  { id: 103, name: '学术论文参考文献真实性验证', category: 'AI检测同行层', mainScenario: 'AI论文鉴别', keywords: ['参考文献', '真实性验证', '来源追溯'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'ai-detect' },
  { id: 104, name: '多模型交叉验证低误判检测', category: 'AI检测同行层', mainScenario: 'AI文案鉴别', keywords: ['多模型', '交叉验证', '低误判'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'ai-detect' },
  { id: 105, name: '中文语境深度适配检测', category: 'AI检测同行层', mainScenario: 'AI文案鉴别', keywords: ['中文语境', '语义理解', '文化适配'], weight: 9, devDays: 3, monetizationType: '免费基础', tier: 'ai-detect' },
  { id: 106, name: '自定义安全规则引擎', category: '内容安全同行层', mainScenario: '企业级AI内容安全审计', keywords: ['自定义规则', '规则库', '实时更新'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'content-security' },
  { id: 107, name: '内容风险分级与可视化', category: '内容安全同行层', mainScenario: '企业级AI内容安全审计', keywords: ['风险分级', '数据可视化', '仪表盘'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'content-security' },
  { id: 108, name: '边缘计算轻量化部署', category: '内容安全同行层', mainScenario: '企业级AI内容安全审计', keywords: ['边缘计算', '轻量化', '低延迟'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'content-security' },
  { id: 109, name: '设备指纹与关联分析', category: '内容安全同行层', mainScenario: '企业级AI内容安全审计', keywords: ['设备指纹', '关联分析', '欺诈识别'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'content-security' },
  { id: 110, name: '大模型Prompt注入检测', category: '内容安全同行层', mainScenario: '企业级AI内容安全审计', keywords: ['Prompt注入', '攻击检测', '输出过滤'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'content-security' },
  { id: 111, name: '生成式AI合规报告生成', category: 'AI治理同行层', mainScenario: '企业级AI内容安全审计', keywords: ['合规报告', 'GDPR', 'CCPA'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'ai-governance' },
  { id: 112, name: 'AI模型风险管理与评估', category: 'AI治理同行层', mainScenario: '企业级AI内容安全审计', keywords: ['模型风险', '评估', '监控'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'ai-governance' },
  { id: 113, name: '安全态势感知与威胁溯源', category: 'AI治理同行层', mainScenario: '企业级AI内容安全审计', keywords: ['态势感知', '威胁溯源', '日志审计'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'ai-governance' },
  { id: 114, name: '移动应用合规与隐私检测', category: 'AI治理同行层', mainScenario: '企业级AI内容安全审计', keywords: ['移动应用', '合规检测', '隐私保护'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'ai-governance' },
  { id: 115, name: '敏感数据识别与分类分级', category: 'AI治理同行层', mainScenario: '企业级AI内容安全审计', keywords: ['敏感数据', '识别', '分类分级'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'ai-governance' },
  { id: 116, name: '学术论文图片真实性检测', category: '垂直场景同行层', mainScenario: 'AI论文鉴别', keywords: ['论文图片', '真实性检测', '篡改识别'], weight: 9, devDays: 3, monetizationType: '按次付费', tier: 'vertical-peer' },
  { id: 117, name: '文本事实核查与溯源', category: '垂直场景同行层', mainScenario: 'AI生成内容溯源', keywords: ['事实核查', '来源验证', '虚假信息'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'vertical-peer' },
  { id: 118, name: '实时聊天上下文语义审核', category: '垂直场景同行层', mainScenario: 'AI文案鉴别', keywords: ['上下文审核', '语义分析', '意图识别'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'vertical-peer' },
  { id: 119, name: '医疗文本合规与医保数据安全', category: '垂直场景同行层', mainScenario: 'AI医疗报告鉴别', keywords: ['医疗合规', '医保数据', '隐私保护'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-peer' },
  { id: 120, name: '新闻内容虚假信息识别', category: '垂直场景同行层', mainScenario: 'AI文案鉴别', keywords: ['虚假新闻', '识别', '权威验证'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'vertical-peer' },
  { id: 121, name: '信息流AI痕迹与限流检测', category: '信息流检测层', mainScenario: 'AI营销文案鉴别', keywords: ['AI痕迹', '限流检测', '流量预测'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'infoflow-detect' },
  { id: 122, name: '全栈式信息流实时审核', category: '信息流检测层', mainScenario: 'AI文案鉴别', keywords: ['实时审核', '多模态', '低延迟'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'infoflow-detect' },
  { id: 123, name: '信息流上下文语义与意图分析', category: '信息流检测层', mainScenario: 'AI文案鉴别', keywords: ['上下文分析', '意图判定', '情感分析'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'infoflow-detect' },
  { id: 124, name: '信息流多维度审核与批量处理', category: '信息流检测层', mainScenario: 'AI文案鉴别', keywords: ['多维度审核', '批量处理', '数据统计'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'infoflow-detect' },
  { id: 125, name: '信息流中文语境与风险分级', category: '信息流检测层', mainScenario: 'AI文案鉴别', keywords: ['中文语境', '风险分级', '动态阈值'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'infoflow-detect' },
  { id: 126, name: '信息流爆款预测与选题推荐', category: '流量优化层', mainScenario: 'AI营销文案鉴别', keywords: ['爆款预测', '选题推荐', '标题优化'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'traffic-optimize' },
  { id: 127, name: '公众号内容违规风险预警', category: '流量优化层', mainScenario: 'AI营销文案鉴别', keywords: ['公众号', '违规预警', '数据追踪'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'traffic-optimize' },
  { id: 128, name: '多平台内容一键分发', category: '流量优化层', mainScenario: 'AI营销文案鉴别', keywords: ['多平台', '一键分发', '同步管理'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'traffic-optimize' },
  { id: 129, name: '粉丝画像与互动预测', category: '流量优化层', mainScenario: 'AI营销文案鉴别', keywords: ['粉丝画像', '互动预测', '变现建议'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'traffic-optimize' },
  { id: 130, name: '信息流SEO优化与标题评分', category: '流量优化层', mainScenario: 'AI营销文案鉴别', keywords: ['SEO优化', '标题评分', '关键词排名'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'traffic-optimize' },
  { id: 131, name: '政务信息流合规与政策适配', category: '信息流合规层', mainScenario: 'AI文案鉴别', keywords: ['政务合规', '政策适配', '敏感信息'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'infoflow-compliance' },
  { id: 132, name: '信息流反垃圾与欺诈识别', category: '信息流合规层', mainScenario: 'AI文案鉴别', keywords: ['反垃圾', '欺诈识别', '黑产发现'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'infoflow-compliance' },
  { id: 133, name: '信息流账号异常与设备风控', category: '信息流合规层', mainScenario: 'AI文案鉴别', keywords: ['账号异常', '设备风控', '实时拦截'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'infoflow-compliance' },
  { id: 134, name: '新闻信息流版权与权威验证', category: '信息流合规层', mainScenario: 'AI文案鉴别', keywords: ['版权保护', '权威验证', '来源追溯'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'infoflow-compliance' },
  { id: 135, name: '企业信息流数据安全与隐私', category: '信息流合规层', mainScenario: 'AI文案鉴别', keywords: ['企业信息流', '数据安全', '隐私保护'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'infoflow-compliance' },
  { id: 136, name: '信息流图片/视频深度伪造检测', category: '多模态信息流层', mainScenario: 'AI深度伪造视频鉴别', keywords: ['深度伪造', '图片/视频', '水印溯源'], weight: 8, devDays: 5, monetizationType: '按次付费', tier: 'multimodal-infoflow' },
  { id: 137, name: '信息流多模态合成内容鉴别', category: '多模态信息流层', mainScenario: 'AI文案鉴别', keywords: ['多模态', '合成内容', '风险标识'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multimodal-infoflow' },
  { id: 138, name: '信息流边缘计算与离线处理', category: '多模态信息流层', mainScenario: 'AI文案鉴别', keywords: ['边缘计算', '离线处理', '批量审核'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'multimodal-infoflow' },
  { id: 139, name: '信息流热点追踪与情感分析', category: '多模态信息流层', mainScenario: 'AI文案鉴别', keywords: ['热点追踪', '情感分析', '关键词提取'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'multimodal-infoflow' },
  { id: 140, name: '金融信息流欺诈与合规检测', category: '多模态信息流层', mainScenario: 'AI财务报表鉴别', keywords: ['金融欺诈', '合规检测', '风险预'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multimodal-infoflow' },
  // ===== 上下文理解层 (141-145) =====
  { id: 141, name: '多轮对话上下文语义分析', category: '上下文理解层', mainScenario: 'AI文案鉴别', keywords: ['多轮对话', '语义分析', '指代消解'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'context-understanding' },
  { id: 142, name: '上下文敏感信息动态过滤', category: '上下文理解层', mainScenario: 'AI文案鉴别', keywords: ['动态过滤', '变种识别', '多模态融合'], weight: 9, devDays: 3, monetizationType: '企业定制', tier: 'context-understanding' },
  { id: 143, name: '超长文本上下文摘要与提取', category: '上下文理解层', mainScenario: 'AI文案鉴别', keywords: ['超长文本', '摘要', '关键信息提取'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'context-understanding' },
  { id: 144, name: '跨模态上下文理解与推理', category: '上下文理解层', mainScenario: 'AI文案鉴别', keywords: ['跨模态', '知识图谱', '上下文推理'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'context-understanding' },
  { id: 145, name: '上下文无负担收集与智能浮现', category: '上下文理解层', mainScenario: 'AI文案鉴别', keywords: ['上下文收集', '智能浮现', '主动推送'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'context-understanding' },
  // ===== 长对话管理层 (146-150) =====
  { id: 146, name: '200K tokens超长上下文缓存', category: '长对话管理层', mainScenario: 'AI文案鉴别', keywords: ['超长上下文', '缓存', '段落引用'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'long-conversation' },
  { id: 147, name: '1M tokens环形注意力检索', category: '长对话管理层', mainScenario: 'AI文案鉴别', keywords: ['环形注意力', '多跳检索', '上下文压缩'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'long-conversation' },
  { id: 148, name: '上下文路由与记忆管理', category: '长对话管理层', mainScenario: 'AI文案鉴别', keywords: ['上下文路由', '记忆机制', '多模态融合'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'long-conversation' },
  { id: 149, name: '上下文检索增强与自动摘要', category: '长对话管理层', mainScenario: 'AI文案鉴别', keywords: ['检索增强', '自动摘要', '实体链接'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'long-conversation' },
  { id: 150, name: '上下文连贯性与一致性校验', category: '长对话管理层', mainScenario: 'AI文案鉴别', keywords: ['连贯性', '一致性', '错误修正'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'long-conversation' },
  // ===== 上下文风控层 (151-155) =====
  { id: 151, name: '上下文敏感内容熔断与过载控制', category: '上下文风控层', mainScenario: '企业级AI内容安全审计', keywords: ['内容熔断', '过载控制', '自动裁剪'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'context-risk-control' },
  { id: 152, name: '上下文风险分级与动态阈值', category: '上下文风控层', mainScenario: '企业级AI内容安全审计', keywords: ['风险分级', '动态阈值', '多轮追溯'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'context-risk-control' },
  { id: 153, name: '上下文安全态势与异常检测', category: '上下文风控层', mainScenario: '企业级AI内容安全审计', keywords: ['态势感知', '异常检测', '威胁溯源'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'context-risk-control' },
  { id: 154, name: '上下文账号欺诈与关联分析', category: '上下文风控层', mainScenario: '企业级AI内容安全审计', keywords: ['账号欺诈', '关联分析', '设备指纹'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'context-risk-control' },
  { id: 155, name: '上下文Prompt注入与数据泄露防护', category: '上下文风控层', mainScenario: '企业级AI内容安全审计', keywords: ['Prompt注入', '数据泄露', '输出过滤'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'context-risk-control' },
  // ===== 垂直上下文层 (156-160) =====
  { id: 156, name: '政务上下文合规与政策适配', category: '垂直上下文层', mainScenario: 'AI文案鉴别', keywords: ['政务上下文', '政策适配', '敏感信息'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-context' },
  { id: 157, name: '金融上下文欺诈与风险评估', category: '垂直上下文层', mainScenario: 'AI财务报表鉴别', keywords: ['金融上下文', '欺诈识别', '风险评估'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-context' },
  { id: 158, name: '媒体上下文语义与热点追踪', category: '垂直上下文层', mainScenario: 'AI文案鉴别', keywords: ['媒体上下文', '语义分析', '热点追踪'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'vertical-context' },
  { id: 159, name: '医疗上下文合规与隐私保护', category: '垂直上下文层', mainScenario: 'AI医疗报告鉴别', keywords: ['医疗上下文', '合规检测', '隐私保护'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-context' },
  { id: 160, name: '企业上下文数据安全与审计', category: '垂直上下文层', mainScenario: '企业级AI内容安全审计', keywords: ['企业上下文', '数据安全', '审计追溯'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-context' },
  // ===== 检索系统层 (161-165) =====
  { id: 161, name: '实时向量检索与动态索引', category: '检索系统层', mainScenario: 'AI文案鉴别', keywords: ['向量检索', '动态索引', '混合查询'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'retrieval-system' },
  { id: 162, name: '全文检索与倒排索引优化', category: '检索系统层', mainScenario: 'AI文案鉴别', keywords: ['全文检索', '倒排索引', '同义词扩展'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'retrieval-system' },
  { id: 163, name: '知识图谱检索与实体链接', category: '检索系统层', mainScenario: 'AI文案鉴别', keywords: ['知识图谱', '实体链接', '语义相似度'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'retrieval-system' },
  { id: 164, name: '近似最近邻检索与负载均衡', category: '检索系统层', mainScenario: 'AI文案鉴别', keywords: ['近似最近邻', '负载均衡', '过滤优化'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'retrieval-system' },
  { id: 165, name: '轻量级向量检索与内存优化', category: '检索系统层', mainScenario: 'AI文案鉴别', keywords: ['轻量级', '内存优化', '实时更新'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'retrieval-system' },
  // ===== 集群管理层 (166-170) =====
  { id: 166, name: 'GPU动态共享与超额订阅', category: '集群管理层', mainScenario: '企业级AI内容安全审计', keywords: ['GPU共享', '超额订阅', '资源优先级'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'cluster-management' },
  { id: 167, name: '容器编排与自动扩缩容', category: '集群管理层', mainScenario: '企业级AI内容安全审计', keywords: ['容器编排', '自动扩缩容', '服务发现'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'cluster-management' },
  { id: 168, name: '高性能计算调度与任务排队', category: '集群管理层', mainScenario: '企业级AI内容安全审计', keywords: ['高性能计算', '任务调度', '资源隔离'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'cluster-management' },
  { id: 169, name: '混合云调度与GPU拓扑感知', category: '集群管理层', mainScenario: '企业级AI内容安全审计', keywords: ['混合云', 'GPU拓扑', '训推一体'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'cluster-management' },
  { id: 170, name: '异构算力管理与故障自愈', category: '集群管理层', mainScenario: '企业级AI内容安全审计', keywords: ['异构算力', '故障自愈', '弹性伸缩'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'cluster-management' },
  // ===== 文件操作层 (171-175) =====
  { id: 171, name: '系统级文件操作与跨端管理', category: '文件操作层', mainScenario: 'AI文案鉴别', keywords: ['系统级文件', '跨端管理', '内容理解'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'file-operation' },
  { id: 172, name: '多格式文件解析与内容提炼', category: '文件操作层', mainScenario: 'AI文案鉴别', keywords: ['多格式解析', '内容提炼', '智能标注'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'file-operation' },
  { id: 173, name: '企业文件管理与版本追踪', category: '文件操作层', mainScenario: 'AI文案鉴别', keywords: ['企业文件', '权限控制', '版本追踪'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'file-operation' },
  { id: 174, name: 'AI文件分类与智能重命名', category: '文件操作层', mainScenario: 'AI文案鉴别', keywords: ['文件分类', '智能重命名', '批量处理'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'file-operation' },
  { id: 175, name: '在线协作与实时编辑', category: '文件操作层', mainScenario: 'AI文案鉴别', keywords: ['在线协作', '实时编辑', '内容审核'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'file-operation' },
  // ===== 语音输入层 (176-180) =====
  { id: 176, name: '实时语音转写与行业术语适配', category: '语音输入层', mainScenario: 'AI文案鉴别', keywords: ['语音转写', '行业术语', '多语种'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'voice-input' },
  { id: 177, name: '实时转写纠错与口语优化', category: '语音输入层', mainScenario: 'AI文案鉴别', keywords: ['转写纠错', '口语优化', '命令模式'], weight: 9, devDays: 3, monetizationType: '会员免费', tier: 'voice-input' },
  { id: 178, name: '跨应用听写与AI编辑指令', category: '语音输入层', mainScenario: 'AI文案鉴别', keywords: ['跨应用听写', 'AI编辑', '低延迟'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'voice-input' },
  { id: 179, name: '本地语音处理与隐私保护', category: '语音输入层', mainScenario: 'AI文案鉴别', keywords: ['本地处理', '隐私保护', '实时响应'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'voice-input' },
  { id: 180, name: '语音合成与多风格转换', category: '语音输入层', mainScenario: 'AI文案鉴别', keywords: ['语音合成', '多风格', '个性化'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'voice-input' },
  // ===== 通用Agent层 (181-185) =====
  { id: 181, name: '多Agent协作与对话驱动', category: '通用Agent层', mainScenario: 'AI文案鉴别', keywords: ['多Agent', '协作', '对话驱动'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'general-agent' },
  { id: 182, name: 'Agent状态管理与循环执行', category: '通用Agent层', mainScenario: 'AI文案鉴别', keywords: ['状态管理', '循环执行', '条件分支'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'general-agent' },
  { id: 183, name: '自主任务规划与错误自愈', category: '通用Agent层', mainScenario: 'AI文案鉴别', keywords: ['任务规划', '错误自愈', '工具调用'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'general-agent' },
  { id: 184, name: '多模型兼容与分布式部署', category: '通用Agent层', mainScenario: 'AI文案鉴别', keywords: ['多模型兼容', '分布式', '资源隔离'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'general-agent' },
  { id: 185, name: '零代码Agent开发与可视化编排', category: '通用Agent层', mainScenario: 'AI文案鉴别', keywords: ['零代码', '可视化编排', '插件集成'], weight: 9, devDays: 5, monetizationType: '会员免费', tier: 'general-agent' },
  // ===== 企业Agent层 (186-190) =====
  { id: 186, name: '全栈Agent开发与全链路审计', category: '企业Agent层', mainScenario: '企业级AI内容安全审计', keywords: ['全栈开发', '可信AI', '全链路审计'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'enterprise-agent' },
  { id: 187, name: '知识增强Agent与幻觉抑制', category: '企业Agent层', mainScenario: 'AI文案鉴别', keywords: ['知识增强', '幻觉抑制', '长文档解析'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'enterprise-agent' },
  { id: 188, name: '超自动化Agent与流程挖掘', category: '企业Agent层', mainScenario: 'AI文案鉴别', keywords: ['超自动化', '流程挖掘', '任务复盘'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'enterprise-agent' },
  { id: 189, name: '安全可信Agent与隐私计算', category: '企业Agent层', mainScenario: '企业级AI内容安全审计', keywords: ['安全可信', '隐私计算', '国产化适配'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'enterprise-agent' },
  { id: 190, name: '社交集成Agent与运营自动化', category: '企业Agent层', mainScenario: 'AI文案鉴别', keywords: ['社交集成', '运营自动化', '故障自愈'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'enterprise-agent' },
  // ===== 垂直Agent层 (191-195) =====
  { id: 191, name: '多模态Agent与方言识别', category: '垂直Agent层', mainScenario: 'AI文案鉴别', keywords: ['多模态', '方言识别', '行业适配'], weight: 8, devDays: 5, monetizationType: '会员免费', tier: 'vertical-agent' },
  { id: 192, name: '工业Agent与质检优化', category: '垂直Agent层', mainScenario: 'AI文案鉴别', keywords: ['工业质检', '能源优化', '自主可控'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'vertical-agent' },
  { id: 193, name: '政务Agent与公文处理', category: '垂直Agent层', mainScenario: 'AI文案鉴别', keywords: ['政务公文', '政策解读', '多部门协同'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-agent' },
  { id: 194, name: '金融Agent与风险评估', category: '垂直Agent层', mainScenario: 'AI财务报表鉴别', keywords: ['金融风险', '智能投顾', '合规报告'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'vertical-agent' },
  { id: 195, name: '媒体Agent与热点追踪', category: '垂直Agent层', mainScenario: 'AI文案鉴别', keywords: ['媒体热点', '内容生成', '舆情监测'], weight: 8, devDays: 3, monetizationType: '会员免费', tier: 'vertical-agent' },
  // ===== 多Agent协作层 (196-200) =====
  { id: 196, name: '多Agent互操作与标准协议', category: '多Agent协作层', mainScenario: 'AI文案鉴别', keywords: ['互操作', '标准协议', '安全隔离'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multi-agent-collab' },
  { id: 197, name: '多模型协同与任务分发', category: '多Agent协作层', mainScenario: 'AI文案鉴别', keywords: ['多模型协同', '任务分发', '结果聚合'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multi-agent-collab' },
  { id: 198, name: 'Agent DevOps与全生命周期管理', category: '多Agent协作层', mainScenario: 'AI文案鉴别', keywords: ['Agent DevOps', '生命周期管理', '自动化测试'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multi-agent-collab' },
  { id: 199, name: '多角色协同与权限管理', category: '多Agent协作层', mainScenario: 'AI文案鉴别', keywords: ['多角色协同', '权限管理', '数据隔离'], weight: 8, devDays: 5, monetizationType: '企业定制', tier: 'multi-agent-collab' },
  { id: 200, name: '自我演化Agent与全局优化', category: '多Agent协作层', mainScenario: 'AI文案鉴别', keywords: ['自我演化', '全局优化', '实时决策'], weight: 7, devDays: 7, monetizationType: '企业定制', tier: 'multi-agent-collab' },
];

// ====== 平台核心能力层 (201-212) — OpenRath Runtime 驱动 ======
export const PLATFORM_CAPABILITIES: SkillItem[] = [
  { id: 201, name: '四Agent多维协同检测引擎', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['四Agent', '协同检测', 'OpenRath', 'Session Graph', '串行工作流'], weight: 10, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 202, name: 'SSE流式实时推送检测', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['SSE', '流式推送', '实时进度', '事件驱动', '逐Agent推送'], weight: 10, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 203, name: '会话历史持久化管理', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['会话管理', '历史加载', '消息检索', 'Session持久化', '刷新不丢'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 204, name: 'HTML检测报告一键导出', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['报告导出', 'HTML下载', '安全等级徽章', '四Agent详情', '改进建议'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 205, name: 'OpenRath多智能体运行时', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['OpenRath', 'Session一等公民', '可插拔沙箱', '可插拔记忆', '动态路由', '复现'], weight: 10, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 206, name: 'Agent: 内容审核员(独立调用)', category: '平台能力层', mainScenario: 'AI文案鉴别', keywords: ['auditor', '内容审核', '敏感词检测', '合规审查', '单Agent调用'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 207, name: 'Agent: 事实核查官(独立调用)', category: '平台能力层', mainScenario: 'AI文案鉴别', keywords: ['verifier', '事实核查', '来源追溯', '时间线分析', '单Agent调用'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 208, name: 'Agent: 数字取证员(独立调用)', category: '平台能力层', mainScenario: 'AI文案鉴别', keywords: ['archiver', '数字取证', '元数据分析', '模式识别', '单Agent调用'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 209, name: 'Agent: 裁决官(独立调用)', category: '平台能力层', mainScenario: 'AI文案鉴别', keywords: ['judge', '裁决仲裁', '综合裁决', '风险评估', '单Agent调用'], weight: 9, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 210, name: '上下文智能压缩服务', category: '平台能力层', mainScenario: 'AI文案鉴别', keywords: ['上下文压缩', 'Compressor', '历史摘要', 'Token优化', '保留最近轮次'], weight: 8, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 211, name: 'Session Graph血缘追踪系统', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['SessionGraph', '血缘追踪', 'Fork关系', '执行链路', '复现'], weight: 8, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
  { id: 212, name: '动态路由与完整复现引擎', category: '平台能力层', mainScenario: 'AI全场景检测', keywords: ['动态路由', '复现引擎', 'JSONL导出', '离线分析', '审计追溯'], weight: 7, devDays: 0, monetizationType: '免费', tier: 'platform-runtime' },
];

export const getSkillsByCategory = (categoryKey: string): SkillItem[] => {
  return SKILL_MATRIX.filter(s => s.tier === categoryKey);
};

export const getSkillsByScenario = (scenario: string): SkillItem[] => {
  return SKILL_MATRIX.filter(s => s.mainScenario === scenario);
};

export const getSkillById = (id: number): SkillItem | undefined => {
  return SKILL_MATRIX.find(s => s.id === id);
};

export const searchSkills = (query: string): SkillItem[] => {
  const lowerQuery = query.toLowerCase();
  return SKILL_MATRIX.filter(s =>
    s.name.toLowerCase().includes(lowerQuery) ||
    s.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
    s.category.includes(query) ||
    s.mainScenario.includes(query)
  );
};

export const getCategoryStats = () => {
  const stats: Record<string, { count: number; totalWeight: number }> = {};
  SKILL_CATEGORIES.forEach(cat => {
    const skills = SKILL_MATRIX.filter(s => s.tier === cat.key);
    stats[cat.key] = {
      count: skills.length,
      totalWeight: skills.reduce((sum, s) => sum + s.weight, 0),
    };
  });
  return stats;
};
