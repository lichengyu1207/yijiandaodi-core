export interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  coverImage: string;
  categoryId: number;
  categoryName: string;
  tags: string[];
  authorId: number;
  authorName: string;
  avatar: string;
  publishTime: string;
  readCount: number;
  likeCount: number;
  commentCount: number;
  isRecommended: boolean;
  status: 'published' | 'draft' | 'archived';
  xinfaTag?: 'industry_insight' | 'ai_security_pitfall' | 'compute_cost' | 'startup_review' | 'qa_qa' | 'beginner_guide' | 'architecture_inside';
  isPinned?: boolean;
  isHot?: boolean;
  pitfallCount?: number;
  learnedCount?: number;
  userHasPitfalled?: boolean;
  userHasLearned?: boolean;
  ctaText?: string;
  ctaLink?: string;
  hookLine?: string;
  zoneId?: 'industry' | 'security' | 'compute' | 'startup' | 'qa' | 'guide' | 'inside';
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  articleCount: number;
  coverImage?: string;
}

export interface Author {
  id: number;
  name: string;
  avatar: string;
  bio: string;
}

export interface ArticleListParams {
  page?: number;
  pageSize?: number;
  category?: number;
  tag?: string;
  sort?: 'publish_time' | '-publish_time' | 'read_count' | '-read_count' | 'like_count' | '-like_count';
  search?: string;
  xinfaTag?: 'industry_insight' | 'ai_security_pitfall' | 'compute_cost' | 'startup_review' | 'qa_qa' | 'beginner_guide' | 'architecture_inside';
  zoneId?: 'industry' | 'security' | 'compute' | 'startup' | 'qa' | 'guide' | 'inside';
}

export interface ArticleListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Article[];
}
