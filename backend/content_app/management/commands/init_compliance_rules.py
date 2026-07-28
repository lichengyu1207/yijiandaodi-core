from django.core.management.base import BaseCommand
from content_app.unified_scan_models import ComplianceRule


class Command(BaseCommand):
    help = '初始化全品类内容安全检测合规规则库（覆盖6+法规体系）'

    def handle(self, *args, **options):
        rules_data = [
            # ===== 网络安全法 (Cybersecurity Law) =====
            {
                'rule_code': 'CSL-001', 'rule_type': 'cybersecurity_law',
                'article_reference': '第21条', 'severity': 'must',
                'title': '网络日志留存要求',
                'description': '网络运营者应当按照网络安全等级保护制度的要求，采取技术措施和其他必要措施，保障网络安全、稳定运行，防范网络违法犯罪活动。应当留存网络日志不少于六个月。',
                'detection_pattern': {'keywords': ['日志', '留存', '记录', '审计'], 'regex_patterns': [], 'semantic_features': ['缺少日志记录说明', '未提及数据留存期限']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source'],
                'penalty_description': '由有关主管部门责令改正，给予警告；拒不改正或者导致危害网络安全等后果的，处一万元以上十万元以下罚款。',
            },
            {
                'rule_code': 'CSL-002', 'rule_type': 'cybersecurity_law',
                'article_reference': '第24条', 'severity': 'must',
                'title': '用户实名制要求',
                'description': '网络运营者为用户办理入网、提供信息发布等服务，在与用户签订协议或者确认提供服务时，应当要求用户提供真实身份信息。用户不提供真实身份信息的，网络运营者不得为其提供相关服务。',
                'detection_pattern': {'keywords': ['实名制', '真实身份', '身份证', '手机号验证', '实名认证'], 'regex_patterns': [r'1[3-9]\d{9}'], 'semantic_features': ['涉及用户注册但无身份验证流程']},
                'applicable_categories': ['enterprise_content', 'social_content', 'api_response', 'email_comm'],
                'penalty_description': '由公安机关责令限期改正，可以并处一万元以上十万元以下罚款；情节严重的，处十五日以下拘留，并处五万元以上五十万元以下罚款。',
            },
            {
                'rule_code': 'CSL-003', 'rule_type': 'cybersecurity_law',
                'article_reference': '第27条', 'severity': 'must',
                'title': '违法有害信息处置',
                'description': '网络运营者发现法律、行政法规禁止发布或者传输的信息的，应当立即停止传输该信息，采取消除等处置措施，防止信息扩散，保存有关记录，并向有关主管部门报告。',
                'detection_pattern': {'keywords': ['暴恐', '色情', '赌博', '毒品', '违禁', '非法'], 'regex_patterns': [], 'semantic_features': ['包含违法违禁内容特征']},
                'applicable_categories': ['general_text', 'social_content', 'email_comm', 'video_media', 'image_media'],
                'penalty_description': '由有关主管部门责令改正，给予警告；没收违法所得；违法所得五万元以上的，可并处违法所得一倍以上十倍以下罚款。',
            },
            {
                'rule_code': 'CSL-004', 'rule_type': 'cybersecurity_law',
                'article_reference': '第41条', 'severity': 'must',
                'title': '个人信息与重要数据出境安全评估',
                'description': '关键信息基础设施的运营者在中华人民共和国境内运营中收集和产生的个人信息和重要数据应当在境内存储。因业务需要，确需向境外提供的，应当进行安全评估。',
                'detection_pattern': {'keywords': ['跨境传输', '境外服务器', '海外部署', '数据出境', 'GDPR', '国际传输'], 'regex_patterns': [], 'semantic_features': ['涉及跨国数据传输但无安全评估说明']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source', 'financial_statement'],
                'penalty_description': '由有关主管部门责令改正，给予警告，没收违法所得，处五万元以上五十万元以下罚款；情节严重的，可以并处五十万元以上五百万元以下罚款。',
            },

            # ===== 数据安全法 (Data Security Law) =====
            {
                'rule_code': 'DSL-001', 'rule_type': 'data_security_law',
                'article_reference': '第21条', 'severity': 'must',
                'title': '数据分类分级保护',
                'description': '国家建立数据分类分级保护制度。根据数据在经济社会发展中的重要程度，以及一旦遭到篡改、破坏、泄露或者非法获取后对国家安全、公共利益或者个人、组织合法权益造成的危害程度，将数据分为一般、重要、核心数据。',
                'detection_pattern': {'keywords': ['数据分级', '敏感度', 'L1', 'L2', 'L3', 'L4', '分类分级', '数据资产盘点'], 'regex_patterns': [], 'semantic_features': ['处理大量个人或企业数据但未体现分类分级机制']},
                'applicable_categories': ['enterprise_content', 'financial_statement', 'medical_report', 'api_response', 'code_source'],
                'penalty_description': '由有关主管部门责令改正，给予警告，可以并处五万元以上五十万元以下罚款；拒不改正或者造成严重后果的，处五十万元以上二百万元以下罚款。',
            },
            {
                'rule_code': 'DSL-002', 'rule_type': 'data_security_law',
                'article_reference': '第27条', 'severity': 'must',
                'title': '重要数据识别与保护',
                'description': '开展数据处理活动应当加强风险监测，发现数据安全缺陷、漏洞等风险时，应当立即采取补救措施；发生数据安全事件时，应当立即采取处置措施，按照规定及时告知用户并向有关主管部门报告。',
                'detection_pattern': {'keywords': ['重要数据', '核心数据', '数据安全事件', '漏洞', '应急响应', '数据泄露通知'], 'regex_patterns': [], 'semantic_features': ['包含敏感商业/财务/医疗数据但缺乏保护措施描述']},
                'applicable_categories': ['enterprise_content', 'financial_statement', 'medical_report', 'legal_document'],
                'penalty_description': '对直接负责的主管人员和其他直接责任人员可以处一万元以上十万元以下罚款。',
            },
            {
                'rule_code': 'DSL-003', 'rule_type': 'data_security_law',
                'article_reference': '第35条', 'severity': 'should',
                'title': '数据交易安全管理',
                'description': '从事数据交易中介服务的机构提供服务，应当要求数据提供方说明数据来源，审核交易双方的身份，并留存审核、交易记录。',
                'detection_pattern': {'keywords': ['数据交易', '数据买卖', '数据共享协议', '第三方数据', '数据采购'], 'regex_patterns': [], 'semantic_features': ['涉及数据交换/买卖但未说明来源合法性']},
                'applicable_categories': ['enterprise_content', 'api_response', 'financial_statement'],
                'penalty_description': '由有关主管部门没收违法所得，处违法所得一倍以上十倍以下罚款；没有违法所得或者违法所得不足十万元的，处十万元以上一百万元以下罚款。',
            },

            # ===== 个人信息保护法 (PIPL) =====
            {
                'rule_code': 'PIPL-001', 'rule_type': 'pipl',
                'article_reference': '第5-7条', 'severity': 'must',
                'title': '告知同意原则 - 处理前告知',
                'description': '处理个人信息应当在事先充分告知的前提下取得个人同意。不得通过误导、欺诈、胁迫等方式取得个人同意。处理目的、方式、范围发生变更的，应当重新取得个人同意。',
                'detection_pattern': {'keywords': ['隐私政策', '用户协议', '同意书', '授权书', '知情同意', 'opt-in', 'opt-out'], 'regex_patterns': [], 'semantic_features': ['收集个人信息但未提及隐私声明或用户授权']},
                'applicable_categories': ['enterprise_content', 'api_response', 'email_comm', 'social_content', 'code_source'],
                'penalty_description': '由履行个人信息保护职责的部门责令改正，给予警告，没收违法所得，对违法处理个人信息的应用程序，责令暂停或者停止提供服务；拒不改正的，并处一百万元以下罚款；情节严重的，并处五千万元以下或者上一年度营业额百分之五以下罚款。',
            },
            {
                'rule_code': 'PIPL-002', 'rule_type': 'pipl',
                'article_reference': '第13条', 'severity': 'must',
                'title': '最小必要原则',
                'description': '处理个人信息应当具有明确、合理的目的，并应当与处理目的直接相关，采取对个人权益影响最小的方式。收集个人信息限于实现处理目的的最小范围，不得过度收集个人信息。',
                'detection_pattern': {'keywords': ['最小必要', '最小化', '过度收集', '非必要信息', '精简采集'], 'regex_patterns': [], 'semantic_features': ['收集了明显超出业务需要的个人数据字段']},
                'applicable_categories': ['enterprise_content', 'api_response', 'social_content', 'medical_report', 'email_comm'],
                'penalty_description': '同PIPL-001，最高可处五千万元或上一年度营业额百分之五罚款。',
            },
            {
                'rule_code': 'PIPL-003', 'rule_type': 'pipl',
                'article_reference': '第14-15条', 'severity': 'must',
                'title': '目的限制与存储限制',
                'description': '个人信息的处理目的、处理方式和处理的个人信息种类发生变更的，应当重新取得个人同意。除法律、行政法规规定的保存期限未届满或者删除个人信息从技术上难以实现等情形外，保存期限应当为实现处理目的所必要的最短时间。',
                'detection_pattern': {'keywords': ['保留期限', '数据保留', '删除策略', '数据生命周期', '过期清理', '自动删除'], 'regex_patterns': [], 'semantic_features': ['长期存储个人数据但未说明保留期限或删除机制']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source', 'database'],
                'penalty_description': '同PIPL-001，最高可处五千万元或上一年度营业额百分之五罚款。',
            },
            {
                'rule_code': 'PIPL-004', 'rule_type': 'pipl',
                'article_reference': '第28条', 'severity': 'must',
                'title': '敏感个人信息特别保护',
                'description': '只有在具有特定的目的和充分的必要性，并采取严格保护措施的情形下，方可处理敏感个人信息。处理敏感个人信息应当取得个人的单独同意；向境外提供敏感个人信息的，应当向个人告知境外接收方的名称或者姓名、联系方式、处理目的等。',
                'detection_pattern': {'keywords': ['生物识别', '宗教信仰', '特定身份', '医疗健康', '金融账户', '行踪轨迹', '未成年人信息', '敏感信息'], 'regex_patterns': [r'身份证|护照|银行卡|病历|基因|指纹|人脸'], 'semantic_features': ['包含高度敏感的个人隐私数据']},
                'applicable_categories': ['medical_report', 'financial_statement', 'enterprise_content', 'api_response', 'social_content'],
                'penalty_description': '违反敏感个人信息保护规定的，从重处罚，最高可处五千万元或上一年度营业额百分之五罚款，并可责令暂停业务、停业整顿。',
            },
            {
                'rule_code': 'PIPL-005', 'rule_type': 'pipl',
                'article_reference': '第38-39条', 'severity': 'should',
                'title': '个人信息主体权利保障',
                'description': '个人有权查阅、复制其个人信息；发现信息有错误的，有权提出更正补充要求。个人请求查阅、复制其个人信息的，个人信息处理者应当及时提供。个人请求删除其个人信息的，符合法定情形的，个人信息处理者应当主动删除。',
                'detection_pattern': {'keywords': ['撤回同意', '删除账户', '导出数据', '访问权', '被遗忘权', '更正权', '注销账号'], 'regex_patterns': [], 'semantic_features': ['涉及用户数据管理但未提供用户查询/删除/更正渠道']},
                'applicable_categories': ['enterprise_content', 'api_response', 'social_content', 'code_source'],
                'penalty_description': '拒不履行个人信息主体权利的，由监管部门责令改正，给予警告，拒不改正的，处一百万元以下罚款。',
            },

            # ===== 等保2.0三级 (DJB Level 3) =====
            {
                'rule_code': 'DJB3-001', 'rule_type': 'djb_level3',
                'article_reference': '8.1.3 身份鉴别', 'severity': 'must',
                'title': '强身份鉴别机制',
                'description': '应采用口令、密码技术、生物技术等两种或两种以上组合的鉴别技术对用户进行身份鉴别，且其中一种鉴别技术至少应使用密码技术来实现。',
                'detection_pattern': {'keywords': ['双因素认证', '2FA', 'MFA', '多因素认证', '短信验证码', 'TOTP', '动态令牌', '生物识别'], 'regex_patterns': [], 'semantic_features': ['涉及系统认证但仅使用单一认证方式']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source'],
                'penalty_description': '不符合等保2.0三级要求的，公安机关网络安全保卫部门出具整改通知书，逾期不改的予以行政处罚。',
            },
            {
                'rule_code': 'DJB3-002', 'rule_type': 'djb_level3',
                'article_reference': '8.1.4 访问控制', 'severity': 'must',
                'title': '细粒度访问控制',
                'description': '应依据安全策略严格控制用户对系统功能的访问。应授予不同账户为完成各自承担任务所需的最小权限，并实现不同主体的权限隔离。',
                'detection_pattern': {'keywords': ['RBAC', '权限管理', '角色控制', '最小权限', 'ACL', '访问控制列表', '鉴权', '授权'], 'regex_patterns': [], 'semantic_features': ['多用户系统但未体现权限隔离或角色管理']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source'],
                'penalty_description': '同DJB3-001，需在规定期限内完成整改并通过测评。',
            },
            {
                'rule_code': 'DJB3-003', 'rule_type': 'djb_level3',
                'article_reference': '8.1.5 安全审计', 'severity': 'must',
                'title': '全面安全审计日志',
                'description': '应启用安全审计功能，审计覆盖到每个用户，对重要的用户行为和重要安全事件进行审计。审计记录应包括事件的日期和时间、用户、事件类型、事件是否成功及其他与审计相关的信息。',
                'detection_pattern': {'keywords': ['审计日志', '操作日志', 'access_log', 'audit trail', '行为追踪', '安全事件记录'], 'regex_patterns': [], 'semantic_features': ['企业级应用但缺少审计日志设计']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source'],
                'penalty_description': '同DJB3-001，审计缺失是等保测评的高频扣分项。',
            },
            {
                'rule_code': 'DJB3-004', 'rule_type': 'djb_level3',
                'article_reference': '8.1.7 入侵防范', 'severity': 'must',
                'title': '入侵检测与防御',
                'description': '应遵循最小安装的原则，仅安装需要的组件和应用程序。应通过设定终端接入方式或网络地址范围对通过网络进行管理的管理终端进行限制。应能检测到对重要节点进行入侵的行为并在发生严重入侵事件时提供报警。',
                'detection_pattern': {'keywords': ['WAF', 'IDS', 'IPS', '防火墙', '入侵检测', '异常流量', '防DDoS', 'Web应用防护'], 'regex_patterns': [], 'semantic_features': ['对外服务但未见安全防护措施说明']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source', 'video_media'],
                'penalty_description': '同DJB3-001，入侵防范能力是三级等保的核心要求之一。',
            },
            {
                'rule_code': 'DJB3-005', 'rule_type': 'djb_level3',
                'article_reference': '8.2.1 数据完整性', 'severity': 'must',
                'title': '数据完整性与保密性保护',
                'description': '应采用校验技术或密码技术保证重要数据在传输过程中的完整性。应采用校验技术或密码技术保证重要数据在存储过程中的完整性。应采用密码技术保证重要数据的机密性。',
                'detection_pattern': {'keywords': ['加密传输', 'HTTPS', 'TLS', 'SSL', 'AES', 'RSA', 'SHA256', '哈希校验', '端到端加密', '数据加密'], 'regex_patterns': [], 'semantic_features': ['传输敏感数据但未使用加密通道']},
                'applicable_categories': ['enterprise_content', 'api_response', 'code_source', 'financial_statement', 'medical_report'],
                'penalty_description': '同DJB3-001，数据加密是三级等保的基本要求。',
            },

            # ===== 广告法 (Advertising Law) =====
            {
                'rule_code': 'AD-001', 'rule_type': 'ad_law',
                'article_reference': '第9条', 'severity': 'must',
                'title': '极限词禁止使用',
                'description': '广告不得有下列情形：（三）使用"国家级""最高级""最佳"等用语；广告中涉及商品性能、功能、产地、用途、质量、价格、生产者、有效期限、允诺等或者对服务的内容、形式、质量、价格、允诺有表示的，应当准确、清楚、明白。',
                'detection_pattern': {'keywords': ['国家级', '最高级', '最佳', '第一', '唯一', '顶级', '极致', '100%', '彻底', '绝对', '永久', '根治', '全网最低', '史上最', '遥遥领先'], 'regex_patterns': [r'(最|第一|唯一|顶级|绝对|彻底|根治|永久|100%|全网).{0,6}(好|优|强|低|便宜|快|全|新|先进)'], 'semantic_features': ['使用绝对化/夸大宣传用语']},
                'applicable_categories': ['general_text', 'social_content', 'email_comm', 'image_media', 'video_media'],
                'penalty_description': '由市场监督管理部门责令停止发布广告，对广告主处二十万元以上一百万元以下的罚款，情节严重的，并可以吊销营业执照。',
            },
            {
                'rule_code': 'AD-002', 'rule_type': 'ad_law',
                'article_reference': '第4条', 'severity': 'must',
                'title': '虚假广告禁止',
                'description': '广告不得含有虚假或者引人误解的内容，不得欺骗、误导消费者。广告主应当对广告内容的真实性负责。',
                'detection_pattern': {'keywords': ['虚假宣传', '欺骗', '误导消费者', '夸大效果', '虚构数据', '伪造证明'], 'regex_patterns': [], 'semantic_features': ['效果承诺缺乏依据或使用模糊表述诱导消费']},
                'applicable_categories': ['general_text', 'social_content', 'email_comm', 'image_media', 'video_media'],
                'penalty_description': '广告费用三倍以上五倍以下的罚款，广告费用无法计算或者明显偏高的，处一百万元以上二百万元以下的罚款。',
            },
            {
                'rule_code': 'AD-003', 'rule_type': 'ad_law',
                'article_reference': '第17条', 'severity': 'should',
                'title': '比较广告合规性',
                'description': '广告在涉及比较时，不得贬低其他生产经营者的商品或者服务。专利产品或者方法应当在广告中标明专利号和专利种类。不得使用未授予专利权的谎称专利。',
                'detection_pattern': {'keywords': ['比.*好', '优于', '超过', '碾压', '吊打', '竞品对比', '专利', '专利号'], 'regex_patterns': [], 'semantic_features': ['贬低竞争对手或未经证实的对比声明']},
                'applicable_categories': ['general_text', 'social_content', 'email_comm', 'image_media', 'video_media'],
                'penalty_description': '由市场监督管理部门责令停止发布、处以罚款，给他人造成损害的，依法承担民事责任。',
            },

            # ===== 著作权法 (Copyright Law) =====
            {
                'rule_code': 'CR-001', 'rule_type': 'copyright_law',
                'article_reference': '第10条', 'severity': 'must',
                'title': '文字作品著作权保护',
                'description': '著作权法保护以文字形式表现的作品，包括小说、诗词、散文、论文等以文字形式表现的作品。剽窃他人作品的，应当根据情况，承担停止侵害、消除影响、赔礼道歉、赔偿损失等民事责任。',
                'detection_pattern': {'keywords': ['原创', '版权所有', '转载请注明', '侵权', '抄袭', '洗稿', '改写', '引用出处'], 'regex_patterns': [], 'semantic_features': ['文本与已知来源高度相似且未标注引用']},
                'applicable_categories': ['general_text', 'academic_paper', 'social_content', 'design_draft', 'email_comm'],
                'penalty_description': '应当根据情况，承担停止侵害、消除影响、赔礼道歉、赔偿损失等民事责任。侵犯著作权的诉讼时效为三年。',
            },
            {
                'rule_code': 'CR-002', 'rule_type': 'copyright_law',
                'article_reference': '第22条', 'severity': 'should',
                'title': '合理使用边界',
                'description': '合理使用必须满足条件：指明作者名称、作品名称；不影响该作品的正常使用；不得不合理地损害著作权人的合法权益。为介绍、评论某一作品或者说明某一问题，在作品中适当引用他人已经发表的作品属于合理使用。',
                'detection_pattern': {'keywords': ['引用', '参考', '摘录', '节选', '出处', '参考文献', ' bibliography', 'citation'], 'regex_patterns': [], 'semantic_features': ['大量引用他人作品但超出合理使用范围']},
                'applicable_categories': ['academic_paper', 'general_text', 'legal_document', 'design_draft'],
                'penalty_description': '超出合理使用范围的，构成侵权，需承担相应法律责任。',
            },
            {
                'rule_code': 'CR-003', 'rule_type': 'copyright_law',
                'article_reference': '第53条', 'severity': 'must',
                'title': 'AI生成内容版权归属',
                'description': 'AI生成的内容目前在中国司法实践中倾向于不被认定为著作权法意义上的作品。但如果AI生成内容中融入了大量人类创作元素，则可能获得部分保护。使用AI工具生成内容时应明确标注来源。',
                'detection_pattern': {'keywords': ['AI生成', 'ChatGPT', 'DeepSeek', 'Midjourney', '人工智能写作', '机器生成', '辅助创作'], 'regex_patterns': [], 'semantic_features': ['检测到AI生成特征但未标注AI参与']},
                'applicable_categories': ['general_text', 'academic_paper', 'design_draft', 'social_content', 'image_media'],
                'penalty_description': '如将AI生成内容冒充原创作品发表或用于商业用途，可能构成欺诈或不正当竞争。',
            },

            # ===== 学术规范 (Academic Integrity) =====
            {
                'rule_code': 'ACAD-001', 'rule_type': 'academic_integrity',
                'article_reference': '教育部《学位论文作假行为处理办法》第3条', 'severity': 'must',
                'title': '学位论文AI代写/代笔禁止',
                'description': '购买、出售学位论文或者组织学位论文买卖的，由他人代写、为他人代写学位论文或者组织学位论文代写的，属于学位论文作假行为。对于存在作假行为的，已授予学位的，依法撤销。',
                'detection_pattern': {'keywords': ['代写', '代笔', '枪手', '论文买卖', 'AI代写', '学术不端', '伪造数据', '篡改数据'], 'regex_patterns': [], 'semantic_features': ['学术论文呈现明显的AI生成模式或逻辑不一致']},
                'applicable_categories': ['academic_paper', 'general_text'],
                'penalty_description': '已经获得学位的，撤销学位，注销学位证书，取消学位申请资格或者撤销学位的处理决定向社会公布；在职人员还应当通报其所在单位。',
            },
            {
                'rule_code': 'ACAD-002', 'rule_type': 'academic_integrity',
                'article_reference': '《高等学校预防与处理学术不端行为办法》第6条', 'severity': 'must',
                'title': '抄袭与不当引用',
                'description': '剽窃、抄袭、侵占他人学术成果，或伪造科研数据、资料、文献、注释，或者捏造事实、编造虚假成果等行为均属学术不端。引用他人成果未注明出处的，视情节轻重认定为抄袭或学术失范。',
                'detection_pattern': {'keywords': ['抄袭', '剽窃', '自我抄袭', '重复发表', '重复率', '查重', '相似度', 'Turnitin'], 'regex_patterns': [], 'semantic_features': ['大段文字与已发表文献高度相似且无引用标注']},
                'applicable_categories': ['academic_paper', 'general_text'],
                'penalty_description': '情节较轻的，给予警告、记过处分；情节严重的，给予留校察看、开除学籍处分，取消学位申请资格、撤销学位。',
            },
            {
                'rule_code': 'ACAD-003', 'rule_type': 'academic_integrity',
                'article_reference': 'GB/T 7714 信息与文献 参考文献著录规则', 'severity': 'should',
                'title': '引用规范格式要求',
                'description': '学术文献中的引文应以适当方式注明原始出处。著录项目应包括主要责任者、题名项、出版项、获取和访问路径等。格式应符合GB/T 7714国家标准。',
                'detection_pattern': {'keywords': ['参考文献', 'References', 'Bibliography', '引用格式', '著录', '[1]', '(Author, Year)', 'doi:'], 'regex_patterns': [r'\[\d+\]|\(\w+,\s*\d{4}\)|doi:|https?://'], 'semantic_features': ['学术文档但缺少规范的参考文献列表或引用格式不规范']},
                'applicable_categories': ['academic_paper'],
                'penalty_description': '引用不规范可能被认定为学术失范，影响论文评审结果和学术声誉。',
            },

            # ===== 金融监管规定 (Financial Regulation) =====
            {
                'rule_code': 'FIN-001', 'rule_type': 'financial_regulation',
                'article_reference': '《会计法》第9条', 'severity': 'must',
                'title': '财务数据真实性要求',
                'description': '各单位必须根据实际发生的经济业务事项进行会计核算，填制会计凭证，登记会计账簿，编制财务会计报告。任何单位不得以虚假的经济业务事项或者资料进行会计核算。',
                'detection_pattern': {'keywords': ['虚增收入', '隐瞒利润', '虚列成本', '粉饰报表', '财务造假', '盈余管理', '账外账', '小金库'], 'regex_patterns': [], 'semantic_features': ['财务数据存在逻辑矛盾或异常偏离行业均值']},
                'applicable_categories': ['financial_statement', 'enterprise_content'],
                'penalty_description': '由县级以上人民政府财政部门责令限期改正，可以对单位并处三千元以上五万元以下的罚款；对其直接负责的主管人员和其他直接责任人员，可以处二千元以上二万元以下的罚款；属于国家工作人员的，还应当依法给予行政处分。',
            },
            {
                'rule_code': 'FIN-002', 'rule_type': 'financial_regulation',
                'article_reference': '《证券法》第78条', 'severity': 'must',
                'title': '信息披露真实性',
                'description': '信息披露义务人披露的信息，应当真实、准确、完整，简明清晰，通俗易懂，不得有虚假记载、误导性陈述或者重大遗漏。',
                'detection_pattern': {'keywords': ['重大遗漏', '误导性陈述', '虚假记载', '内幕信息', '未披露', '延迟披露', '选择性披露'], 'regex_patterns': [], 'semantic_features': ['公开披露文件中存在矛盾或可疑数据点']},
                'applicable_categories': ['financial_statement', 'enterprise_content', 'legal_document'],
                'penalty_description': '由中国证监会责令改正，给予警告，并处以三十万元以上六十万元以下的罚款。对直接负责的主管人员和其他直接责任人员给予警告，并处以三万元以上三十万元以下的罚款。',
            },
            {
                'rule_code': 'FIN-003', 'rule_type': 'financial_regulation',
                'article_reference': '《反洗钱法》第16条', 'severity': 'must',
                'title': '客户身份识别与大额交易报告',
                'description': '金融机构应当按照规定建立客户身份识别制度。金融机构办理单笔交易或在规定期限内的累计交易超过规定金额时，应当向中国反洗钱监测分析中心报告。',
                'detection_pattern': {'keywords': ['KYC', '了解你的客户', 'AML', '反洗钱', '大额交易报告', '可疑交易', '受益所有人', 'UBO'], 'regex_patterns': [], 'semantic_features': ['金融机构文档中缺少客户身份识别或交易监控流程']},
                'applicable_categories': ['financial_statement', 'enterprise_content', 'api_response'],
                'penalty_description': '由国务院反洗钱行政主管部门或者其授权的设区的市一级以上派出机构责令限期改正；情节严重的，建议有关金融监督管理机构依法责令金融机构对直接负责的董事、高级管理人员和其他直接责任人员给予纪律处分。',
            },

            # ===== 医疗行业规定 (Medical Regulation) =====
            {
                'rule_code': 'MED-001', 'rule_type': 'medical_regulation',
                'article_reference': '《医疗机构管理条例》第28条', 'severity': 'must',
                'title': '医疗文书真实性',
                'description': '医疗机构不得使用非卫生技术人员从事医疗卫生技术工作。医疗机构应当加强对医疗文书的管理，确保病历、处方、检查报告等医疗文书的真实性和准确性。',
                'detection_pattern': {'keywords': ['伪造病历', '篡改医嘱', '虚假诊断', '挂床住院', '过度医疗', '分解处方', '医保诈骗'], 'regex_patterns': [], 'semantic_features': ['医疗文书存在医学常识错误或逻辑矛盾']},
                'applicable_categories': ['medical_report', 'enterprise_content'],
                'penalty_description': '由县级以上人民政府卫生行政部门责令限期改正，并可处以5000元以下的罚款；情节严重的，吊销其《医疗机构执业许可证》。',
            },
            {
                'rule_code': 'MED-002', 'rule_type': 'medical_regulation',
                'article_reference': '《基本医疗卫生与健康促进法》第101条', 'severity': 'must',
                'title': '患者隐私保护',
                'description': '医疗卫生机构、医学教学科研机构应当采取措施保障患者的隐私和个人信息安全。任何组织或者个人不得非法收集、使用、加工、传输患者个人健康信息，不得非法买卖、提供或者公开患者个人健康信息。',
                'detection_pattern': {'keywords': ['患者隐私', 'HIPAA', '健康档案', '电子病历', '脱敏', '匿名化', '知情同意书', 'HIT'], 'regex_patterns': [r'\d{15,19}|(张|王|李|刘|陈)\S{1,3}(先生|女士|病人|患者)'], 'semantic_features': ['包含患者个人信息但未体现隐私保护措施']},
                'applicable_categories': ['medical_report', 'enterprise_content', 'api_response'],
                'penalty_description': '由卫生健康主管部门责令改正，给予警告，没收违法所得，并处违法所得一倍以上五倍以下罚款；违法所得不足十万元的，按十万元计算；情节严重的，可暂停执业活动或吊销许可证。',
            },
            {
                'rule_code': 'MED-003', 'rule_type': 'medical_regulation',
                'article_reference': '《互联网诊疗管理办法》第14条', 'severity': 'must',
                'title': 'AI辅助诊断责任界定',
                'description': '当使用人工智能技术辅助诊断时，医师应当对AI给出的诊断结论进行复核确认，并对最终诊断结论承担责任。不得完全依赖AI系统做出诊断决策。',
                'detection_pattern': {'keywords': ['AI辅助诊断', '智能阅片', 'CDSS', '临床决策支持', '影像AI', '病理AI', '复核', '人工确认'], 'regex_patterns': [], 'semantic_features': ['医疗报告中AI痕迹明显但缺少医生复核确认环节']},
                'applicable_categories': ['medical_report', 'video_media', 'image_media'],
                'penalty_description': '由卫生健康行政部门责令改正，给予警告；造成严重后果的，对直接责任人依法给予处分；构成犯罪的，依法追究刑事责任。',
            },
        ]

        created_count = 0
        updated_count = 0

        for rule_data in rules_data:
            rule, is_created = ComplianceRule.objects.update_or_create(
                rule_code=rule_data['rule_code'],
                defaults=rule_data,
            )
            if is_created:
                created_count += 1
            else:
                updated_count += 1

        total_active = ComplianceRule.objects.filter(is_active=True).count()
        self.stdout.write(
            self.style.SUCCESS(
                f'[OK] 合规规则库初始化完成: 新建 {created_count} 条, 更新 {updated_count} 条, '
                f'当前生效规则 {total_active} 条\n'
                f'  覆盖法规体系: 网络安全法(4) + 数据安全法(3) + PIPL(5) + 等保2.0三级(5) '
                f'+ 广告法(3) + 著作权法(3) + 学术规范(3) + 金融监管(3) + 医疗规定(3)'
            )
        )
