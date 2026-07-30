from django.urls import path
from .front_views import (
    CategoryListView,
    TagListView,
    ArticleListView,
    HotArticlesView,
    ArticleDetailView,
    ArticleLikeView,
    ArticleLikeStatusView,
    ArticleFollowStatusView,
    ArticleFavoriteView,
    ArticleFollowView,
    ArticleCommentView,
    BannerPublicListView,
)

app_name = 'front'

urlpatterns = [
    # 分类列表
    path('categories/', CategoryListView.as_view(), name='categories'),

    # 标签列表
    path('tags/', TagListView.as_view(), name='tags'),

    # 文章列表（分页、排序）
    path('articles/', ArticleListView.as_view(), name='articles'),

    # 热门文章
    path('articles/hot/', HotArticlesView.as_view(), name='articles-hot'),

    # 文章详情
    path('articles/<int:pk>/', ArticleDetailView.as_view(), name='article-detail'),

    # 文章点赞
    path('articles/<int:pk>/like/', ArticleLikeView.as_view(), name='article-like'),

    # 点赞状态查询
    path('articles/<int:pk>/like_status/', ArticleLikeStatusView.as_view(), name='article-like-status'),

    # 关注状态查询
    path('articles/<int:pk>/follow_status/', ArticleFollowStatusView.as_view(), name='article-follow-status'),

    # 文章收藏
    path('articles/<int:pk>/favorite/', ArticleFavoriteView.as_view(), name='article-favorite'),

    # 关注作者
    path('articles/<int:pk>/follow/', ArticleFollowView.as_view(), name='article-follow'),

    # 文章评论（GET列表 + POST创建）
    path('articles/<int:pk>/comments/', ArticleCommentView.as_view(), name='article-comments'),

    # 公开轮播图
    path('banners/public/', BannerPublicListView.as_view(), name='banners-public'),
]
