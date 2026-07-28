import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const SITE_URL = 'https://yijiandaodi.com';

const STATIC_PAGES = [
  '',
  '/category/1',
  '/category/2',
  '/category/3',
  '/category/4',
  '/category/5',
  '/category/6',
  '/category/7',
  '/pricing',
  '/about',
  '/developer',
];

const DYNAMIC_ARTICLE_COUNT = 105;

function generateSitemap(): string {
  const today = new Date().toISOString().split('T')[0];
  const lastMod = today;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

  for (const page of STATIC_PAGES) {
    const priority = page === '' ? '1.0' : page.startsWith('/category') ? '0.8' : '0.6';
    const changefreq = page === '' ? 'daily' : 'weekly';
    xml += `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${SITE_URL}${page}" />
  </url>`;
  }

  for (let i = 1; i <= DYNAMIC_ARTICLE_COUNT; i++) {
    xml += `
  <url>
    <loc>${SITE_URL}/cases/${i}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
  }

  xml += '\n</urlset>';
  return xml;
}

export function serveSitemap(_req: any, res: any): void {
  res.set('Content-Type', 'application/xml');
  res.send(generateSitemap());
}

export function generateSitemapToFile(outputPath?: string): void {
  const outPath = outputPath || path.join(process.cwd(), '../frontend/public/sitemap.xml');
  fs.writeFileSync(outPath, generateSitemap(), 'utf-8');
  console.log(`[SEO] Sitemap generated: ${outPath}`);
}
