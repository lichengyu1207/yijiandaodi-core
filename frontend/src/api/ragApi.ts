import axios from 'axios';

const RAG_API_BASE = '/api/rag';

const ragApi = axios.create({
  baseURL: RAG_API_BASE,
  timeout: 30000,
});

ragApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

ragApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('RAG API Error:', error);
    return Promise.reject(error);
  }
);

// ==================== 知识库分类 ====================

export interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  document_count: number;
  chunk_count: number;
  created_at: string;
}

export const getKBCategories = () =>
  ragApi.get('/categories/');

export const getKBStatistics = () =>
  ragApi.get('/categories/statistics/');

// ==================== 文档管理 ====================

export interface KBDocument {
  id: number;
  title: string;
  category_id: number;
  category_name?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_type_display?: string;
  status: string;
  status_display?: string;
  progress: number;
  word_count: number;
  chunk_count: number;
  summary: string;
  is_public: boolean;
  uploaded_by: number;
  created_at: string;
  updated_at: string;
}

export const getDocuments = (params?: {
  category_id?: number | string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => ragApi.get('/documents/', { params });

export const uploadDocument = (data: FormData) =>
  ragApi.post('/documents/upload/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDocumentDetail = (id: number) =>
  ragApi.get(`/documents/${id}/`);

export const getDocumentChunks = (id: number) =>
  ragApi.get(`/documents/${id}/chunks/`);

export const deleteDocument = (id: number) =>
  ragApi.delete(`/documents/${id}/delete_with_chunks/`);

// ==================== 检索和问答 ====================

export interface SearchResult {
  chunk_id: number;
  content: string;
  document_title: string;
  score: number;
  metadata: Record<string, any>;
  page_number: number;
  section_title: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_found: number;
  response_time_ms: number;
  query_type: string;
}

export interface RAGAnswerResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  model_used: string;
  response_time_ms: number;
}

export const searchKnowledgeBase = (data: {
  query: string;
  category_slug?: string;
  top_k?: number;
  query_type?: 'semantic' | 'keyword' | 'hybrid';
  min_score?: number;
}) => ragApi.post('/search/search/', data);

export const askQuestion = (data: {
  question: string;
  category_slug?: string;
  top_k?: number;
  session_id?: string;
  user_id?: number;
}) => ragApi.post('/search/ask/', data);

// ==================== 检索日志 ====================

export interface RetrievalLogItem {
  id: number;
  query: string;
  query_type: string;
  results_count: number;
  response_time_ms: number;
  user_id: number;
  created_at: string;
}

export const getRetrievalLogs = (params?: {
  date_from?: string;
  date_to?: string;
  query_type?: string;
  page?: number;
  page_size?: number;
}) => ragApi.get('/logs/', { params });

export default ragApi;
