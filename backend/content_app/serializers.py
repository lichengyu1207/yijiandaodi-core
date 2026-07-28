from rest_framework import serializers
from .models import Article, Category, Banner


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    cover_image_url = serializers.ImageField(source='cover_image', read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'content', 'summary',
            'status', 'category', 'category_name',
            'cover_image', 'cover_image_url', 'gallery_images',
            'author', 'author_name',
            'xinfa_tag', 'is_pinned', 'zone_id',
            'hook_line', 'real_case_title', 'cta_text', 'cta_link',
            'created_at', 'updated_at', 'published_at',
            'read_count', 'like_count', 'comment_count', 'is_recommended',
        ]
        read_only_fields = ['id', 'author', 'author_name', 'category_name',
                           'created_at', 'updated_at', 'published_at',
                           'read_count', 'like_count', 'comment_count']


class ArticleListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    cover_image_url = serializers.ImageField(source='cover_image', read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'summary', 'status',
            'category', 'category_name',
            'cover_image', 'cover_image_url', 'gallery_images',
            'author_name',
            'xinfa_tag', 'is_pinned', 'zone_id',
            'created_at', 'updated_at', 'read_count', 'is_recommended',
        ]


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = '__all__'


class BannerListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ['id', 'title', 'subtitle', 'description', 'image_url', 'link_url',
                  'link_type', 'bg_color', 'category_tag', 'sort_order', 'status',
                  'click_count', 'created_at', 'updated_at']
