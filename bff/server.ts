import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { renderSSR } from './src/middleware/ssr.ts';
import { setupSeoRoutes } from './src/routes.ts';
import { serveRobots } from './src/seo/robots.ts';
import { serveSitemap } from './src/seo/sitemap.ts';

const app = express();
const PORT = process.env.PORT || 4000;
const DJANGO_URL = process.env.DJANGO_URL || 'http://localhost:8000';

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', '/categories', 'https://picsum.photos', 'https://trae-api-cn.mchost.guru'],
      connectSrc: ["'self'", DJANGO_URL, 'wss:', 'ws:'],
    },
  },
}));
app.use(morgan('combined'));

app.use(express.static('../frontend/dist/client', { index: false }));

app.use('/api', createProxyMiddleware({
  target: DJANGO_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '/api' },
  onProxyReq: (proxyReq, req) => {
    if (req.headers['x-forwarded-for']) {
      proxyReq.setHeader('X-Forwarded-For', req.headers['x-forwarded-for'] as string);
    }
  },
}));

app.use('/media', createProxyMiddleware({
  target: DJANGO_URL,
  changeOrigin: true,
}));

setupSeoRoutes(app);

app.get('/robots.txt', serveRobots);
app.get('/sitemap.xml', serveSitemap);

const SKIP_SSR_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'];

app.use('*', async (req, res, next) => {
  const url = req.originalUrl;
  if (
    url.startsWith('/api') ||
    url.startsWith('/media') ||
    url.startsWith('/admin') ||
    SKIP_SSR_EXTENSIONS.some(ext => url.endsWith(ext)) ||
    url.startsWith('/_next')
  ) {
    return next();
  }

  try {
    await renderSSR(req, res);
  } catch (err) {
    console.error('[SSR Error]', err);
    res.status(500).send('Server Render Error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 BFF Server running at http://localhost:${PORT}`);
  console.log(`   API Proxy → ${DJANGO_URL}`);
  console.log(`   Admin SPA → http://localhost:3000`);
});
