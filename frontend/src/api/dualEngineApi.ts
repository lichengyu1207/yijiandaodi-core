import request from '@/utils/request';

export interface DualEngineItem {
  id: string;
  user?: number;
  original_text: string;
  text_preview: string;
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
  file_name: string;
  file_size: number;
  file_hash_sha256: string;
  content_language: string;
  ai_score: number;
  plagiarism_score: number;
  originality_score: number;
  human_written_percent: number;
  ai_generated_percent: number;
  mixed_content_percent: number;
  plagiarized_percent: number;
  overall_verdict: string;
  verdict_display: string;
  confidence_level: string;
  confidence_display: string;
  confidence_value: number;
  ai_model_detected: string;
  ai_model_confidence: number;
  reading_ease_score: number;
  avg_sentence_length: number;
  vocab_richness: number;
  style_consistency: number;
  sentence_analyses: SentenceAnalysis[];
  source_matches: SourceMatch[];
  ai_indicators: Record<string, any>;
  plagiarism_indicators: Record<string, any>;
  detailed_report: string;
  executive_summary: string;
  status: string;
  status_display: string;
  processing_time_ms: number;
  ai_engine_time_ms: number;
  plagiarism_engine_time_ms: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SentenceAnalysis {
  index: number;
  text: string;
  start_char: number;
  end_char: number;
  ai_probability: number;
  plagiarism_similarity: number;
  sentence_verdict: string;
  confidence: number;
  key_reason: string;
  ai_markers: string[];
  source_ref: string | null;
}

export interface SourceMatch {
  match_id: string;
  matched_text_segment: string;
  similarity_percent: number;
  source_type: string;
  source_description: string;
  plagiarism_type: string;
  location_in_text: string;
  confidence: number;
}

const BASE = '/api/dual-engine';

export const dualEngineApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/dual-engine-scan/`, { params }),
  detail: (id: string) => request.get(`${BASE}/dual-engine-scan/${id}/`),
  scan: (data: { original_text: string; file_name?: string; file_size?: number }) =>
    request.post(`${BASE}/dual-engine-scan/scan/`, data),
  stats: () => request.get(`${BASE}/dual-engine-scan/stats/`),
  exportReport: (id: string, format?: string) =>
    request.post(`${BASE}/dual-engine-scan/${id}/export-report/`, { format: format || 'json' }),
};
