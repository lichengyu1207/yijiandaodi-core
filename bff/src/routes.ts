import type { Express } from 'express';

export function setupSeoRoutes(app: Express): void {

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'yijiandaodi-bff' });
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const axios = (await import('axios')).default;
      const djangoHealth = await axios.get(`${process.env.DJANGO_URL || 'http://localhost:8000'}/api/health`, { timeout: 3000 });
      res.json({
        status: 'ok',
        bff: 'healthy',
        django: djangoHealth.data,
      });
    } catch {
      res.json({ status: 'degraded', bff: 'healthy', django: 'unreachable' });
    }
  });

  const SEO_ROUTES = [
    '/',
    '/category/:id',
    '/cases/:id',
    '/search',
    '/pricing',
    '/about',
    '/developer',
    '/courses',
    '/enterprise-services',
    '/tech/provenance',
    '/tech/deepfake',
    '/unified-scan',
    '/dual-engine',
    '/originality',
    '/anti-fraud',
  ];

  for (const route of SEO_ROUTES) {
    app.get(route, (req, res, next) => {
      (req as any).__seoRoute = true;
      next();
    });
  }
}
