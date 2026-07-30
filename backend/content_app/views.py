from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q, F
from django.utils import timezone
import uuid
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

from .models import Article, Category, Tag, FrontAuthor, ArticleLike, ArticleComment, UserFollow, Banner, ArticleFavorite
from .serializers import ArticleSerializer, ArticleListSerializer, CategorySerializer, BannerSerializer, BannerListSerializer
from .front_serializers import (
    ArticleListSerializer as FrontArticleListSerializer,
    ArticleDetailSerializer,
    CategorySerializer as FrontCategorySerializer,
    TagSerializer,
    AuthorSerializer,
    ArticleCommentSerializer,
    ArticleCommentCreateSerializer,
    UserFollowSerializer,
)


class ImageUploadView(APIView):
    permission_classes = [IsAuthenticated]

    # 文件魔数
    FILE_MAGIC = {
        b'\xff\xd8\xff': 'image/jpeg',
        b'\x89PNG\r\n\x1a\n': 'image/png',
        b'GIF87a': 'image/gif',
        b'GIF89a': 'image/gif',
        b'RIFF': 'image/webp',
    }

    # 文件名敏感词黑名单
    IMAGE_BANNED_KEYWORDS = [
        'exploit', 'shell', 'webshell', 'php', 'asp', 'aspx', 'jsp',
        'cmd', 'eval', 'base64', '恶意', '木马', '后门', '注入',
        '.php', '.asp', '.aspx', '.jsp', '.exe', '.bat', '.sh',
    ]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'success': False, 'message': '未选择文件'}, status=status.HTTP_400_BAD_REQUEST)

        # ── 0. 上传频率限制 ──
        user_id = getattr(request.user, 'id', 'anonymous')
        ip_addr = self._get_client_ip(request)
        rate_key = f'img_upload_rate_{user_id}_{ip_addr}'
        recent_count = cache.get(rate_key, 0)
        if recent_count >= 5:
            return Response({
                'success': False,
                'message': '上传过于频繁，同一用户每分钟最多上传5张图片',
                'retry_after': 60,
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        cache.set(rate_key, recent_count + 1, 60)

        # ── 1. Content-Type 白名单 ──
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            return Response({'success': False, 'message': '仅支持 JPG/PNG/GIF/WebP 格式'}, status=status.HTTP_400_BAD_REQUEST)

        # ── 2. 文件大小限制 ──
        if file.size > 5 * 1024 * 1024:
            return Response({'success': False, 'message': '图片大小不能超过 5MB'}, status=status.HTTP_400_BAD_REQUEST)

        # ── 3. 文件名敏感词检测 ──
        original_name = file.name.lower()
        for kw in self.IMAGE_BANNED_KEYWORDS:
            if kw.lower() in original_name:
                return Response({
                    'success': False,
                    'message': f'文件名包含不允许的关键词: {kw}',
                    'security_check': 'filename_blocked',
                }, status=status.HTTP_400_BAD_REQUEST)

        # ── 4. 文件魔数验证（验证真实格式） ──
        try:
            file_header = file.read(12)
            file.seek(0)  # 重置指针以便后续保存

            detected_type = None
            for magic, mime_type in self.FILE_MAGIC.items():
                if file_header.startswith(magic):
                    detected_type = mime_type
                    break

            if not detected_type:
                return Response({
                    'success': False,
                    'message': '无法识别的文件格式，可能已被篡改或损坏',
                    'security_check': 'magic_number_failed',
                }, status=status.HTTP_400_BAD_REQUEST)

            if detected_type != file.content_type:
                return Response({
                    'success': False,
                    'message': f'声明的格式({file.content_type})与实际格式({detected_type})不符',
                    'security_check': 'type_mismatch',
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Image magic number check error: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': '文件格式验证失败，可能存在安全风险，上传已阻断',
                'security_check': 'magic_number_error',
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── 5. 安全保存（UUID重命名） ──
        ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else 'jpg'
        safe_name = f"{uuid.uuid4().hex}.{ext}"

        article = Article()
        article.cover_image.save(safe_name, file)
        url = article.cover_image.url
        article.delete()

        return Response({
            'success': True,
            'data': {
                'url': f'/media{url}',
                'alt': safe_name,
                'security_checks': {
                    'content_type': True,
                    'size_limit': True,
                    'filename_scan': True,
                    'magic_number': True,
                    'rate_limit': True,
                }
            }
        })

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')


class CategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': '分类创建成功',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def put(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': '分类更新成功',
            'data': serializer.data
        })

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': '分类删除成功'
        })


class ArticleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ArticleSerializer
        return ArticleListSerializer

    def get_queryset(self):
        queryset = Article.objects.all().select_related('category', 'author').prefetch_related('tags').defer('content')
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        keyword = self.request.query_params.get('keyword')
        if keyword:
            queryset = queryset.filter(Q(title__icontains=keyword) | Q(summary__icontains=keyword))
        
        xinfa_tag = self.request.query_params.get('xinfa_tag')
        if xinfa_tag:
            queryset = queryset.filter(xinfa_tag=xinfa_tag)
        
        zone_id = self.request.query_params.get('zone_id')
        if zone_id:
            queryset = queryset.filter(zone_id=zone_id)
        
        is_pinned = self.request.query_params.get('is_pinned')
        if is_pinned in ('true', '1'):
            queryset = queryset.filter(is_pinned=True)
        
        author_id = self.request.query_params.get('author_id')
        if author_id:
            try:
                queryset = queryset.filter(author_id=int(author_id))
            except (ValueError, TypeError):
                pass
        
        start_date = self.request.query_params.get('start_date')
        if start_date:
            try:
                from datetime import datetime as dt
                sd = dt.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(created_at__gte=sd)
            except ValueError:
                pass
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            try:
                from datetime import datetime as dt, timedelta
                ed = dt.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                queryset = queryset.filter(created_at__lt=ed)
            except ValueError:
                pass
        
        ordering = self.request.query_params.get('ordering', '-updated_at')
        allowed_orderings = [
            'id', '-id',
            'title', '-title',
            'created_at', '-created_at',
            'updated_at', '-updated_at',
            'published_at', '-published_at',
            'read_count', '-read_count',
            'like_count', '-like_count',
            'is_pinned', '-is_pinned',
            'sort_order', '-sort_order',
        ]
        if ordering in allowed_orderings:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-updated_at')
        
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': '文章创建成功',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='batch-publish')
    def batch_publish(self, request):
        """批量发布"""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要操作的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count = Article.objects.filter(id__in=ids).update(
            status='published',
            published_at=timezone.now()
        )
        return Response({'success': True, 'message': f'成功发布 {count} 篇文章', 'count': count})

    @action(detail=False, methods=['post'], url_path='batch-unpublish')
    def batch_unpublish(self, request):
        """批量下架"""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要操作的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count = Article.objects.filter(id__in=ids).update(status='archived')
        return Response({'success': True, 'message': f'成功下架 {count} 篇文章', 'count': count})

    @action(detail=False, methods=['post'], url_path='batch-delete')
    def batch_delete(self, request):
        """批量删除"""
        if not request.user.is_staff:
            return Response({'success': False, 'message': '需要管理员权限'}, status=status.HTTP_403_FORBIDDEN)
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要删除的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count, _ = Article.objects.filter(id__in=ids).delete()
        return Response({'success': True, 'message': f'成功删除 {count} 篇文章', 'count': count})


class ArticleBatchPublishView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要操作的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count = Article.objects.filter(id__in=ids).update(status='published', published_at=timezone.now())
        return Response({'success': True, 'message': f'成功发布 {count} 篇文章', 'count': count})

class ArticleBatchUnpublishView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要操作的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count = Article.objects.filter(id__in=ids).update(status='archived')
        return Response({'success': True, 'message': f'成功下架 {count} 篇文章', 'count': count})

class ArticleBatchDeleteView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'success': False, 'message': '请选择要删除的文章'}, status=status.HTTP_400_BAD_REQUEST)
        count, _ = Article.objects.filter(id__in=ids).delete()
        return Response({'success': True, 'message': f'成功删除 {count} 篇文章', 'count': count})


class ArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer

    def put(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': '文章更新成功',
            'data': serializer.data
        })

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': '文章删除成功'
        })


class AuthorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        authors = FrontAuthor.objects.all().values('id', 'name', 'avatar', 'bio')[:100]
        return Response({
            'success': True,
            'data': list(authors),
            'total': FrontAuthor.objects.count(),
        })


class PublicCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Category.objects.filter(is_active=True)
    serializer_class = FrontCategorySerializer
    lookup_field = 'slug'


class PublicTagViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Tag.objects.all()
    serializer_class = TagSerializer


class PublicAuthorViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = FrontAuthor.objects.all()
    serializer_class = AuthorSerializer


class ArticlePublicViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Article.objects.filter(status='published')
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ArticleDetailSerializer
        return FrontArticleListSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        category = self.request.query_params.get('category')
        if category:
            if category.isdigit():
                qs = qs.filter(category_id=int(category))
            else:
                qs = qs.filter(category__slug=category)

        xinfa_tag = self.request.query_params.get('xinfa_tag')
        if xinfa_tag:
            qs = qs.filter(xinfa_tag=xinfa_tag)

        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__slug=tag)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(summary__icontains=search))

        sort = self.request.query_params.get('sort', '-published_at')
        allowed_sorts = {
            'publish_time': 'published_at',
            '-publish_time': '-published_at',
            'read_count': 'read_count',
            '-read_count': '-read_count',
            'like_count': 'like_count',
            '-like_count': '-like_count',
        }
        if sort in allowed_sorts:
            qs = qs.order_by(allowed_sorts[sort])

        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Article.objects.filter(pk=instance.pk).update(read_count=F('read_count') + 1)
        instance.read_count = (instance.read_count or 0) + 1
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def hot(self, request):
        period = request.query_params.get('period', 'week')
        qs = self.get_queryset().order_by('-read_count')[:10]
        serializer = self.get_serializer(qs, many=True)
        return Response({
            'period': period,
            'results': serializer.data
        })

    @action(detail=True, methods=['post'])
    def like(self, request, id=None):
        article = self.get_object()

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
            Article.objects.filter(pk=article.pk).update(like_count=F('like_count') + 1)
            article.like_count = (article.like_count or 0) + 1
            return Response({
                'liked': True,
                'like_count': article.like_count,
                'message': '点赞成功'
            })
        else:
            like_obj.delete()
            Article.objects.filter(pk=article.pk).update(like_count=F('like_count') - 1)
            article.like_count = max(0, (article.like_count or 0) - 1)
            return Response({
                'liked': False,
                'like_count': article.like_count,
                'message': '已取消点赞'
            })

    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        """切换收藏状态：已收藏则取消，未收藏则添加"""
        article = self.get_object()

        if not request.user.is_authenticated:
            return Response({'success': False, 'message': '请先登录后再收藏'},
                           status=status.HTTP_401_UNAUTHORIZED)

        user_id = request.user.id
        ip_address = self._get_client_ip(request)

        fav_obj, created = ArticleFavorite.objects.get_or_create(
            article=article,
            user_id=user_id,
            defaults={'ip_address': ip_address}
        )

        if created:
            article.favorite_count = (article.favorite_count or 0) + 1
            article.save(update_fields=['favorite_count'])
            return Response({
                'success': True,
                'favorited': True,
                'favorite_count': article.favorite_count,
                'message': '收藏成功'
            })
        else:
            fav_obj.delete()
            Article.objects.filter(pk=article.pk).update(
                favorite_count=F('favorite_count') - 1
            )
            article.refresh_from_db(fields=['favorite_count'])
            return Response({
                'success': True,
                'favorited': False,
                'favorite_count': max(0, article.favorite_count or 0),
                'message': '已取消收藏'
            })

    @action(detail=True, methods=['get'])
    def favorite_status(self, request, pk=None):
        """查询当前用户是否已收藏该文章"""
        article = self.get_object()

        if not request.user.is_authenticated:
            return Response({
                'favorited': False,
                'favorite_count': article.favorite_count or 0
            })

        is_favorited = ArticleFavorite.objects.filter(
            article=article,
            user_id=request.user.id
        ).exists()

        return Response({
            'favorited': is_favorited,
            'favorite_count': article.favorite_count or 0
        })

    @action(detail=True, methods=['get'])
    def comments(self, request, id=None):
        article = self.get_object()
        comments = article.comments.filter(
            is_approved=True,
            parent_comment__isnull=True
        )[:20]

        serializer = ArticleCommentSerializer(comments, many=True)
        return Response({
            'count': comments.count(),
            'results': serializer.data
        })

    @action(detail=True, methods=['post'])
    def add_comment(self, request, id=None):
        article = self.get_object()
        serializer = ArticleCommentCreateSerializer(data=request.data)

        if serializer.is_valid():
            user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else 0
            username = getattr(request.user, 'username', None) if request.user.is_authenticated else '访客用户'

            comment = serializer.save(
                user_id=user_id or 0,
                username=username or '访客用户',
                avatar='',
                ip_address=self._get_client_ip(request),
            )

            article.comment_count += 1
            article.save(update_fields=['comment_count'])

            return Response({
                'success': True,
                'comment': ArticleCommentSerializer(comment).data,
                'message': '评论发表成功'
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def follow(self, request, id=None):
        article = self.get_object()
        if not article.author:
            return Response({
                'success': False,
                'message': '该文章没有作者信息'
            }, status=status.HTTP_400_BAD_REQUEST)

        user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else request.data.get('user_id', 0)
        if not user_id:
            user_id = 0

        follow_obj, created = UserFollow.objects.get_or_create(
            user_id=user_id,
            author=article.author,
        )

        if created:
            follower_count = UserFollow.objects.filter(author=article.author).count()
            return Response({
                'success': True,
                'followed': True,
                'follower_count': follower_count,
                'message': f'已关注 {article.author.name}'
            })
        else:
            follow_obj.delete()
            follower_count = UserFollow.objects.filter(author=article.author).count()
            return Response({
                'success': True,
                'followed': False,
                'follower_count': follower_count,
                'message': f'已取消关注 {article.author.name}'
            })

    @action(detail=True, methods=['get'])
    def like_status(self, request, id=None):
        article = self.get_object()
        user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else request.query_params.get('user_id')
        ip_addr = self._get_client_ip(request)

        is_liked = False
        if user_id or ip_addr:
            query = Q(article=article)
            if user_id:
                query &= Q(user_id=user_id)
            if ip_addr:
                query &= Q(ip_address=ip_addr)
            is_liked = ArticleLike.objects.filter(query).exists()

        return Response({
            'is_liked': is_liked,
            'like_count': article.like_count or 0
        })

    @action(detail=True, methods=['get'])
    def follow_status(self, request, id=None):
        article = self.get_object()
        if not article.author:
            return Response({
                'is_followed': False,
                'follower_count': 0
            })

        user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else request.query_params.get('user_id')
        is_followed = False
        if user_id and article.author:
            is_followed = UserFollow.objects.filter(user_id=user_id, author=article.author).exists()

        follower_count = UserFollow.objects.filter(author=article.author).count()
        return Response({
            'is_followed': is_followed,
            'follower_count': follower_count
        })

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '')
        return ip


class BannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.all().order_by('-sort_order', '-id')
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return BannerListSerializer
        return BannerSerializer

    def get_permissions(self):
        if self.action in ['list', 'public_list']:
            return []
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='public-list')
    def public_list(self, request):
        items = self.get_queryset().filter(status='active')[:5]
        serializer = self.get_serializer(items, many=True)
        return Response({'success': True, 'data': serializer.data})
