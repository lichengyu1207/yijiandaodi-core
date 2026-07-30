import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from datetime import date
from auth_app.system_models import PrivacyAgreement

PRIVACY_V3 = """
<h2 style="color:#165DFF;font-size:20px;margin-bottom:16px;border-bottom:2px solid #E5E6EB;padding-bottom:8px;">隐私政策 v3.0</h2>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  <strong>「一鉴到底」</strong>（以下简称"我们"）深知个人信息保护的重要性。本政策依据
  <strong>《中华人民共和国个人信息保护法》（2021年11月1日施行）</strong>、
  <strong>《中华人民共和国数据安全法》（2021年9月1日施行）</strong>、
  <strong>《中华人民共和国网络安全法》（2017年6月1日施行）</strong>
  及相关法律法规制定，旨在向您清晰说明我们如何收集、使用、存储和保护您的个人信息。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">一、我们收集哪些信息</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">为向您提供AI安全检测服务，我们遵循<strong>「最小必要原则」</strong>收集以下信息：</p>

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;color:#475569;">
  <tr style="background:#F0F5FF;"><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;">信息类别</th><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;">具体内容</th><th style="padding:10px;text-align:center;border:1px solid #D6E4FF;">敏感级别</th><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;">法律依据</th></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>账户身份信息</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">用户名、电子邮箱（自愿提供时）、头像URL</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#E8F3FF;color:#165DFF;padding:2px 8px;border-radius:4px;">L2-内部</span></td><td style="padding:8px;border:1px solid #E5E6EB;">个保法第6条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>认证凭据</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">密码哈希值（不可逆加密）、登录令牌Token、会话标识</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#FFF7E6;color:#FA8C16;padding:2px 8px;border-radius:4px;">L4-绝密</span></td><td style="padding:8px;border:1px solid #E5E6EB;">网安法第24条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>登录审计日志</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">登录IP地址（哈希处理）、浏览器UA、登录时间、成功/失败状态</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#E8F3FF;color:#165DFF;padding:2px 8px;border-radius:4px;">L2-内部</span></td><td style="padding:8px;border:1px solid #E5E6EB;">网安法第21条（日志留存≥6个月）</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>操作行为日志</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">浏览记录、点击轨迹、搜索关键词、功能使用频率</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#E8F3FF;color:#165DFF;padding:2px 8px;border-radius:4px;">L2-内部</span></td><td style="padding:8px;border:1px solid #E5E6EB;">个保法第7条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>支付与财务</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">订单号、支付金额（加密存储）、支付渠道类型</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#FFF7E6;color:#FA8C16;padding:2px 8px;border-radius:4px;">L3-机密</span></td><td style="padding:8px;border:1px solid #E5E6EB;">电子商务法第27条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>商务咨询信息</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">联系人姓名（脱敏）、联系电话（部分脱敏）、联系邮箱（部分脱敏）、公司名称</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#FFF7E6;color:#FA8C16;padding:2px 8px;border-radius:4px;">L3-机密</span></td><td style="padding:8px;border:1px solid #E5E6EB;">个保法第6条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>API开发者凭证</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">API密钥（SHA-256哈希存储）、调用IP白名单（哈希处理）</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#FFECE8;color:#F53F3F;padding:2px 8px;border-radius:4px;">L4-绝密</span></td><td style="padding:8px;border:1px solid #E5E6EB;">网安法第27条</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>检测内容</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">您提交的待检测文本/文件（即时分析，不长期存储，最长保留7天）</td><td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><span style="background:#F0FDF4;color:#52C41A;padding:2px 8px;border-radius:4px;">L1-公开</span></td><td style="padding:8px;border:1px solid #E5E6EB;">个保法第6条</td></tr>
</table>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">二、数据分类分级制度</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  依据《数据安全法》第21条要求，我们建立了完善的<strong>数据分类分级制度</strong>，
  将所有用户数据按照敏感程度分为 <strong>4 个等级</strong>，并采取差异化的安全保护措施：
</p>

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;color:#475569;">
  <tr style="background:#F0F5FF;">
    <th style="padding:10px;text-align:center;border:1px solid #D6E4FF;width:80px;">级别</th>
    <th style="padding:10px;text-align:left;border:1px solid #D6E4FF;width:90px;">名称</th>
    <th style="padding:10px;text-align:left;border:1px solid #D6E4FF;">定义</th>
    <th style="padding:10px;text-align:center;border:1px solid #D6E4FF;width:70px;">保留期</th>
    <th style="padding:10px;text-align:center;border:1px solid #D6E4FF;width:65px;">加密</th>
    <th style="padding:10px;text-align:center;border:1px solid #D6E4FF;width:70px;">访问日志</th>
    <th style="padding:10px;text-align:center;border:1px solid #D6E4FF;width:75px;">导出审批</th>
  </tr>
  <tr>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;background:#F6FFED;"><strong>L1</strong></td>
    <td style="padding:8px;border:1px solid #E5E6EB;"><span style="color:#52C41A;">公开</span></td>
    <td style="padding:8px;border:1px solid #E5E6EB;">可公开发布的数据，无敏感信息</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">90天</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">否</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">否</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">免审</td>
  </tr>
  <tr>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;background:#E8F3FF;"><strong>L2</strong></td>
    <td style="padding:8px;border:1px solid #E5E6EB;"><span style="color:#165DFF;">内部</span></td>
    <td style="padding:8px;border:1px solid #E5E6EB;">仅内部员工访问的业务数据</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">180天</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">否</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">是</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">免审</td>
  </tr>
  <tr>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;background:#FFF7E6;"><strong>L3</strong></td>
    <td style="padding:8px;border:1px solid #E5E6EB;"><span style="color:#FA8C16;">机密</span></td>
    <td style="padding:8px;border:1px solid #E5E6EB;">包含PII或核心业务机密，需加密+审批</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;">730天(2年)</td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><strong>是</strong></td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><strong>是</strong></td>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;"><strong>需审批</strong></td>
  </tr>
  <tr>
    <td style="padding:8px;text-align:center;border:1px solid #E5E6EB;background:#FFF1F0;"><strong>L4</strong></td>
    <td style="padding:8px;border:1px solid #E5E6EB;"><span style="color:#F53F3F;">绝密</span></td>
    <td style="padding:8px;border:1px solid #E5E6EB;">API密钥、支付凭证等最高级别数据</td>
    <td style="padding:8px:text-align:center;border:1px solid #E5E6EB;">1825天(5年)</td>
    <td style="padding:8px:text-align:center;border:1px solid #E5E6EB;"><strong>是(AES)</strong></td>
    <td style="padding:8px:text-align:center;border:1px solid #E5E6EB;"><strong>是</strong></td>
    <td style="padding:8px:text-align:center;border:1px solid #E5E6EB;"><strong>需DPO审核</strong></td>
  </tr>
</table>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">三、我们如何使用您的信息</h3>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>提供、维护和改进AI安全检测、Agent对话、RAG检索等服务</li>
  <li>验证您的身份并保障账户安全（含暴力破解防护：连续5次失败锁定15分钟）</li>
  <li>防止欺诈、滥用和未授权访问行为</li>
  <li>生成安全审计日志（留存≥6个月，符合《网络安全法》第21条）</li>
  <li>进行数据分析以优化产品体验（已匿名化/去标识化处理）</li>
  <li>遵守法律法规及监管部门的合规要求</li>
  <li>处理您的订单、套餐购买和企业审计咨询请求</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">四、信息的共享与披露</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">我们承诺：</p>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li><strong>不会出售</strong>您的个人信息给任何第三方</li>
  <li>仅在以下情况共享：获得您的明确同意 / 法律法规强制要求 / 与可信赖的服务提供商合作（均签署保密协议）</li>
  <li><strong>禁止跨境传输</strong>：除公开级(L1)内容文章类数据外，所有个人数据和业务数据均不向境外传输</li>
  <li>L3/L4级别数据的导出需经过<strong>管理员审批流程</strong>，且需由数据保护官(DPO)复核</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">五、信息的存储与安全保障</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">我们采用多层次的安全措施保护您的数据：</p>

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;color:#475569;">
  <tr style="background:#F0F5FF;"><th style="padding:8px;text-align:left;border:1px solid #D6E4FF;">安全措施</th><th style="padding:8px;text-align:left;border:1px solid #D6E4FF;">技术细节</th></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>传输加密</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">TLS 1.3 加密传输，HSTS 强制 HTTPS</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>静态加密</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">L3/L4 数据 AES-256 加密存储；密码 bcrypt 哈希；API Key SHA-256</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>访问控制</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">基于角色的权限控制(RBAC)，最小权限原则，L4 仅 super_admin 可访问</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>安全审计</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">全链路 SecurityAuditMiddleware 记录所有敏感操作</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>防注入/XSS</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">Django ORM 参数化查询；前端 sanitizeHTML 过滤；CSRF Token 保护</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>速率限制</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">登录5次/15分钟锁定；API 匿名100次/h，用户1000次/h</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>数据备份</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">每日自动全量备份 + 实时增量备份，异地容灾</td></tr>
</table>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">六、您的权利（依据《个人信息保护法》）</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">作为数据主体，您享有以下权利：</p>

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;color:#475569;">
  <tr style="background:#F0F5FF;"><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;width:140px;">权利</th><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;">说明</th><th style="padding:10px;text-align:left;border:1px solid #D6E4FF;width:120px;">行使方式</th></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>知情权</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">了解我们收集了哪些信息、如何使用</td><td style="padding:8px;border:1px solid #E5E6EB;">本政策全文</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>访问权</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">查看我们持有的关于您的个人信息</td><td style="padding:8px;border:1px solid #E5E6EB;">个人中心 → 账户设置</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>更正权</strong></td><td style="padding:8px;border:1px solid #E5E6EB;">更正不准确或不完整的个人信息</td><td style="padding:8px;border:1px solid #E5E6EB;">个人中心 → 编辑资料</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>删除权（注销权）</strong></td><td style="padding:8px;border:1px solid #E5E6EB;"><strong>永久注销账户</strong>，清除所有关联数据（评论/点赞/关注/登录日志），账号标记为 deleted_ 状态</td><td style="padding:8px;border:1px solid #E5E6EB;">个人中心 → 注销账户（需输入"永久注销"确认）</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>撤回同意权</strong></td><td style="padding:8px:border:1px solid #E5E6EB;">随时撤回此前给予的处理同意</td><td style="padding:8px;border:1px solid #E5E6EB;">联系客服或通过系统反馈</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;"><strong>数据可携带权</strong></td><td style="padding:8px:border:1px solid #E5E6EB;">以结构化格式获取您的个人数据副本</td><td style="padding:8px;border:1px solid #E5E6EB;">提交数据导出申请（L3/L4 需审批）</td></tr>
</table>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">七、数据保护官（DPO）</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  我们已设立<strong>数据保护官（Data Protection Officer, DPO）</strong>负责监督本平台的数据保护合规工作。
  如您对数据处理有任何疑问或投诉，可通过以下方式联系 DPO：
</p>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li><strong>电子邮箱</strong>：<a href="mailto:lichengyu@fangsuanyun.cn" style="color:#165DFF;">lichengyu@fangsuanyun.cn</a></li>
  <li>DPO 负责：数据分类分级审核 / L3/L4 数据导出审批 / 用户删除权执行确认 / 合规投诉处理</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">八、未成年人保护</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  我们的服务主要面向企业和专业用户。如果我们发现无意中收集了未满14周岁儿童的个人信息，
  将立即采取措施删除相关信息。监护人可通过上述联系方式联系我们。
</p>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">九、政策更新</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  本政策可能不时更新。<strong>重大变更</strong>将通过应用内弹窗通知 + 站内信方式告知您。
  继续使用本服务即表示您接受更新后的政策。版本历史可在系统管理后台查询。
</p>

<div style="margin:24px 0 12px;padding:16px;background:#F0F5FF;border-radius:8px;border-left:4px solid #165DFF;">
  <p style="margin:0;line-height:1.9;color:#475569;font-size:13px;">
    <strong>版本信息</strong> | 版本号：v3.0 | 更新日期：2026年5月31日 | 生效日期：2026年5月31日<br/>
    <strong>适用法律</strong> | 《个人信息保护法》《数据安全法》《网络安全法》《生成式人工智能服务管理暂行办法》《电子商务法》<br/>
    <strong>联系方式</strong> | <a href="mailto:lichengyu@fangsuanyun.cn" style="color:#165DFF;">lichengyu@fangsuanyun.cn</a>
  </p>
</div>
"""

TERMS_V3 = """
<h2 style="color:#165DFF;font-size:20px;margin-bottom:16px;border-bottom:2px solid #E5E6EB;padding-bottom:8px;">用户服务条款 v3.0</h2>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">一、服务概述</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  <strong>「一鉴到底」</strong>是方酸云（fangsuanyun.cn）旗下的 AI 驱动安全内容检测与合规平台。
  我们提供以下产品和服务：
</p>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li><strong>AI 内容安全检测</strong> — 文本/图片/AI生成内容的智能检测（S级/A级/B级/C级场景）</li>
  <li><strong>多 Agent 协同系统</strong> — 审计官/验证官/存证官/裁决官 四大内置 Agent</li>
  <li><strong>RAG 检索增强</strong> — 10万+ 行业知识库，支持文档解析与智能问答</li>
  <li><strong>场景联动套餐</strong> — S+A+B 组合套餐（60% 折扣优惠）</li>
  <li><strong>企业安全审计服务</strong> — 年度 AI 安全合规审计（起价 ¥50,000/年）</li>
  <li><strong>开放 API 平台</strong> — 第三方开发者接入 Agent 和 RAG 能力</li>
  <li><strong>创作者分成计划</strong> — 内容创作者收益分成体系</li>
  <li><strong>课程培训</strong> — Agent 实战开发 / RAG 入门等专业课程</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">二、账户注册与使用</h3>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>注册时须阅读并同意《隐私政策》和本《用户服务条款》（<strong>单独同意原则</strong>，符合个保法第14条）</li>
  <li>应提供真实、准确的注册信息，密码长度不少于 8 位且必须包含字母和数字</li>
  <li>妥善保管账户密码，对账户下所有活动承担全部责任</li>
  <li>不得将账户转让、出借、出租给他人使用</li>
  <li>如发现账户存在异常活动，我们有权临时冻结账户直至核实身份</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">三、用户行为规范</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">在使用本服务时，您承诺不会从事以下行为：</p>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>利用平台从事任何违法违规活动（包括但不限于传播违法有害信息）</li>
  <li>攻击、破坏平台系统或干扰正常运营（包括但不限于 DDoS 攻击、SQL 注入、XSS 攻击）</li>
  <li>逆向工程、反编译或试图获取平台源代码、算法模型或训练数据</li>
  <li>超出授权范围使用 API 接口（含速率限制规避、Key 共享等）</li>
  <li>利用平台的 AI 检测能力从事侵犯他人权益的活动</li>
  <li>将平台能力用于军事用途或大规模监控</li>
  <li>传播病毒、恶意代码、钓鱼链接或其他有害程序</li>
  <li>对 AI 检测结果进行恶意篡改后用于误导性目的</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">四、套餐与付费服务条款</h3>

<h4 style="color:#4E5969;font-size:14px;margin:14px 0 8px;">4.1 场景联动套餐</h4>
<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:13px;color:#475569;">
  <tr style="background:#F0F5FF;"><th style="padding:8px;text-align:left;border:1px solid #D6E4FF;">套餐类型</th><th style="padding:8px;text-align:left;border:1px solid #D6E4FF;">价格</th><th style="padding:8px;text-align:left;border:1px solid #D6E4FF;">有效期</th><th style="padding:8px:text-align:left;border:1px solid #D6E4FF;">核心权益</th></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;">S+A+B 旗舰套餐</td><td style="padding:8px;border:1px solid #E5E6EB;">¥598（原价¥997，40% off）</td><td style="padding:8px;border:1px solid #E5E6EB;">365天</td><td style="padding:8px;border:1px solid #E5E6EB;">4大Agent + RAG知识库 + API接入 + 优先支持</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;">S+A 双核套餐</td><td style="padding:8px;border:1px solid #E5E6EB;">¥498（原价¥797，38% off）</td><td style="padding:8px;border:1px solid #E5E6EB;">365天</td><td style="padding:8px;border:1px solid #E5E6EB;">2大Agent + RAG基础 + 标准支持</td></tr>
  <tr><td style="padding:8px;border:1px solid #E5E6EB;">A+B 入门套餐</td><td style="padding:8px;border:1px solid #E5E6EB;">¥198（原价¥297，33% off）</td><td style="padding:8px;border:1px solid #E5E6EB;">180天</td><td style="padding:8px;border:1px solid #E5E6EB;">单Agent + 社区支持</td></tr>
</table>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>套餐一经购买，不支持退款（除非法律法规另有规定）</li>
  <li>套餐有效期从支付成功之日起计算</li>
  <li>套餐内的 B 级场景在购买时选定，选定后不可更换</li>
  <li>我们保留调整套餐价格的权利，已购套餐不受影响</li>
</ul>

<h4 style="color:#4E5969;font-size:14px;margin:14px 0 8px;">4.2 企业安全审计服务</h4>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>企业审计服务为<strong>定制化年度服务</strong>，具体内容和价格以双方签订的合同为准</li>
  <li>基础审计版起步价为 <strong>¥50,000 元/年</strong>，企业旗舰版最高可达 <strong>¥150,000 元/年</strong></li>
  <li>审计流程：咨询 → 方案报价 → 签约 → 现场/远程审计 → 整改建议 → 出具报告 → 季度复查</li>
  <li>审计报告仅供参考和建议，不构成法律意见或合规保证</li>
  <li>客户有义务配合提供必要的访问权限和信息，因客户原因导致审计无法完成的，已付费用不予退还</li>
</ul>

<h4 style="color:#4E5969;font-size:14px;margin:14px 0 8px;">4.3 开放 API 服务</h4>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>API 使用受<strong>速率限制</strong>约束（详见开发者文档）</li>
  <li>API 密钥（yjdp_ 前缀）仅限本人使用，禁止分享或转售</li>
  <li>异常调用行为可能导致 Key 被撤销且不予退款</li>
  <li>我们保留根据使用量调整免费额度的权利</li>
</ul>

<h4 style="color:#4E5969;font-size:14px;margin:14px 0 8px;">4.4 创作者分成计划</h4>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>创作者收益按月结算，提现最低金额为 ¥100</li>
  <li>分成比例根据创作者等级确定（初级/中级/金牌）</li>
  <li>平台有权对违规内容取消分成资格</li>
  <li>创作者需自行承担个人所得税等相关税费</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">五、知识产权</h3>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>平台的商标、Logo、界面设计、算法模型、源代码及相关知识产权归方酸云所有</li>
  <li>您在使用过程中产生的检测数据、分析结果归您所有</li>
  <li>平台提供的 AI 检测结果仅供参考，其知识产权归属按双方约定确定</li>
  <li>知识库内容由平台整理和维护，未经授权不得批量抓取或转载</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">六、服务变更与终止</h3>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>我们保留随时修改、暂停或终止服务的权利，重大变更将提前 <strong>30 天</strong>通知</li>
  <li>您可随时申请<strong>注销账户</strong>（符合《个人信息保护法》第47条删除权），注销后所有个人数据将被清除</li>
  <li>违反本条款的用户账户可能被立即终止，已付费用的未使用部分不予退还</li>
  <li>对于连续 <strong>12 个月</strong>未登录的闲置账户，我们有权进行清理</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">七、免责声明</h3>
<ul style="margin:8px 0;padding-left:22px;line-height:2;color:#475569;">
  <li>平台提供的 AI 检测结果<strong>仅供参考</strong>，不构成法律意见或最终判定</li>
  <li>对于因依赖检测结果造成的任何损失，平台在法律法规允许的最大范围内不承担责任</li>
  <li>因不可抗力（自然灾害、政府行为、网络攻击等）导致的服务中断，平台不承担责任</li>
  <li>第三方服务（云服务商、AI 模型服务等）的中断或故障不在我们的控制范围内</li>
</ul>

<h3 style="color:#1E293B;font-size:16px;margin:20px 0 12px;padding-left:10px;border-left:4px solid #165DFF;">八、争议解决</h3>
<p style="margin:8px 0;line-height:1.9;color:#475569;">
  因本协议引起的争议，双方应友好协商解决；协商不成的，提交<strong>平台所在地人民法院</strong>诉讼解决。
  本协议的订立、执行、解释及争议解决均适用<strong>中华人民共和国法律</strong>。
</p>

<div style="margin:24px 0 12px;padding:16px;background:#F0F5FF;border-radius:8px;border-left:4px solid #165DFF;">
  <p style="margin:0;line-height:1.9;color:#475569;font-size:13px;">
    <strong>版本信息</strong> | 版本号：v3.0 | 更新日期：2026年5月31日 | 生效日期：2026年5月31日<br/>
    <strong>联系方式</strong> | <a href="mailto:lichengyu@fangsuanyun.cn" style="color:#165DFF;">lichengyu@fangsuanyun.cn</a>
  </p>
</div>
"""


def seed_privacy_v3():
    agreements = [
        {
            'title': '隐私政策',
            'agreement_type': 'privacy',
            'content': PRIVACY_V3,
            'version': '3.0',
            'is_active': True,
            'is_required': True,
            'effective_date': date(2026, 5, 31),
        },
        {
            'title': '用户服务条款',
            'agreement_type': 'terms',
            'content': TERMS_V3,
            'version': '3.0',
            'is_active': True,
            'is_required': True,
            'effective_date': date(2026, 5, 31),
        },
    ]

    for data in agreements:
        obj, created = PrivacyAgreement.objects.update_or_create(
            agreement_type=data['agreement_type'],
            version=data['version'],
            defaults=data,
        )
        status = 'Created' if created else 'Updated'
        print(f'  [{status}] {data["title"]} v{data["version"]}')

    total = PrivacyAgreement.objects.filter(is_active=True).count()
    print(f'\n[OK] Privacy Policy & Terms v3.0 initialized ({total} active)')


if __name__ == '__main__':
    seed_privacy_v3()
