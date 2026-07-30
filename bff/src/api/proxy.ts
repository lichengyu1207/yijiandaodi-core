import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';

const DJANGO_BASE = process.env.DJANGO_URL || 'http://localhost:8000';

interface ProxyConfig {
  target: string;
  timeout: number;
  retryCount: number;
}

const API_ENDPOINTS: Record<string, ProxyConfig> = {
  '/api/articles': { target: `${DJANGO_BASE}/api/articles`, timeout: 10000, retryCount: 2 },
  '/api/categories': { target: `${DJANGO_BASE}/api/categories`, timeout: 5000, retryCount: 1 },
  '/api/auth': { target: `${DJANGO_BASE}/api/auth`, timeout: 8000, retryCount: 2 },
  '/api/users': { target: `${DJANGO_BASE}/api/users`, timeout: 8000, retryCount: 1 },
  '/api/p2p': { target: `${DJANGO_BASE}/api/p2p/v1`, timeout: 15000, retryCount: 3 },
};

const CACHE_TTL_MS = {
  articles: 60 * 1000,
  categories: 300 * 1000,
  public: 120 * 1000,
};

const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached(key: string): unknown | null {
  const item = cache.get(key);
  if (item && Date.now() < item.expiry) return item.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl: number): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

export async function apiProxy(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path;

  const matchedEndpoint = Object.keys(API_ENDPOINTS).find(endpoint =>
    path.startsWith(endpoint)
  );

  if (!matchedEndpoint) {
    return next();
  }

  const config = API_ENDPOINTS[matchedEndpoint];
  const cacheKey = `${path}${JSON.stringify(req.query)}`;

  if (req.method === 'GET') {
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
  }

  try {
    const response = await axios({
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: `${config.target}${path.replace(matchedEndpoint, '')}`,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: new URL(config.target).host,
      } as Record<string, string>,
      timeout: config.timeout,
      validateStatus: () => true,
    });

    if (req.method === 'GET' && response.status === 200) {
      const ttl = path.includes('/articles') ? CACHE_TTL_MS.articles :
                 path.includes('/categories') ? CACHE_TTL_MS.categories :
                 CACHE_TTL_MS.public;
      setCache(cacheKey, response.data, ttl);
    }

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[API Proxy Error] ${path}:`, error);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Django service unavailable',
        path,
      });
    }
  }
}

export { API_ENDPOINTS, DJANGO_BASE };
