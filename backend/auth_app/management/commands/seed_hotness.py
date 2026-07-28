from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random

from auth_app.payment_models import SkillHotnessSnapshot
from auth_app.skill_config_models import SkillConfig


class Command(BaseCommand):
    help = '初始化技能热度快照数据(Top9+随机热度)'

    def handle(self, *args, **options):
        hour_key = timezone.now().strftime('%Y%m%d%H')

        online_skills = SkillConfig.objects.filter(status='online').order_by('-weight', '-usage_count', 'id')
        total = online_skills.count()

        if total == 0:
            self.stdout.write(self.style.WARNING('没有在线技能'))
            return

        created_count = 0
        for idx, skill in enumerate(online_skills):
            base_clicks = max(1, (total - idx) * random.randint(3, 12))
            base_selects = max(0, base_clicks // 2)
            base_executes = max(0, base_selects // 3)
            base_shares = max(0, random.randint(0, base_executes))

            if skill.is_hot:
                base_clicks += random.randint(50, 200)
                base_executes += random.randint(20, 80)
            if skill.is_new:
                base_clicks += random.randint(10, 60)
                base_shares += random.randint(5, 20)
            if skill.is_recommended:
                base_clicks += random.randint(20, 80)

            usage_bonus = min((skill.usage_count or 0) * random.uniform(0.5, 2), 100)
            weight_bonus = skill.weight * random.uniform(1, 3)

            raw_hotness = (
                base_clicks * 1.0 +
                base_selects * 2.0 +
                base_executes * 3.0 +
                base_shares * 5.0 +
                usage_bonus +
                weight_bonus +
                random.uniform(-0.5, 1)
            )

            obj, created = SkillHotnessSnapshot.objects.update_or_create(
                skill=skill,
                hour_key=hour_key,
                defaults={
                    'click_count': base_clicks,
                    'select_count': base_selects,
                    'execute_count': base_executes,
                    'share_count': base_shares,
                    'raw_hotness': round(raw_hotness, 2),
                }
            )
            if created:
                created_count += 1

        from auth_app.payment_views import HotnessEngine
        result = HotnessEngine.normalize_and_rank(hour_key)

        top_9 = [r['skill_name'] for r in result[:9]]

        self.stdout.write(
            self.style.SUCCESS(
                f'热度初始化完成! 总计: {total} 个技能 | 新增: {created_count} | '
                f'小时: {hour_key} | Top9: {", ".join(top_9)}'
            )
        )
