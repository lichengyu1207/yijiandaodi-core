import request from '@/utils/request';

export interface PaperSubmissionItem {
  id: string;
  user?: number;
  title: string;
  author_name: string;
  institution: string;
  paper_type: string; paper_type_display: string;
  subject_area: string; subject_area_display: string;
  original_text: string; text_preview: string;
  total_characters: number; total_words: number; estimated_pages: number;
  file_name: string; file_size: number; file_hash_sha256: string;
  overall_integrity_score: number;
  overall_ai_score: number; overall_plagiarism_score: number;
  overall_verdict: string; verdict_display: string;
  confidence_level: string;
  chapter_count: number; sections_analyzed: number;
  problematic_sections_count: number; clean_sections_count: number;
  structure_analysis: Record<string, any>;
  chapter_results: ChapterResult[];
  key_findings: any[];
  risk_indicators: Record<string, any>;
  citation_analysis: Record<string, any>;
  detailed_report: string;
  student_friendly_summary: string;
  improvement_recommendations: ImprovementRec[];
  status: string; status_display: string;
  processing_time_ms: number; error_message: string;
  tags: string[]; metadata: Record<string, any>;
  created_at: string; updated_at: string;
  chapters?: ChapterAnalysisItem[];
}

export interface ChapterResult {
  order: number; title: string; type: string;
  word_count: number; ai_probability: number; plagiarism_similarity: number;
  integrity_score: number; verdict: string;
  problem_sentences: ProblemSentence[];
  plagiarism_sources: PlagiarismSource[];
  writing_style_notes: string;
}

export interface ChapterAnalysisItem {
  id: string; submission: string;
  chapter_order: number; chapter_title: string;
  chapter_type: string; chapter_type_display: string;
  original_text: string; char_count: number; word_count: number;
  ai_probability: number; plagiarism_similarity: number; integrity_score: number;
  verdict: string; verdict_display: string;
  perplexity_score: number; burstiness_score: number;
  vocabulary_diversity: number; academic_tone_score: number; citation_density: number;
  problem_sentences: ProblemSentence[];
  plagiarism_sources: PlagiarismSource[];
  ai_markers: string[]; writing_style_notes: string;
  detailed_analysis: Record<string, any>; created_at: string;
}

export interface ProblemSentence {
  index_in_chapter: number; text_preview: string;
  issue_type: string; severity: string; suggestion: string;
}

export interface PlagiarismSource {
  matched_text: string; similarity_percent: number;
  source_description: string; type: string;
}

export interface ImprovementRec {
  priority: string; chapter_ref: string;
  issue: string; suggestion: string;
  example_before: string; example_after: string;
}

const BASE = '/api/chapter-detect';

export const chapterDetectApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/paper-submission/`, { params }),
  detail: (id: string) => request.get(`${BASE}/paper-submission/${id}/`),
  detect: (data: { original_text: string; title?: string; author_name?: string; institution?: string; paper_type?: string; subject_area?: string; file_name?: string; file_size?: number }) =>
    request.post(`${BASE}/paper-submission/detect/`, data),
  stats: () => request.get(`${BASE}/paper-submission/stats/`),
  exportPdf: (id: string, config?: Record<string, any>) => request.post(`${BASE}/paper-submission/${id}/export-pdf/`, config || {}),
};
