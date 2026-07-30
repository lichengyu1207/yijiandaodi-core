import request from '@/utils/request';

export interface Article {
  id: number;
  title: string;
  content: string;
  summary: string;
  status: 'draft' | 'published' | 'archived' | 'reviewing';
  cover_image?: string | null;
  cover_image_url?: string | null;
  author_name: string;
  author_avatar?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  read_count?: number;
  like_count?: number;
  comment_count?: number;
  xinfa_tag?: string;
  is_pinned?: boolean;
  zone_id?: string;
}

export interface ArticleFormData {
  title: string;
  content: string;
  summary?: string;
  cover_image?: string | null;
  status?: 'draft' | 'published';
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  article_count: number;
  created_at: string;
}

export interface CategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
}

export const contentApi = {
  getArticles: (params?: {
    status?: string;
    keyword?: string;
    xinfa_tag?: string;
    zone_id?: string;
    is_pinned?: string;
    author_id?: number | string;
    start_date?: string;
    end_date?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
  }): Promise<any> => {
    return request.get('/content/articles/', { params });
  },

  getArticle: (id: number): Promise<Article> => {
    return request.get(`/content/articles/${id}/`);
  },

  createArticle: (data: ArticleFormData): Promise<Article> => {
    return request.post('/content/articles/', data);
  },

  updateArticle: (id: number, data: Partial<ArticleFormData>): Promise<Article> => {
    return request.put(`/content/articles/${id}/`, data);
  },

  deleteArticle: (id: number): Promise<void> => {
    return request.delete(`/content/articles/${id}/`);
  },

  uploadImage: (file: File): Promise<{ url: string; alt: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/content/upload-image/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getCategories: (): Promise<Category[]> => {
    return request.get('/content/categories/');
  },

  createCategory: (data: CategoryFormData): Promise<Category> => {
    return request.post('/content/categories/', data);
  },

  updateCategory: (id: number, data: Partial<CategoryFormData>): Promise<Category> => {
    return request.put(`/content/categories/${id}/`, data);
  },

  deleteCategory: (id: number): Promise<void> => {
    return request.delete(`/content/categories/${id}/`);
  },

  batchPublish: (ids: number[]): Promise<any> => {
    return request.post('/content/articles/batch-publish/', { ids });
  },
  batchUnpublish: (ids: number[]): Promise<any> => {
    return request.post('/content/articles/batch-unpublish/', { ids });
  },
  batchDelete: (ids: number[]): Promise<any> => {
    return request.post('/content/articles/batch-delete/', { ids });
  },

  getAuthors: (): Promise<any> => {
    return request.get('/content/authors/');
  },
};
