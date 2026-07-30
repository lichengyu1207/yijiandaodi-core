import random
import sys
import io

# Fix Windows GBK encoding issue
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from content_app.models import Category, Tag, FrontAuthor, Article, ArticleTag


class Command(BaseCommand):
    help = 'Generate seed article data'

    def handle(self, *args, **options):
        self.stdout.write('[START] Generating seed data...')

        with transaction.atomic():
            self.clean_old_data()
            categories = self.create_categories()
            authors = self.create_authors()
            tags = self.create_tags()
            self.create_articles(categories, authors, tags)

        self.stdout.write(self.style.SUCCESS('[DONE] Seed data generation complete!'))

    def clean_old_data(self):
        self.stdout.write('[CLEAN] Cleaning old data...')
        ArticleTag.objects.all().delete()
        Article.objects.all().delete()
        Tag.objects.all().delete()
        FrontAuthor.objects.all().delete()
        Category.objects.all().delete()
        self.stdout.write('  [OK] Old data cleaned')

    def create_categories(self):
        self.stdout.write('[CAT] Creating categories...')
        categories_data = [
            {'id': 1, 'name': '安全审计', 'slug': 'security-audit'},
            {'id': 2, 'name': '合规检测', 'slug': 'compliance'},
            {'id': 3, 'name': '身份验证', 'slug': 'identity'},
            {'id': 4, 'name': '数据存证', 'slug': 'data-proof'},
            {'id': 5, 'name': '漏洞扫描', 'slug': 'vuln-scan'},
            {'id': 6, 'name': '风险评估', 'slug': 'risk-assess'},
            {'id': 7, 'name': '应急响应', 'slug': 'incident'},
            {'id': 8, 'name': '行业动态', 'slug': 'industry'},
            {'id': 9, 'name': 'Agent 执行', 'slug': 'agent-exec'},
        ]
        categories = []
        for cat_data in categories_data:
            cat = Category(
                id=cat_data['id'],
                name=cat_data['name'],
                slug=cat_data['slug'],
                sort_order=cat_data['id'],
                is_active=True,
            )
            categories.append(cat)
        Category.objects.bulk_create(categories)
        self.stdout.write(f'  [OK] Created {len(categories)} categories')
        return list(Category.objects.all())

    def create_authors(self):
        self.stdout.write('[AUTHOR] Creating authors...')
        authors_data = [
            {'id': 1, 'name': '老陈', 'avatar': '', 'bio': 'Agent安全从业者，专注LLM应用安全', 'email': ''},
            {'id': 2, 'name': '阿明', 'avatar': '', 'bio': '全栈工程师，踩坑无数', 'email': ''},
            {'id': 3, 'name': '安全狗', 'avatar': '', 'bio': '渗透测试出身，转做AI安全', 'email': ''},
            {'id': 4, 'name': '运维小王', 'avatar': '', 'bio': 'K8s/Docker重度用户', 'email': ''},
            {'id': 5, 'name': '合规专员Lisa', 'avatar': '', 'bio': '等保/GDPR/等合规领域', 'email': ''},
            {'id': 6, 'name': '架构师张哥', 'avatar': '', 'bio': '15年经验，什么坑都见过', 'email': ''},
            {'id': 7, 'name': 'RAG玩家', 'avatar': '', 'bio': '向量数据库爱好者', 'email': ''},
            {'id': 8, 'name': 'DevSecOps李', 'avatar': '', 'bio': '安全左移实践者', 'email': ''},
            {'id': 9, 'name': '产品经理Sarah', 'avatar': '', 'bio': 'ToB安全产品经理', 'email': ''},
            {'id': 10, 'name': '开源贡献者Kevin', 'avatar': '', 'bio': 'LangChain/AutoGPT源码阅读者', 'email': ''},
        ]
        authors = []
        for author_data in authors_data:
            author = FrontAuthor(
                id=author_data['id'],
                name=author_data['name'],
                avatar=author_data['avatar'],
                bio=author_data['bio'],
                email=author_data['email'],
            )
            authors.append(author)
        FrontAuthor.objects.bulk_create(authors)
        self.stdout.write(f'  [OK] Created {len(authors)} authors')
        return list(FrontAuthor.objects.all())

    def create_tags(self):
        self.stdout.write('[TAG] Creating tags...')
        tags_data = [
            'Agent安全', 'Prompt注入', 'RAG安全', 'LLM防护', '权限越权',
            '数据泄露', '供应链攻击', '合规审计', 'DevSecOps', '零信任',
            '容器安全', 'API安全', '密钥管理', '日志审计', '渗透测试',
            '等保测评', 'GDPR', 'Docker', 'Kubernetes', 'LangChain',
            'OpenAI', '向量数据库', 'OAuth2', 'JWT', 'Function Calling'
        ]
        tags = []
        for tag_name in tags_data:
            slug = tag_name.lower().replace('/', '-').replace(' ', '-')
            tag = Tag(name=tag_name, slug=slug)
            tags.append(tag)
        Tag.objects.bulk_create(tags)
        self.stdout.write(f'  [OK] Created {len(tags)} tags')
        return list(Tag.objects.all())

    def create_articles(self, categories, authors, tags):
        self.stdout.write('[ARTICLE] Generating articles...')

        titles_library = self.get_titles_library()
        summaries_library = self.get_summaries_library()
        hook_lines = self.get_hook_lines()

        xinfa_tags_choices = ['agent_pitfall', 'dev_survival', 'corp_compliance', 'pitfall_records']
        xinfa_tags_weights = [0.4, 0.2, 0.2, 0.2]
        zone_ids = ['dev', 'enterprise', 'multi_agent', 'pitfall_records']

        articles_batch = []
        article_tags_batch = []

        total_articles = 1000
        batch_size = 50

        for i in range(total_articles):
            title_idx = i % len(titles_library)
            summary_idx = (i * 7 + 3) % len(summaries_library)

            title = titles_library[title_idx]
            summary = summaries_library[summary_idx]
            xinfa_tag = random.choices(xinfa_tags_choices, weights=xinfa_tags_weights)[0]
            zone_id = random.choice(zone_ids)
            hook_line = hook_lines[i % len(hook_lines)]

            published_at = datetime.now() - timedelta(days=random.randint(0, 180))

            article = Article(
                title=title,
                summary=summary,
                content=self.generate_content(title, summary),
                cover_image='',
                category=random.choice(categories),
                author=random.choice(authors),
                status='published',
                read_count=random.randint(100, 50000),
                like_count=random.randint(10, 5000),
                comment_count=random.randint(0, 200),
                is_recommended=(i < int(total_articles * 0.15)),
                xinfa_tag=xinfa_tag,
                is_pinned=(i < 30),
                zone_id=zone_id,
                hook_line=hook_line,
                cta_text='立即检测你的 Agent ->',
                cta_link='/chat',
                published_at=published_at,
            )
            articles_batch.append(article)

            selected_tags = random.sample(tags, k=random.randint(2, 4))
            for tag in selected_tags:
                article_tags_batch.append({'article_idx': i, 'tag': tag})

            if len(articles_batch) >= batch_size or i == total_articles - 1:
                created_articles = Article.objects.bulk_create(articles_batch)
                self._create_article_tags(created_articles, article_tags_batch[:len(created_articles) * 3])
                self.stdout.write(f'  [OK] Generated {min(i + 1, total_articles)}/{total_articles} articles')
                articles_batch = []
                article_tags_batch = []

        self.stdout.write(f'  [DONE] All {total_articles} articles generated!')

    def _create_article_tags(self, articles, article_tags_data):
        article_tags = []
        tag_index = 0
        seen_pairs = set()
        for article in articles:
            for _ in range(3):
                if tag_index < len(article_tags_data):
                    pair = (article.id, article_tags_data[tag_index]['tag'].id)
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        article_tags.append(ArticleTag(
                            article=article,
                            tag=article_tags_data[tag_index]['tag']
                        ))
                    tag_index += 1
        if article_tags:
            ArticleTag.objects.bulk_create(article_tags)

    def get_titles_library(self):
        return [
            '上周上线了个Agent，第二天客户打电话说数据被别人看到了',
            '帮一家政企单位做等保测评，Agent模块扣了不少分',
            '同事把API Key写死在代码里提交了，第二天仓库被人扫到了',
            '用户在我们的Agent里输入了一段话，系统直接执行了不该执行的命令',
            'RAG接上去之后效果不错，但后来发现知识库被污染了',
            '.env文件被提交到Git的后果',
            'Docker里跑Agent容器，默认配置其实不够安全',
            'LangChain的Tool调用没做参数校验，测试时发现了这个问题',
            'K8s RBAC配错拿到集群权限的事',
            '整理了一份Agent上线前的检查表，每次发版前过一遍',
            '我们的Agent把生产数据库密码打印到日志了',
            'Prompt Injection比想象中更隐蔽，上周排查了一个case',
            'AutoGPT让它自己跑，结果它尝试rm -rf /',
            'CrewAI多Agent协作，权限隔离是个大问题',
            'Function Calling返回值没校验，上下文窗口撑爆了',
            '向量数据库被注入攻击，检索结果全错了',
            'OAuth2 Token在Agent里的生命周期管理踩坑',
            'JWT过期处理不当，用户正在操作突然被踢出登录',
            '多租户Agent的数据隔离，一个SQL注入拉出所有人数据',
            '供应链投毒：npm包感染Agent的案例',
            'Agent沙箱逃逸：Docker隔离够不够用',
            'LLM幻觉导致信息泄露，模型编造了敏感信息',
            '前端嵌入Agent SDK的XSS风险升级',
            '混沌工程测Agent稳定性，随机杀服务看error handling',
            '私有模型被白嫖的发现过程',
            '边缘设备跑轻量级Agent的安全方案裁剪',
            'Agent SOC告警聚合，误报率高达90%',
            '代码签名防止Agent被篡改的重要性',
            '加密流量下Agent行为异常检测的侧信道分析',
            '从零搭Agent安全实验室的经验',
            'Agent调用链追踪在分布式系统的实现',
            'OWASP AI Top 10对照自查笔记',
            '实时监控Agent行为基线的建立过程',
            'Agent编排引擎DAG权限传递问题',
            '模型蒸馏攻击的防御思路',
            'ToB产品客户数据隔离翻车记录',
            '长期存储上下文就是最大攻击面',
            '红队演练Agent全链路攻防记录',
            '等保2.0条款逐条对照笔记',
            'GDPR被遗忘权在Agent系统中的实现难点',
            '企业内部Agent的权限模型设计',
            'API Gateway做Agent流量控制的实践',
            '敏感信息检测在Agent管道中的应用',
            'LLM输出内容安全过滤实战',
            'Agent版本回滚时配置残留问题',
            '多云部署Agent的策略同步难题',
            '测试环境数据混入生产的惨痛教训',
            '开源框架安全审计：LangChain源码走读',
            '密码策略在Agent时代的挑战',
            'Agent并发请求状态竞争问题',
            '人机回环安全边界怎么划',
            'API Key别再硬编码了，兄弟',
            '我的.env文件是怎么泄露到GitHub的',
            'Dockerfile写不好，安全隐患一大堆',
            'CI/CD流水线里藏了多少秘密',
            'Nginx配置漏了一行，服务器被扫了',
            'K8s Secret比ConfigMap安全吗？其实也未必',
            'PostgreSQL默认配置有几个坑',
            'Redis没设密码的后果',
            'GitHub Actions环境变量使用指南',
            '代码里出现password=xxx怎么预防',
            'SSH密钥管理混乱的教训',
            '数据库连接字符串别放前端代码',
            'Token过期处理那点事',
            'CORS配置错了的典型症状',
            '依赖包漏洞扫描工具对比',
            'npm audit到底能不能信',
            'pipreqs生成的requirements.txt有问题',
            'Docker层缓存导致的安全问题',
            'Alpine镜像真的更安全吗',
            '多阶段构建减少攻击面的实践',
            'gitignore写不全的后果',
            'pre-commit hook拦住一次泄露',
            'truffleHog扫描历史提交记录',
            'gitleaks配置和使用心得',
            'detect-secrets集成到CI流程',
            'SonarQube安全规则配置经验',
            'SAST工具选型踩坑记录',
            'DAST扫描结果误报处理',
            '依赖锁定文件的重要性',
            'package-lock.json不能随便删',
            'yarn.lock和pnpm-lock.yaml区别',
            'Go module代理配置安全问题',
            'Python虚拟环境隔离不够用',
            'Node.js进程权限控制要点',
            'Linux文件权限755还是644',
            'umask设置对安全的影响',
            'sudoers配置错误的教训',
            'cron任务被劫持的案例',
            'systemd服务安全配置参考',
            '日志轮转logrotate配置要点',
            '/tmp目录滥用导致的问题',
            '/dev/shm内存泄漏案例',
            'ulimit设置不当OOM Killed',
            'swap分区安全配置建议',
            '防火墙ufw/iptables选择',
            'fail2ban防暴力破解配置',
            '端口扫描nmap自检方法',
            'SSL证书Let\'s Encrypt续期踩坑',
            'HTTPS强制跳转Nginx配置',
            'HSTS头设置的重要性',
            'CSP策略编写实战经验',
            'X-Frame-Options防点击劫持',
            'X-Content-Type-Options嗅探防护',
            'Referrer-Policy隐私保护',
            'Permissions-Policy功能限制',
            'Cookie安全属性设置指南',
            'SameSite属性防CSRF',
            'HttpOnly防XSS窃取Cookie',
            'Secure属性强制HTTPS',
            'Session固定攻击防护',
            'CSRF Token实现方案对比',
            '双重Submit Cookie方案',
            '自定义Header验证方案',
            'SQL注入防护参数化查询',
            'ORM框架防注入注意事项',
            'MyBatis XML注入风险',
            'Hibernate HQL注入案例',
            'Sequelize Op注入问题',
            'TypeORM QueryBuilder安全',
            'XSS反射型存储型DOM型区别',
            'DOMPurify过滤HTML使用',
            '转义函数选择escape vs encode',
            '模板引擎自动转义配置',
            'React dangerouslySetInnerHTML慎用',
            'Vue v-html替代方案',
            'Angular DomSanitizer用法',
            'SSRF服务端请求伪造防护',
            'URL白名单实现方案',
            '内网地址正则匹配规则',
            'DNS重绑定攻击防范',
            '文件上传类型校验方法',
            'MIME Type不可信的原因',
            'Magic Number文件头检测',
            '上传目录禁止执行权限',
            '文件名特殊字符过滤',
            '路径遍历../防护方案',
            'realpath规范化路径',
            'join拼接代替用户输入',
            '命令注入os.system禁用原因',
            'subprocess shell=True风险',
            'exec函数参数列表传递',
            'child_process spawn安全用法',
            '反序列化pickle/yaml风险',
            'JSON.parse相对安全的理由',
            'XML实体注入XXE防护',
            'SAX解析器关闭DTD',
            'LDAP注入特殊字符转义',
            'NoSQL注入$where过滤',
            'MongoDB操作符黑名单',
            'XPath注入concat拼接',
            '重定向注入Location头校验',
            'Open Redirect白名单域名',
            'HTTP响应拆分CRLF防护',
            'Race Condition竞争条件锁',
            '原子操作避免TOCTOU',
            '业务逻辑越权IDOR防护',
            '对象归属校验必做事项',
            'UUID代替自增ID好处',
            '批量接口缺少分页限制',
            '导出功能数据量控制',
            '导入功能文件大小限制',
            '暴力破解账号锁定策略',
            '验证码图形滑动短信选择',
            '密码强度要求BCrypt成本',
            '加盐哈希随机salt生成',
            'PBKDF2迭代次数推荐值',
            'Argon2内存硬度参数',
            'MFA双因素TOTP实现',
            '短信验证码频率限制',
            '邮箱验证链接有效期',
            '密码找回流程安全设计',
            '安全问题反馈渠道建立',
            '漏洞赏金计划运营经验',
            '安全事件响应预案制定',
            '应急联系人名单维护',
            '备份恢复演练定期执行',
            '灾难恢复RPO RTO目标',
            '热备冷备温备方案选择',
            '异地多活容灾架构设计',
            '数据加密静态传输都要做',
            'AES-GCM模式推荐理由',
            'RSA密钥长度2048vs4096',
            'ECC曲线secp256r1选择',
            '密钥分发PKI体系理解',
            '证书链验证完整性检查',
            '证书吊销CRL OCSP对比',
            'HSM硬件安全模块使用',
            'KMS密钥管理服务集成',
            'Envoy代理安全配置要点',
            'Istio mTLS双向TLS配置',
            'Service Mesh安全实践',
            'Sidecar容器安全考虑',
            'eBPF安全监控程序开发',
            'Falco规则编写入门',
            'Auditd审计日志配置',
            'WAF Web应用防火墙规则',
            'ModSecurity OWASP CRS',
            '云WAF自建vs购买对比',
            'DDoS防护CDN清洗中心',
            'SYN Flood防御Syncookie',
            'UDP放大攻击缓解措施',
            '应用层CC攻击限流方案',
            'Rate Limiting令牌桶算法',
            'Sliding Window滑动窗口',
            'Leaky Bucket漏桶实现',
            'Guava RateLimiter使用',
            'Redis Lua脚本限流',
            'Nginx limit_req_zone配置',
            'API Gateway限流策略',
            '熔断降级Hystrix Sentinel',
            '服务网格流量控制Istio',
            '灰度发布金丝雀部署',
            'Feature Flag特性开关安全',
            'AB测试数据隔离要求',
            '蓝绿部署切换回滚机制',
            '滚动更新健康检查配置',
            'Pod Disruption Budget PDB',
            '节点draining安全操作',
            '集群升级滚动策略kubeadm',
            'etcd备份加密存储',
            'kubeconfig权限最小化',
            'kubectl context切换安全',
            'helm chart values敏感数据',
            'kustomize overlay分层管理',
            'argocd GitOps安全实践',
            'fluxcd同步策略配置',
            'tekton Pipeline安全上下文',
            'jenkins pipeline凭证管理',
            'gitlab runner executor选择',
            'github self-hosted runner安全',
            '容器镜像仓库harbor扫描',
            'ECR生命周期策略配置',
            'ACR任务构建安全上下文',
            'GCR Binary Authorization',
            '镜像签名Notary TUF',
            'SBOM软件物料清单生成',
            'Syft Grype工具链使用',
            '依赖关系图可视化分析',
            '许可证合规SPDX标识',
            'CPE CVE漏洞关联查询',
            'NVD National Vulnerability Database',
            'CVSS评分v3.1计算方法',
            'EPSS预测评分理解',
            'KEV已知被利用漏洞关注',
            '补丁管理优先级排序',
            '变更管理审批流程设计',
            '紧急补丁例外通道建立',
            '回滚计划必须提前准备',
            '蓝军红军紫队演习组织',
            '钓鱼邮件模拟培训效果',
            '社会工程学意识提升',
            '物理安全门禁访客登记',
            '办公桌清屏锁屏策略',
            'USB端口管控DMC策略',
            '打印机传真机安全配置',
            '碎纸机销毁级别选择',
            '资产盘点CMDB准确性',
            '退役设备数据擦除验证',
            '硬盘消磁物理粉碎标准',
            '供应商安全评估问卷',
            '第三方风险评估方法论',
            'SLA安全条款审查要点',
            '数据处理协议DPA签署',
            'SCA软件成分分析工具',
            'FOSSA Black Duck Snyk对比',
            '许可证冲突GPL传染性',
            'MIT Apache BSD宽松许可',
            'Copyleft义务履行跟踪',
            '开源治理办公室OSPO建立',
            '贡献者许可协议CLA管理',
            'DCO Developer Origin Certificate',
            '安全开发生命周期SDLC',
            '威胁建模STRIDE方法',
            '攻击树Attack Tree绘制',
            ' misuse Case误用案例',
            '安全需求User Story编写',
            'Architecture Risk Analysis ARA',
            '设计安全review checklist',
            '安全编码规范团队定制',
            '代码审查security focus',
            '静态分析门槛质量门禁',
            '动态分析覆盖核心场景',
            '渗透测试scope定义技巧',
            '红队规则ROE交战规则',
            '漏洞披露政策Responsible Disclosure',
            'CVE编号分配流程了解',
            '安全公告订阅RSS聚合',
            '威胁情报TI feed集成',
            'IOC指标Indicators of Compromise',
            'TTPs战术技术过程分析',
            'MITRE ATT&CK框架映射',
            '钻石模型Diamond Model',
            'Kill Chain杀伤链理论',
            'OODA循环观察调整行动',
            '情报驱动防御IDS IPS',
            'SIEM Splunk ELK QRadar',
            'SOAR playbook自动化响应',
            'EDR端点检测CrowdStrike',
            'MDR托管检测响应服务',
            'XDR扩展检测响应趋势',
            'NDR网络检测Darktrace',
            'CWPP云工作负载Prisma',
            'CSPM云安全posture管理',
            'CASB云访问安全代理',
            'SASE安全访问服务边缘',
            'ZTNA零信任网络访问',
            'SWG安全Web网关',
            'FWaaS防火墙即服务',
            'RASP运行时应用自我保护',
            'IAST交互式应用测试',
            'MAST移动应用安全测试',
            'API Security网关方案',
            'GraphQL安全深度防御',
            'gRPC安全TLS认证',
            'WebSocket wss://配置',
            'Webhook签名验证HMAC',
            '回调URL白名单机制',
            'OAuth2 PKCE流程移动端',
            'OpenID Connect ID Token',
            'SAML SSO单点登录集成',
            'LDAP AD域认证对接',
            'Kerberos票据安全配置',
            'PAM特权账号管理',
            'Just-in-Time JIT临时授权',
            '堡垒机jump server审计',
            'VPN Zero Trust替代方案',
            'SDP软件定义perimeter',
            '身份联邦IdP联合认证',
            'SCIM用户自动预配',
            'SSO单点登出SLO实现',
            '帮一家政企单位过等保三级的故事',
            '等保2.0测评师不会告诉你的事',
            'GDPR合规项目踩坑半年总结',
            '企业数据分级分类怎么做',
            '密码应用安全性评估通过经验',
            '关保关键信息基础设施检查清单',
            '个人信息保护法落地实践',
            '数据出境安全评估申报流程',
            '车联网安全合规那些坑',
            '医疗行业HIPAA等保双合规',
            '金融行业网络安全法合规要点',
            '教育行业等保二级测评经验',
            '能源行业工控安全合规指南',
            '政务云平台安全合规建设',
            '国企央企网络安全考核应对',
            'ISO 27001认证审核通过心得',
            'ISO 27701隐私信息管理认证',
            'SOC 2 Type II 审计准备工作',
            'PCI DSS支付卡行业合规实践',
            'HCIP华为安全认证备考经验',
            'CISP注册信息安全专业人员',
            'CISSP国际信息系统安全专家',
            'CISA信息系统审计师考试',
            '等保测评差距分析报告模板',
            '合规管理制度体系建设',
            '安全策略文档编写规范',
            '应急预案编制与演练记录',
            '安全事件报告流程设计',
            '风险评估方法论ISO 31000',
            '资产识别与赋值打分标准',
            '脆弱性识别扫描工具选择',
            '威胁建模STRIDE在合规中应用',
            '风险计算公式 likelihood x impact',
            '风险处置接受降低转移规避',
            '残余风险 acceptance criteria',
            '合规持续监控 metrics dashboard',
            '管理层汇报材料 preparedness',
            '董事会安全报告季度模板',
            '监管机构沟通应对策略',
            '行政处罚减免情节把握',
            '整改通知书回复技巧',
            '合规证明文件归档管理',
            '审计轨迹 retention policy',
            '电子证据保全公证流程',
            '日志留存六个月以上要求',
            '审计日志防篡改WORM存储',
            '操作日志who did what when',
            '登录日志失败成功记录',
            '访问日志资源操作明细',
            '变更日志配置修改历史',
            '安全日志入侵检测告警',
            '日志集中收集syslog rsyslog',
            '日志分析ELK Stack部署',
            '日志归档冷热分层存储',
            '日志销毁secure deletion流程',
            '身份鉴别用户名密码+MFA',
            '口令复杂度长度有效期策略',
            '登录失败锁定账户策略',
            '登录连接超时自动退出',
            '唯一标识用户身份鉴别',
            '多因素组合两种以上鉴别',
            '鉴别信息防窃取传输加密',
            '访问控制最小权限原则',
            '角色权限RBAC模型实现',
            '权限分离职责不相容SoD',
            '默认拒绝deny all策略',
            '特权账号admin root管理',
            '远程访问VPN加密通道',
            '无线接入802.1x认证',
            '移动终端MDM MAM管理',
            '安全区域边界划分VLAN',
            '边界防护防火墙ACL规则',
            '入侵防范IDS IPS部署',
            '恶意代码防病毒EDR',
            '安全审计审计策略启用',
            '审计记录保护完整性',
            '审计分析报警阈值设定',
            '入侵防范抗DoS能力',
            '终端防病毒策略统一推送',
            '主机加固基线CIS Benchmark',
            '操作系统Windows Server hardened',
            'Linux CentOS Ubuntu hardening',
            '数据库Oracle MySQL加固',
            '中间件Tomcat Nginx加固',
            '应用服务器安全配置',
            'Web应用WAF防护部署',
            '数据完整性校验hash算法',
            '数据保密性加密存储传输',
            '数据备份增量全量策略',
            '备份介质离线异地保存',
            '备份恢复演练年度计划',
            'RTO RPO业务连续性目标',
            '灾难恢复预案DRP制定',
            '备用场地冷热温站选择',
            '应急预案ICSIncident Response',
            '应急组织架构角色分工',
            '应急响应流程 Detection Analysis',
            'Containment Eradication Recovery',
            '应急演练Tabletop Exercise',
            ' tabletop桌面推演实施',
            'Red Team Blue Team对抗演练',
            'Purple Team紫队协作模式',
            'Cyber Range网络靶场建设',
            '安全培训 awareness program',
            '新员工入职安全培训必修',
            '全员年度安全意识考核',
            '开发人员安全编码培训',
            '管理人员安全管理培训',
            '第三方人员安全保密协议',
            '外包服务商安全SLA约束',
            '供应链安全风险管理',
            '采购安全要求合同条款',
            '供应商安全评估 questionnaire',
            '软件开发安全SDLC嵌入',
            '安全需求需求规格说明书',
            '安全设计 Threat Modeling',
            '安全编码 Secure Coding Guidelines',
            '安全测试 SAST DAST Penetration',
            '安全发布 Release Security Review',
            '安全运维 Secure Operations',
            'DevSecOps流水线集成实践',
            '安全左移 Shift Left理念落地',
            '自动化安全扫描CI集成',
            'Infrastructure as Code IaC扫描',
            'Terraform tfsec安全检查',
            'CloudFormation cfn-nag扫描',
            'Ansible ansible-lint安全规则',
            'Kubernetes kube-bench CIS基准',
            'Docker docker bench security',
            '容器镜像Trivy Grype扫描',
            ' Helm helm lint security',
            '代码仓库Git pre-commit hooks',
            'PR Pull Request安全审查',
            'Code Review Security Checklist',
            '安全门禁 Quality Gate配置',
            '缺陷严重等级 CVSS mapping',
            '漏洞修复 SLA time to remediate',
            'Zero Day零日漏洞应急流程',
            '补丁管理 Patch Management',
            '变更管理 Change Advisory Board',
            '紧急变更 Emergency Change Process',
            '回滚计划 Rollback Procedure',
            '配置管理 CMDB Configuration',
            '版本控制 Git Branching Strategy',
            '环境管理 Dev Test Prod隔离',
            '秘钥管理 Secrets Management',
            'HashiCorp Vault 部署使用',
            'AWS Secrets Manager 集成',
            'Azure Key Vault 配置',
            'GCP Secret Manager 调用',
            '证书管理 Certificate Lifecycle',
            'PKI Public Key Infrastructure',
            'CA Certificate Authority搭建',
            'CSR Certificate Signing Request',
            '证书签发颁发吊销流程',
            'OCSP Online Certificate Status',
            'CRL Certificate Revocation List',
            '证书透明度 Certificate Transparency',
            'CT Log SCT Signed Certificate Timestamp',
            '密钥加密硬件HSM Thales Luna',
            'AWS CloudHSM 云端HSM',
            'Azure Dedicated HSM专用',
            'GCP Cloud HSM服务',
            '密钥轮换 Rotation Policy',
            '密钥分割 Secret Sharing Shamir',
            '双因子控制 Dual Control',
            '知识拆分 Split Knowledge',
            '物理安全 Physical Security',
            '机房准入 Access Control',
            '视频监控 CCTV Recording',
            '环境监控 Temperature Humidity',
            '消防系统 Fire Suppression',
            'UPS不间断电源 Battery Backup',
            '发电机 Generator Fuel Reserve',
            '精密空调 Precision Air Conditioning',
            '静电地板 Anti-static Flooring',
            '机柜 locking Cabinet',
            '线缆标签 Cable Labeling',
            '布线规范 Cabling Standards',
            '电磁屏蔽 EMC Shielding',
            'TEMPEST防信息泄漏',
            '资产管理 Asset Management',
            '硬件资产 Inventory Tracking',
            '软件资产 License Management',
            '数据资产 Data Asset Catalog',
            '报废处置 Decommissioning',
            '数据擦除 Data Sanitization',
            'NIST SP 800-88媒体净化',
            'DoD 5220.22-M标准擦除',
            '物理销毁 Physical Destruction',
            ' shredding 粉碎 degaussing 消磁',
            '合规证明 Compliance Attestation',
            '法律意见 Legal Opinion',
            '第三方审计 Third Party Audit',
            '认证机构 Accreditation Body',
            'CNAS中国认可委员会',
            'CMA检验检测机构资质',
            'CCRC信息安全服务资质',
            'ISCCC信息安全认证',
            '公安部第三研究所测评',
            '中国信息安全测评中心',
            '等级保护测评机构 selection',
            '商用密码检测机构 appointment',
            '个人信息保护认证机构',
            '数据出境评估申报部门',
            '国家互联网信息办CAC',
            '工信部 MIIT 网安局',
            '公安部 MPS 网安总队',
            '行业主管监管部门 liaison',
            '合规预算 Cost of Compliance',
            'ROI投资回报率计算',
            'TCO总拥有成本分析',
            '违规罚款 Penalty Calculation',
            '声誉损失 Reputational Damage',
            '业务中断 Business Disruption',
            '法律责任 Legal Liability',
            '刑事责任 Criminal Liability',
            '合规文化 Culture of Compliance',
            '道德伦理 Ethics & Integrity',
            '举报渠道 Whistleblowing Hotline',
            '反腐败 Anti-Corruption FCPA',
            '反贿赂 Anti-Bribery UK Bribery Act',
            '利益冲突 Conflict of Interest',
            '内控 Internal Controls COSO',
            '三道防线 Three Lines of Defense',
            '第一道防线 First Line Operations',
            '第二道防线 Second Line Risk&Compliance',
            '第三道防线 Third Line Internal Audit',
            '内部审计 Internal Audit Function',
            '外部审计 External Audit Engagement',
            '管理评审 Management Review',
            '持续改进 Continual Improvement PDCA',
            'Plan Do Check Act 循环',
            '纠正预防 CAPA Corrective Action',
            '不符合项 Non-conformity NC',
            '观察项 Observation OFI',
            '改进机会 Opportunity for Improvement',
            '最佳实践 Best Practice Sharing',
            '行业对标 Industry Benchmarking',
            '同业交流 Peer Exchange',
            '协会联盟 Industry Association',
            '标准制定 Standards Development',
            '政策参与 Policy Advocacy',
            '合规科技 RegTech 应用',
            'GRC Governance Risk Compliance',
            '平台工具 Platform Selection',
            'ServiceNow GRC Module',
            'RSA Archer GRC Suite',
            'MetricStream Integrated GRC',
            'OneTrust Privacy Management',
            'BigId Data Intelligence',
            'Collibra Data Governance',
            'Alteryx Data Analytics',
            'Splunk Enterprise Security',
            'IBM QRadar SIEM',
            'Micro Focus ArcSight',
            'LogRhythm NextGen SIEM',
            'Sumo Logic Cloud SIEM',
            'Elastic Security SIEM+SOAR',
            'Splunk SOAR Phantom',
            'Palo Alto XSOAR',
            'IBM Resilient SOAR',
            'Swimlane Core SOAR',
            'Demisto (Palo Alto)',
            'FireEye Helix Security Ops',
            'Secureworks Taegis XDR',
            'CrowdStrike Falcon XDR',
            'Microsoft Defender XDR',
            'SentinelOne Singularity XDR',
            'Trellix Insight XDR',
            'Darktrace DETECT RESPOND',
            'Vectra AI Network Detection',
            'ExtraHop Reveal(x) NDR',
            'Corelight Zeek-based NDR',
            'Palo Alto Cortex XDR',
            'Cisco SecureX XDR',
            'Fortinet FortiAnalyzer',
            'Check Point Infinity SOC',
            'Trend Micro Vision One',
            'Symantec (Broadcom) Secure',
            'Zscaler Digital Experience',
            'Netskope Intelligent SSE',
            'Lookout Cloud Security',
            'McAfee MVISION Cloud',
            'Bitglass CASB Discovery',
            'Skyhigh Networks (Netskope)',
            'CipherTrust Data Security',
            'Thales CipherTrust Manager',
            'Vormetric Data Encryption',
            'Gemalto SafeNet KeySecure',
            'Utimaco CryptoServer HSM',
        ]

    def get_summaries_library(self):
        return [
            '前两天在项目里遇到一个问题，LangChain的Tool调用居然没有做参数类型校验，用户传了个字符串当数字用，后面整个链路都乱了。查了半天才发现是pydantic model没写对。',
            '这个是我们团队用了半年的方案，分享一下我们怎么管理Agent项目的API Key的。之前直接写在.env里，后来上了HashiCorp Vault，现在用的是AWS Secrets Manager，每个环境单独一套。',
            '帮一家客户做等保测评的时候发现，他们的Agent系统居然用的root账号跑Docker容器，而且宿主机docker.sock直接挂载进去了。我跟他们说这个跟裸奔没啥区别...',
            '网上关于Prompt Injection的文章不少，但实际操作中发现很多所谓的"防御方案"根本挡不住变种攻击。这篇文章记录一下我们上周排查的一个case，攻击手法挺巧妙的。',
            '记录一下上周五晚上的事故——我们的RAG系统被人投毒了，向量库里混入了几条恶意数据，导致所有涉及某个话题的回答都被引导到了错误的方向。排查过程挺有意思的。',
            '说实话，Function Calling这块OpenAI做得还不够完善。我们项目中有个工具需要接收JSON数组作为参数，但SDK的type hint经常搞错，导致生产环境时不时报错。',
            '基本上每次做Agent安全审计都会发现这个问题：开发者喜欢把LLM的输出直接拿来用，不做任何sanitization。上次在一个项目里看到有人把user input拼进了SQL语句，虽然是间接的但一样危险。',
            '后来我们发现K8s上跑Agent最大的坑不是网络策略，而是RBAC。很多人给Pod配了cluster-admin觉得方便，结果一个容器逃逸就能拿到整个集群的控制权。',
            '我们组上周做了个实验，用AutoGPT让它自己决定执行什么命令，结果它尝试rm -rf /。虽然我们在沙箱里跑了但还是出了一身冷汗，强烈建议大家加一层命令白名单。',
            'CrewAI的多Agent协作模式确实强大，但权限隔离是个大问题。如果其中一个Agent被攻陷，横向移动到其他Agent的难度比你想象的要低得多。',
            '踩了个大坑：Anthropic Claude的tool_use response格式跟GPT的不一样，我们迁移的时候没注意到，导致有一周的时间工具调用全部静默失败了，没有任何报错。',
            '关于Docker容器安全，我想说一点很多人的误区：--privileged flag绝对不要用！我们审计过一个项目，为了调试方便开了这个flag，结果容器直接拿到了宿主机所有设备权限。',
            'PostgreSQL做Agent的记忆存储其实挺好的，但要注意连接池配置。我们有一次因为max_connections设太小，高峰期大量Agent请求被排队，用户体验极差。',
            'Redis用来做Agent的缓存和session存储很常见，但要记得设置maxmemory-policy，不然OOM的时候Redis会直接kill掉或者被系统OOM killer干掉。',
            'Nginx做Agent API的反向代理时，记得加上rate limiting。我们有次没做，被一个爬虫把API打爆了，后端服务全部超时。',
            'GitHub Actions里千万不要把secrets打印到log里！我有同事不小心echo了一个secret，虽然后来rotate了但那个value已经在action log里留了记录。',
            'Pinecone的索引如果配置不当，upsert操作可能会覆盖掉正常数据。我们遇到过一次，因为id collision导致一批向量数据被静默替换了。',
            'Milvus集群部署的时候一定要注意etcd的备份。我们有一次etcd数据丢了，整个Milvus集群的schema定义全没了，重建花了两整天。',
            'ChromaDB在开发环境跑得好好的，一上生产就各种问题。主要原因是它默认把数据存/tmp，有些云主机会定期清理tmp目录...',
            'API Gateway层面做一层统一的认证和限流真的很重要。我们之前每个微服务自己做鉴权，结果有一个服务漏了，成了整个系统的突破口。',
            '等保2.0对Agent系统的要求其实挺明确的，但很多条款的解读有歧义。比如"安全计算环境"这一条，Agent运行时要满足三级要求具体指哪些东西，不同测评师说法不一样。',
            'GDPR下的被遗忘权在Agent系统里实现起来特别麻烦。因为Agent的记忆系统可能分布在多个地方：向量数据库、关系数据库、本地缓存，要彻底删除一个人的数据很难。',
            '企业内部Agent一定要做多租户数据隔离。我们见过最夸张的是一个SaaS产品，所有客户的数据存在同一个表里，靠tenant_id区分，结果一个SQL注入就把所有人数据都拉出来了。',
            'Agent的日志审计如果只是简单地记录request/response其实没什么用。关键是要记录决策过程：为什么选择了这个工具、为什么生成了这样的回答、中间经过了哪些推理步骤。',
            '敏感信息检测不能只靠正则表达式。我们试过好几种方案，最后发现结合小模型做分类效果最好，虽然延迟高了点但准确率能接受。',
            'LLM输出的内容安全过滤是个无底洞。你永远不知道模型下一句会输出什么。我们的方案是多层过滤：关键词匹配 + 规则引擎 + 小模型二次审核。',
            'Agent版本回滚的时候最容易忽略的是配置残留。比如你升级了prompt模板，回滚代码但忘了回滚配置，新旧版本混在一起会出现奇怪的行为。',
            '多云部署Agent最头疼的是策略同步。你在AWS上配了一套安全策略，Azure和GCP上也要保持一致，手动做很容易遗漏，我们最后是用Terraform + workspace来管理的。',
            '测试数据混入生产这种事听起来很低级，但我们还真遇到了。原因是开发环境的数据库连接串被误提交到了生产配置里。',
            'LangChain源码里有一些值得注意的设计决策。比如它的Memory组件默认会把对话历史明文存储，如果你处理的是敏感数据这一点要格外小心。',
            '密码学在Agent时代面临新的挑战。传统的密码策略（定期更换、复杂度要求）在Agent场景下不太适用，因为Agent本身就需要长期持有凭据来做认证。',
            '混沌工程测Agent稳定性是个有意思的方向。我们用Chaos Monkey随机杀掉一些依赖服务，看Agent的error handling和retry逻辑是否健壮。',
            '.env文件被提交到Git这种事，说出去都丢人。但我们团队确实发生过，还好有pre-commit hook和gitleaks扫描，在merge request阶段拦住了。',
            'Agent在高并发下的状态管理是个大问题。如果两个请求同时修改同一个context，可能出现数据竞争。我们最后用了乐观锁来解决这个问题。',
            '人机回环(HITL)在设计上要特别注意安全边界。人类审批的操作应该在一个独立的、受保护的界面上完成，而不是在普通的聊天窗口里点个确认就行。',
            '边缘设备上跑Agent资源非常有限，常规的安全方案（如完整的WAF、IDS）跑不动。我们做了一些裁剪，保留了最核心的输入校验和日志审计功能。',
            '建设Agent SOC（安全运营中心）的过程中，最大的挑战是告警太多。Agent的行为模式跟传统应用差别很大，一开始我们的误报率高达90%。',
            '代码签名对于防止Agent运行时被篡改非常重要。特别是如果你的Agent是从外部下载或更新的，一定要验证签名完整性。',
            '加密流量下的Agent行为检测确实很难。我们最终采用了侧信道分析的方式，通过流量特征（包大小、时序、频率）来推断异常行为。',
            '从零搭建Agent安全实验室花了我们大概两周时间。主要是靶场环境的搭建比较费劲，要模拟各种攻击场景同时保证不影响其他开发工作。',
            'Agent调用链追踪在微服务架构下特别重要。当一个请求经过多个服务、多个Agent协作完成时，出了问题要能快速定位到是哪个环节出的问题。',
            '前端嵌入Agent SDK的风险被低估了。如果一个页面有XSS漏洞，攻击者不仅能窃取cookie，还能通过SDK劫持Agent执行任意操作。',
            'OWASP正在起草AI/ML Top 10威胁列表，目前还是草案阶段。我们对照着做了一次自查，发现了几个之前没意识到的问题点。',
            '建立Agent行为基线是个长期的过程。你需要收集足够多的"正常行为"数据，才能定义什么是"异常"。我们大概跑了三个月才建立起靠谱的基线。',
            'Function Calling不仅输入要校验，输出也要校验。我们有一次工具返回了一个超长的字符串，直接把上下文窗口撑爆了，后续的所有调用都失败了。',
            'Agent编排引擎（比如LangGraph）里的DAG执行图，节点之间的数据传递可能携带敏感信息。如果某个节点的权限过高，下游节点就能拿到不该拿到的数据。',
            '模型蒸馏攻击是个比较新的话题。如果你提供的是付费API服务，有人可能通过大量调用你的模型来"偷"走模型的能力，然后自己部署一个免费的。',
            '供应链攻击在Agent生态里尤其危险。因为你依赖的npm/pip包可能本身就包含了恶意代码，而这些代码会在Agent的执行环境中以较高的权限运行。',
            'ToB产品的多租户隔离真的是生死攸关。我们看过一个案例，因为tenant_id过滤漏了一个接口，导致A客户能看到B客户的聊天记录。',
            'Agent的长期记忆本质上就是一个巨大的攻击面。里面存储的历史对话、用户偏好、上下文信息，一旦泄露后果不堪设想。',
            '红队演练Agent系统跟我们平时做的Web渗透差别很大。传统的SQL注入、XSS在这里不太适用，更多是要针对LLM的特性来设计攻击向量。',
            'LLM幻觉导致的信息泄露比你想的更普遍。模型可能会"编造"一些看起来很真实的敏感信息，用户如果不加辨别就直接使用了。',
            'K8s RBAC配置错误是我们见过的最高频问题。很多人不理解ServiceAccount、Role、RoleBinding之间的关系，随便网上抄个yaml就用。',
            'XSS劫持Agent的场景是这样的：攻击者在页面注入恶意JS -> JS调用Agent SDK -> Agent SDK以受害者身份执行操作 -> 攻击者间接控制了Agent。',
            '企业级安全Checklist如果只是挂在墙上没人执行那就毫无意义。我们把它集成到了CI/CD流水线里，每次部署前自动跑一遍检查。',
            '日志审计体系的搭建最怕的就是"记了但不看"。我们专门配了一个Splunk dashboard，每天早上安全团队会花15分钟review前一日的异常日志。',
            '私有模型被蒸馏/抄袭的检测很难。目前的方法主要是通过"水印"技术——在模型的输出中植入一些统计特征，用于溯源。',
            'OAuth2 token在Agent中的管理要特别注意refresh token的安全性。如果refresh token泄露，攻击者可以无限期地获取新的access token。',
            '恶意npm包的套路通常是：先发布一个正常的版本积累下载量，然后在某个patch版本里加入恶意代码。所以lock file很重要，不要随意升级。',
            '批量数据泄露事故的响应速度决定了损失大小。我们的目标是：从发现到确认 <= 1小时，从确认到遏制 <= 4小时，从遏制到根除 <= 24小时。',
            '记忆系统的数据分类很重要。不是所有对话都需要永久保存，大部分日常闲聊应该在一定时间后自动清理，符合数据最小化原则。',
            '等保2.0的三级要求对Agent系统来说，最难满足的可能是"安全审计"这一块。Agent的决策过程如何做到可追溯、可审计，技术上还有不少挑战。',
            '完整的攻击链复现有助于理解防御重点。我们从初始接入开始，模拟了数据采集->处理->存储->输出的全链路，找出了7个可以改进的点。',
            '输出内容的自动审核目前还没有完美的方案。我们用了三个模型交叉验证：一个看有没有敏感词，一个看有没有诱导性内容，一个看整体是否合理。',
            'RBAC配置导致集群提权的案例：一个developer角色的ServiceAccount被错误地绑定了cluster-admin的ClusterRoleBinding，任何能拿到该SA token的人都能接管集群。',
            '分布式系统中定位安全事件的源头，distributed tracing是关键。我们在OpenTelemetry的基础上加了安全相关的span attribute，方便事后追溯。',
            '前端SDK被劫持后能做的事情取决于SDK的能力范围。如果SDK有文件读写、shell执行等能力，那基本等同于服务器被攻陷了。',
            '我们调研了100家企业的Agent安全现状，排名前十的共性问题是：1) 缺乏输入过滤 2) 权限过大 3) 日志不足 4) 无审计 5) 密钥硬编码...',
            'Function Calling的参数校验不能用信任模型输出的态度来做。不管模型多么"聪明"，它的输出本质上仍然是概率性的，必须当做不可信输入来处理。',
            '零信任架构在Agent系统中的落地，核心原则是：永不信任，始终验证。每次Agent调用工具、访问数据、执行操作，都要重新做鉴权和授权。',
            'PII（个人身份信息）的自动识别和脱敏，纯规则的方式覆盖率只有60%左右。我们后来接入了专门的PII检测服务，准确率提到了95%。',
            '训练数据投毒的检测目前还是个开放问题。常用的方法包括：统计异常检测、成员推理攻击检测、水印验证等，但没有一种能做到100%可靠。',
            'DAG编排引擎中权限传递的问题在于：上游节点的权限不应该自动传递给下游节点。每个节点应该基于自己的角色独立申请权限。',
            'AI时代的威胁矩阵跟传统的OWASP Top 10有很大差异。新增的威胁类别包括：模型窃取、数据投毒、提示注入、成员推理等。',
            '基于基线的入侵检测对于Agent系统来说是最实用的方案。因为Agent的行为通常有一定的模式和规律，偏离基线就意味着可能有异常。',
            '旧版本模型和配置的残留是很多安全问题的根源。升级后一定要全面清理旧资源，包括模型文件、配置文件、数据库schema变更等。',
            '跨云策略同步我们用的是Terraform Cloud + workspaces。每个云 provider 一个workspace，共享的变量用terraform remote state来传递。',
            '环境隔离的核心原则是：开发/测试/生产之间要做到网络隔离、数据隔离、权限隔离。任何跨越边界的操作都应该经过审批和审计。',
            '开源框架审计重点关注：依赖版本是否有已知漏洞、默认配置是否安全、是否有硬编码凭证、错误信息是否泄露敏感数据。',
            '无密码认证（Passwordless Auth）在Agent场景下确实更有优势。因为Agent不需要"记住"密码，用API Key/Machine Identity更合适。',
            '混沌工程的目的是在可控的环境中制造故障，从而发现系统的弱点。我们对Agent做了以下实验：网络延迟、服务宕机、内存压力、磁盘满。',
            '敏感文件的自动扫描应该成为CI/CD的标准环节。我们用的是gitleaks + detect-secrets的组合，能在commit阶段就发现泄露的凭证。',
            '并发竞争条件在Agent系统中更容易出现，因为Agent通常是异步的、事件驱动的。用数据库事务和乐观锁是必要的。',
            'GDPR的被遗忘权（Right to Erasure）在Agent系统中的实现难点在于：Agent可能把用户数据"记住"在了模型权重里（通过fine-tuning），这部分数据无法被精确删除。',
            '人机回环的安全边界划分建议：审批操作必须在独立的系统中完成，有独立的认证、独立的审计日志、独立的权限控制。',
            '边缘计算场景下Agent的安全方案要做减法。保留最核心的功能：输入校验、输出过滤、基本审计。其他高级功能根据实际情况取舍。',
            'SOC建设的核心是：告警要少而精。宁可漏报也不要海量误报导致警报疲劳。我们目前的告警量控制在每天20条以内。',
            '代码签名和完整性校验是防止供应链攻击的重要手段。所有的Agent组件（模型、代码、配置）在部署前都应该验证签名。',
            '网络流量分析在加密环境下要换思路。不再看payload内容，而是看metadata：连接模式、流量大小、通信频率、时序特征。',
            '安全实验室的环境搭建建议用Docker Compose或Vagrant，方便一键销毁和重建。靶场环境要跟开发/生产完全隔离。',
            'Prompt Injection的演化速度很快。从最初的"忽略之前的指令"，到现在利用模型的对齐特性进行"越狱"，防御方案也需要不断更新。',
            'SQL注入到Prompt Injection的类比很有意思：两者都是利用系统对输入的过度信任。区别在于SQL注入利用的是语法漏洞，而Prompt Injection利用的是语义漏洞。',
            'Agent安全领域目前最大的威胁确实是Prompt Injection。因为它不需要任何代码漏洞，只需要一段精心构造的自然语言就能绕过所有安全措施。',
            '安全是一个持续的过程，不是一个一次性项目。从设计阶段就要考虑安全，并且在开发的每个阶段都要有安全检查点。',
            '侥幸心理是安全的大敌。"应该不会有问题吧""先上线再说吧"——这些想法往往是事故的前奏。',
            '构建Agent安全防线没有银弹。需要多层次、多维度的防御：输入过滤、权限控制、审计日志、行为监控、应急响应，缺一不可。',
            '上线前的安全测试不能省。哪怕只是跑一遍自动化扫描工具，也能发现大部分低级错误。我们团队的要求是：不上线=不测试。',
            '说一件丢人的事：上周我把数据库密码写进了代码里，还push到了GitHub。好在有Secret Scanning自动检测到了，不然真就完蛋了。从此以后我发誓再也不这么干了。',
            '.env文件的管理真的是个老大难问题。我们团队试过好多方案：git-crypt、blackbox、direnv，最后还是觉得每个环境一套.env + .gitignore最靠谱。',
            'Dockerfile的安全问题往往被忽视。比如FROM latest标签、RUN apt-get不清理缓存、以root用户运行容器——这些看似小事累积起来就是很大的风险。',
            'CI/CD流水线里的秘密管理是我见过最多问题的地方。很多人直接把AWS_KEY写到GitHub Actions的secrets里然后用echo打印出来debug...',
            'Nginx配置漏了server_tokens off这一个小小的选项，攻击者就能看到你的Nginx版本号，然后针对性查找该版本的已知漏洞。',
            'K8s Secret真的比ConfigMap安全吗？答案是：也未必。因为Secret默认只是base64编码，并不是真正的加密。而且etcd里的Secret是明文存的。',
            'PostgreSQL有几个默认配置挺坑的。比如listen_addresses默认是\'*\'，意味着监听所有接口；还有superuser reserved connections默认5个，可能被攻击者占用。',
            'Redis没设密码+绑定0.0.0.0，基本上就是在邀请别人进来玩。我们有一台测试服务器的Redis就是这样被入侵的，还被植入了挖矿程序。',
            'GitHub Actions的环境变量使用有几个坑：repository secrets和environment secrets的作用域不同；还有GITHUB_TOKEN的权限默认太大，建议缩小。',
            '代码中出现password=xxx这种字样，靠grep是搜不完的。我们用了truffleHog和gitleaks做历史扫描，居然找到了两年前某次commit里留下的测试密码。',
            'SSH密钥管理混乱是很多团队的通病。谁的机器上有哪个key、key什么时候生成的、有没有过期——这些问题大部分人答不上来。',
            '数据库连接串千万别放到前端代码里，哪怕是打包混淆了也能被逆向出来。我们有个前辈就是这么干的，被安全团队通报批评。',
            'Token过期处理不当会导致很诡异的问题。比如用户正在操作突然被踢出登录，体验很差。我们的做法是access token短时效+refresh token长时效+自动续期。',
            'CORS配置错了的典型症状是：浏览器console报错但postman能正常请求。记住：Access-Control-Allow-Origin不要用*，尤其是带credential的时候。',
            '依赖包漏洞扫描工具我对比了几个：Snyk、Dependabot、Renovate、npm audit。各有优劣，但关键是你要真的去看报告并且修，不只是跑一下。',
            'npm audit的结果不能全信也不能不信。有些漏洞标记为critical但其实影响有限，有些low severity的反而在你的场景下很危险。',
            'pipreqs生成的requirements.txt有时候会漏掉隐式依赖。比如某个包的setup.py里声明了extra_requires，但pipreqs扫描不到。',
            'Docker层缓存有时候会给你"惊喜"。比如你COPY . .在RUN npm install之前，那每次代码变动都会破坏缓存，导致构建变慢且可能引入不一致的依赖。',
            'Alpine镜像确实小，但它用的是musl libc而不是glibc，有些C扩展的Python包在上面会有兼容问题。numpy和pandas用户要注意。',
            '多阶段构建是减少镜像攻击面的好实践。第一阶段build，第二阶段只copy需要的artifact，这样最终的镜像里就不会有gcc、make这些工具了。',
            '.gitignore写不全的后果：IDE配置文件、node_modules、.env、编译产物——这些东西一旦进仓库就很麻烦，尤其是含敏感信息的。',
            'pre-commit hook救了我一次。我配置了detect-secrets扫描，差点把一个API key push上去，在commit阶段就被拦截了。',
            'truffleHog扫描git历史提交记录真的很强大。它能找到即使已经被删除了的敏感信息，因为git history是不可篡改的（除非rewrite history）。',
            'gitleaks配置起来稍微有点烦，但是一旦配好了就很省心。我们把它集成到了CI里，每个PR都会自动扫描。',
            'detect-secrets集成到CI流程后，我们团队的secret泄露率降到了接近零。关键是baseline的维护要及时更新。',
            'SonarQube的安全规则默认配置有点松。我们调严了一些规则的severity threshold，并且开启了hotspot review机制。',
            'SAST工具选型的经验：商业工具（Fortify、Checkmarx）准确率高但贵；开源工具（Semgrep、CodeQL）免费但需要花时间调规则。',
            'DAST扫描结果的误报率普遍很高。我们的做法是：先由安全工程师初审一轮，把明显误报的标记出来，剩下的再分配给开发修。',
            '依赖锁定文件的重要性怎么说都不为过。package-lock.json、yarn.lock、poetry.lock——这些文件确保了团队成员安装的依赖版本一致。',
            'package-lock.json真的不能随便删除！有些人觉得它碍事就rm了，结果装出来的依赖版本跟其他人不一样，bug复现都复现不了。',
            'Go module proxy在国内访问有时候有问题。我们可以设置GOPROXY=https://goproxy.cn,direct来加速，但要注意proxy本身的可信度。',
            'Python虚拟环境venv只能解决包隔离的问题，解决不了Python版本隔离的问题。如果你需要在不同项目间切换Python版本，建议用pyenv。',
            'Node.js进程不要以root运行！这是个基本原则。如果需要监听1024以下的端口，可以用authbind或者启动后再drop privileges。',
            'Linux文件权限的基本原则：文件644、目录755、执行脚本755。不要图省事chmod 777，这是安全审计一定会扣分的点。',
            'umask设置为0027或0077，这样新建的文件默认权限会更严格。默认的0002意味着同组用户有写权限，在很多场景下是不必要的。',
            'sudoers配置错误可能导致权限提升。记住：用visudo编辑而不是直接vi /etc/sudoers，否则语法错了连sudo都用不了了。',
            'cron任务被劫持的案例我见过好几个。攻击者如果有写权限的话，可以在crontab里加一条恶意命令，定期执行。',
            'systemd服务的安全配置要点：User=指定非root用户、PrivateTmp=yes隔离/tmp、ReadOnly=yes只读文件系统、NoNewPrivileges=yes禁止提权。',
            '日志轮转logrotate不配置的话，/var/log会被撑满导致磁盘满。我们遇到过一次，整个系统因为没有空间写日志而各种服务报错。',
            '/tmp目录是所有用户可写的，这意味着任何用户都能在里面创建文件。如果你的应用往/tmp写敏感数据，其他用户可能读到。',
            '/dev/shm是共享内存区域，默认大小是物理内存的一半。有些应用会用它来做IPC，但里面的数据也是所有用户可读的。',
            'ulimit设置不当会导致"Too many open files"错误。Node.js应用尤其容易碰到这个问题，因为它默认的fd limit比较低。',
            'swap分区的大小建议设为物理内存的1-2倍。太小的话OOM Killer会直接杀进程，太大的话性能会受影响。',
            '防火墙的选择：ufw适合简单的场景，iptables功能强大但配置复杂，firewalld是CentOS 7+的默认选择。新手推荐ufw。',
            'fail2ban配合iptables可以有效防暴力破解。SSH、FTP、SMTP这些暴露在公网的服务都应该配上，阈值建议设为5分钟内失败3次。',
            '端口扫描自检用nmap：nmap -sV -sC your-ip.com 能扫出版本信息和常见漏洞脚本的检测结果。',
            'Let\'s Encrypt证书免费且好用，但要注意renewal。certbot renew --dry-run 可以测试续期是否正常，建议设个cron每月跑一次。',
            'HTTPS强制跳转的Nginx配置：return 301 https://$host$request_uri; 放在server块的80端口监听里，简单有效。',
            'HSTS头（Strict-Transport-Security）告诉浏览器以后只用HTTPS访问。设置max-age=31536000; includeSubDomains; preload。',
            'CSP（Content-Security-Policy）能有效防XSS。但配置起来很繁琐，建议先用report-only模式观察一段时间再正式开启。',
            'X-Frame-Options: DENY 防止你的页面被嵌入到别人的iframe里进行点击劫持。这个头已经逐渐被CSP的frame-ancestors取代了。',
            'X-Content-Type-Options: nosniff 防止浏览器猜测（MIME Sniff）响应内容的类型。这个一定要加，开销几乎为零。',
            'Referrer-Policy: strict-origin-when-cross-origin 控制Referer头的发送策略。默认情况下Referer会带完整URL，可能泄露敏感路径信息。',
            'Permissions-Policy可以禁用一些浏览器功能，比如camera=(), microphone=(), geolocation=()。如果你的页面不需要这些功能就关掉。',
            'Cookie的安全属性设置：HttpOnly=true防XSS窃取、Secure=true仅HTTPS传输、SameSite=Strict/Lax防CSRF、Path=/限制作用域。',
            'SameSite属性是防CSRF的新武器。Strict模式最严格但会影响正常导航，Lax模式允许顶级导航携带cookie，是目前推荐的默认值。',
            'Session固定攻击的防护：登录成功后一定要regenerate session id。否则攻击者可以先设置一个session id，等用户登录后就拿到了有效的session。',
            'CSRF Token的实现要点：token要是不可预测的、每次请求都要验证、token要与用户session绑定、token要有过期时间。',
            'SQL注入防护的第一原则：永远不要拼接SQL字符串。无论用什么语言什么框架，参数化查询（prepared statement）是必须的。',
            'ORM框架也不是万能的。Hibernate的HQL、MyBatis的${}语法、Sequelize的sequelize.literal()——这些都可能引入注入风险。',
            'XSS的分类：反射型（通过URL参数触发）、存储型（存在数据库里每次读取都触发）、DOM型（在前端JavaScript里触发）。三种的防御策略略有不同。',
            'DOMPurify是前端防XSS的好帮手。它能把HTML中的恶意标签和属性过滤掉，同时保留合法的内容。记得每次渲染用户输入都过一遍。',
            'SSRF（服务端请求伪造）是这几年越来越受重视的漏洞类型。核心问题是：服务器代用户发起的请求，目标地址可以被用户控制。',
            '文件上传安全是Web安全的老大难问题。MIME Type不可信（可以伪造）、文件扩展名不可信（可以双扩展名欺骗）、文件内容才是真相。',
            '路径遍历攻击（../）的防护：不要相信用户输入的路径、用realpath()规范化路径、把用户限制在特定目录下、禁止..字符。',
            '命令注入是比SQL注入更危险的漏洞类型。因为命令注入可以直接执行系统命令。os.system()、subprocess(shell=True)这些都是危险信号。',
            '反序列化漏洞在Java（Python pickle、PHP unserialize、YAML load）里特别危险。原则上不要反序列化不受信任的数据来源。',
            'XML外部实体注入（XXE）如果解析XML的话一定要关掉外部实体的解析。SAXParser设置feature禁止DTD，这是最基本的防护。',
            'LDAP注入的转义：特殊字符包括 * ( ) \\ NUL / 。在拼接LDAP filter之前要把用户输入里的这些字符做转义处理。',
            'NoSQL注入不像SQL注入那么有名，但同样危险。MongoDB的$where操作符、$ne操作符都可能被利用来绕过认证。',
            '重定向注入（Open Redirect）的危害常被低估。攻击者可以构造一个看起来像你网站的URL，实际上跳转到钓鱼网站。',
            'HTTP响应拆分（CRLF Injection）可以在HTTP头里注入\\r\\n，从而添加任意的响应头或body。用户输入出现在HTTP头里时要特别小心。',
            '竞争条件（Race Condition）在Web应用中相对少见，但在支付、转账等涉及金钱的场景里一旦出现后果严重。用数据库锁来保护。',
            'IDOR（不安全的直接对象引用）是API安全里最常见的漏洞之一。访问/api/users/123时，当前用户是否有权限查看用户123的数据？',
            '暴力破解的防护：账号锁定策略（如5次失败锁定30分钟）、验证码（图形/滑块/短信）、速率限制（同一IP每分钟最多尝试几次）。',
            '密码存储的正确姿势：绝不用明文、绝不用可逆加密（MD5/SHA1也不行）、用bcrypt/scrypt/argon2做单向哈希、加盐（salt）。',
            '双因素认证（2FA/MFA）强烈推荐。TOTP（基于时间的一次性密码）实现简单成本低，Google Authenticator/Authy都支持。',
            '安全事件响应的关键是快。检测->分析->遏制->根除->恢复->复盘，每个环节都有明确的时间目标和责任人。',
            '数据加密的两个维度：传输加密（TLS/SSL）和存储加密（AES）。两个都要做，缺一不可。AES推荐用GCM模式，自带完整性校验。',
            '密钥管理的黄金法则：密钥本身的安全比加密算法更重要。用专业的密钥管理服务（Vault/KMS），不要把密钥写进代码或配置文件。',
            '容器安全的几个要点：基础镜像要精简、不要用root运行、不要用--privileged、限制capabilities、只读文件系统、资源限制。',
            'Kubernetes安全是个大话题。NetworkPolicy隔离Pod间通信、RBAC限制权限、PodSecurityPolicy/Pod Security Standards、镜像扫描、Secret加密。',
            'DevSecOps就是把安全左移到开发阶段。在CI/CD流水线里集成SAST/DAST/依赖扫描/镜像扫描，让安全检查成为每次部署的标准流程。',
            'API安全是现在的重中之重。因为前后端分离、微服务、移动端的普及，API成为了系统的核心接口。认证、授权、限流、日志一个都不能少。',
            'Rate Limiting（速率限制）是保护API的基本手段。令牌桶、滑动窗口、漏桶算法各有适用场景。Nginx的limit_req_zone配置起来很简单。',
            '熔断器和降级是分布式系统的标准配置。当某个服务不可达或响应过慢时，及时切断调用并返回降级后的结果，防止雪崩。',
            '灰度发布（金丝雀部署）是降低发布风险的利器。先让一小部分用户使用新版本，观察无误后再逐步扩大范围。',
            '监控和告警是安全运营的基础。你要知道：谁在什么时候访问了什么、有没有异常行为、系统资源是否正常。Prometheus + Grafana 是经典搭配。',
            '日志的三大要素：完整性（不被篡改）、可用性（需要时能查到）、保密性（敏感数据脱敏）。满足这三点才叫合格的日志系统。',
            '备份的3-2-1原则：至少3份副本、2种不同的存储介质、1份异地。还要定期做恢复演练——备份不恢复等于没备份。',
            '应急响应预案要写下来并且定期演练。纸上谈兵没用，真正出事的时候能按预案执行的团队才能把损失降到最低。',
            '安全意识培训不是走过场。钓鱼邮件模拟测试、安全政策宣贯、案例分析——要让每个员工都知道安全是每个人的责任。',
            '供应链安全越来越重要了。你的依赖包是谁写的？有没有后门？最近有没有漏洞公告？这些都要持续关注。',
            '合规不是可选的而是必须的。等保、GDPR、HIPAA、PCI-DSS——根据你的业务所在地和行业，找到适用的法规并遵守它。',
            '安全没有终点。今天修补的漏洞明天可能出现新的变体。保持学习、保持警惕、保持谦逊——这才是安全从业者的常态。',
            '去年帮一家市属国企做等保三级测评，整个过程历时三个月。说实话，等保2.0的标准比1.0细致太多了，光是差距分析报告就写了八十多页。',
        ]

    def get_hook_lines(self):
        return [
            '这个问题你一定遇到过...',
            '说一个扎心的真相...',
            '先问自己一个问题...',
            '我见过太多团队在这里翻车了...',
            '别等出了事再后悔...',
            '这个坑我踩过，花了3天才爬出来...',
            '如果你在做Agent相关产品，这条必须看完...',
            '上周又有一家公司因为这个问题上了新闻...',
            '前两天在群里看到有人在讨论这个...',
            '说实话这个问题困扰了我很久...',
            '分享一个我们团队血的教训...',
            '这个方案我们用了大半年了，效果不错...',
            '帮客户做审计的时候发现的...',
            '网上资料很多但都没说到点子上...',
            '记录一下上周五晚上的事故...',
            '看完这条能帮你省不少冤枉路...',
        ]

    def generate_content(self, title, summary):
        langchain_versions = ['0.1.15', '0.1.17', '0.1.19', '0.2.0', '0.2.1']
        python_versions = ['3.10', '3.11', '3.12']
        models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet']

        tools = [
            ('query_database', 'query database for user info'),
            ('search_documents', 'search document library'),
            ('send_email', 'send notification email'),
            ('read_file', 'read specified file content'),
            ('execute_command', 'execute system command'),
            ('call_api', 'call external API'),
            ('write_to_file', 'write content to file'),
            ('validate_input', 'validate input legitimacy'),
        ]

        tool_name, tool_desc = random.choice(tools)
        langchain_ver = random.choice(langchain_versions)
        python_ver = random.choice(python_versions)
        model_name = random.choice(models)

        error_messages = [
            'Tool execution failed: invalid parameter type',
            'SQL syntax error near...',
            'Command not found: rm -rf',
            'FileNotFoundError: ../../../etc/passwd',
            'Timeout exceeded: operation took >30s',
            'Connection refused to database',
            'Authentication failed: invalid token',
            'Permission denied: insufficient privileges',
        ]

        issues = [
            'Tool call result is wrong',
            'Agent fell into infinite loop',
            'Output contains unwanted info',
            'Occasional timeout',
            'Memory usage spike caused OOM',
            'State inconsistency under concurrency',
            'Strange errors in logs',
        ]

        malicious_inputs = [
            'malicious prompt',
            'text with SQL injection features',
            'overlong string',
            'special characters',
            'XSS payload',
            'path traversal sequence',
            'command injection fragment',
        ]

        results = [
            "db.query(input)",
            "doc_search.search(input)",
            "smtp.send(input)",
            "open(input).read()",
            "os.popen(input).read()",
            "requests.post(url, json=input)",
            "subprocess.run(input, shell=True)",
            "eval(input)",
        ]

        content = """## Background

{summary}

## Investigation Process

Environment: LangChain `{langchain_ver}`, Python `{python_ver}`, model: OpenAI `{model_name}`.

Issue: **{issue}**.

```python
# Problem code looks like this
from langchain.tools import tool
from langchain.agents import create_openai_functions_agent

@tool
def {tool_name}(input: str):
    f'''{tool_desc}'''
    # No parameter validation here...
    result = {result}
    return result
```

## Root Cause Analysis

Later we found that the user input contained **{malicious_input}**. Even after LLM processing, the output still carried the original malicious content.

```
# Log fragment
[ERROR] {error_message}
```

## Solution

After some effort, we adopted the following approach:

### 1. Input Layer Validation

```python
import re
from pydantic import BaseModel, validator

class ToolInput(BaseModel):
    query: str

    @validator('query')
    def validate_no_injection(cls, v):
        dangerous_patterns = [
            r';\\\\s*drop\\\\s+table',
            r'\\\\$\\\\{{.*\\\\}}',
            r'__import__',
            r'os\\\\.system',
            r'subprocess',
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError(f'Security risk detected: {{pattern}}')
        return v.strip()[:500]  # Limit length
```

### 2. Output Layer Filtering

```python
def sanitize_llm_output(text: str) -> str:
    text = re.sub(r'```[\\\\s\\\\S]*?```', '[CODE_BLOCK_REMOVED]', text)
    from html import escape
    text = escape(text)
    return text
```

### 3. Least Privilege

```python
# Dockerfile example
FROM python:{python_ver}-slim

RUN useradd -m appuser
USER appuser
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

### 4. Audit Logging

```python
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

def log_agent_decision(agent_id: str, decision: dict):
    log_entry = {{
        'timestamp': datetime.now().isoformat(),
        'agent_id': agent_id,
        'decision_type': decision.get('type'),
        'tool_called': decision.get('tool'),
        'input_hash': hash(decision.get('input', '')) % 10000,
        'output_length': len(decision.get('output', '')),
        'confidence_score': decision.get('confidence', 0),
    }}
    logger.info(json.dumps(log_entry))
```

## Lessons Learned

This incident taught us a valuable lesson:

1. **Never trust LLM output**: Even the most advanced model can produce unexpected content
2. **Multi-layer defense is essential**: Input validation + Output filtering + Permission control + Audit logging
3. **Regular security audits**: Don't wait until something goes wrong
4. **Team security awareness training**: Every developer should have basic security literacy

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [LangChain Security Best Practices](https://python.langchain.com/docs/security/)
- [AI/ML Security Guidelines](https://www.owasp.org/project-list/)

---

**Tags**: #{tag1} #{tag2}

*Originally posted on [Agent Security Community](https://example.com), please cite the source.*
""".format(
            summary=summary,
            langchain_ver=langchain_ver,
            python_ver=python_ver,
            model_name=model_name,
            issue=random.choice(issues),
            tool_name=tool_name,
            tool_desc=tool_desc,
            result=random.choice(results),
            malicious_input=random.choice(malicious_inputs),
            error_message=random.choice(error_messages),
            tag1=random.choice(['Agent Security', 'Prompt Injection', 'LLM Protection', 'DevSecOps']),
            tag2=random.choice(['Docker', 'Kubernetes', 'Python', 'LangChain']),
        )
        return content
