from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import timedelta

from .models import Article, Category, Tag, FrontAuthor, ArticleLike, ArticleComment, UserFollow, ArticleFavorite, Banner
from .front_serializers import (
    CategorySerializer,
    TagSerializer,
    AuthorSerializer,
    ArticleListSerializer,
    ArticleDetailSerializer,
    ArticleLikeSerializer,
    ArticleCommentCreateSerializer,
    ArticleCommentSerializer,
    UserFollowSerializer,
)


class FrontendAnonRateThrottle(AnonRateThrottle):
    """前台API专用匿名用户限流 - 放宽到每分钟60次"""
    rate = '60/min'


class FrontendUserRateThrottle(UserRateThrottle):
    """前台API专用已登录用户限流 - 放宽到每分钟120次"""
    rate = '120/min'


class StandardResultsSetPagination(PageNumberPagination):
    """标准分页器"""
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100


class CategoryListView(generics.ListAPIView):
    """前台分类列表 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    queryset = Category.objects.filter(is_active=True).order_by('sort_order', 'id')
    serializer_class = CategorySerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


class TagListView(generics.ListAPIView):
    """前台标签列表 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    queryset = Tag.objects.all().order_by('name')
    serializer_class = TagSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


class ArticleListView(generics.ListAPIView):
    """前台文章列表 API（分页、排序、筛选）"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    serializer_class = ArticleListSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = Article.objects.filter(
            status='published'
        ).select_related(
            'category', 'author'
        ).prefetch_related(
            'tags'
        ).defer('content')

        category = self.request.query_params.get('category')
        if category:
            if category.isdigit():
                queryset = queryset.filter(category_id=int(category))
            else:
                queryset = queryset.filter(category__slug=category)

        xinfa_tag = self.request.query_params.get('xinfa_tag')
        if xinfa_tag:
            queryset = queryset.filter(xinfa_tag=xinfa_tag)

        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__slug=tag)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(summary__icontains=search)
            )

        sort = self.request.query_params.get('sort', '-publish_time')
        allowed_sorts = {
            'publish_time': 'published_at',
            '-publish_time': '-published_at',
            'read_count': 'read_count',
            '-read_count': '-read_count',
            'like_count': 'like_count',
            '-like_count': '-like_count',
            'created_at': 'created_at',
            '-created_at': '-created_at',
        }
        if sort in allowed_sorts:
            queryset = queryset.order_by(allowed_sorts[sort])
        else:
            queryset = queryset.order_by('-published_at', '-id')

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'count': len(serializer.data)
        })


class HotArticlesView(generics.ListAPIView):
    """热门文章 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    serializer_class = ArticleListSerializer
    pagination_class = None

    def get_queryset(self):
        period = self.request.query_params.get('period', 'week')
        now = timezone.now()

        if period == 'day':
            since = now - timedelta(days=1)
        elif period == 'week':
            since = now - timedelta(weeks=1)
        elif period == 'month':
            since = now - timedelta(days=30)
        else:
            since = now - timedelta(weeks=1)

        return Article.objects.filter(
            status='published',
            published_at__gte=since
        ).select_related(
            'category', 'author'
        ).prefetch_related(
            'tags'
        ).defer(
            'content'
        ).order_by('-read_count')[:10]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'period': request.query_params.get('period', 'week'),
            'data': serializer.data
        })


class ArticleDetailView(generics.RetrieveAPIView):
    """文章详情 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    queryset = Article.objects.filter(status='published').select_related(
        'category', 'author'
    ).prefetch_related('tags')
    serializer_class = ArticleDetailSerializer
    lookup_field = 'pk'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.read_count = (instance.read_count or 0) + 1
        instance.save(update_fields=['read_count'])
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })


class ArticleLikeView(generics.CreateAPIView):
    """文章点赞 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]
    serializer_class = ArticleLikeSerializer

    def post(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            article = Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({
                'success': False,
                'message': '文章不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0
        if not user_id:
            user_id = 0

        ip_addr = self._get_client_ip(request)

        like_obj, created = ArticleLike.objects.get_or_create(
            article=article,
            user_id=user_id,
            ip_address=ip_addr,
        )

        if created:
            article.like_count += 1
            article.save(update_fields=['like_count'])
            return Response({
                'success': True,
                'liked': True,
                'like_count': article.like_count,
                'message': '点赞成功'
            })
        else:
            like_obj.delete()
            article.like_count = max(0, article.like_count - 1)
            article.save(update_fields=['like_count'])
            return Response({
                'success': True,
                'liked': False,
                'like_count': article.like_count,
                'message': '已取消点赞'
            })

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '')
        return ip


class ArticleCommentView(generics.ListCreateAPIView):
    """文章评论 API (GET列表 + POST创建)"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ArticleCommentCreateSerializer
        return ArticleCommentSerializer

    def get_queryset(self):
        article_id = self.kwargs.get('pk')
        return ArticleComment.objects.filter(
            article_id=article_id,
            is_approved=True,
            parent_comment__isnull=True
        ).select_related('article').order_by('-created_at')

    def get(self, request, *args, **kwargs):
        try:
            Article.objects.get(id=self.kwargs['pk'], status='published')
        except Article.DoesNotExist:
            return Response({
                'success': False,
                'message': '文章不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        queryset = self.get_queryset()[:20]
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'count': len(serializer.data),
            'data': serializer.data
        })

    def post(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            article = Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({
                'success': False,
                'message': '文章不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0
            username = getattr(request.user, 'username', None) if request.user.is_authenticated else '访客用户'

            comment = serializer.save(
                article=article,
                user_id=user_id or 0,
                username=username or '访客用户',
                avatar='',
                ip_address=self._get_client_ip(request),
            )

            article.comment_count += 1
            article.save(update_fields=['comment_count'])

            return Response({
                'success': True,
                'data': ArticleCommentSerializer(comment).data,
                'message': '评论发表成功'
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '')
        return ip


class BannerPublicListView(generics.ListAPIView):
    """公开轮播图 API"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def get_queryset(self):
        return Banner.objects.filter(
            status='active'
        ).order_by('-sort_order', '-id')[:5]

    def get_serializer_class(self):
        from .serializers import BannerListSerializer
        return BannerListSerializer

    pagination_class = None

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


# ── 缺失接口补充 ──────────────────────────────────

class ArticleLikeStatusView(generics.RetrieveAPIView):
    """查询用户对文章的点赞状态"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def get(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({'success': False, 'message': '文章不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        user_id = request.query_params.get('user_id')
        if user_id is None:
            user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0

        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
             request.META.get('REMOTE_ADDR', '')

        liked = ArticleLike.objects.filter(
            article_id=article_id,
            user_id=user_id or 0,
            ip_address=ip,
        ).exists()

        return Response({
            'success': True,
            'data': {
                'liked': liked,
                'article_id': article_id,
                'like_count': ArticleLike.objects.filter(article_id=article_id).count(),
            }
        })


class ArticleFollowStatusView(generics.RetrieveAPIView):
    """查询用户对文章作者的关注状态"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def get(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            article = Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({'success': False, 'message': '文章不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        user_id = request.query_params.get('user_id')
        if user_id is None:
            user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0

        followed = UserFollow.objects.filter(
            user_id=user_id or 0,
            author_id=article.author_id,
        ).exists()

        return Response({
            'success': True,
            'data': {
                'followed': followed,
                'article_id': article_id,
                'author_id': article.author_id,
            }
        })


class ArticleFavoriteView(generics.CreateAPIView):
    """文章收藏（切换收藏/取消收藏）"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def post(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            article = Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({'success': False, 'message': '文章不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0
        ip_addr = (request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
                   or request.META.get('REMOTE_ADDR', ''))

        fav_obj, created = ArticleFavorite.objects.get_or_create(
            article=article,
            user_id=user_id or 0,
            ip_address=ip_addr,
        )

        if created:
            return Response({
                'success': True,
                'favorited': True,
                'message': '收藏成功'
            })
        else:
            fav_obj.delete()
            return Response({
                'success': True,
                'favorited': False,
                'message': '已取消收藏'
            })


class ArticleFollowView(generics.CreateAPIView):
    """关注文章作者（切换关注/取消关注）"""
    permission_classes = [AllowAny]
    throttle_classes = [FrontendAnonRateThrottle, FrontendUserRateThrottle]

    def post(self, request, *args, **kwargs):
        article_id = kwargs.get('pk')
        try:
            article = Article.objects.get(id=article_id, status='published')
        except Article.DoesNotExist:
            return Response({'success': False, 'message': '文章不存在'},
                            status=status.HTTP_404_NOT_FOUND)

        if not article.author_id:
            return Response({'success': False, 'message': '该文章没有关联作者'},
                            status=status.HTTP_400_BAD_REQUEST)

        user_id = int(request.data.get('user_id', 0)) or \
                  (getattr(request.user, 'id', None) if request.user.is_authenticated else 0)

        follow_obj, created = UserFollow.objects.get_or_create(
            user_id=user_id or 0,
            author_id=article.author_id,
        )

        if created:
            return Response({
                'success': True,
                'followed': True,
                'message': '关注成功'
            })
        else:
            follow_obj.delete()
            return Response({
                'success': True,
                'followed': False,
                'message': '已取消关注'
            })
