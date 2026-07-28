import request from '@/utils/request';

export interface MatchedSource {
  source_url: string;
  source_title: string;
  domain: string;
  platform_type: string;
  similarity_percent: number;
  matched_words: number;
  total_words: number;
  match_type: string;
  confidence: number;
  matched_snippets: Array<{
    text: string;
    similarity: number;
  }>;
  source_excerpt: string;
  context_before: string;
  context_after: string;
  publish_date: string | null;
  last_crawled: string | null;
  page_authority: number;
  is_verified: boolean;
  verification_status: string;
  risk_level: string;
  notes: string;
  created_at: string;
}

export interface SentenceAnalysis {
  sentence_index: number;
  original_text: string;
  similarity: number;
  match_type: string;
  matched_sources: Array<Omit<MatchedSource, 'created_at'>>;
  is_problematic: boolean;
  suggestion: string;
}

export interface PlagiarismBreakdown {
  count: number;
  percentage: number;
  total_words: number;
}

export interface ImprovementSuggestion {
  priority: 'P0' | 'P1' | 'P2';
  category: string;
  title: string;
  description: string;
  before_text: string;
  after_text: string;
  affected_sources: string[];
}

export interface MarketingAnalysis {
  ad_compliance_score: number;
  ad_violations_found: string[];
  product_description_uniqueness: number;
  brand_story_originality: number;
  landing_page_cta_uniqueness: number;
  social_media_freshness: number;
  common_phrases_detected: Array<{
    phrase: string;
    frequency: string;
    suggestion: string;
  }>;
}

export interface PlagiarismScanItem {
  id: string;
  user: number | null;
  original_text: string;
  text_hash: string;
  content_type: string;
  content_type_display?: string;
  overall_similarity: number;
  unique_score: number;
  plagiarism_risk: string;
  match_count: number;
  total_sources: number;
  exact_matches: number;
  near_duplicates: number;
  paraphrased: number;
  plagiarism_breakdown: Record<string, PlagiarismBreakdown>;
  platform_distribution: Record<string, { count: number; avg_similarity: number }>;
  sentence_analyses: SentenceAnalysis[];
  executive_summary: string;
  detailed_report: string;
  improvement_suggestions: ImprovementSuggestion[];
  scan_metadata: Record<string, any>;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
  match_sources?: MatchedSource[];
}

export interface CopyscapeStats {
  total_scans: number;
  average_similarity: number;
  high_risk_percentage: number;
  risk_distribution: Array<{ plagiarism_risk: string; count: number }>;
  content_type_distribution: Array<{ content_type: string; count: number }>;
  top_matched_platforms: Array<{ platform: string; count: number; total_similarity: number }>;
}

const copyscapeApi = {
  plagiarism: {
    list: (params?: Record<string, any>) =>
      request.get('/api/copyscape/plagiarism-scan/', { params }),

    retrieve: (id: string) =>
      request.get(`/api/copyscape/plagiarism-scan/${id}/`),

    scan: (data: {
      original_text: string;
      content_type?: string;
    }) =>
      request.post('/api/copyscape/plagiarism-scan/scan/', data),

    stats: () =>
      request.get('/api/copyscape/plagiarism-scan/stats/'),
  },
};

export default copyscapeApi;
