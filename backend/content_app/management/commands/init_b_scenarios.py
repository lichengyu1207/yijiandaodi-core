from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from auth_app.mall_models import Product
import os

User = get_user_model()


class Command(BaseCommand):
    help = '初始化4个B级垂直场景产品数据'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        products_data = [
            {
                'title': 'AI 医疗报告鉴别服务',
                'description': '支持医疗报告上传、检测 AI 生成内容、识别医疗错误、生成专业鉴别报告。覆盖检验报告、影像报告、病理报告、出院小结、处方单等全类型医疗文书。基于20年资深医疗专家知识库 + DeepSeek V4大模型，提供结构化专业报告。',
                'category': 'tool',
                'price': 5000,
                'original_price': 8000,
                'cover_image': 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20medical%20report%20analysis%20dashboard%20with%20red%20cross%20icon%20stethoscope%20clean%20modern%20UI%20dark%20blue%20background&image_size=landscape_16_9',
                'tags': ['B级场景', '医疗', 'AI鉴别', '企业服务', '高客单价'],
                'is_hot': True,
                'is_recommend': True,
                'status': 'on_sale',
                'sort_order': 10,
                'slug_tag': 'b_medical',
            },
            {
                'title': 'AI 法律文书鉴别服务',
                'description': '支持法律文书上传、检测 AI 生成内容、识别法律风险、生成合规审查报告。覆盖合同协议、诉讼文书、知识产权文件、公司治理文件等。对照《民法典》《公司法》《劳动合同法》等核心法规进行合规性扫描。客单价≥5000元。',
                'category': 'tool',
                'price': 5000,
                'original_price': 10000,
                'cover_image': 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=legal%20document%20verification%20gavel%20scales%20of%20justice%20professional%20law%20firm%20dashboard%20blue%20gold%20elegant&image_size=landscape_16_9',
                'tags': ['B级场景', '法律', 'AI鉴别', '合规审查', '企业服务'],
                'is_hot': True,
                'is_recommend': True,
                'status': 'on_sale',
                'sort_order': 11,
                'slug_tag': 'b_legal',
            },
            {
                'title': 'AI 财务报表鉴别服务',
                'description': '支持财务报表上传、检测 AI 生成内容、识别财务造假、生成专业审计报告。覆盖资产负债表、利润表、现金流量表等。基于Beneish M-Score、Altman Z-Score等经典模型思路，结合AI深度分析，标记异常项目与造假指标。目标企业客户≥5家。',
                'category': 'tool',
                'price': 8000,
                'original_price': 15000,
                'cover_image': 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=financial%20statement%20audit%20dashboard%20bar%20charts%20calculator%20spreadsheet%20green%20candlestick%20professional%20fintech&image_size=landscape_16_9',
                'tags': ['B级场景', '财务', 'AI鉴别', '审计', '造假检测', '企业服务'],
                'is_hot': True,
                'is_recommend': True,
                'status': 'on_sale',
                'sort_order': 12,
                'slug_tag': 'b_financial',
            },
            {
                'title': 'AI 设计稿鉴别服务',
                'description': '支持设计稿上传、检测 AI 生成内容、识别抄袭、生成原创度分析报告。覆盖UI设计稿、Logo设计、平面设计、插画作品、3D模型等。检测AI典型伪影(手指错误/文字乱码)、构图规律性、色彩分布统计特征。日使用量≥200的目标。',
                'category': 'tool',
                'price': 500,
                'original_price': 1000,
                'cover_image': 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=colorful%20design%20portfolio%20review%20palette%20brush%20creative%20art%20tools%20purple%20gradient%20modern%20aesthetic&image_size=landscape_16_9',
                'tags': ['B级场景', '设计', 'AI鉴别', '原创度', '抄袭检测', '设计师工具'],
                'is_hot': False,
                'is_recommend': True,
                'status': 'on_sale',
                'sort_order': 13,
                'slug_tag': 'b_design',
            },
        ]

        admin_user = User.objects.filter(is_staff=True).first()

        for pdata in products_data:
            slug_tag = pdata.pop('slug_tag')
            product, is_created = Product.objects.update_or_create(
                title=pdata['title'],
                defaults=pdata
            )
            if is_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'  [CREATE] {product.title} - CNY {product.price}'))
            else:
                updated += 1
                self.stdout.write(self.style.WARNING(f'  [UPDATE] {product.title} - CNY {product.price}'))

        total = created + updated
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'[OK] B级场景产品初始化完成！新增 {created} 个，更新 {updated} 个，共 {total} 个产品'))
        self.stdout.write(self.style.NOTICE('  产品已就绪，可通过 /api/b-scenario/{medical|legal|financial|design}/detect/ 调用鉴别API'))
        self.stdout.write(self.style.NOTICE('  前端访问路径: /b-scenarios'))
