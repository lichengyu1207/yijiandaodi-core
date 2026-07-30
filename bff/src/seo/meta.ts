interface SEOMeta {
  title: string;
  description: string;
  keywords: string;
  canonical?: string;
  ogTags?: string;
}

const SITE_NAME = '一鉴到底';
const SITE_DESC = 'AI安全执行层基础设施 — ASS安全内核 · EIHM-P2P-CS算力调度 · 数据不出域 · 七层架构纵深防御';

const PAGE_META: Record<string, () => SEOMeta> = {
  '/': () => ({
    title: `${SITE_NAME} | AI安全执行层基础设施 — 行业认知洞察、避坑指南、算力成本拆解`,
    description: SITE_DESC,
    keywords: 'AI安全执行层,ASS安全内核,P2P算力网络,EIHM算法,数据不出域,网页IDE,代码审计,内容风控,大模型误区,算力成本优化',
    canonical: 'https://yijiandaodi.com/',
    ogTags: `
<meta property="og:type" content="website" />
<meta property="og:title" content="${SITE_NAME} - AI安全执行层基础设施" />
<meta property="og:description" content="${SITE_DESC}" />
<meta property="og:url" content="https://yijiandaodi.com/" />
<meta property="og:site_name" content="${SITE_NAME}" />`,
  }),

  '/category/1': () => ({
    title: `行业认知洞察 | ${SITE_NAME} — 反常识颠覆式AI赛道深度分析`,
    description: '大多数人以为AI拼大模型，真正护城河在执行层。15篇反常识洞察，看懂AI安全执行层的底层逻辑与行业真相。',
    keywords: 'AI执行层,行业认知,大模型误区,安全底盘,端侧推理,政企市场,技术壁垒',
    canonical: 'https://yijiandaodi.com/category/industry-insight',
  }),
  '/category/2': () => ({
    title: `AI安全避坑 | ${SITE_NAME} — 劝退警告式安全实践指南`,
    description: '我真心劝你别裸奔运行AI代码。15条避坑警告，覆盖代码漏洞、免费工具陷阱、沙箱隔离、四层巡检等关键安全话题。',
    keywords: 'AI安全避坑,代码漏洞,Prompt注入,沙箱隔离,零信任,日志审计,Agent安全,供应链安全',
    canonical: 'https://yijiandaodi.com/category/ai-security-pitfall',
  }),
  '/category/3': () => ({
    title: `算力成本拆解 | ${SITE_NAME} — P2P算力成本碾压传统云服务`,
    description: '同样跑AI推理，成本仅为传统阿里云的1/20。EIHM-P2P-CS算力调度引擎详解，闲置设备零门槛起步。',
    keywords: 'P2P算力,成本优化,WebGPU,端侧推理,闲置算力,分布式计算,EIHM-P2P-CS,集群组网',
    canonical: 'https://yijiandaodi.com/category/compute-cost',
  }),
  '/category/4': () => ({
    title: `项目创业复盘 | ${SITE_NAME} — AI安全赛道从0到商业闭环`,
    description: '闭门深耕30天，彻底看透AI赛道底层逻辑。闭关复盘、踩坑总结、落地真经，普通人入局AI安全执行层的完整路径。',
    keywords: 'AI创业,复盘总结,商业闭环,执行层赛道,安全算力,产品打磨,长期主义,差异化竞争',
    canonical: 'https://yijiandaodi.com/category/startup-review',
  }),
  '/category/5': () => ({
    title: `赛道问答解惑 | ${SITE_NAME} — 内行实话解答AI安全算力核心问题`,
    description: '2026入局AI安全算力赛道还有红利吗？浏览器本地跑大模型真的能做到数据完全不出域？内行说真话，15个核心问题一次性讲透。',
    keywords: 'AI入局,算力风口,数据安全,P2P网络,WebGPU推理,执行层入门,商用合规,蓝海赛道',
    canonical: 'https://yijiandaodi.com/category/qa-qa',
  }),
  '/category/6': () => ({
    title: `新手入门指南 | ${SITE_NAME} — 避坑清单式AI执行层入门教程`,
    description: '入局AI赛道必踩的5个大坑？搭建P2P算力节点要避开哪些错误？新手必读的避坑指南，按步骤走就能入门AI安全执行层。',
    keywords: 'AI入门,避坑指南,新手必读,P2P节点,安全工具,执行层入门,AI副业,信息流运营,隐私保护',
    canonical: 'https://yijiandaodi.com/category/beginner-guide',
  }),
  '/category/7': () => ({
    title: `架构干货内幕 | ${SITE_NAME} — 七层架构拆解与技术底层真相`,
    description: '关于AI代码漏洞的底层真相，圈内人从不肯实话讲。七层架构拆解、EIHM-P2P-CS调度逻辑、四层巡检设计原理，内幕级技术干货。',
    keywords: '架构设计,底层原理,安全内核,P2P协议,沙箱隔离,零信任架构,区块链存证,七层架构,EIHM算法',
    canonical: 'https://yijiandaodi.com/category/architecture-inside',
  }),

  '/pricing': () => ({
    title: `产品定价 | ${SITE_NAME} — AI安全检测服务价格方案`,
    description: '一鉴到底AI安全执行层产品定价方案，涵盖个人版、团队版、企业版，支持按量付费和包年订阅。',
    keywords: 'AI安全定价,产品价格,企业版,团队版,个人版,按量付费,订阅制',
    canonical: 'https://yijiandaodi.com/pricing',
  }),
  '/about': () => ({
    title: `关于我们 | ${SITE_NAME} — AI安全执行层基础设施团队`,
    description: '了解一鉴到底团队背景、技术愿景和使命——让每一个AI能力都能在安全可控的环境中落地执行。',
    keywords: '关于一鉴到底,团队介绍,技术愿景,公司使命,联系方式',
    canonical: 'https://yijiandaodi.com/about',
  }),
  '/developer': () => ({
    title: `开发者中心 | ${SITE_NAME} — API文档与SDK下载`,
    description: '一鉴到底开发者中心，提供完整的API文档、SDK下载、代码示例和集成指南，快速接入AI安全执行能力。',
    keywords: 'API文档,开发者中心,SDK下载,接口集成,代码示例,开发者工具',
    canonical: 'https://yijiandaodi.com/developer',
  }),
};

function matchDynamicRoute(path: string): SEOMeta | null {
  const detailMatch = path.match(/^\/cases\/(\d+)$/);
  if (detailMatch) {
    return {
      title: `文章详情 | ${SITE_NAME}`,
      description: '一鉴到底原创深度文章，聚焦AI安全执行层、P2P算力网络、代码安全审计等领域。',
      keywords: 'AI安全文章,执行层分析,算力成本,创业复盘,技术内幕',
      canonical: `https://yijiandaodi.com${path}`,
    };
  }

  const categoryMatch = path.match(/^\/category\/(\d+)$/);
  if (categoryMatch) {
    const catId = parseInt(categoryMatch[1]);
    const staticMeta = PAGE_META[`/category/${catId}`];
    if (staticMeta) return staticMeta();
  }

  return null;
}

export function getSEODataForPath(path: string): SEOMeta {
  const normalizedPath = path.split('?')[0].split('#')[0];

  if (PAGE_META[normalizedPath]) {
    return PAGE_META[normalizedPath]();
  }

  const dynamicMatch = matchDynamicRoute(normalizedPath);
  if (dynamicMatch) return dynamicMatch;

  return {
    title: `${SITE_NAME} | AI安全执行层基础设施`,
    description: SITE_DESC,
    keywords: 'AI安全,执行层,P2P算力,数据不出域,代码审计,内容风控,一鉴到底',
    canonical: `https://yijiandaodi.com${normalizedPath}`,
  };
}

export { PAGE_META, SITE_NAME, SITE_DESC };
