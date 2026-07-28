import type { Category } from '../types/article';

export const categories: Category[] = [
  {
    id: 1,
    name: '行业认知洞察',
    slug: 'industry-insight',
    icon: '🔭',
    description: '反常识颠覆式洞察：AI执行层才是真正护城河，大多数人看错的方向',
    articleCount: 15,
    coverImage: '/categories/industry-insight.jpg',
  },
  {
    id: 2,
    name: 'AI安全避坑',
    slug: 'ai-security-pitfall',
    icon: '🛡️',
    description: '劝退警告式指南：裸奔运行AI代码、免费工具陷阱、四层巡检兜底',
    articleCount: 15,
    coverImage: '/categories/ai-security-pitfall.jpg',
  },
  {
    id: 3,
    name: '算力成本拆解',
    slug: 'compute-cost',
    icon: '⚡',
    description: '成本反差碾压式分析：P2P算力仅为传统云服务1/20，闲置设备零门槛入局',
    articleCount: 15,
    coverImage: '/categories/compute-cost.jpg',
  },
  {
    id: 4,
    name: '项目创业复盘',
    slug: 'startup-review',
    icon: '📝',
    description: '个人闭关复盘式总结：从0到商业闭环，AI安全赛道底层逻辑与落地真经',
    articleCount: 15,
    coverImage: '/categories/startup-review.jpg',
  },
  {
    id: 5,
    name: '赛道问答解惑',
    slug: 'qa-qa',
    icon: '❓',
    description: '悬念反问式解答：2026入局还有红利吗？数据不出域真能实现？内行说真话',
    articleCount: 15,
    coverImage: '/categories/qa-qa.jpg',
  },
  {
    id: 6,
    name: '新手入门指南',
    slug: 'beginner-guide',
    icon: '🧭',
    description: '避坑清单式教程：5步入门AI执行层、P2P节点搭建、安全风控核心点',
    articleCount: 15,
    coverImage: '/categories/beginner-guide.jpg',
  },
  {
    id: 7,
    name: '架构干货内幕',
    slug: 'architecture-inside',
    icon: '🏗️',
    description: '内幕无人敢说式拆解：七层架构、EIHM-P2P-CS调度、四层巡检设计逻辑',
    articleCount: 15,
    coverImage: '/categories/architecture-inside.jpg',
  }
];

const CATEGORY_COVER_MAP: Record<number, string> = {
  1: '/categories/industry-insight.jpg',
  2: '/categories/ai-security-pitfall.jpg',
  3: '/categories/compute-cost.jpg',
  4: '/categories/startup-review.jpg',
  5: '/categories/qa-qa.jpg',
  6: '/categories/beginner-guide.jpg',
  7: '/categories/architecture-inside.jpg',
};

export { CATEGORY_COVER_MAP };
