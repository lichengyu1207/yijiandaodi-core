# ============================================================
# 一鉴到底 - 站点地图（Sitemap）
# 访问: https://yijiandaodi.com/sitemap.xml
# ============================================================

from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from content_app.models import Article


class StaticViewSitemap(Sitemap):
    """静态页面站点地图"""
    priority = 1.0
    changefreq = 'daily'

    def items(self):
        return ['home', 'pricing', 'about', 'skills']

    def location(self, item):
        # 首页用 /，其他页面用 /slug/
        if item == 'home':
            return '/'
        return f'/{item}/'

    def lastmod(self, item):
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)


class ArticleSitemap(Sitemap):
    """文章内容站点地图"""
    changefreq = 'weekly'
    priority = 0.8

    def items(self):
        # 只收录已发布的文章
        return Article.objects.filter(status='published').order_by('-updated_at')

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        # 文章详情页路径
        return f'/article/{obj.id}/'


class CategorySitemap(Sitemap):
    """分类页面站点地图"""
    changefreq = 'weekly'
    priority = 0.7

    def items(self):
        from content_app.models import Category
        return Category.objects.all()

    def location(self, obj):
        return f'/category/{obj.slug}/'

    def lastmod(self, obj):
        # 取该分类下最新文章的更新时间
        latest = obj.articles.filter(status='published').order_by('-updated_at').first()
        return latest.updated_at if latest else None


# 站点地图注册表
sitemaps = {
    'static': StaticViewSitemap,
    'articles': ArticleSitemap,
    'categories': CategorySitemap,
}
