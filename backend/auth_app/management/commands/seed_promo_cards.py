from django.core.management.base import BaseCommand
from auth_app.promo_card_models import PromoCard


class Command(BaseCommand):
    help = '初始化会员推广卡片数据'

    PROMO_DATA = [
        {
            'title': '解锁全部 200+ AI 技能',
            'subtitle': '基础会员专享',
            'description': '开通基础会员，解锁全部 200+ 项 AI 鉴别技能，无限次使用核心功能',
            'card_type': 'vip_basic',
            'position': 'feed_middle',
            'icon_name': 'Crown',
            'icon_color': '#F5A623',
            'bg_color': '#FFF7E8',
            'border_color': '#FFD666',
            'accent_color': '#F5A623',
            'button_text': '立即开通',
            'price_text': '\u00a59.9/\u6708',
            'priority': 20,
        },
        {
            'title': '企业级内容安全审计',
            'subtitle': '高级会员专属',
            'description': '批量检测 API 接口、自定义规则引擎、团队协作权限管理',
            'card_type': 'vip_premium',
            'position': 'skill_panel_footer',
            'icon_name': 'Building2',
            'icon_color': '#722ED1',
            'bg_color': '#F0F5FF',
            'border_color': '#86909C',
            'accent_color': '#722ED1',
            'button_text': '了解详情',
            'price_text': '\u00a599/\u6708',
            'priority': 15,
        },
        {
            'title': '新功能上线: 多Agent协作引擎',
            'subtitle': '200号技能已就绪',
            'description': '多模型协同、任务分发、结果聚合 — 自我演化的 Agent 系统',
            'card_type': 'feature_launch',
            'position': 'feed_top',
            'icon_name': 'Users',
            'icon_color': '#7C3AED',
            'bg_color': '#F5F3FF',
            'border_color': '#C4B5FD',
            'accent_color': '#7C3AED',
            'button_text': '立即体验',
            'price_text': '\u514d\u8d39\u4f53\u9a8c',
            'priority': 25,
        },
        {
            'title': '限时优惠: 年度会员 6 折',
            'subtitle': '仅剩 48 小时',
            'description': '年度会员原价 \u00a5599\uff0c\u73b0\u5728\u53ea\u9700 \u00a5359\uff0c\u8282\u7701 240 元',
            'card_type': 'limited_offer',
            'position': 'feed_bottom',
            'icon_name': 'Gift',
            'icon_color': '#F53F3F',
            'bg_color': '#FFF1F0',
            'border_color': '#FFCCC7',
            'accent_color': '#F53F3F',
            'button_text': '立即抢购',
            'price_text': '\u00a5359/\u5e74',
            'priority': 30,
        },
        {
            'title': '邀请好友得 30 天会员',
            'subtitle': '无上限奖励',
            'description': '每邀请一位好友注册并使用，双方各获得 30 天 VIP 权益',
            'card_type': 'referral',
            'position': 'sidebar',
            'icon_name': 'Heart',
            'icon_color': '#EC4899',
            'bg_color': '#FFF0F7',
            'border_color': '#FFD6E7',
            'accent_color': '#EC4899',
            'button_text': '去邀请',
            'price_text': '\u514d\u8d39\u83b7\u53d6',
            'priority': 10,
        },
    ]

    def handle(self, *args, **options):
        created = 0
        for data in self.PROMO_DATA:
            obj, created_flag = PromoCard.objects.update_or_create(
                title=data['title'],
                defaults=data,
            )
            if created_flag:
                created += 1

        total = PromoCard.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f'推广卡片初始化完成! 总计 {total} 张 | 新增 {created} 张'
            )
        )
