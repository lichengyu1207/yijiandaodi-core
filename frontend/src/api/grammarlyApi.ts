import request from '@/utils/request';

export interface ReplacementOption {
  text: string;
  description?: string;
}

export interface CorrectionItem {
  id?: number;
  suggestion_type: 'spelling' | 'grammar' | 'punctuation' | 'style' | 'clarity' | 'conciseness' | 'vocabulary' | 'tone' | 'engagement' | 'delivery' | 'formatting' | 'consistency';
  severity: 'critical' | 'warning' | 'info' | 'suggestion';
  category: string;
  original_text: string;
  corrected_text: string;
  replacement_options: ReplacementOption[];
  start_position: number;
  end_position: number;
  context_before: string;
  context_after: string;
  explanation: string;
  rule_reference: string;
  examples: Array<{ wrong: string; right: string }>;
  confidence: number;
  impact_score: number;
  is_accepted: boolean | null;
}

export interface ReadabilityMetrics {
  reading_level: string;
  avg_sentence_length: number;
  avg_word_length: number;
  flesch_reading_ease: number;
  complex_sentence_ratio: number;
  passive_voice_ratio: number;
  transition_word_density: number;
  paragraph_count: number;
  estimated_read_time_seconds: number;
}

export interface ToneAnalysis {
  detected_tone: string;
  tone_scores: Record<string, number>;
  recommended_tone_for_content_type: string;
  tone_adjustment_suggestions: string[];
}

export interface StyleSuggestion {
  category: string;
  title: string;
  current_version: string;
  optimized_version: string;
  improvement_reason: string;
  expected_impact: string;
}

export interface ImprovementPhase {
  phase: string;
  items: string[];
  estimated_time: string;
}

export interface GrammarCheckItem {
  id: string;
  user: number | null;
  original_text: string;
  corrected_text: string;
  text_hash: string;
  content_type: string;
  content_type_display?: string;

  overall_score: number;
  correctness_score: number;
  clarity_score: number;
  engagement_score: number;
  delivery_score: number;

  total_issues: number;
  critical_count: number;
  warning_count: number;
  suggestion_count: number;

  issue_categories: Record<string, { count: number; severity_breakdown: Record<string, number> }>;

  readability_metrics: ReadabilityMetrics;
  tone_analysis: ToneAnalysis;
  style_suggestions: StyleSuggestion[];

  executive_summary: string;
  improvement_roadmap: ImprovementPhase[];

  processing_time_ms: number;
  created_at: string;
  updated_at: string;

  suggestions?: CorrectionItem[];
}

export interface GrammarlyStats {
  total_checks: number;
  average_overall_score: number;
  average_correctness_score: number;
  content_type_stats: Array<{ content_type: string; count: number; avg_score: number }>;
  severity_summary: {
    total_critical: number;
    total_warning: number;
    total_suggestion: number;
  };
  tone_distribution: Array<{
    tone: string;
    count: number;
    avg_score: number;
  }>;
}

const grammarlyApi = {
  grammar: {
    list: (params?: Record<string, any>) =>
      request.get('/api/grammarly/grammar-check/', { params }),

    retrieve: (id: string) =>
      request.get(`/api/grammarly/grammar-check/${id}/`),

    check: (data: {
      original_text: string;
      content_type?: string;
    }) =>
      request.post('/api/grammarly/grammar-check/check/', data),

    stats: () =>
      request.get('/api/grammarly/grammar-check/stats/'),
  },
};

export default grammarlyApi;
