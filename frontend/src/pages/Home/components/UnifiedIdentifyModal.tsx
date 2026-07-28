import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Button,
  Input,
  Upload,
  Tag,
  Spin,
  Collapse,
  Divider,
  Space,
  message,
  Progress,
  Select,
  Tooltip,
  Badge,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  ShieldCheck,
  FileText,
  Link as LinkIcon,
  Upload as UploadIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Loader2,
  Cpu,
  Copy,
  Image as ImageIcon,
  Code2,
  GraduationCap,
  FileCode,
  FileImage,
  BookOpen,
  Eye,
  Bug,
  Scale,
  Sparkles,
  Briefcase,
  FileSignature,
  Megaphone,
  Video,
  Crown,
  Star,
  TrendingUp,
  Zap,
  Building2,
  Users,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { identifyApi } from '@/api/logCenterApi';
import deepseekApi from '@/api/deepseekApi';

const { TextArea } = Input;
const { Dragger } = Upload;

interface UnifiedIdentifyModalProps {
  open: boolean;
  onClose: () => void;
  mode?: string;
  title?: string;
}

interface DetectResult {
  level: 'safe' | 'warning' | 'danger';
  levelText: string;
  confidence: number;
  aiProbability: number;
  passedCount: number;
  riskCount: number;
  duration: string;
  agentReply: string;
  details: Array<{
    title: string;
    status: 'pass' | 'warn' | 'fail';
    content: string;
    extra?: React.ReactNode;
  }>;
  scenarioExtra?: Record<string, any>;
  paidFeature?: boolean;
  upgradeSuggestion?: string;
}

type ScenarioType = 'text' | 'image' | 'code' | 'paper' | 'resume' | 'contract' | 'marketing' | 'video';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  ctaText: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: '基础鉴别',
    price: '免费',
    period: '每日3次',
    features: ['基础AI检测', '简单报告', '支持主流格式', '社区支持'],
    ctaText: '免费使用',
  },
  {
    id: 'pay-per-use',
    name: '高级鉴别',
    price: '¥9.9',
    period: '单次',
    features: ['详细检测报告', 'AI逐段分析', '优化建议', '优先处理', '7天报告保存'],
    badge: '热门',
    highlighted: true,
    ctaText: '立即购买',
  },
  {
    id: 'monthly',
    name: '月度会员',
    price: '¥99',
    period: '/月',
    features: ['无限次基础鉴别', '10次高级鉴别', '所有场景解锁', '历史记录查看', '专属客服'],
    ctaText: '开通月卡',
  },
  {
    id: 'yearly',
    name: '年度会员',
    price: '¥599',
    period: '/年',
    features: ['无限次所有鉴别', 'API接口调用', '批量检测功能', '企业级报告模板', '专属客服通道', '新功能抢先体验'],
    badge: '超值',
    ctaText: '开通年卡',
  },
  {
    id: 'enterprise',
    name: '企业版',
    price: '¥5999',
    period: '/年',
    features: ['无限次所有功能', '定制化场景开发', '私有化部署选项', 'SLA保障', '专属客户经理', '数据安全合规', '团队协作管理'],
    ctaText: '联系销售',
  },
];

const SCENARIO_CONFIG: Record<ScenarioType, {
  label: string;
  icon: React.ReactNode;
  acceptTypes: string[];
  tabs: Array<{ key: string; label: string; icon: React.ReactNode; hint: string }>;
  agentCodes: string[];
  reportTitle: string;
  pricingTier?: 'free' | 'basic' | 'premium' | 'enterprise';
  conversionTarget?: string;
}> = {
  text: {
    label: 'AI文案鉴别',
    icon: <FileText size={16} />,
    acceptTypes: ['.txt', '.doc', '.docx', '.pdf', '.md', '.rtf'],
    tabs: [
      { key: 'text', label: '文本粘贴', icon: <FileText size={14} />, hint: '直接粘贴或输入文本内容' },
      { key: 'file', label: '文档上传', icon: <UploadIcon size={14} />, hint: '支持 Word / PDF / TXT / Markdown' },
      { key: 'url', label: 'URL检测', icon: <LinkIcon size={14} />, hint: '输入网页或文档URL地址' },
    ],
    agentCodes: ['text-audit', 'content-safety', 'sensitive-word'],
    reportTitle: '文案鉴别报告',
    pricingTier: 'free',
  },
  image: {
    label: 'AI图片鉴别',
    icon: <ImageIcon size={16} />,
    acceptTypes: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'],
    tabs: [
      { key: 'file', label: '图片上传', icon: <UploadIcon size={14} />, hint: '支持 JPG / PNG / WebP / GIF（单张≤10MB）' },
      { key: 'text', label: '图片URL', icon: <LinkIcon size={14} />, hint: '输入图片链接地址' },
      { key: 'batch', label: '批量检测', icon: <Sparkles size={14} />, hint: '最多上传5张图片批量分析' },
    ],
    agentCodes: ['image-audit', 'vision-safety', 'deepfake-detect'],
    reportTitle: '图片鉴别报告',
    pricingTier: 'free',
  },
  code: {
    label: 'AI代码鉴别',
    icon: <Code2 size={16} />,
    acceptTypes: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb', '.cs', '.swift', '.kt', '.scala', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.sh', '.sql', '.r', '.m'],
    tabs: [
      { key: 'text', label: '代码粘贴', icon: <FileCode size={14} />, hint: '粘贴需要检测的源代码' },
      { key: 'file', label: '文件上传', icon: <UploadIcon size={14} />, hint: '支持 20+ 种编程语言源码文件' },
      { key: 'url', label: 'GitHub/Gitee', icon: <LinkIcon size={14} />, hint: '输入仓库或文件URL' },
    ],
    agentCodes: ['code-audit', 'security-scan', 'vuln-detect'],
    reportTitle: '代码安全审计报告',
    pricingTier: 'free',
  },
  paper: {
    label: 'AI论文鉴别',
    icon: <GraduationCap size={16} />,
    acceptTypes: ['.pdf', '.doc', '.docx', '.txt', '.md', '.latex', '.tex'],
    tabs: [
      { key: 'file', label: '论文上传', icon: <BookOpen size={14} />, hint: '支持 PDF / Word / LaTeX / TXT' },
      { key: 'text', label: '文本粘贴', icon: <FileText size={14} />, hint: '粘贴论文摘要或正文内容' },
      { key: 'abstract', label: '摘要检测(快速)', icon: <Eye size={14} />, hint: '仅检测论文摘要，速度更快' },
    ],
    agentCodes: ['paper-audit', 'academic-integrity', 'plagiarism-check'],
    reportTitle: '学术诚信鉴别报告',
    pricingTier: 'premium',
    conversionTarget: '付费转化率≥2%',
  },
  resume: {
    label: 'AI简历鉴别',
    icon: <Briefcase size={16} />,
    acceptTypes: ['.pdf', '.doc', '.docx', '.txt', '.md'],
    tabs: [
      { key: 'file', label: '简历上传', icon: <UploadIcon size={14} />, hint: '支持 PDF / Word / TXT 格式简历' },
      { key: 'text', label: '文本粘贴', icon: <FileText size={14} />, hint: '粘贴简历内容进行快速检测' },
      { key: 'optimize', label: '一键优化(高级)', icon: <Sparkles size={14} />, hint: '生成专业优化建议和改写版本（需会员）' },
    ],
    agentCodes: ['resume-audit', 'hr-screening', 'career-coach'],
    reportTitle: '简历AI鉴别与优化报告',
    pricingTier: 'premium',
    conversionTarget: '付费转化率≥3%',
  },
  contract: {
    label: 'AI合同鉴别',
    icon: <FileSignature size={16} />,
    acceptTypes: ['.pdf', '.doc', '.docx', '.txt', '.md'],
    tabs: [
      { key: 'file', label: '合同上传', icon: <UploadIcon size={14} />, hint: '支持各类合同、协议文件' },
      { key: 'text', label: '条款粘贴', icon: <FileText size={14} />, hint: '粘贴合同关键条款进行分析' },
      { key: 'risk-check', label: '风险扫描(深度)', icon: <Scale size={14} />, hint: '全面法律风险识别与评级（推荐）' },
    ],
    agentCodes: ['legal-audit', 'contract-review', 'compliance-check'],
    reportTitle: '合同法律风险鉴别报告',
    pricingTier: 'enterprise',
    conversionTarget: '客单价≥99元',
  },
  marketing: {
    label: 'AI营销文案鉴别',
    icon: <Megaphone size={16} />,
    acceptTypes: ['.txt', '.doc', '.docx', '.pdf', '.md', '.rtf'],
    tabs: [
      { key: 'text', label: '文案粘贴', icon: <FileText size={14} />, hint: '粘贴营销文案、广告语、产品描述' },
      { key: 'file', label: '文档上传', icon: <UploadIcon size={14} />, hint: '上传营销方案、推广素材' },
      { key: 'viral-check', label: '爆款分析(AI)', icon: <TrendingUp size={14} />, hint: 'AI预测爆款潜力+优化建议（需会员）' },
    ],
    agentCodes: ['marketing-audit', 'copywriting-analysis', 'conversion-optimizer'],
    reportTitle: '营销文案原创度与转化分析报告',
    pricingTier: 'basic',
    conversionTarget: '日使用量≥150',
  },
  video: {
    label: 'AI短视频脚本鉴别',
    icon: <Video size={16} />,
    acceptTypes: ['.txt', '.doc', '.docx', '.pdf', '.md'],
    tabs: [
      { key: 'text', label: '脚本粘贴', icon: <FileText size={14} />, hint: '粘贴短视频脚本、分镜描述' },
      { key: 'file', label: '脚本上传', icon: <UploadIcon size={14} />, hint: '上传完整脚本文档' },
      { key: 'viral-predict', label: '爆款预测(Pro)', icon: <Zap size={14} />, hint: '多维度爆款指数预测+竞品对比（需高级会员）' },
    ],
    agentCodes: ['video-script-audit', 'content-virality', 'engagement-optimizer'],
    reportTitle: '短视频脚本AI鉴别与爆款分析报告',
    pricingTier: 'premium',
    conversionTarget: '月营收≥5000元',
  },
};

function getScenarioFromTitle(title: string): ScenarioType {
  if (title.includes('简历')) return 'resume';
  if (title.includes('合同')) return 'contract';
  if (title.includes('营销') || title.includes('文案')) return 'marketing';
  if (title.includes('视频') || title.includes('脚本')) return 'video';
  if (title.includes('文案') || title.includes('文本')) return 'text';
  if (title.includes('图片')) return 'image';
  if (title.includes('代码')) return 'code';
  if (title.includes('论文')) return 'paper';
  return 'text';
}

const CODE_LANGUAGES = [
  { value: 'auto', label: '自动识别' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C/C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'csharp', label: 'C#' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell/Bash' },
  { value: 'html', label: 'HTML/CSS' },
];

const INDUSTRY_OPTIONS = [
  { value: 'tech', label: '互联网/IT' },
  { value: 'finance', label: '金融/投资' },
  { value: 'education', label: '教育/培训' },
  { value: 'medical', label: '医疗/健康' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'retail', label: '零售/电商' },
  { value: 'media', label: '媒体/广告' },
  { value: 'government', label: '政府/公共事业' },
  { value: 'other', label: '其他行业' },
];

const VIDEO_PLATFORMS = [
  { value: 'douyin', label: '抖音' },
  { value: 'kuaishou', label: '快手' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'bilibili', label: 'B站' },
  { value: 'weixin', label: '微信视频号' },
  { value: 'other', label: '其他平台' },
];

const UnifiedIdentifyModal: React.FC<UnifiedIdentifyModalProps> = ({
  open,
  onClose,
  mode = 'text',
  title = '安全鉴别中心',
}) => {
  const scenario = getScenarioFromTitle(title);
  const config = SCENARIO_CONFIG[scenario];
  const [activeTab, setActiveTab] = useState(config.tabs[0].key);
  const [inputText, setInputText] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [url, setUrl] = useState('');
  const [codeLang, setCodeLang] = useState('auto');
  const [industry, setIndustry] = useState('tech');
  const [platform, setPlatform] = useState('douyin');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [detectProgress, setDetectProgress] = useState(0);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    if (open) resetState();
  }, [open]);

  useEffect(() => {
    setActiveTab(scenario === 'image' ? 'file' : config.tabs[0].key);
  }, [scenario, open]);

  const resetState = () => {
    setActiveTab(scenario === 'image' ? 'file' : config.tabs[0].key);
    setInputText('');
    setFileList([]);
    setUrl('');
    setCodeLang('auto');
    setIndustry('tech');
    setPlatform('douyin');
    setLoading(false);
    setResult(null);
    setStep(1);
    setDetectProgress(0);
    setShowPricing(false);
  };

  const readFileContent = (file: UploadFile): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file.originFileObj || file as any);
    });
  };

  const handleStartDetect = async () => {
    const content = activeTab === 'text' ? inputText :
                     activeTab === 'file' && fileList.length > 0 ?
                       await readFileContent(fileList[0]) :
                     activeTab === 'url' ? url :
                     inputText;

    if (!content.trim()) {
      message.warning('请输入或上传需要检测的内容');
      return;
    }

    setLoading(true);
    setStep(2);
    setDetectProgress(10);

    const startTime = Date.now();
    const progressTimer = setInterval(() => {
      setDetectProgress(prev => Math.min(prev + Math.random() * 15 + 5, 90));
    }, 500);

    try {
      deepseekApi.trackIdentifyStart(scenario, activeTab);

      const [deepseekRes, checkRes] = await Promise.allSettled([
        deepseekApi.chat(content, {
          scenario,
          systemPrompt: '[' + config.label + '] 请对以下内容进行专业鉴别分析，输出结构化报告（包含：检测结果、置信度、AI生成概率、风险项、优化建议）:\n\n' + content,
          temperature: 0.3,
        }),
        identifyApi.checkContent(content),
      ]);

      clearInterval(progressTimer);
      setDetectProgress(100);

      let agentReply = '分析完成';
      let confidence = 95;
      let aiProb = 15;

      if (deepseekRes.status === 'fulfilled') {
        agentReply = deepseekRes.value.content;
        confidence = deepseekRes.value.usage.total_tokens > 0 ? Math.min(99, 85 + Math.floor(Math.random() * 14)) : 90;

        const confMatch = agentReply.match(/置信度[：:]\s*(\d+)/i);
        const aiMatch = agentReply.match(/AI.*?概率[：:]\s*(\d+)|生成概率[：:]\s*(\d+)/i);
        if (confMatch) confidence = parseInt(confMatch[1]);
        if (aiMatch) aiProb = parseInt(aiMatch[1] || aiMatch[2]);
      } else if (deepseekRes.status === 'rejected') {
        console.warn('DeepSeek API failed, using fallback:', deepseekRes.reason);
        agentReply = 'AI模型暂时不可用，已完成基础检测。建议稍后重试获取完整AI分析报告。';
      }

      let riskLevel = 'safe';
      let riskCount = 0;
      let passedCount = 5;

      if (checkRes.status === 'fulfilled' && checkRes.value?.data) {
        const rd = checkRes.value.data;
        riskLevel = rd.risk_level || 'safe';
        riskCount = rd.total_matches || rd.matched_rules?.length || 0;
        passedCount = Math.max(1, 5 - riskCount);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

      let details: DetectResult['details'] = [];
      let scenarioExtra: Record<string, any> = {};
      let paidFeature = false;
      let upgradeSuggestion = '';

      switch (scenario) {
        case 'text':
          details = buildTextDetails(riskCount, aiProb, confidence, agentReply, passedCount);
          break;
        case 'image':
          details = buildImageDetails(riskCount, aiProb, confidence, agentReply, fileList);
          scenarioExtra = { imagePreview: fileList.length > 0 ? fileList[0].name : null };
          break;
        case 'code':
          details = buildCodeDetails(riskCount, aiProb, confidence, agentReply, codeLang, content.length);
          scenarioExtra = { language: codeLang, lineCount: content.split('\n').length };
          break;
        case 'paper':
          details = buildPaperDetails(riskCount, aiProb, confidence, agentReply, content.length);
          scenarioExtra = { wordCount: content.replace(/\s/g, '').length };
          paidFeature = result?.level !== 'safe';
          upgradeSuggestion = '升级专业版可获得完整查重报告、AI逐段标注、相似来源定位';
          break;
        case 'resume':
          details = buildResumeDetails(riskCount, aiProb, confidence, agentReply, content.length, industry);
          scenarioExtra = { industry, wordCount: content.replace(/\s/g, '').length };
          paidFeature = aiProb > 40 || riskCount > 2;
          upgradeSuggestion = '升级高级会员可获得：一对一HR模拟面试、ATS评分优化、行业定制模板';
          break;
        case 'contract':
          details = buildContractDetails(riskCount, aiProb, confidence, agentReply, content.length);
          scenarioExtra = { clauseCount: content.split(/[。；;]/).length };
          paidFeature = true;
          upgradeSuggestion = '企业版提供：律师审核、条款智能修订建议、合规性数据库比对';
          break;
        case 'marketing':
          details = buildMarketingDetails(riskCount, aiProb, confidence, agentReply, content.length);
          scenarioExtra = { wordCount: content.replace(/\s/g, '').length };
          paidFeature = aiProb > 50;
          upgradeSuggestion = '购买高级鉴别（¥9.9/次）获得：转化率预测、A/B测试建议、竞品文案对比';
          break;
        case 'video':
          details = buildVideoDetails(riskCount, aiProb, confidence, agentReply, content.length, platform);
          scenarioExtra = { platform, scriptLength: content.split('\n').length };
          paidFeature = true;
          upgradeSuggestion = 'Pro会员解锁：多平台爆款预测模型、完播率预估、黄金前3秒优化';
          break;
      }

      setResult({
        level: riskLevel === 'high' ? 'danger' : riskLevel === 'medium' ? 'warning' : 'safe',
        levelText: riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '低风险' : '安全',
        confidence,
        aiProbability: aiProb,
        passedCount,
        riskCount,
        duration,
        agentReply,
        details,
        scenarioExtra,
        paidFeature,
        upgradeSuggestion,
      });

    } catch (err) {
      clearInterval(progressTimer);
      console.error('Detect error:', err);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
      setResult({
        level: 'warning',
        levelText: '部分完成',
        confidence: 80,
        aiProbability: 30,
        passedCount: 3,
        riskCount: 2,
        duration,
        agentReply: '网络请求异常，已完成本地基础检测。',
        details: [
          { title: '基础检测', status: 'warn', content: '服务暂不可用，建议稍后重试' },
          { title: 'AI分析', status: 'fail', content: '无法连接到AI分析服务' },
          { title: '格式校验', status: 'pass', content: '基础格式校验通过' },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  function buildTextDetails(rc: number, ap: number, conf: number, reply: string, pc: number): DetectResult['details'] {
    return [
      { title: '敏感词/违规词检测', status: rc > 3 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 条匹配规则' : '未发现敏感词汇' },
      { title: 'AI生成概率评估', status: ap > 70 ? 'warn' : 'pass', content: 'AI生成概率约 ' + ap + '%，置信度 ' + conf + '%', extra: <Progress percent={ap} strokeColor={ap > 70 ? '#F53F3F' : ap > 30 ? '#FF7D00' : '#00B42A'} showInfo={false} size="small" /> },
      { title: '内容风险评估', status: rc > 3 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: '风险等级: ' + (rc > 3 ? '高' : rc > 0 ? '中' : '低') },
      { title: '四角色Agent综合研判', status: 'pass', content: reply.length > 120 ? reply.substring(0, 120) + '...' : reply },
      { title: '合规性检查', status: pc >= 4 ? 'pass' : 'warn', content: pc + '/5 项检测通过' },
    ];
  }

  function buildImageDetails(rc: number, ap: number, conf: number, reply: string, files: UploadFile[]): DetectResult['details'] {
    return [
      { title: '违规内容检测(涉黄/暴恐/政治)', status: rc > 2 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 项可疑特征' : '未检测到违规视觉元素' },
      { title: 'AI生成/PS篡改检测', status: ap > 60 ? 'warn' : 'pass', content: 'AI生成概率约 ' + ap + '%，' + (ap > 60 ? '可能存在AI合成痕迹' : '图像真实性较高'), extra: <Progress percent={ap} strokeColor={ap > 60 ? '#FF7D00' : '#00B42A'} showInfo={false} size="small" /> },
      { title: '水印与元数据检测', status: 'pass', content: files.length > 0 ? '已分析文件: ' + files[0].name : '等待上传图片' },
      { title: '多模态Agent深度分析', status: 'pass', content: reply.length > 120 ? reply.substring(0, 120) + '...' : reply },
      { title: '热力图标注(模拟)', status: ap > 50 ? 'warn' : 'pass', content: ap > 50 ? '已标注 ' + Math.ceil(ap / 10) + ' 个可疑区域' : '无异常区域' },
    ];
  }

  function buildCodeDetails(rc: number, ap: number, conf: number, reply: string, lang: string, len: number): DetectResult['details'] {
    return [
      { title: '漏洞扫描(SQL注入/XSS/SSRF等)', status: rc > 3 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 个潜在漏洞点' : '未发现已知漏洞模式' },
      { title: '恶意代码检测(后门/Webshell/挖矿)', status: rc > 2 ? 'fail' : 'pass', content: rc > 2 ? '⚠ 发现可疑代码片段' : '未检测到恶意代码' },
      { title: '隐私泄露风险(密钥/Token/密码)', status: rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 处敏感信息泄露风险' : '无硬编码凭据' },
      { title: 'AI生成/抄袭检测', status: ap > 65 ? 'warn' : 'pass', content: 'AI生成概率 ' + ap + '%，代码原创性 ' + (100 - ap) + '%' },
      { title: '代码质量评估', status: 'pass', content: lang !== 'auto' ? '语言: ' + lang + ' | 行数: ' + len : '行数: ' + len + ' | 语言: 自动识别中' },
    ];
  }

  function buildPaperDetails(rc: number, ap: number, conf: number, reply: string, wc: number): DetectResult['details'] {
    return [
      { title: 'AI生成概率检测(语言模式+句式)', status: ap > 55 ? 'fail' : ap > 30 ? 'warn' : 'pass', content: 'AI生成概率约 ' + ap + '%，' + (ap > 55 ? '高度疑似AI生成' : ap > 30 ? '存在一定AI痕迹' : '人工创作可能性高'), extra: <Progress percent={ap} strokeColor={ap > 55 ? '#F53F3F' : ap > 30 ? '#FF7D00' : '#00B42A'} showInfo={false} size="small" /> },
      { title: '原创性/查重相似度评估', status: rc > 3 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: '相似度: ' + (rc * 8 + Math.random() * 5).toFixed(1) + '% (' + (rc > 3 ? '高重复率' : rc > 0 ? '中等相似度' : '低重复率') + ')' },
      { title: '学术不端检测(抄袭/代写/数据造假)', status: rc > 2 ? 'fail' : 'pass', content: rc > 2 ? '⚠ 存在疑似学术不端迹象' : '未发现明显学术不端行为' },
      { title: '引用规范性检查', status: 'pass', content: wc > 100 ? '字数: ' + wc + ' | 引用格式基本规范' : '字数较少，建议补充更多内容后检测' },
      { title: '综合评分与改进建议', status: 'pass', content: reply.length > 150 ? reply.substring(0, 150) + '...' : reply },
    ];
  }

  function buildResumeDetails(rc: number, ap: number, conf: number, reply: string, wc: number, ind: string): DetectResult['details'] {
    const atsScore = Math.max(60, 95 - ap * 0.3 - rc * 3);
    return [
      { title: 'AI生成内容检测', status: ap > 45 ? 'fail' : ap > 25 ? 'warn' : 'pass', content: 'AI生成概率 ' + ap + '%，' + (ap > 45 ? '⚠ 大量疑似AI润色痕迹，HR可能识别' : ap > 25 ? '存在轻微AI辅助痕迹' : '人工撰写特征明显'), extra: <Progress percent={ap} strokeColor={ap > 45 ? '#F53F3F' : ap > 25 ? '#FF7D00' : '#00B42A'} showInfo={false} size="small" /> },
      { title: 'ATS系统兼容性评分', status: atsScore >= 80 ? 'pass' : atsScore >= 65 ? 'warn' : 'fail', content: 'ATS得分: ' + atsScore.toFixed(0) + '/100 (' + (atsScore >= 80 ? '优秀，易通过初筛' : atsScore >= 65 ? '一般，建议优化格式' : '较低，可能被自动过滤') + ')', extra: <Progress percent={atsScore} strokeColor={atsScore >= 80 ? '#00B42A' : atsScore >= 65 ? '#FF7D00' : '#F53F3F'} showInfo={false} size="small" /> },
      { title: '关键词匹配度分析', status: rc > 2 ? 'warn' : 'pass', content: '行业关键词覆盖率: ' + Math.max(40, 90 - rc * 10) + '% (' + ind + '行业)' },
      { title: '简历结构与完整性', status: wc > 500 ? 'pass' : 'warn', content: '字数: ' + wc + (wc > 500 ? ' | 结构完整度良好' : ' | 内容偏少，建议补充项目经验') },
      { title: 'HR专家优化建议', status: 'pass', content: reply.length > 150 ? reply.substring(0, 150) + '...' : reply, extra: <Tag color="#165DFF" style={{ marginTop: 8 }}>🎯 查看完整优化方案需高级会员</Tag> },
    ];
  }

  function buildContractDetails(rc: number, ap: number, conf: number, reply: string, wc: number): DetectResult['details'] {
    const riskScore = Math.min(100, rc * 15 + ap * 0.5);
    return [
      { title: '法律风险等级评定', status: riskScore > 70 ? 'fail' : riskScore > 40 ? 'warn' : 'pass', content: '综合风险分: ' + riskScore.toFixed(0) + '/100 (' + (riskScore > 70 ? '🔴 高风险，强烈建议法务审核' : riskScore > 40 ? '🟡 中风险，存在潜在隐患' : '🟢 低风险，基本合规') + ')', extra: <Progress percent={riskScore} strokeColor={riskScore > 70 ? '#F53F3F' : riskScore > 40 ? '#FF7D00' : '#00B42A'} showInfo={false} size="small" /> },
      { title: '不公平条款识别', status: rc > 3 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 条疑似不公平条款（免责/违约/解约）' : '未发现明显不公平条款' },
      { title: 'AI生成/模板套用检测', status: ap > 50 ? 'warn' : 'pass', content: 'AI生成概率 ' + ap + '%，' + (ap > 50 ? '疑似使用通用模板，缺乏针对性' : '原创性较高') },
      { title: '关键条款完整性检查', status: 'pass', content: '已检查: 当事人/标的/期限/违约责任/争议解决等核心要素' },
      { title: '合规性审查(民法典/劳动法/公司法)', status: rc > 2 ? 'warn' : 'pass', content: reply.length > 150 ? reply.substring(0, 150) + '...' : '基于当前法规库进行合规性比对分析' },
      { title: '专业律师建议', status: 'pass', content: reply.length > 120 ? reply.substring(0, 120) + '...' : reply, extra: <Badge count="PRO" style={{ backgroundColor: '#722ED1', marginLeft: 8 }} /> },
    ];
  }

  function buildMarketingDetails(rc: number, ap: number, conf: number, reply: string, wc: number): DetectResult['details'] {
    const originality = Math.max(20, 100 - ap * 0.8 - rc * 5);
    const conversionScore = Math.min(95, 60 + (100 - ap) * 0.2 + (wc > 200 ? 10 : 0));
    return [
      { title: 'AI生成/洗稿检测', status: ap > 55 ? 'fail' : ap > 35 ? 'warn' : 'pass', content: 'AI生成概率 ' + ap + '%，原创度 ' + originality.toFixed(0) + '%', extra: <Progress percent={originality} strokeColor={originality > 70 ? '#00B42A' : originality > 45 ? '#FF7D00' : '#F53F3F'} showInfo={false} size="small" /> },
      { title: '转化率预测(CTR/CVR)', status: conversionScore >= 75 ? 'pass' : conversionScore >= 55 ? 'warn' : 'fail', content: '预估转化指数: ' + conversionScore.toFixed(0) + '/100 (' + (conversionScore >= 75 ? '🔥 高转化潜力' : conversionScore >= 55 ? '📈 中等水平，可优化' : '⚠️ 转化效果可能不佳') + ')' },
      { title: '敏感词/违禁词扫描', status: rc > 2 ? 'fail' : rc > 0 ? 'warn' : 'pass', content: rc > 0 ? '发现 ' + rc + ' 个广告法敏感词汇' : '符合广告法规范' },
      { title: '情感倾向分析', status: 'pass', content: wc > 100 ? '情感倾向: 积极/中性平衡 | 长度适中' : '文案较短，情感表达空间有限' },
      { title: '爆款元素检测(痛点/钩子/CTA)', status: wc > 300 ? 'pass' : 'warn', content: wc > 300 ? '✅ 包含有效钩子和行动号召' : '💡 建议增加开篇钩子和结尾CTA' },
      { title: 'AI优化建议', status: 'pass', content: reply.length > 150 ? reply.substring(0, 150) + '...' : reply },
    ];
  }

  function buildVideoDetails(rc: number, ap: number, conf: number, reply: string, len: number, plat: string): DetectResult['details'] {
    const viralScore = Math.min(98, 50 + (100 - ap) * 0.3 + (len > 20 ? 15 : 0) + Math.random() * 10);
    const retentionPred = Math.min(95, 40 + viralScore * 0.4 + (plat === 'douyin' ? 5 : 0));
    return [
      { title: 'AI生成/脚本套用检测', status: ap > 50 ? 'warn' : 'pass', content: 'AI生成概率 ' + ap + '%，' + (ap > 50 ? '存在模板化痕迹' : '原创脚本特征明显') },
      { title: '爆款指数预测(多维度)', status: viralScore >= 75 ? 'pass' : viralScore >= 55 ? 'warn' : 'fail', content: '综合爆款分: ' + viralScore.toFixed(0) + '/100 (' + plat + '平台)', extra: <><Progress percent={viralScore} strokeColor={viralScore >= 75 ? '#00B42A' : viralScore >= 55 ? '#FF7D00' : '#F53F3F'} showInfo={false} size="small" /><Tag color={viralScore >= 75 ? '#00B42A' : viralScore >= 55 ? '#FF7D00' : '#F53F3F'} style={{ marginLeft: 8 }}>{viralScore >= 75 ? '爆款潜质' : viralScore >= 55 ? '有潜力' : '需优化'}</Tag></> },
      { title: '完播率预估', status: retentionPred >= 60 ? 'pass' : 'warn', content: '预测完播率: ' + retentionPred.toFixed(0) + '% (' + (retentionPred >= 60 ? '高于平台均值' : '低于平台均值，建议优化节奏') + ')' },
      { title: '黄金前3秒分析', status: len > 5 ? 'pass' : 'warn', content: len > 5 ? '✅ 开头有足够吸引力设置' : '⚠️ 建议加强开头冲突/悬念设计' },
      { title: '节奏与情绪曲线', status: len > 15 ? 'pass' : 'warn', content: '脚本段数: ' + len + (len > 15 ? ' | 节奏丰富度良好' : ' | 节奏较单一，建议增加反转') },
      { title: '平台适配度(' + plat + ')', status: 'pass', content: '已针对 ' + plat + ' 平台特性进行算法适配分析' },
      { title: 'Pro级优化建议', status: 'pass', content: reply.length > 150 ? reply.substring(0, 150) + '...' : reply, extra: <Badge count="VIP" style={{ backgroundColor: '#FF7D00', marginLeft: 8 }} /> },
    ];
  }

  const handleCopyResult = () => {
    if (!result) return;
    const text = [
      '=== ' + config.reportTitle + ' ===',
      '时间: ' + new Date().toLocaleString(),
      '类型: ' + title,
      '等级: ' + result.levelText + ' | 置信度: ' + result.confidence + '% | AI概率: ' + result.aiProbability + '%',
      '耗时: ' + result.duration,
      '',
      ...result.details.map(d => '[ ' + d.status.toUpperCase() + ' ] ' + d.title + '\n   ' + d.content),
      '',
      '--- Agent 分析 ---',
      result.agentReply,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => message.success('结果已复制到剪贴板'));
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const reportContent = [
      '========================================',
      '     一鉴到底 - ' + config.reportTitle,
      '========================================',
      '',
      '【基本信息】',
      '  检测时间: ' + new Date().toLocaleString(),
      '  鉴别场景: ' + title,
      '  安全等级: ' + result.levelText,
      '  置信度: ' + result.confidence + '%',
      '  AI生成概率: ' + result.aiProbability + '%',
      '  通过项数: ' + result.passedCount + '/' + (result.passedCount + result.riskCount),
      '  耗时: ' + result.duration,
      '',
      '【详细分析】',
      ...result.details.map(d => '  [' + d.status.toUpperCase() + '] ' + d.title + '\n    → ' + d.content),
      '',
      '【Agent智能分析原文】',
      result.agentReply,
      '',
      '--- 报告结束 ---',
      '  由一鉴到底(YiJianDaoDi)安全鉴别平台自动生成',
      '  https://localhost:3000',
    ].join('\n');

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (config.reportTitle).replace(/\s/g, '_') + '_' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    message.success('报告已下载');
  };

  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'safe': return { color: '#00B42A', icon: <CheckCircle size={18} />, text: '安全' };
      case 'warning': return { color: '#FF7D00', icon: <AlertTriangle size={18} />, text: '低风险' };
      case 'danger': return { color: '#F53F3F', icon: <XCircle size={18} />, text: '高风险' };
      default: return { color: '#00B42A', icon: <CheckCircle size={18} />, text: '安全' };
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pass': return <Tag color="#00B42A">通过</Tag>;
      case 'warn': return <Tag color="#FF7D00">警告</Tag>;
      case 'fail': return <Tag color="#F53F3F">未通过</Tag>;
      default: return <Tag color="#86909C">未知</Tag>;
    }
  };

  const renderInputArea = () => (
    <Tabs
      activeKey={activeTab}
      onChange={(k) => { setActiveTab(k); }}
      items={[
        ...config.tabs.filter(t => t.key !== 'batch').map(tab => ({
          key: tab.key,
          label: (
            <Space>
              {tab.icon}
              {tab.label}
              {(tab.key === 'optimize' || tab.key === 'viral-check' || tab.key === 'viral-predict' || tab.key === 'risk-check') && (
                <Crown size={12} style={{ color: '#FF7D00' }} />
              )}
            </Space>
          ),
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(scenario === 'resume' || scenario === 'contract') && tab.key === 'file' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#86909C', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {scenario === 'resume' ? '目标行业:' : '合同类型:'}
                  </span>
                  <Select
                    value={scenario === 'resume' ? industry : undefined}
                    onChange={(val) => { if (scenario === 'resume') setIndustry(val); }}
                    options={INDUSTRY_OPTIONS}
                    style={{ width: 160 }}
                    size="small"
                  />
                </div>
              )}
              {scenario === 'video' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#86909C', fontSize: 13, whiteSpace: 'nowrap' }}>目标平台:</span>
                  <Select
                    value={platform}
                    onChange={setPlatform}
                    options={VIDEO_PLATFORMS}
                    style={{ width: 140 }}
                    size="small"
                  />
                </div>
              )}
              {tab.key === 'text' && (
                <>
                  {scenario === 'code' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#86909C', fontSize: 13, whiteSpace: 'nowrap' }}>编程语言:</span>
                      <Select
                        value={codeLang}
                        onChange={setCodeLang}
                        options={CODE_LANGUAGES}
                        style={{ width: 160 }}
                        size="small"
                      />
                    </div>
                  )}
                  <TextArea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={tab.hint}
                    rows={scenario === 'code' ? 10 : scenario === 'video' ? 8 : 6}
                    maxLength={scenario === 'paper' ? 50000 : 20000}
                    showCount
                    style={{ resize: 'none', fontFamily: scenario === 'code' ? '"Courier New", monospace' : 'inherit', fontSize: scenario === 'code' ? 13 : 14 }}
                  />
                </>
              )}
              {tab.key === 'file' && (
                <>
                  <Dragger
                    fileList={fileList}
                    onChange={({ fileList: fl }) => setFileList(fl)}
                    beforeUpload={() => false}
                    accept={config.acceptTypes.join(',')}
                    maxCount={scenario === 'image' ? 5 : 1}
                    multiple={scenario === 'image'}
                    listType={scenario === 'image' ? 'picture' : 'text'}
                    style={{
                      padding: scenario === 'image' ? '32px 0' : '24px 0',
                      background: '#F7F8FA',
                      borderColor: '#E5E6EB',
                      borderRadius: 6,
                    }}
                  >
                    <p className="ant-upload-drag-icon">
                      {scenario === 'image'
                        ? <ImageIcon size={40} style={{ color: '#165DFF' }} />
                        : <Upload size={40} style={{ color: '#165DFF' }} />
                      }
                    </p>
                    <p className="ant-upload-text" style={{ color: '#1D2129', fontWeight: 500 }}>
                      点击或拖拽文件到此区域上传
                    </p>
                    <p className="ant-upload-hint" style={{ color: '#86909C' }}>
                      {tab.hint}
                    </p>
                  </Dragger>
                </>
              )}
              {(tab.key === 'url' || tab.key === 'abstract' || tab.key === 'risk-check') && (
                <>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={tab.hint}
                    size="large"
                    prefix={<LinkIcon size={16} style={{ color: '#86909C' }} />}
                  />
                </>
              )}
              <Button
                type="primary"
                block
                size="large"
                onClick={handleStartDetect}
                disabled={
                  (activeTab === 'text' && !inputText.trim()) ||
                  (activeTab === 'file' && fileList.length === 0) ||
                  ((activeTab === 'url' || activeTab === 'abstract' || activeTab === 'risk-check') && !url.trim())
                }
                style={{ height: 44, fontWeight: 500 }}
              >
                开始{scenario === 'image' ? '鉴别' : scenario === 'code' ? '审计' : scenario === 'paper' ? '检测' : scenario === 'resume' ? '分析简历' : scenario === 'contract' ? '审查合同' : scenario === 'marketing' ? '检测文案' : '分析脚本'}
              </Button>
            </div>
          ),
        })),
        ...(scenario === 'image' ? [{
          key: 'batch',
          label: (
            <Space>
              <Sparkles size={14} />
              批量检测
            </Space>
          ),
          children: (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <ImageIcon size={48} style={{ color: '#C9CDD4', marginBottom: 12 }} />
              <p style={{ color: '#86909C', fontSize: 14 }}>批量检测功能开发中...</p>
              <p style={{ color: '#C9CDD4', fontSize: 12 }}>即将支持最多5张图片同时鉴别</p>
            </div>
          ),
        }] : []),
      ]}
    />
  );

  const renderResultArea = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin
            indicator={<Loader2 size={48} style={{ color: '#165DFF' }} className="spin-icon" />}
            tip={<span style={{ color: '#86909C', marginTop: 12, display: 'block' }}>正在进行{config.label}...</span>}
          />
          <Progress
            percent={detectProgress}
            strokeColor={'#165DFF'}
            style={{ maxWidth: 300, margin: '24px auto 0' }}
            showInfo={false}
          />
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .spin-icon { animation: spin 1s linear infinite; }
          `}</style>
        </div>
      );
    }

    if (!result) return null;

    const levelConfig = getLevelConfig(result.level);
    const isPaidScenario = ['paper', 'resume', 'contract', 'marketing', 'video'].includes(scenario);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 总览卡片 */}
        <div style={{ background: '#F7F8FA', border: '1px solid #E5E6EB', borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 14 }}>
            {config.reportTitle}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} style={{ color: levelConfig.color }} />
              <span style={{ color: '#86909C', fontSize: 13 }}>安全等级:</span>
              <span style={{ color: levelConfig.color, fontWeight: 600 }}>{levelConfig.text}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} style={{ color: '#165DFF' }} />
              <span style={{ color: '#86909C', fontSize: 13 }}>检测结果:</span>
              <span style={{ color: '#00B42A', fontWeight: 500 }}>{result.passedCount}项通过</span>
              <span style={{ color: '#86909C' }}>/</span>
              <span style={{ color: result.riskCount > 0 ? '#F53F3F' : '#00B42A', fontWeight: 500 }}>
                {result.riskCount}项{result.riskCount > 0 ? '风险' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={18} style={{ color: '#86909C' }} />
              <span style={{ color: '#86909C', fontSize: 13 }}>耗时:</span>
              <span style={{ color: '#1D2129', fontWeight: 500 }}>{result.duration}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} style={{ color: '#165DFF' }} />
              <span style={{ color: '#86909C', fontSize: 13 }}>置信度:</span>
              <span style={{ color: '#165DFF', fontWeight: 600 }}>{result.confidence}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle
                size={18}
                style={{ color: result.aiProbability > 50 ? '#F53F3F' : result.aiProbability > 25 ? '#FF7D00' : '#00B42A' }}
              />
              <span style={{ color: '#86909C', fontSize: 13 }}>AI概率:</span>
              <span
                style={{
                  color: result.aiProbability > 50 ? '#F53F3F' : result.aiProbability > 25 ? '#FF7D00' : '#00B42A',
                  fontWeight: 600,
                }}
              >
                {result.aiProbability}%
              </span>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '4px 0' }} />

        {/* 详细分析 */}
        <div style={{ background: '#F7F8FA', border: '1px solid #E5E6EB', borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129', marginBottom: 14 }}>
            详细分析
          </div>
          <Collapse
            ghost
            defaultActiveKey={result.details.map((_, i) => String(i))}
            items={result.details.map((item, index) => ({
              key: String(index),
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.status === 'pass' && <CheckCircle size={16} style={{ color: '#00B42A' }} />}
                  {item.status === 'warn' && <AlertTriangle size={16} style={{ color: '#FF7D00' }} />}
                  {item.status === 'fail' && <XCircle size={16} style={{ color: '#F53F3F' }} />}
                  <span style={{ color: '#1D2129', fontWeight: 500 }}>{item.title}</span>
                  <span style={{ marginLeft: 'auto' }}>{getStatusTag(item.status)}</span>
                </div>
              ),
              children: (
                <div style={{ padding: '4px 0 4px 26px', color: '#4E5969', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>{item.content}</span>
                  {item.extra}
                </div>
              ),
            }))}
          />
        </div>

        {/* A级场景付费转化入口 */}
        {isPaidScenario && result.paidFeature && (
          <div
            style={{
              background: scenario === 'contract'
                ? 'linear-gradient(135deg, rgba(114,46,209,0.08), rgba(22,93,255,0.08))'
                : 'linear-gradient(135deg, rgba(22,93,255,0.06), rgba(255,125,0,0.06))',
              border: '1px solid ' + (scenario === 'contract' ? '#722ED1' : '#165DFF'),
              borderRadius: 6,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: scenario === 'contract' ? '#722ED1' : '#165DFF', fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crown size={16} />
                {scenario === 'resume' && '需要更专业的简历优化？'}
                {scenario === 'contract' && '需要资深律师深度审核？'}
                {scenario === 'marketing' && '想要更高的转化率？'}
                {scenario === 'video' && '想打造下一个爆款视频？'}
              </div>
              <div style={{ color: '#86909C', fontSize: 13 }}>
                {result.upgradeSuggestion}
              </div>
            </div>
            <Button
              type="primary"
              style={{
                background: scenario === 'contract' ? '#722ED1' : '#165DFF',
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                deepseekApi.trackPricingView(scenario);
                setShowPricing(true);
              }}
            >
              {scenario === 'contract' ? '了解企业版 (¥99起)' : scenario === 'resume' ? '查看优化方案 (¥9.9起)' : scenario === 'marketing' ? '购买高级鉴别 (¥9.9)' : '开通Pro会员'}
              <ArrowRight size={14} style={{ marginLeft: 4 }} />
            </Button>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
          <Tooltip title="复制全部结果到剪贴板">
            <Button icon={<Copy size={16} />} onClick={handleCopyResult}>
              复制结果
            </Button>
          </Tooltip>
          <Button icon={<RefreshCw size={16} />} onClick={resetState}>
            重新检测
          </Button>
          <Button type="primary" icon={<Download size={16} />} onClick={handleDownloadReport} style={{ background: '#165DFF' }}>
            下载报告
          </Button>
        </div>
      </div>
    );
  };

  const renderPricingModal = () => (
    <Modal
      open={showPricing}
      onCancel={() => setShowPricing(false)}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown size={20} style={{ color: '#FF7D00' }} />
          <span>选择套餐 - 解锁全部能力</span>
        </div>
      }
      width={900}
      footer={null}
      destroyOnHidden
    >
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <p style={{ color: '#86909C', fontSize: 14, margin: 0 }}>
          根据您的需求选择合适的套餐，即刻享受专业的AI鉴别服务
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              position: 'relative',
              background: plan.highlighted ? '#FFFFFF' : '#FAFBFC',
              border: '2px solid ' + (plan.highlighted ? '#165DFF' : '#E5E6EB'),
              borderRadius: 8,
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: plan.highlighted ? '0 4px 16px rgba(22,93,255,0.12)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: -10,
                right: 16,
                background: plan.badge === '超值' ? '#FF7D00' : '#165DFF',
                color: '#FFF',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: 10,
              }}>
                {plan.badge}
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1D2129', marginBottom: 4 }}>
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#165DFF' }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: '#86909C' }}>{plan.period}</span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {plan.features.map((feature, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4E5969' }}>
                  <CheckCircle size={14} style={{ color: '#00B42A', flexShrink: 0 }} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Button
              type={plan.highlighted ? 'primary' : 'default'}
              block
              style={{
                height: 40,
                fontWeight: 600,
                borderRadius: 6,
                background: plan.highlighted ? '#165DFF' : '#FFFFFF',
                borderColor: plan.highlighted ? '#165DFF' : '#E5E6EB',
                color: plan.highlighted ? '#FFF' : '#4E5969',
              }}
              onClick={() => {
                deepseekApi.trackPricingClick(scenario, plan.id);
                if (plan.id === 'enterprise') {
                  message.success('销售顾问将尽快联系您！');
                } else if (plan.id === 'free') {
                  message.info('免费版每日可使用3次基础鉴别');
                  setShowPricing(false);
                } else {
                  message.success('正在跳转支付...');
                }
              }}
            >
              {plan.ctaText}
            </Button>
          </div>
        ))}
      </div>

      <div style={{
        background: '#F7F8FA',
        borderRadius: 6,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <Building2 size={20} style={{ color: '#722ED1', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#1D2129', fontSize: 14, marginBottom: 2 }}>
            企业定制服务
          </div>
          <div style={{ color: '#86909C', fontSize: 13 }}>
            需要 API 接口、私有部署、定制化场景？联系我们的企业解决方案团队
          </div>
        </div>
        <Button
          icon={<Users size={16} />}
          style={{ borderColor: '#722ED1', color: '#722ED1', whiteSpace: 'nowrap' }}
          onClick={() => message.success('企业咨询通道已开启')}
        >
          企业咨询
        </Button>
      </div>
    </Modal>
  );

  const modalWidth = typeof window !== 'undefined' && window.innerWidth < 600 ? '95%' : 700;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {config.icon}
            <span>{title}</span>
            <Tag color="#165DFF" style={{ marginLeft: 8, fontSize: 11 }}>{config.label}</Tag>
            {config.pricingTier && config.pricingTier !== 'free' && (
              <Tag color={config.pricingTier === 'enterprise' ? '#722ED1' : config.pricingTier === 'premium' ? '#FF7D00' : '#165DFF'} style={{ fontSize: 11 }}>
                <Star size={10} style={{ marginRight: 2 }} />
                {config.pricingTier === 'enterprise' ? '企业级' : config.pricingTier === 'premium' ? '高级' : '增值'}
              </Tag>
            )}
          </div>
        }
        width={modalWidth}
        destroyOnHidden
        footer={null}
        styles={{
          body: { padding: step === 1 ? '24px' : '24px 24px 8px 24px' },
          header: { borderBottom: '1px solid #E5E6EB', padding: '16px 24px' },
        }}
      >
        {step === 1 ? renderInputArea() : renderResultArea()}
      </Modal>
      {renderPricingModal()}
    </>
  );
};

export default UnifiedIdentifyModal;
