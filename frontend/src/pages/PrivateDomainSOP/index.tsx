import React from 'react';
import { ArrowDown, Target, TrendingUp, Users, DollarSign, Copy } from 'lucide-react';

const STYLES = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F5F7FA',
  },
  container: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '40px 20px',
  },
  hero: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 16,
    color: '#FFFFFF',
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 800,
    marginBottom: 16,
    lineHeight: 1.3,
  },
  heroSubtitle: {
    fontSize: 18,
    opacity: 0.9,
    lineHeight: 1.6,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: '40px 32px',
    marginBottom: 32,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: '#1D2129',
    marginBottom: 24,
    textAlign: 'center' as const,
  },
  processFlow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  processStep: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    transition: 'all 0.25s ease',
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #FF7D00 0%, #EA580C 100%)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    color: '#86909C',
    lineHeight: 1.6,
  },
  arrowIcon: {
    textAlign: 'center' as const,
    color: '#C9CDD4',
    padding: '8px 0',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
  },
  metricCard: {
    padding: 28,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    textAlign: 'center' as const,
  },
  metricValue: {
    fontSize: 36,
    fontWeight: 800,
    color: '#165DFF',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 15,
    color: '#4E5969',
    fontWeight: 500,
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 20,
  },
  productCard: {
    padding: 24,
    borderRadius: 12,
    border: '1px solid #E5E6EB',
    transition: 'all 0.25s ease',
  },
  productPrice: {
    fontSize: 28,
    fontWeight: 700,
    color: '#FF7D00',
    marginTop: 12,
  },
  scriptSection: {
    marginBottom: 24,
  },
  scriptTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#1D2129',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  scriptBox: {
    backgroundColor: '#F7F8FA',
    border: '1px solid #E5E6EB',
    borderRadius: 8,
    padding: 16,
    position: 'relative' as const,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 1.8,
    color: '#4E5969',
  },
  copyButton: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    background: '#FFFFFF',
    border: '1px solid #E5E6EB',
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#4E5969',
  },
};

const PROCESS_STEPS = [
  {
    num: '①',
    title: '内容引流（公众号/知乎/技术博客）',
    desc: '发布高质量 Agent 安全内容，建立专业形象，吸引目标用户关注',
  },
  {
    num: '②',
    title: '引导关注（每篇文章底部 + 详情页）',
    desc: '「扫码加入交流群」+ 9.9元钩子产品，将流量转化为私域用户',
  },
  {
    num: '③',
    title: '社群运营（每日干货 + 互动答疑）',
    desc: '建立信任 + 展示专业能力，让用户感受到你的价值',
  },
  {
    num: '④',
    title: '转化变现（会员/咨询服务/企业合作）',
    desc: '产生第一笔收入，实现从 0 到 1 的突破',
  },
];

const METRICS = [
  { label: '私域好友', value: '≥50人', icon: <Users size={24} /> },
  { label: '产生收入', value: '首笔入账', icon: <DollarSign size={24} /> },
  { label: '用户满意', value: '≥4.5/5', icon: <Target size={24} /> },
  { label: '月营收', value: '≥1000元', icon: <TrendingUp size={24} /> },
];

const HOOK_PRODUCTS = [
  { name: 'Agent 安全审计提示词包', price: '¥9.9', desc: '50+ 高质量 Prompt 模板' },
  { name: 'RAG 向量数据库安全检测工具', price: '¥49.9', desc: '一键检测安全隐患' },
  { name: 'LLM Agent 攻防实战课程', price: '¥199', desc: '系统学习攻防技术' },
  { name: '企业合规检查清单模板包', price: '¥29.9', desc: '主流合规框架覆盖' },
];

const SCRIPTS = [
  {
    title: '公众号自动回复话术',
    content: `欢迎关注「一鉴到底」！👋

这里是 Agent 安全领域的专业社区，我们提供：
✅ AI Agent 安全审计工具
✅ LLM 攻防技术分享
✅ 企业合规解决方案

🎁 新人福利：回复「入门」领取 9.9 元提示词包优惠券

📱 想进交流群？扫码添加微信：yijiandaodi_cn（备注「Agent」）`,
  },
  {
    title: '群内欢迎语',
    content: `欢迎 @新成员 加入「Agent安全交流群」！🎉

本群专注讨论：
• AI/LLM Agent 安全攻防
• Prompt Injection 防护
• RAG 系统安全设计
• 企业落地最佳实践

📌 群规：禁止广告，保持专业，互助共赢

💡 入群福利：查看群公告领取新人礼包`,
  },
  {
    title: '私聊跟进话术 - 第1天',
    content: `Hi [姓名]，欢迎加入一鉴到底社区！👋

我是这里的运营 [你的名字]

看到你对 Agent 安全领域很感兴趣，想了解一下：
1. 你目前主要在做什么方向？（安全研究/开发/运维）
2. 有没有遇到什么具体的挑战？

如果需要，我可以给你推荐一些适合新手的资源 📚`,
  },
  {
    title: '私聊跟进话术 - 第3天',
    content: `Hi [姓名]，

这几天群里有很多优质内容分享，不知道你有没有看到？

🔥 本周热门话题：
- GPT-4o 的 Prompt 注入新漏洞
- RAG 检索增强的安全隐患排查清单

另外，我们的入门产品限时特惠中：
💰 9.9 元的「Agent 审计提示词包」，原价 29.9

有兴趣的话可以看看：[链接]`,
  },
  {
    title: '私聊跟进话术 - 第7天',
    content: `Hi [姓名]，

加入一周了，感觉怎么样？😊

如果你正在做 Agent 相关项目，这里有个建议：

很多同学反馈我们的「企业合规检查清单模板包」（¥29.9）特别实用，可以直接用在项目中节省大量时间。

🎯 本周还有个活动：邀请 3 位好友入群，可以免费获得这个模板包

感兴趣的话告诉我，我帮你开通～`,
  },
];

const PrivateDomainSOP: React.FC = () => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板！');
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* Hero Section */}
        <div style={STYLES.hero}>
          <h1 style={STYLES.heroTitle}>私域运营 SOP · 从 0 到 50 好友</h1>
          <p style={STYLES.heroSubtitle}>
            一套经过验证的 Agent 安全领域私域引流转化方法论
          </p>
        </div>

        {/* Section 2: 流程图 */}
        <div style={STYLES.section}>
          <h2 style={STYLES.sectionTitle}>四步走流程</h2>
          <div style={STYLES.processFlow}>
            {PROCESS_STEPS.map((step, index) => (
              <React.Fragment key={index}>
                <div style={STYLES.processStep}>
                  <div style={STYLES.stepNumber}>{step.num}</div>
                  <div style={STYLES.stepContent}>
                    <div style={STYLES.stepTitle}>{step.title}</div>
                    <div style={STYLES.stepDesc}>{step.desc}</div>
                  </div>
                </div>
                {index < PROCESS_STEPS.length - 1 && (
                  <div style={STYLES.arrowIcon}>
                    <ArrowDown size={24} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Section 3: 关键指标 */}
        <div style={STYLES.section}>
          <h2 style={STYLES.sectionTitle}>关键指标目标</h2>
          <div style={STYLES.metricsGrid}>
            {METRICS.map((metric) => (
              <div key={metric.label} style={STYLES.metricCard}>
                <div style={{ color: '#165DFF', marginBottom: 12 }}>{metric.icon}</div>
                <div style={STYLES.metricValue}>{metric.value}</div>
                <div style={STYLES.metricLabel}>{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: 钩子产品 */}
        <div style={STYLES.section}>
          <h2 style={STYLES.sectionTitle}>9.9元钩子产品设计</h2>
          <div style={STYLES.productGrid}>
            {HOOK_PRODUCTS.map((product) => (
              <div key={product.name} style={STYLES.productCard}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1D2129' }}>
                  {product.name}
                </div>
                <div style={{ fontSize: 13, color: '#86909C', marginTop: 6 }}>
                  {product.desc}
                </div>
                <div style={STYLES.productPrice}>{product.price}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: 承接话术 */}
        <div style={STYLES.section}>
          <h2 style={STYLES.sectionTitle}>微信承接话术</h2>
          {SCRIPTS.map((script) => (
            <div key={script.title} style={STYLES.scriptSection}>
              <div style={STYLES.scriptTitle}>
                📝 {script.title}
              </div>
              <div style={STYLES.scriptBox}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {script.content}
                </pre>
                <button
                  style={STYLES.copyButton}
                  onClick={() => handleCopy(script.content)}
                >
                  <Copy size={13} />
                  复制
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrivateDomainSOP;
