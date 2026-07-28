from rest_framework import serializers
from django.db.models import Sum
from .models import Article, Category, Tag, FrontAuthor, ArticleLike, ArticleComment, UserFollow


class CategorySerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(source='articles.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'description', 'article_count']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrontAuthor
        fields = ['id', 'name', 'avatar', 'bio']


class ArticleListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    author_name = serializers.CharField(source='author.name', read_only=True)
    avatar = serializers.CharField(source='author.avatar', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    publish_time = serializers.DateTimeField(source='published_at', read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'summary', 'cover_image',
            'category', 'category_name', 'tags',
            'author_id', 'author_name', 'avatar',
            'publish_time', 'read_count', 'like_count', 'comment_count',
            'is_recommended', 'status',
        ]


class ArticleDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    author = AuthorSerializer(read_only=True)
    author_article_count = serializers.SerializerMethodField()
    author_total_reads = serializers.SerializerMethodField()
    is_followed = serializers.SerializerMethodField()
    follower_count = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'summary', 'content', 'cover_image',
            'category', 'tags', 'author',
            'published_at', 'read_count', 'like_count', 'comment_count',
            'is_recommended', 'status', 'created_at', 'updated_at',
            'author_article_count', 'author_total_reads',
            'is_followed', 'follower_count',
        ]

    def get_author_article_count(self, obj):
        return Article.objects.filter(author=obj.author, status='published').count()

    def get_author_total_reads(self, obj):
        return (Article.objects.filter(author=obj.author, status='published')
                .aggregate(total=Sum('read_count'))['total'] or 0)

    def get_is_followed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user_id = getattr(request.user, 'id', None) or request.data.get('user_id')
        if not user_id or not obj.author:
            return False
        return UserFollow.objects.filter(user_id=user_id, author=obj.author).exists()

    def get_follower_count(self, obj):
        if not obj.author:
            return 0
        return UserFollow.objects.filter(author=obj.author).count()


class ArticleLikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleLike
        fields = ['id', 'article', 'user_id', 'created_at']
        read_only_fields = ['id', 'created_at']


class ArticleCommentSerializer(serializers.ModelSerializer):
    replies_count = serializers.IntegerField(source='replies.count', read_only=True)

    class Meta:
        model = ArticleComment
        fields = [
            'id', 'article', 'user_id', 'username', 'avatar',
            'content', 'parent_comment', 'like_count',
            'replies_count', 'created_at', 'is_approved',
        ]
        read_only_fields = ['id', 'like_count', 'replies_count', 'created_at']


class ArticleCommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleComment
        fields = ['content', 'parent_comment']
        read_only_fields = ['article']


class UserFollowSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)

    class Meta:
        model = UserFollow
        fields = ['id', 'user_id', 'author', 'author_name', 'created_at']
        read_only_fields = ['id', 'created_at']
