import request from '@/utils/request';

export interface AlternativeOption {
  text: string;
  description?: string;
}

export interface OptimizationItem {
  id?: number;
  suggestion_category: 'ats_keyword' | 'achievement_quantification' | 'action_verbs' | 'impact_language' | 'section_structure' | 'content_clarity' | 'redundancy_removal' | 'skill_highlighting' | 'formatting' | 'industry_specific' | 'salary_optimization' | 'personal_branding';
  severity: 'critical' | 'important' | 'recommended' | 'optional';
  affected_section: 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'awards' | 'other';
  original_text: string;
  optimized_text: string;
  alternative_options: AlternativeOption[];
  explanation: string;
  impact_description: string;
  salary_impact_range: string;
  before_example: string;
  after_example: string;
  confidence: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'complex';
  is_applied: boolean | null;
}

export interface SectionAnalysis {
  score: number;
  strengths?: string[];
  weaknesses?: string[];
  word_count?: number;
  recommended_length?: string;
  total_entries?: number;
  entries_with_quantified_achievements?: number;
  avg_action_verb_strength?: string;
  issues?: string[];
  is_complete?: boolean;
  highlights?: string[];
  total_skills?: number;
  hard_skills?: number;
  soft_skills?: number;
  tools?: number;
  missing_key_skills?: string[];
}

export interface KeywordItem {
  keyword: string;
  found_in_resume: boolean;
  frequency: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface KeywordAnalysis {
  target_position_keywords: KeywordItem[];
  keyword_coverage_rate: number;
  missing_critical_keywords: string[];
  keyword_optimization_priority: Array<{
    keyword: string;
    where_to_add: string;
    context_example: string;
  }>;
}

export interface ATSCompatibility {
  overall_ats_probability: number;
  format_compatibility: number;
  keyword_match_score: number;
  structure_standardization: number;
  potential_ats_issues: Array<{
    issue: string;
    probability: string;
    solution: string;
  }>;
  recommended_format: string;
}

export interface SalaryImpactEstimate {
  current_estimated_market_value: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  post_optimization_estimate: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  optimization_roi: {
    potential_monthly_increase_min: number;
    potential_monthly_increase_max: number;
    annual_impact_range: string;
  };
  key_leverage_points: Array<{
    area: string;
    current_state: string;
    optimized_state: string;
    salary_impact: string;
  }>;
}

export interface ImprovementPhase {
  phase: string;
  items: string[];
  estimated_time: string;
}

export interface BenchmarkComparison {
  target_position: string;
  experience_level: string;
  sample_size: number;
  industry_average: {
    overall_score: number;
    ats_score: number;
    impact_score: number;
    clarity_score: number;
    completeness_score: number;
  };
  top_10_percent: {
    overall_score: number;
    ats_score: number;
    impact_score: number;
  };
  user_ranking: {
    percentile: number;
    description: string;
    gap_to_top_10?: {
      overall_score_gap: number;
      primary_gaps: string[];
    };
  };
}

export interface ResumeAnalysisItem {
  id: string;
  user: number | null;
  resume_text: string;
  resume_hash: string;
  target_position: string;
  target_industry: string;
  target_industry_display?: string;
  experience_level: string;
  experience_level_display?: string;

  overall_score: number;
  ats_score: number;
  impact_score: number;
  clarity_score: number;
  completeness_score: number;

  total_suggestions: number;
  critical_suggestions: number;
  improvement_suggestions: number;
  enhancement_suggestions: number;

  section_analysis: Record<string, SectionAnalysis>;
  keyword_analysis: KeywordAnalysis;
  ats_compatibility: ATSCompatibility;
  salary_impact_estimate: SalaryImpactEstimate;

  executive_summary: string;
  optimization_roadmap: ImprovementPhase[];
  benchmark_comparison: BenchmarkComparison;

  processing_time_ms: number;
  created_at: string;
  updated_at: string;

  optimizations?: OptimizationItem[];
}

export interface ResumeStats {
  total_analyses: number;
  average_overall_score: number;
  average_ats_score: number;
  industry_distribution: Array<{
    target_industry: string;
    count: number;
    avg_score: number;
  }>;
  experience_level_stats: Array<{
    experience_level: string;
    count: number;
    avg_score: number;
    avg_ats: number;
  }>;
  suggestion_severity_summary: {
    total_critical: number;
    total_improvement: number;
    total_enhancement: number;
  };
}

const resumeApi = {
  resume: {
    list: (params?: Record<string, any>) =>
      request.get('/api/resume/resume-analysis/', { params }),

    retrieve: (id: string) =>
      request.get(`/api/resume/resume-analysis/${id}/`),

    analyze: (data: {
      resume_text: string;
      target_position?: string;
      target_industry?: string;
      experience_level?: string;
    }) =>
      request.post('/api/resume/resume-analysis/analyze/', data),

    stats: () =>
      request.get('/api/resume/resume-analysis/stats/'),
  },
};

export default resumeApi;
