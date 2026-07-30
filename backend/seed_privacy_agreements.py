import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from datetime import date
from auth_app.system_models import PrivacyAgreement

PRIVACY_CONTENT = """
<h3 style="color:#1E293B;font-size:16px;margin-bottom:12px;">一、我们收集哪些信息</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">为向您提供安全检测、内容审核等服务，我们会收集以下信息：</p>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li><strong>账户信息</strong>：用户名、邮箱地址（您自愿提供时）</li>
  <li><strong>使用数据</strong>：登录日志、操作记录、IP地址、设备信息</li>
  <li><strong>检测内容</strong>：您提交的待检测文本或文件（仅用于即时分析，不长期存储）</li>
  <li><strong>技术数据</strong>：Cookie、浏览器类型、屏幕分辨率</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">二、我们如何使用您的信息</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">收集的信息将用于以下目的：</p>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li>提供、维护和改进我们的AI安全检测服务</li>
  <li>验证您的身份并保障账户安全</li>
  <li>防止欺诈和滥用行为</li>
  <li>遵守法律法规要求</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">三、信息的存储与保护</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  我们采用行业标准的加密技术保护您的数据。所有敏感信息均经过加密存储，传输过程使用TLS 1.3加密。
  数据库访问受严格权限控制，定期进行安全审计。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">四、您的权利</h3>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li>有权查看、更正或删除您的个人信息</li>
  <li>有权撤回已给予的同意</li>
  <li>有权导出您的个人数据</li>
  <li>有权注销账户（请联系管理员）</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">五、第三方服务</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  我们可能使用以下第三方服务来辅助运营：
</p>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li><strong>云服务商</strong>：阿里云 / 腾讯云（数据托管）</li>
  <li><strong>AI模型服务</strong>：用于内容分析和安全检测</li>
  <li><strong>数据分析工具</strong>：用于服务质量监控</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">六、Cookie政策</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  我们使用Cookie来记住您的偏好设置、保持登录状态以及收集匿名使用统计数据。
  您可以通过浏览器设置管理或禁用Cookie。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">七、政策更新</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  本政策可能不时更新。重大变更将通过应用内通知或邮件方式告知您。继续使用本服务即表示您接受更新后的政策。
</p>

<p style="margin:20px 0 8px;line-height:1.8;color:#64748B;font-size:13px;">
  最后更新日期：2026年5月29日 &nbsp;|&nbsp; 生效日期：2026年5月29日
</p>
<p style="margin:0;line-height:1.8;color:#64748B;font-size:13px;">
  如有疑问，请通过系统内「意见反馈」功能联系我们。
</p>
"""

TERMS_CONTENT = """
<h3 style="color:#1E293B;font-size:16px;margin-bottom:12px;">一、服务说明</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  「一鉴到底」是一个AI驱动的安全内容检测平台，为您提供文本安全检测、内容审核、企业级API服务等产品。
  使用本服务即表示您同意遵守以下条款。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">二、账户注册与使用</h3>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li>您应提供真实、准确的注册信息</li>
  <li>妥善保管账户密码，对账户下所有活动负责</li>
  <li>不得将账户转让、出借给他人使用</li>
  <li>如发现账户被盗用，请立即联系我们</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">三、用户行为规范</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">在使用本服务时，您承诺不会：</p>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li>利用平台从事任何违法违规活动</li>
  <li>攻击、破坏平台系统或干扰正常运营</li>
  <li>逆向工程、反编译或试图获取平台源代码</li>
  <li>超出授权范围使用API接口</li>
  <li>传播病毒、恶意代码或其他有害程序</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">四、知识产权</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  平台的商标、Logo、界面设计、算法模型及相关知识产权归「一鉴到底」所有。
  您在使用过程中产生的数据，其所有权归属按照相关法律法规确定。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">五、服务变更与终止</h3>
<ul style="margin:8px 0;padding-left:20px;line-height:1.9;color:#475569;">
  <li>我们保留随时修改、暂停或终止服务的权利</li>
  <li>重大变更将提前30天通知</li>
  <li>您可随时申请注销账户</li>
  <li>违反条款的账户可能被立即终止</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">六、免责声明</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  平台提供的AI检测结果仅供参考，不构成法律意见。对于因依赖检测结果造成的任何损失，
  平台在法律法规允许的最大范围内不承担责任。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">七、争议解决</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  因本协议引起的争议，双方应友好协商解决；协商不成的，提交平台所在地人民法院诉讼解决。
</p>

<p style="margin:20px 0 8px;line-height:1.8;color:#64748B;font-size:13px;">
  最后更新日期：2026年5月29日 &nbsp;|&nbsp; 生效日期：2026年5月29日
</p>
"""

COOKIE_CONTENT = """
<h3 style="color:#1E293B;font-size:16px;margin-bottom:12px;">什么是 Cookie？</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  Cookie 是小型文本文件，由网站发送并存储在您的设备上。它们帮助我们记住您的偏好、
  保持登录状态，并了解您如何使用我们的服务。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">我们使用的 Cookie 类型</h3>
<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;color:#475569;">
  <tr style="background:#F1F5F9;">
    <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;">类型</th>
    <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;">用途</th>
    <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;">有效期</th>
  </tr>
  <tr>
    <td style="padding:8px;border:1px solid #E2E8F0;">必要 Cookie</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">保持登录状态、安全验证</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">会话期间</td>
  </tr>
  <tr>
    <td style="padding:8px;border:1px solid #E2E8F0;">功能 Cookie</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">记住语言偏好、界面设置</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">1 年</td>
  </tr>
  <tr>
    <td style="padding:8px;border:1px solid #E2E8F0;">分析 Cookie</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">了解用户如何使用平台</td>
    <td style="padding:8px;border:1px solid #E2E8F0;">6 个月</td>
  </tr>
</table>

<h3 style="color:#1E293B;font-size:16px;margin:18px 0 12px;">如何管理 Cookie</h3>
<p style="margin:8px 0;line-height:1.8;color:#475569;">
  您可以通过浏览器设置管理或删除 Cookie。请注意，禁用必要 Cookie 可能导致无法正常使用某些功能。
</p>

<p style="margin:20px 0 8px;line-height:1.8;color:#64748B;font-size:13px;">
  最后更新日期：2026年5月29日 &nbsp;|&nbsp; 生效日期：2026年5月29日
</p>
"""

def seed_privacy_agreements():
    agreements_data = [
        {
            'title': '隐私政策',
            'agreement_type': 'privacy',
            'content': PRIVACY_CONTENT,
            'version': '2.0',
            'is_active': True,
            'is_required': True,
            'effective_date': date(2026, 5, 29),
        },
        {
            'title': '用户服务条款',
            'agreement_type': 'terms',
            'content': TERMS_CONTENT,
            'version': '2.0',
            'is_active': True,
            'is_required': True,
            'effective_date': date(2026, 5, 29),
        },
        {
            'title': 'Cookie 政策',
            'agreement_type': 'cookie',
            'content': COOKIE_CONTENT,
            'version': '1.0',
            'is_active': True,
            'is_required': False,
            'effective_date': date(2026, 5, 29),
        },
    ]

    created = 0
    for data in agreements_data:
        obj, created_flag = PrivacyAgreement.objects.update_or_create(
            agreement_type=data['agreement_type'],
            version=data['version'],
            defaults=data,
        )
        if created_flag:
            created += 1
            print(f"  + 创建: {data['title']} v{data['version']}")
        else:
            print(f"  = 已存在: {data['title']} v{data['version']}")

    total = PrivacyAgreement.objects.filter(is_active=True).count()
    print(f"\n完成！共 {len(agreements_data)} 条协议，其中新增 {created} 条，当前生效中 {total} 条")

if __name__ == '__main__':
    seed_privacy_agreements()
