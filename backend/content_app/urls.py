from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ArticlePublicViewSet, PublicCategoryViewSet,
    PublicTagViewSet, PublicAuthorViewSet,
    ImageUploadView, CategoryListCreateView, CategoryDetailView,
    ArticleListCreateView, ArticleDetailView, BannerViewSet, AuthorListView,
    ArticleBatchPublishView, ArticleBatchUnpublishView, ArticleBatchDeleteView
)
from .front_views import (
    CategoryListView,
    TagListView,
    ArticleListView,
    HotArticlesView,
    ArticleDetailView as FrontArticleDetailView,
    ArticleLikeView,
    ArticleCommentView,
    BannerPublicListView,
)

app_name = 'content'

router = DefaultRouter()
router.register(r'categories', PublicCategoryViewSet, basename='front-category')
router.register(r'tags', PublicTagViewSet, basename='front-tag')
router.register(r'authors', PublicAuthorViewSet, basename='front-author')
router.register(r'articles', ArticlePublicViewSet, basename='front-article')

urlpatterns = [
    path('', include(router.urls)),
    path('upload-image/', ImageUploadView.as_view(), name='upload-image'),
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('articles/', ArticleListCreateView.as_view(), name='article-list'),
    path('articles/<int:pk>/', ArticleDetailView.as_view(), name='article-detail'),
    path('articles/batch-publish/', ArticleBatchPublishView.as_view(), name='article-batch-publish'),
    path('articles/batch-unpublish/', ArticleBatchUnpublishView.as_view(), name='article-batch-unpublish'),
    path('articles/batch-delete/', ArticleBatchDeleteView.as_view(), name='article-batch-delete'),
    path('articles/<int:pk>/like/', ArticleLikeView.as_view(), name='article-like'),
    path('articles/<int:pk>/comments/', ArticleCommentView.as_view(), name='article-comments'),
    path('authors-list/', AuthorListView.as_view(), name='author-list'),
    path('banners/', BannerViewSet.as_view({'get': 'list', 'post': 'create'}), name='banner-list'),
    path('banners/<int:pk>/', BannerViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='banner-detail'),
    path('banners/public/', BannerPublicListView.as_view(), name='banner-public'),
]
