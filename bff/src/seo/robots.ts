const ROBOTS_CONTENT = `# 一鉴到底 robots.txt
# https://yijiandaodi.com

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /cart/
Disallow: /orders/
Disallow: /user-center/

# 爬虫延迟（友好爬取）
Crawl-delay: 1

# Sitemap位置
Sitemap: https://yijiandaodi.com/sitemap.xml

# 百度专用
User-agent: Baiduspider
Allow: /
Crawl-delay: 1

# 谷歌专用
User-agent: Googlebot
Allow: /
Crawl-delay: 1

# 必应专用
User-agent: Bingbot
Allow: /
Crawl-delay: 1

# 360搜索专用
User-agent: 360Spider
Allow: /
Crawl-delay: 2
`;

export function serveRobots(_req: any, res: any): void {
  res.set('Content-Type', 'text/plain');
  res.send(ROBOTS_CONTENT);
}
