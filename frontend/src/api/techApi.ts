import request from '@/utils/request';

export interface ProvenanceItem {
  id: string;
  user?: number;
  content_type: string;
  content_type_display: string;
  file_name: string;
  file_size: number;
  file_hash_sha256: string;
  original_content: string;
  content_preview: string;
  digital_fingerprint: Record<string, any>;
  fingerprint_version: string;
  watermark_detected: boolean;
  watermark_info: Record<string, any>;
  source_confidence: string;
  source_confidence_display: string;
  confidence_score: number;
  provenance_chain: Array<Record<string, any>>;
  generation_tool_detected: string;
  generation_params: Record<string, any>;
  modification_history: Array<Record<string, any>>;
  cross_platform_matches: Array<Record<string, any>>;
  c2pa_metadata: Record<string, any>;
  technical_report: string;
  risk_assessment: Record<string, any>;
  status: string;
  status_display: string;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface DeepfakeItem {
  id: string;
  user?: number;
  video_type: string;
  video_type_display: string;
  file_name: string;
  file_size: number;
  duration_seconds: number | null;
  resolution: string;
  file_hash_sha256: string;
  video_metadata: Record<string, any>;
  overall_verdict: string;
  verdict_display: string;
  deepfake_probability: number;
  confidence_score: number;
  face_analysis: Record<string, any>;
  frame_analysis: Array<Record<string, any>>;
  temporal_consistency: Record<string, any>;
  frequency_analysis: Record<string, any>;
  biological_signals: Record<string, any>;
  audio_visual_sync: Record<string, any>;
  gan_artifact_detection: Array<Record<string, any>>;
  manipulation_traces: Array<Record<string, any>>;
  detected_techniques: Array<Record<string, any>>;
  affected_regions: string[];
  forensic_evidence: Record<string, any>;
  technical_report: string;
  risk_level: string;
  risk_level_display: string;
  recommended_actions: string[];
  status: string;
  status_display: string;
  processing_time_ms: number;
  frames_analyzed: number;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/tech';

export const techApi = {
  provenance: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/provenance/`, { params }),
    detail: (id: string) => request.get(`${BASE}/provenance/${id}/`),
    analyze: (data: Partial<ProvenanceItem>) => request.post(`${BASE}/provenance/analyze/`, data),
    stats: () => request.get(`${BASE}/provenance/stats/`),
  },
  deepfake: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/deepfake/`, { params }),
    detail: (id: string) => request.get(`${BASE}/deepfake/${id}/`),
    detect: (data: Partial<DeepfakeItem>) => request.post(`${BASE}/deepfake/detect/`, data),
    stats: () => request.get(`${BASE}/deepfake/stats/`),
  },
};

export type { ProvenanceItem, DeepfakeItem };
