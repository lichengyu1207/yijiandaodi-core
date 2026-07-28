# Generated for gallery_images field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content_app', '0024_article_favorite_count'),
    ]

    operations = [
        migrations.AddField(
            model_name='article',
            name='gallery_images',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='信息流三图模式，最多3张图片URL列表，如 ["url1", "url2", "url3"]',
                verbose_name='多图列表'
            ),
        ),
    ]
