import axios from 'axios';

const FRONT_API_BASE = '/api/front';

const frontApi = axios.create({
  baseURL: FRONT_API_BASE,
  timeout: 10000,
});

frontApi.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

frontApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const getCategories = () => frontApi.get('/categories/');

export const getArticles = async (params?: {
  page?: number;
  page_size?: number;
  category?: number | string;
  tag?: string;
  sort?: string;
  search?: string;
  xinfaTag?: string;
}) => {
  return frontApi.get('/articles/', { params });
};

export const getArticleDetail = (id: number | string) =>
  frontApi.get(`/articles/${id}/`);

export const getHotArticles = (period?: string) =>
  frontApi.get('/articles/hot/', { params: { period: period || 'week' } });

export const likeArticle = (id: number | string) =>
  frontApi.post(`/articles/${id}/like/`);

export const favoriteArticle = (id: number | string) =>
  frontApi.post(`/articles/${id}/favorite/`);

export const getFavoriteStatus = (articleId: number | string) =>
  frontApi.get(`/articles/${articleId}/favorite_status/`);

export const getTags = () => frontApi.get('/tags/');

export const getAuthors = () => frontApi.get('/authors/');

// 评论相关
export const getArticleComments = (id: number | string) =>
  frontApi.get(`/articles/${id}/comments/`);

export const addArticleComment = (id: number | string, data: { content: string; parent_comment?: number | null }) =>
  frontApi.post(`/articles/${id}/add_comment/`, data);

// 关注相关
export const followAuthor = (articleId: number | string, userId?: number) =>
  frontApi.post(`/articles/${articleId}/follow/`, { user_id: userId || 0 });

export const getFollowStatus = (articleId: number | string, userId?: number) =>
  frontApi.get(`/articles/${articleId}/follow_status/`, { params: { user_id: userId } });

// 点赞状态查询
export const getLikeStatus = (articleId: number | string, userId?: number) =>
  frontApi.get(`/articles/${articleId}/like_status/`, { params: { user_id: userId } });

export default frontApi;
