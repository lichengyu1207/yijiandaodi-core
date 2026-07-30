import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import reactPlugin from '@vitejs/plugin-react';

let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;

async function getVite() {
  if (!vite) {
    vite = await createViteServer({
      root: '../frontend',
      plugins: [reactPlugin()],
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }
  return vite;
}

export async function renderSSR(req: Request, res: Response) {
  const url = req.originalUrl;
  const viteServer = await getVite();

  try {
    let { render } = await viteServer.ssrLoadModule('/src/ssr-entry.tsx');

    const { html, seoData } = await render(url, req.headers);

    const template = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${seoData.description || '一鉴到底 - AI安全执行层基础设施'}" />
  <meta name="keywords" content="${seoData.keywords || 'AI安全,执行层,P2P算力,数据不出域,代码审计'}" />
  ${seoData.canonical ? `<link rel="canonical" href="${seoData.canonical}" />` : ''}
  ${seoData.ogTags || ''}
  <title>${seoData.title || '一鉴到底 | AI安全执行层基础设施'}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root">${html}</div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;

    const transformed = await viteServer.transformIndexHtml(url, template);
    res.status(200).setHeader('Content-Type', 'text/html').send(transformed);
  } catch (e) {
    vite?.ssrFixStacktrace(e as Error);
    throw e;
  }
}
