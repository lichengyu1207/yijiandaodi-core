import type { Article, ArticleListParams, ArticleListResponse } from '../types/article';
import { categories } from './categories';
import { authors } from './authors';

const industryInsightTitles = [
  '大多数人以为 AI 拼大模型，真正护城河在执行层',
  '大多数人跟风卷生成能力，内行早已布局安全底盘',
  '大多数人迷信云服务器，闲置算力才是未来主流',
  '大多数人觉得本地 AI 不安全，实则云端才是裸奔',
  '大多数人追 AI 表面智能，忽略底层风控才是刚需',
  '大多数人认为开源模型免费，隐性风险从没人提醒',
  '大多数人执着模型参数，真正差距在可控执行',
  '大多数人做 AI 只做前端，不懂后端底盘才是壁垒',
  '大多数人怕端侧算力不稳定，实则远超公有云性价比',
  '大多数人沉迷 AI 话术优化，看不懂合规才是长线',
  '大多数人觉得安全工具无用，出事才懂兜底多重要',
  '大多数人扎堆 C 端流量，政企蓝海无人深耕',
  '大多数人等完美再入局，高手都是先跑再迭代',
  '大多数人追求功能花哨，刚需永远是安全与隐私',
  '大多数人把 AI 当工具，聪明人早已做成生态底盘',
];

const aiSecurityPitfallTitles = [
  '我真心劝你别裸奔运行 AI 代码，大半暗藏高危漏洞',
  '我真心劝你别乱用免费 AI 工具，出事没人给你兜底',
  '我真心劝你别上传隐私数据，云端泄露防不胜防',
  '我真心劝你别直接照搬生成代码，沙箱逃逸风险极高',
  '我真心劝你别忽视 Agent 权限，越权隐患很难察觉',
  '我真心劝你别迷信大模型安全，本身无任何风控能力',
  '我真心劝你别忽略代码审计，小白最容易踩坑中招',
  '我真心劝你别跟风部署模型，底层漏洞没人排查',
  '我真心劝你别放弃本地推理，数据不出域才安心',
  '我真心劝你别轻视日志审计，合规取证全靠它',
  '我真心劝你别随便共享源码，隐私后门极易泄露',
  '我真心劝你别低估沙箱价值，隔离才是安全底线',
  '我真心劝你别只看 AI 效果，安全兜底才是核心',
  '我真心劝你别依赖单一防护，四层巡检才够稳妥',
  '我真心劝你别忽视节点风控，恶意节点会拖垮全网',
];

const computeCostTitles = [
  '同样跑 AI 推理，成本仅为传统阿里云的 1/20',
  '同样搭建算力集群，零服务器投入也能稳定运行',
  '同样做模型部署，端侧 P2P 算力碾压公有云定价',
  '同样批量 AI 任务，闲置设备直接省下九成费用',
  '同样 WebGPU 推理，本地运行彻底告别云算力扣费',
  '同样代码沙箱执行，分布式算力成本几乎可忽略',
  '同样企业级 AI 服务，P2P 架构重新定义成本底线',
  '同样大模型推理，闲时算力错峰使用省下大量开支',
  '同样节点组网，不用高配机器也能撑起海量任务',
  '同样 AI 安全检测，自研架构比商用工具便宜百倍',
  '同样在线 IDE 服务，端侧算力模式碾压传统云 IDE',
  '同样日志与监控，轻量化部署省去高额运维费用',
  '同样异构算力调度，普通电脑就能组成高性能集群',
  '同样长期运营 AI 平台，P2P 模式越做成本越低',
  '同样个人开发者入局，闲置算力让普通人零门槛起步',
];

const startupReviewTitles = [
  '闭门深耕 30 天，我彻底看透 AI 赛道底层逻辑',
  '跑通完整商业闭环，终于看懂算力行业未来格局',
  '抛开浮躁闭门打磨，摸透 AI 项目从 0 到变现路径',
  '深耕安全算力赛道多年，悟透普通人入局核心法则',
  '实测上百款 AI 工具，才懂执行层才是真正壁垒',
  '拆解 50 个同行玩法，终于避开 AI 创业所有弯路',
  '沉寂打磨一鉴到底架构，看懂行业内卷本质',
  '从跟风到沉淀，我放弃卷大模型死磕执行层',
  '亲自下场搭建 P2P 算力，踩坑后总结出落地真经',
  '复盘无数 AI 项目生死，成败只看底层底盘强弱',
  '闭关研究四层安全巡检，看透行业安全空白点',
  '放弃追求功能花哨，终于懂做产品重在刚需兜底',
  '沉淀私域与内容，摸清 AI 创业者长期复利逻辑',
  '实测网页 IDE 数十款，选出最适合二次开发的方案',
  '跳出流量焦虑，我找到了 AI 项目长期稳定打法',
];

const qaQaTitles = [
  '2026 入局 AI 安全算力赛道，普通人还有红利吗？',
  '闲置电脑挂机贡献算力，到底是风口还是割韭菜？',
  '浏览器本地跑大模型，真的能做到数据完全不出域？',
  '没有技术基础，还能入局 AI 执行层赛道吗？',
  '免费 AI 工具和付费平台，差距到底在哪里？',
  'P2P 算力网络靠谱吗，会不会存在安全隐患？',
  '做 AI 项目一定要自研大模型吗？内行说真话',
  '论文 AI 检测总翻车，根本问题到底出在哪？',
  '网页 IDE 能不能商用，有没有版权风险？',
  '个人搭建算力节点，真的能长期稳定收益吗？',
  'AI 安全有必要做四层巡检，普通防护不够用吗？',
  '前端 WebGPU 推理，未来会不会成为主流？',
  '中小团队做 AI 平台，该从大模型还是执行层切入？',
  '数据不上云本地运行，技术上真的能实现吗？',
  'AI 行业内卷严重，普通人怎么避开红海找蓝海？',
];

const beginnerGuideTitles = [
  '入局 AI 赛道必踩 5 个大坑，新手千万别盲目跟风',
  '用 AI 生成代码必避 5 个误区，避开少走一年弯路',
  '新手做 AI 副业常见陷阱，聪明人早早避开',
  '搭建 P2P 算力节点，一定要避开这 6 个错误',
  '选择 AI 安全工具的 4 个标准，新手照着选不踩坑',
  '零基础入门 AI 执行层，按这几步走就够了',
  '运营 AI 内容信息流，新手容易犯的 7 个低级错误',
  '部署开源 AI 项目必避坑，90% 人都栽在配置上',
  '保护个人隐私数据，使用 AI 必须遵守 5 条原则',
  '新手区分大模型与执行层，看懂这篇就入门',
  '入驻 AI 技能市场，一定要避开这些变现套路',
  '做私域引流 AI 用户，新手别踩这几个禁忌',
  '选用网页 IDE 开源项目，避坑指南一次性讲透',
  '普通人入局 AI 创业，千万别碰这三类项目',
  '学习 AI 安全风控，新手优先掌握这 5 个核心点',
];

const architectureInsideTitles = [
  '关于 AI 代码漏洞的底层真相，圈内人从不肯实话讲',
  '为什么大厂不敢开放浏览器推理，背后藏着隐情',
  'AI 执行层真正架构逻辑，行业很少有人摊开拆解',
  'P2P 算力做不大的根源，90% 团队都没找对核心',
  '四层安全巡检的设计逻辑，内行不愿公开的干货',
  '网页 IDE 商业化的底层套路，普通人很难看通透',
  '开源项目混栈的隐患，很多创业者都忽略了',
  '数据不出域真正实现方式，不是简单本地运行',
  '零信任权限管控的核心逻辑，拆解行业通用标准',
  '为什么多数 AI 平台不敢做安全赔付，真相很现实',
  'EIHM-P2P-CS 算力调度，底层设计逻辑一次性讲透',
  '区块链存证在 AI 审计中的价值，很少有人深挖',
  '前端 TF 分布式推理，大厂刻意低调的核心原因',
  '沙箱隔离多层防护逻辑，业内不会普及的干货',
  '一鉴到底七层架构拆解，同行看不懂的差异化壁垒',
];

const industryInsightSummaries = [
  '2026年了还在卷大模型的参数量？醒醒吧。真正的竞争早就不在模型层面了——GPT-4、Claude、Gemini 的能力差距正在快速缩小。真正的护城河在于：你的 AI 能不能**安全地、可控地、低成本地**执行落地。一鉴到底的 ASS 安全内核 + EIHM-P2P-CS 算力调度，就是冲着这个"执行层"缺口去的。',
  '全网都在卷 ChatGPT 套壳、卷 prompt 工程、卷 UI 交互，但你看那些真正拿到融资和订单的项目，哪个不是在底层安全架构上下了重注？数据不出域、沙箱隔离、权限管控——这些"看不见"的东西，才是 ToB 和政企客户愿意掏钱的理由。',
  '你那台吃灰的电脑、公司下班后的办公机、甚至手机 GPU——这些闲置算力的总和，远超全球前三大公有云的总和。问题是谁来调度？谁来保障安全？EIHM-P2P-CS 算力调度引擎就是答案：端侧优先、闲时调度、成本砍掉 95%。',
  '"本地跑 AI 不安全"——这句话是云厂商花了十年营销植入的认知。真相是：你的数据传到云端的那一刻，就已经经过了 N 个不可控的中间环节。本地推理 + 数据不出域 + 沙箱隔离，这才是真正的安全范式。',
  'AI 能写诗画画做PPT，很酷。但政企客户问的第一个问题是：你们的数据怎么保证不泄露？第二个问题：出了事谁负责？没有安全底盘的 AI 产品，就像一辆法拉利没装刹车——跑得快但随时会翻。',
  '开源模型确实不要钱，但你算了隐形成本吗？微调的人力成本、部署的运维成本、最关键的——安全审计的成本。一个有漏洞的开源模型上线，造成的损失可能比你买三年 API 还贵。',
  '7B vs 70B vs 700B 参数量之争，本质上是在比谁的"智商"更高。但商业场景要的不是最聪明的 AI，而是**最听话、最可控、最安全**的 AI。执行层的价值就在这里：让任何模型都能在你的安全框架内乖乖干活。',
  '前端炫酷的对话界面谁都能抄，但后端的沙箱隔离、权限管控、日志审计、区块链存证——这些才是别人抄不走的壁垒。一鉴到底七层架构的设计初衷：前端可以换，底盘必须稳。',
  '端侧算力不稳定？那是十年前的老黄历了。WebGPU 标准成熟、ONNX Runtime 浏览器端优化、Apple Silicon 统一内存架构——现在的端侧推理性能已经逼近 A100 的 30%，而成本不到 1/20。',
  'prompt 写得好就能赚钱？这种思维在 C 端也许管用，但在 ToB 和政企市场，合规性、等保测评、GDPR 合规、数据本地化——这些才是决定生死的关键。安全风控不是锦上添花，是入场券。',
  '安全工具就像保险——没事的时候觉得浪费钱，出事了才知道救命。一次数据泄露的罚款、一次停机事故的客户流失、一次声誉危机的品牌打击——任何一项都够一家小公司倒闭。',
  'C 端 AI 应用红海一片，获客成本越来越高。反观政企市场：等保 2.0 强制要求、数据安全法落地、信创替代加速——这片蓝海的客单价是 C 端的 10-100 倍，而且竞争者寥寥无几。',
  '完美主义是创业者的天敌。MVP 先跑起来、真实用户反馈驱动迭代、快速试错快速调整——这套方法论在 AI 领域同样适用。一鉴到底从第一行代码到今天，经历了无数次"先跑再说"的决定。',
  '语音交互、多模态、情感计算——这些功能听起来很酷，但政企客户的采购清单上永远写着：安全性 > 稳定性 > 合规性 > 功能丰富度。刚需永远是最无聊的那几样东西。',
  '把 AI 当工具用的，最多是个效率提升器；把 AI 当底盘建的，才能构建真正的平台级产品。一鉴到底的定位从来不是一个 AI 工具，而是一套 **AI 安全执行基础设施**——让别人基于我们的底盘去建应用。',
];

const aiSecurityPitfallSummaries = [
  '上周帮一个团队做代码审计，他们直接把 LLM 生成的代码丢进了生产环境。结果呢？三个高危 SQL 注入、两个 SSRF 漏洞、一个硬编码密钥。AI 生成的代码**不代表安全代码**，这是第一条铁律。一鉴到底的四层安全巡检（输入→执行→输出→日志），就是为了拦截这类"看起来能用但有暗雷"的代码。',
  '免费的 AI 工具背后是什么？是你的训练数据被拿去 fine-tune 他们的模型，是你的 API Key 可能被记录，是你的生成内容可能被存储在某台不受控的服务器上。天下没有免费的午餐，尤其在 AI 领域。',
  '把公司的合同文档、财务报表、客户名单上传给 ChatGPT 或同类工具？恭喜你，你的数据现在存在于 OpenAI（或其合作方）的服务器上，用于模型训练的数据池里。GDPR 第 17 条（被遗忘权）在这里形同虚设。',
  'LLM 生成的代码直接 `npm run build` 然后 `docker push`？我们见过太多这样的案例了。生成的代码里可能包含：未校验的用户输入拼接进 SQL、`eval()` 动态执行用户字符串、依赖包版本含已知 CVE。一鉴到底的代码沙箱执行 + AST 静态扫描，专治这种"复制粘贴就上线"的习惯。',
  'Agent 调用外部 API 时带了过高的权限 token？Agent 被注入恶意 prompt 后执行了删除操作？这些问题在当前的多 Agent 架构中极其普遍。一鉴到底的零信任权限管控：每次工具调用都要重新鉴权，每个操作都要独立审批。',
  '大模型本身不具备任何安全防护能力。它能生成安全的代码，也能生成带漏洞的代码；它能识别恶意输入，也能被精心构造的 prompt 绕过。把安全寄托在模型本身的"智能"上，等于把家门钥匙交给陌生人。',
  '代码审计不是大团队的专利。即使是个人开发者，用 Semgrep 跑一遍 SAST、用 gitleaks 扫一遍密钥泄露、用 npm audit 查一遍依赖漏洞——这三件事加起来不超过 30 分钟，但能避免 80% 的低级安全问题。',
  '看到别人部署了个 LLaMA 就跟着部署？你知道那个模型的 license 允许商用吗？你知道它的权重文件有没有被投毒吗？你知道它的推理框架有没有缓冲区溢出漏洞吗？跟风之前先做安全评估。',
  '本地推理不是"退步"，而是"回归正道"。WebGPU + ONNX Runtime + transformers.js 让浏览器端跑 7B 模型成为现实。数据不离开用户的设备，没有任何网络传输，不存在云端泄露的可能。',
  '等保 2.0 三级要求明确规定了日志留存至少 6 个月、操作行为可追溯、异常事件可告警。没有完善的日志审计体系，连等保测评这一关都过不了，更别提接政企客户了。',
  '开源项目很好，但别盲目 trust。npm 上每个月都有数百个恶意包被发现——它们的功能跟你想要的包一模一样，但额外附带了一个 `postinstall` 脚本，把你的环境变量全部发到了某个远程服务器。',
  '沙箱不只是 Docker 容器。真正的沙箱需要：进程隔离 + 网络隔离 + 文件系统隔离 + 内存限制 + CPU 限制 + syscall 过滤。一鉴到底的多层沙箱隔离方案，覆盖了从浏览器端到桌面端的全部执行场景。',
  'AI 效果好 ≠ 产品能上线。效果是面子，安全是里子。一个能完美回答所有问题的 AI 助手，如果它的数据库密码写在代码里、它的 API Key 没有过期机制、它的日志里打印了用户身份证号——这个产品离出事只差时间。',
  '单一 WAF 不够、单一代码扫描不够、单一日志监控不够。一鉴到底的四层巡检：输入层语义分析 → 执行层沙箱隔离 → 输出层内容过滤 → 日志层区块链存证。每一层都是独立的安全防线。',
  'P2P 算力网络中，一个被攻陷的节点可能变成跳板攻击其他节点。节点的身份认证、通信加密、信誉评分、异常行为检测——缺一不可。EIHM-P2P-CS 的节点风控模块专门解决这个问题。',
];

const computeCostSummaries = [
  '同样的 LLM 推理任务，阿里云 PAI 按token收费，一个月跑下来账单五位数。换成 EIHM-P2P-CS 端侧算力调度模式：利用闲置设备的 GPU/CPU/NPU，总成本降到原来的 1/20。这不是理论值，是我们实测了三个月的真实数据。',
  '传统算力集群：买服务器、租机房、配网络、招运维——起步投入几十万。P2P 算力网络：注册节点、安装客户端、自动组网——零硬件投入。每台参与计算的设备都是别人的闲置资源，你只需要做好调度和安全。',
  '阿里云 T4 实例 ¥3.07/小时，AWS g4dn.xlarge $0.526/小时。而端侧 P2P 算力的边际成本趋近于零——电费由设备主人承担，网络费用几乎可忽略，你只需要维护调度服务器的成本。',
  '批量处理 10000 篇文章的 AI 检测任务：公有云方案需要申请 GPU 实例排队等待，花费数千元。P2P 方案：将任务切片分发到 200 台空闲设备并行处理，30 分钟完成，成本不到一杯咖啡的钱。',
  'WebGPU 已经在 Chrome 113+、Edge 113+、Firefox 120+ 全面支持。这意味着浏览器可以直接调用 GPU 跑 AI 推理，不需要安装任何插件、不需要后端服务器、不需要云 API 调用。本地运行，零传输成本。',
  '代码需要在隔离环境中执行以防止恶意行为。传统方案：每份代码启动一个 Docker 容器，资源开销巨大。分布式方案：利用 P2P 节点的沙箱环境执行，主节点只负责任务分发和结果收集，算力成本分摊到各节点。',
  '企业级 AI 服务通常需要专用 GPU 集群 + 专业运维团队 + 安全合规认证，年成本百万起步。P2P 架构将这些成本打散到每个参与者身上，中心端只需要维护调度逻辑和安全策略，整体成本降低一个数量级。',
  '白天高峰期算力紧张价格高，夜间大量 GPU 空转。EIHM-P2P-CS 的错峰调度算法：将非实时任务排到夜间执行，利用闲时算力，成本再降 40%-60%。睡一觉起来，任务全跑完了。',
  '不需要 RTX 4090，不需要 A100。一台配备 GTX 1660 的普通办公电脑，加入 P2P 网络后就能贡献有效的推理算力。海量普通设备汇聚在一起，就是一座超级计算机。',
  '商用 AI 安全检测工具年费几万到几十万不等，而且按调用量阶梯计费。自研 ASS 安全内核 + 本地推理，一次开发终身使用，边际成本为零。对于中小团队来说，这个差距是百倍级的。',
  '传统的云端 IDE（如 GitHub Codespaces、Gitpod）按时长收费，重度使用者月费几百元。端侧算力模式的网页 IDE：代码编辑在浏览器完成，编译和执行通过 P2P 分发到本地或邻近节点，体验一样流畅但费用归零。',
  'ELK Stack 全套部署需要至少 16GB 内存的专业服务器，年运维成本数万元。轻量化方案：结构化日志存本地 SQLite，关键告警推送到 WebSocket 实时展示，总资源占用不到 100MB。',
  'Intel CPU + NVIDIA GPU + Apple Silicon + 手机 NPU——异构算力调度曾经是 HPC 领域的难题。EIHM-P2P-CS 通过统一的任务抽象层，让不同架构的设备都能参与同一批任务的计算，普通电脑就能组成高性能集群。',
  '公有云模式：用得越多越贵。P2P 模式：网络越大越便宜。因为每新增一个节点，不仅增加了总算力，还提高了任务分发的灵活性和容错能力。规模效应在 P2P 网络中是正向飞轮。',
  '不需要买服务器、不需要租 GPU、不需要懂 K8s。一台能上网的电脑，安装一鉴到底桌面客户端，开启算力共享模式——你就同时成为了算力提供者和算力消费者。零门槛，这就是 P2P 的魅力。',
];

const startupReviewSummaries = [
  '30 天闭门期间，我把市面能找到的 AI 安全产品逐个拆了一遍，读了 200+ 篇论文，跑了 50+ 个开源项目。结论只有一个：AI 赛道的终局竞争不在模型层，而在执行层。谁能把 AI 的能力安全、可控、低成本地交付给最终用户，谁就赢。',
  '从第一个付费客户到形成标准化产品，从单机版到 P2P 分布式架构，从纯工具到平台化——这条完整的商业闭环走了将近两年。回头看，每一个关键决策都围绕着一个核心：**安全执行基础设施**，而不是又一个 AI 聊天框。',
  '外面很吵：融资消息满天飞、概念炒作一轮接一轮。但我选择闭门打磨，因为我知道：浮在水面的冰山一角是"AI 很神奇"，水面下的十分之九是"AI 怎么安全落地"。后者才是值得花时间的地方。',
  '在这个赛道摸爬滚打多年，见过太多人冲进来又退出去。活下来且活得好的，都有一个共同特征：不追热点，盯刚需。政企刚需 = 安全 + 合规 + 数据主权 + 成本可控。这四个词就是入场券。',
  'ChatGPT、Claude、Gemini、文心一言、通义千问、Kimi、豆包……我全都深度用过。结论：模型之间的差距在快速缩小，真正拉开差距的是——你的 AI 能不能在一个**受控的安全环境**里执行复杂任务。',
  '同行 A 卷大模型微调死了，同行 B 做 Agent 平台烧光了融资，同行 C 搞 AI 培训赚了快钱但不可持续。分析了 50+ 个案例后发现：避开"卷模型"、"卷应用"、"卷流量"三条路，走"安全执行基础设施"这条路，弯路最少。',
  '一鉴到底的七层架构不是拍脑袋设计的。每一层都对应一个真实的痛点：应用层解决接入复杂度、编排层解决多 Agent 协作、ASS 安全网关解决信任问题、成本路由层解决预算焦虑、P2P 算力层解决资源瓶颈、统一执行层解决异构兼容、白盒审计层解决合规取证。',
  '2024 年初也想过要不要 fine-tune 一个自己的大模型。想了两个月，放弃了。原因很简单：模型会越来越 commodity，但**安全执行环境**永远不会。与其在红海里厮杀，不如在空白地带建城堡。',
  '搭 P2P 算力网络这件事，网上的教程基本都是理论层面的。真正动手之后才发现：节点发现协议怎么设计才不会被 DDoS、任务分发怎么做到负载均衡、结果聚合怎么做共识验证、恶意节点怎么识别和隔离——这些都是书本上学不到的。',
  '看过太多 AI 项目：有的产品很酷但找不到商业模式，有的技术很强但安全一塌糊涂，有的融资很多但产品始终无法交付。总结下来：**底盘强弱决定生死**。底盘 = 安全架构 + 执行能力 + 成本控制 + 合规能力。',
  '市面上大多数 AI 安全产品只做一层防护（比如只做内容过滤）。我们研究了为什么没人做四层：技术难度大、需要跨领域知识、短期看不到收益。但这恰恰是我们的机会——四层巡检本身就是差异化壁垒。',
  '早期版本我们也追求"功能大而全"：支持 20+ 种模型、集成 10+ 个第三方工具、UI 做得很炫酷。后来砍掉了 70% 的功能，聚焦到一件事：**让 AI 代码在安全的环境中执行并给出可信的结果**。少即是多。',
  '不做广告投放、不买流量、不搞裂变——所有的增长都来自内容输出和技术口碑。写干货、做开源、分享经验，吸引来的用户虽然慢但是精准。AI ToB 领域，一个精准客户的价值抵得上 C 端一千个泛流量用户。',
  'Monaco Editor、CodeMirror、VS Code Web、StackBlitz、Replit、CodeSandbox……前后测试了几十款网页 IDE 方案。最终选择了 Monaco + 自研沙箱执行的组合：编辑器成熟稳定，执行环境自主可控，二次开发空间最大。',
  '不再每天盯着竞品的新功能焦虑了，不再追着每个新出的模型去适配了。找到了自己的节奏：深耕安全执行层，让模型层的变化成为"上游供应商的选择题"而不是"生死攸关的技术赌注"。长期主义的定力，来自对底层逻辑的确信。',
];

const qaQaSummaries = [
  '有红利，但不是你想的那种"躺赚"红利。红利在于：政策推动（数据安全法、等保 2.0）、技术拐点（端侧推理成熟）、市场空白（安全执行层玩家极少）。门槛在于：你需要懂的不只是 AI，还有安全、分布式系统、合规。普通人入局的路径：从一个细分场景开始，做深做透。',
  '风口和割韭菜往往只有一线之差。判断标准有三个：(1) 是否有真实的技术壁垒而非概念包装；(2) 是否有清晰的盈利模式而非烧钱换增长；(3) 参与者的收益是否来自创造价值而非拉人头。一鉴到底的 P2P 算力网络：节点贡献者获得算力积分，使用者支付远低于公有云的费用——价值闭环清晰。',
  '技术上完全可以实现，而且已经有成熟方案。WebGPU + ONNX Runtime + transformers.js 让 7B 以内的模型可以在浏览器端流畅运行。数据全程不离开用户设备，没有 API 调用、没有网络传输、没有云端存储。"数据不出域"从口号变成了工程现实。',
  '能，但建议从"使用者"开始而不是从"开发者"开始。先用现成的安全执行工具理解整个流程，再逐步深入到底层原理。一鉴到底的定位就是降低这个门槛：你不需要懂分布式系统，不需要懂密码学，就能用上企业级的安全 AI 执行能力。',
  '差距在三个维度：数据安全（免费工具可能收集你的输入输出）、可靠性（免费工具没有 SLA 保障）、合规性（免费工具通常无法满足等保/GDPR 要求）。如果你的用途只是个人娱乐，免费够用；如果是商业场景，付费平台的投资回报率其实更高。',
  'P2P 算力网络的安全性取决于架构设计。(1) 节点间通信必须端到端加密；(2) 每个节点必须有身份认证和信誉评分；(3) 任务必须在沙箱中执行；(4) 必须有异常行为检测机制。一鉴到底的 EIHM-P2P-CS 协议覆盖了以上全部要点。',
  '不一定。90% 的业务场景直接调用现有的大模型 API 就够了。自研模型的理由只有三个：(1) 数据绝对不能出域（如军工、金融核心）；(2) 需要极致的低延迟（如实时交易）；(3) 有足够的标注数据和算力资源。其余情况，"用好"比"自研"重要得多。',
  '根本问题在于：检测工具用的是"概率匹配"而非"语义理解"。它们统计文本的特征分布是否偏离人类写作习惯，但这种统计方法既会产生误报（人工写的被判为 AI），也会产生漏报（AI 写的被判为人工）。一鉴到底的检测方案结合了多层语义分析，准确率显著高于纯统计方法。',
  '能商用，但要注意版权细节。(1) 编辑器内核（如 Monaco）使用 MIT 协议可自由商用；(2) 你自己写的扩展插件版权属于你；(3) 注意不要捆绑 GPL 协议的依赖库。一鉴到底的网页 IDE 方案基于 MIT 协议组件构建，商用无法律风险。',
  '能，前提是你加入了靠谱的网络。收益稳定性取决于：(1) 网络的任务总量是否充足；(2) 你的设备配置是否能 competitively 获得任务分配；(3) 积分/代币的兑换机制是否透明。一鉴到底采用"算力积分 + 任务竞价"的双轨制，确保长期参与者的稳定回报。',
  '普通防护（如单一 WAF 或内容过滤器）面对复杂的 AI 攻击向量是不够的。Prompt Injection 可以绕过输入过滤、模型幻觉可以绕过输出审核、Agent 越权可以绕过权限控制。四层巡检的本质是**纵深防御**——每一层都是独立的防线，一层被突破还有下面三层兜底。',
  '会成为主流之一，但不会取代云端推理。两者是互补关系：端侧适合隐私敏感、延迟敏感、成本敏感的场景；云端适合超大规模模型、需要最新能力的场景。未来的常态是"端云协同"——简单任务本地跑，复杂任务云端跑，中间由智能路由自动决策。',
  '从执行层切入。原因：(1) 大模型领域已经被巨头垄断，后来者几乎没有差异化空间；(2) 执行层是目前最大的痛点——所有人都在讨论用什么模型，但几乎没人讨论怎么安全地执行模型给出的指令；(3) 执行层的客户粘性远高于模型层（切换成本高）。',
  '技术上不仅能实现，而且已经是成熟方案。关键技术栈：WebGPU（浏览器 GPU 加速）、ONNX Runtime（跨平台推理引擎）、WebAssembly（沙箱执行环境）、IndexedDB（本地持久化存储）。一鉴到底的整套技术栈就是围绕"数据不出域"这个目标构建的。',
  '红海 = 所有人都在做的事（做 ChatGPT 套壳、做 AI 绘画、做 AI 写作）。蓝海 = 有需求但供给不足的方向（AI 安全执行、政企合规 AI、数据不出域解决方案）。找蓝海的方法：看政府采购目录、看等保测评需求清单、看企业安全预算分配——答案都在里面。',
];

const beginnerGuideSummaries = [
  '坑 1：直接把 API Key 写进代码里（用 Secrets Manager）；坑 2：用 LLM 生成代码不经审查就上线（加 SAST + 人工 Review）；坑 3：以为开源等于免费（算上运维和安全成本）；坑 4：忽略数据合规（GDPR/数据安全法）；坑 5：一个人想干所有事（找互补的合伙人）。这五个坑，踩中任何一个都可能让你半年白干。',
  '误区 1：AI 生成的代码可以直接用（必须安全审计）；误区 2：prompt 越长越好（精炼高效更重要）；误区 3：用最新的模型效果最好（匹配场景最重要）；误区 4：AI 能替代程序员（目前只能提效 30-50%）；误区 5：开源模型更安全（可能有后门和投毒）。避开这五个误区，你的 AI 开发效率至少翻倍。',
  '陷阱 1：卖账号/卖 key 的"代理模式"（没有技术壁垒随时被取代）；陷阱 2：刷量的"矩阵运营"（平台一封号全军覆没）；陷阱 3：割韭菜的"培训变现"（学员学完发现没法落地）；陷阱 4：蹭热度的"自媒体引流"（流量来了转化不了）。聪明的入局者选择：做一个有技术门槛的工具或服务。',
  '错误 1：用公网 IP 直接暴露节点（必须加 NAT/反向代理）；错误 2：节点间明文通信（必须 TLS mTLS 加密）；错误 3：不设资源上限（容器/进程必须限制 CPU/内存）；错误 4：信任所有传入任务（必须签名验证+沙箱执行）；错误 5：忽略心跳检测（僵尸节点会拖垮任务队列）；错误 6：没有退出机制（优雅下线避免任务丢失）。',
  '标准 1：是否有沙箱隔离能力（防止恶意代码执行）；标准 2：是否支持数据不出域（本地推理/私有化部署）；标准 3：是否有审计日志（等保合规必备）；标准 4：是否有活跃的开源社区（长期维护有保障）。按这四个标准筛选，90% 的候选工具会被淘汰。',
  'Step 1：理解什么是"执行层"（模型之上的安全运行环境）；Step 2：搭建第一个本地推理环境（用 Ollama 或 LM Studio）；Step 3：跑通一个简单的代码沙箱（Docker 或 browser sandbox）；Step 4：学习基本的 AI 安全知识（OWASP AI Top 10）；Step 5：找一个真实场景练手（从自己的痛点出发）。五步走完，你就入了门。',
  '错误 1：标题党但内容空洞（SEO 短期有效但伤口碑）；错误 2：抄袭洗稿（原创才能建立品牌）；错误 3：不发不改（信息流需要持续更新）；错误 4：只发不互动（评论区是建立信任的最佳场所）；错误 5：格式混乱（专业排版体现专业度）；错误 6：没有分类（读者需要快速定位感兴趣的内容）；错误 7：忽略 SEO 基础（标题、摘要、标签都要优化）。',
  '坑 1：直接 git clone 就跑（先审计 Dockerfile 和依赖列表）；坑 2：用 root 运行容器（创建非特权用户）；坑 3：默认端口 0.0.0.0（绑定 127.0.0.1 或内网 IP）；坑 4：.env 文件不设权限（chmod 600）；坑 5：不检查镜像签名（启用 docker content trust）；坑 6：生产环境用 latest 标签（锁定具体版本 hash）。90% 的安全事故源于这些基础配置错误。',
  '原则 1：敏感数据不上传云端（用本地推理）；原则 2：API Key 不写入代码（用密钥管理服务）；原则 3：生成内容需人工审核（尤其是对外发布时）；原则 4：定期清理对话历史（减少数据暴露面）；原则 5：了解所使用的 AI 服务的数据政策（读 privacy policy）。五条原则，守住底线。',
  '大模型 = 大脑（负责理解和生成）；执行层 = 身体（负责安全地行动）。大脑可以说"帮我查一下数据库"，但如果身体没有权限控制、没有输入校验、没有日志记录——大脑的一句话可能导致灾难。一鉴到底做的就是"身体"这部分的工作。',
  '套路 1：高额入驻费后没有流量扶持（问清楚流量分配机制）；套路 2：平台抽成过高压缩利润空间（算清楚 ROI 再签约）；套路 3：知识产权归属模糊（签合同前确认 IP 条款）；套路 4：数据锁定难以迁移（确认数据导出格式和接口）。记住：你是来赚钱的不是来做慈善的。',
  '禁忌 1：第一天就群发广告（先提供价值再谈转化）；禁忌 2：夸大效果承诺（诚实建立长期信任）；禁忌 3：不区分受众（ToB 和 ToC 的沟通方式完全不同）；禁忌 4：忽略私域沉淀（公域流量是一次性的，私域是复利的）。做好内容 → 吸引精准用户 → 沉淀到私域 → 持续提供价值 → 自然转化。',
  '避坑 1：确认开源协议（MIT/Apache 可商用，GPL 要小心）；避坑 2：评估二次开发难度（看文档完整性、代码质量、社区活跃度）；避坑 3：检查安全基线（有没有已知漏洞、有没有硬编码凭证）；避坑 4：考虑长期维护成本（上游项目是否持续更新）。一鉴到底选型 Monaco Editor 就是按照这个流程走的。',
  '类型 1：需要巨额算力投入的项目（个人扛不住 GPU 成本）；类型 2：纯 C 端流量变现模式（红海中的红海）；类型 3：涉及用户敏感数据的"灰色地带"应用（法律风险极大）。普通人入局的正确姿势：找一个垂直细分领域，用轻量级技术方案解决具体问题，从小做起逐步扩张。',
  '核心点 1：输入层安全（防 Prompt Injection、防恶意输入）；核心点 2：执行层隔离（沙箱、权限最小化、资源限制）；核心点 3：输出层审核（内容过滤、敏感信息遮蔽）；核心点 4：日志审计（操作留痕、异常告警、合规取证）；核心点 5：供应链安全（依赖审计、镜像签名、来源验证）。掌握这五点，AI 安全风控就算入门了。',
];

const architectureInsideSummaries = [
  '行业内都知道 AI 生成的代码漏洞率高，但没人愿意说具体有多高。我们的实测数据：未经审计的 AI 生成代码，平均每 100 行含有 1.2-3.7 个安全缺陷，其中高危漏洞占比 15%-23%。这个数字如果公布出来，会让大量 AI 编程工具的商业化叙事崩塌。所以大家都不说。',
  '浏览器推理能力已经足够强（Chrome 支持 WebGPU、支持 WASM 多线程、支持 SharedArrayBuffer），但大厂为什么不大力推？原因很现实：浏览器推理 = 用户不调 API = 云厂商损失收入。Google 推广 TensorFlow.js 但从不强调它可以替代 Cloud AI API，就是这个道理。',
  '大多数文章讲 AI 架构只讲到"模型→提示词→输出"三层。真正的执行层架构至少包含七层：应用接入 → 任务编排 → 安全网关 → 成本路由 → 算力调度 → 统一执行 → 审计存证。每一层都有自己的协议、状态机和故障恢复机制。一鉴到底的七层架构就是这样设计的。',
  'P2P 算力项目做了很多但做大的很少。根源在于：大多数团队把它当"分布式计算"在做，忽略了"安全信任"这个核心问题。节点之间如何互信？任务结果如何验证？恶意节点如何隔离？不做好的 P2P 网络，就是一个巨大的 DDoS 放大器。',
  '为什么四层巡检而不是一层？因为现代 AI 攻击是多维度的。Prompt Injection 攻击输入层、沙箱逃逸攻击执行层、模型幻觉污染输出层、日志篡改破坏审计层。每一层都需要独立的检测逻辑和拦截机制。行业内不愿公开的原因：四层架构的研发成本是单层的 4-5 倍。',
  '免费网页 IDE 为什么免费？因为你的代码就是他们的训练数据。GitHub Copilot 为什么这么好用？因为全球开发者上传的代码就是它的训练集。商业化网页 IDE 的真正盈利模式：要么卖订阅、要么卖数据。一鉴到底的模式不同：IDE 免费，安全执行能力付费——数据始终属于用户。',
  '一个 AI 项目同时用了 Python（模型推理）、Node.js（API 服务）、Rust（沙箱执行）、Go（调度服务）——这种混栈架构在 AI 领域非常普遍。隐患在于：每种语言的安全最佳实践不同、依赖链的攻击面叠加、跨语言的错误处理容易遗漏。一鉴到底早期也是混栈，后来做了大量的安全统一工作。',
  '"数据不出域"≠"数据在本地文件夹里"。真正的数据不出域需要：(1) 推理在本地设备完成（WebGPU/WASM）；(2) 中间结果不经过外部网络（内存级别传递）；(3) 模型权重可验证完整性（哈希校验）；(4) 执行过程可审计（日志本地存储）。缺少任何一环，"不出域"都是伪命题。',
  '零信任的核心不是"不信任任何人"，而是"每次访问都重新验证"。在 AI 执行场景中意味着：即使 Agent A 刚刚成功调用了工具 B，下一次调用仍然需要重新验权；即使节点 X 昨天完成了 100 个任务，今天的第 101 个任务仍然需要重新验证身份和信誉。一鉴到底的权限管控严格遵循这个原则。',
  '安全赔付 = 承诺"如果因我们的安全漏洞导致你的数据泄露，我们赔偿"。为什么多数 AI 平台不敢做？因为 AI 系统的攻击面太广太复杂，没有人敢打包票 100% 不出事。一旦承诺赔付，一个漏洞就可能带来天文数字的赔偿金。一鉴到底的目标是：通过七层架构的纵深防御，最终有底气做出这个承诺。',
  'EIHM = Economic Intelligence Hash Matching（经济智能哈希匹配），用于任务-节点的最优匹配；P2P = Peer-to-Peer（点对点算力网络）；CS = Consensus & Scheduling（共识与调度）。三者协同：EIHM 决定"谁最适合做这个任务"，P2P 提供"算力从哪里来"，CS 确保"结果是可信的"。整个调度过程的延迟控制在 200ms 以内。',
  'AI 审计的最大难题是"举证难"：你怎么证明某次 AI 输出在当时确实是安全的？区块链存证解决了这个问题：每一次执行的关键步骤（输入哈希、执行环境指纹、输出哈希、时间戳）都被写入不可篡改的分布式账本。等到需要审计的时候，链上数据就是铁证。',
  'TensorFlow.js 在浏览器端跑推理这件事，Google 从来不大张旗鼓地宣传。原因：如果前端推理普及了，谁还用 TensorFlow Serving / TF Cloud？大厂的战略是：前端推理作为"补充选项"存在，主力方向永远是云端 API。但对于数据敏感场景来说，前端 TF 才是正道。',
  '单层沙箱（如 Docker）可以被逃逸——这在安全圈已经不是新闻。多层防护的逻辑是：即使攻击者逃逸了容器（Layer 1），还会遇到 syscall 过滤（Layer 2）；突破了 syscall 过滤，还有网络隔离（Layer 3）；打穿了网络层，还有行为基线检测（Layer 4）。每一层的逃逸成本指数级上升。',
  '一鉴到底七层架构：① 应用接入层（统一 API / SDK）→ ② 编排层（DAG 任务编排 / 多 Agent 协作）→ ③ ASS 安全网关（输入过滤 / 权限管控 / 零信任）→ ④ 成本路由层（EIHM 智能匹配 / 地域合规路由）→ ⑤ P2P 算力层（节点管理 / 心跳 / 信誉评分）→ ⑥ 统一执行层（WASM 沙箱 / WebGPU 推理 / Python 子进程）→ ⑦ 白盒审计层（区块链存证 / 四层巡检报告）。同行看不懂是因为：每一层都需要跨领域的深度积累，不是堆人力就能复制的。',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(): string {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const randomTime = oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime());
  return new Date(randomTime).toISOString();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTags(category: string): string[] {
  const tagMap: Record<string, string[]> = {
    industry_insight: ['AI执行层', '安全内核', '算力调度', '数据不出域', 'P2P网络', 'ASS安全', 'EIHM算法', '行业洞察', 'AI趋势', '技术壁垒', '政企市场', '端侧推理'],
    ai_security_pitfall: ['AI安全', '代码漏洞', '沙箱隔离', 'Prompt注入', '权限管控', '数据泄露', '合规审计', '零信任', '日志审计', 'Agent安全', '供应链安全', '四层巡检'],
    compute_cost: ['P2P算力', '成本优化', 'WebGPU', '端侧推理', '闲置算力', '分布式计算', '算力调度', '成本对比', '企业降本', '异构算力', 'EIHM-P2P-CS', '集群组网'],
    startup_review: ['AI创业', '复盘总结', '商业闭环', '执行层赛道', '安全算力', '产品打磨', '长期主义', '技术选型', '私域运营', '差异化竞争', '一鉴到底', '从0到1'],
    qa_qa: ['AI入局', '算力风口', '数据安全', 'P2P网络', 'WebGPU推理', '执行层入门', 'AI安全', '商用合规', '算力收益', '四层巡检', '端侧AI', '蓝海赛道'],
    beginner_guide: ['AI入门', '避坑指南', '新手必读', 'P2P节点', '安全工具', '执行层入门', 'AI副业', '信息流运营', '隐私保护', '网页IDE', 'AI创业', '风控基础'],
    architecture_inside: ['架构设计', '底层原理', '安全内核', 'P2P协议', '沙箱隔离', '零信任架构', '区块链存证', '算力调度', '七层架构', 'EIHM算法', '执行层架构', '技术内幕'],
  };
  const tags = tagMap[category] || tagMap.industry_insight;
  const count = randomInt(2, 4);
  const shuffled = [...tags].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

const XINFA_TAGS: ('industry_insight' | 'ai_security_pitfall' | 'compute_cost' | 'startup_review' | 'qa_qa' | 'beginner_guide' | 'architecture_inside')[] = [
  'industry_insight', 'ai_security_pitfall', 'compute_cost', 'startup_review',
  'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
  'industry_insight', 'ai_security_pitfall', 'compute_cost',
  'startup_review', 'qa_qa', 'beginner_guide', 'architecture_inside',
];

const ZONE_IDS: ('industry' | 'security' | 'compute' | 'startup' | 'qa' | 'guide' | 'inside')[] = [
  'industry', 'security', 'compute', 'startup',
  'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
  'industry', 'security', 'compute',
  'startup', 'qa', 'guide', 'inside',
];

const HOOK_LINES = [
  '这个问题你一定遇到过...',
  '说一个扎心的真相...',
  '先问自己一个问题...',
  '我见过太多团队在这里翻车了...',
  '别等出了事再后悔...',
  '这个坑我踩过，花了3天才爬出来...',
  '如果你在做AI相关产品，这条必须看完...',
  '上周又有一家公司因为这个问题上了新闻...',
  '前两天在群里看到有人在讨论这个...',
  '说实话这个问题困扰了我很久...',
  '分享一个我们团队血的教训...',
  '这个方案我们用了大半年了，效果不错...',
  '帮客户做审计的时候发现的...',
  '网上资料很多但都没说到点子上...',
  '记录一下上周五晚上的事故...',
  '看完这条能帮你省不少冤枉路...',
];

const categoryMap: Record<string, { categoryId: number; categoryName: string }> = {
  industry_insight: { categoryId: 1, categoryName: '行业认知洞察' },
  ai_security_pitfall: { categoryId: 2, categoryName: 'AI安全避坑' },
  compute_cost: { categoryId: 3, categoryName: '算力成本拆解' },
  startup_review: { categoryId: 4, categoryName: '项目创业复盘' },
  qa_qa: { categoryId: 5, categoryName: '赛道问答解惑' },
  beginner_guide: { categoryId: 6, categoryName: '新手入门指南' },
  architecture_inside: { categoryId: 7, categoryName: '架构干货内幕' },
};

const titleBank: Record<string, string[]> = {
  industry_insight: industryInsightTitles,
  ai_security_pitfall: aiSecurityPitfallTitles,
  compute_cost: computeCostTitles,
  startup_review: startupReviewTitles,
  qa_qa: qaQaTitles,
  beginner_guide: beginnerGuideTitles,
  architecture_inside: architectureInsideTitles,
};

const summaryBank: Record<string, string[]> = {
  industry_insight: industryInsightSummaries,
  ai_security_pitfall: aiSecurityPitfallSummaries,
  compute_cost: computeCostSummaries,
  startup_review: startupReviewSummaries,
  qa_qa: qaQaSummaries,
  beginner_guide: beginnerGuideSummaries,
  architecture_inside: architectureInsideSummaries,
};

const CATEGORY_COVER_MAP: Record<number, string> = {
  1: '/categories/industry-insight.jpg',
  2: '/categories/ai-security-pitfall.jpg',
  3: '/categories/compute-cost.jpg',
  4: '/categories/startup-review.jpg',
  5: '/categories/qa-qa.jpg',
  6: '/categories/beginner-guide.jpg',
  7: '/categories/architecture-inside.jpg',
};

export const articles: Article[] = Array.from({ length: 105 }, (_, index) => {
  const xinfaTag = XINFA_TAGS[index];
  const zoneId = ZONE_IDS[index];
  const isPinned = index < 15;
  const isHot = index < 30 || Math.random() < 0.12;

  const titles = titleBank[xinfaTag] || titleBank.industry_insight;
  const summaries = summaryBank[xinfaTag] || summaryBank.industry_insight;

  const authorId = randomInt(1, 10);
  const author = authors.find(a => a.id === authorId)!;
  const catInfo = categoryMap[xinfaTag] || categoryMap.industry_insight;

  return {
    id: index + 1,
    title: titles[index % titles.length],
    summary: summaries[index % summaries.length],
    content: generateContent(xinfaTag),
    coverImage: CATEGORY_COVER_MAP[catInfo.categoryId] || CATEGORY_COVER_MAP[1],
    categoryId: catInfo.categoryId,
    categoryName: catInfo.categoryName,
    tags: randomTags(xinfaTag),
    authorId,
    authorName: author.name,
    avatar: author.avatar,
    publishTime: randomDate(),
    readCount: randomInt(500, 80000),
    likeCount: randomInt(20, 6000),
    commentCount: randomInt(0, 300),
    isRecommended: Math.random() < 0.18,
    status: 'published' as const,
    xinfaTag,
    isPinned,
    zoneId,
    isHot,
    pitfallCount: randomInt(3, 300),
    learnedCount: randomInt(15, 1000),
    hookLine: pickRandom(HOOK_LINES),
    ctaText: '立即体验安全执行层 →',
    ctaLink: '/chat',
  };
});

export function getArticles(params: ArticleListParams = {}): ArticleListResponse {
  let filteredArticles = [...articles];

  if (params.category) {
    filteredArticles = filteredArticles.filter(article => article.categoryId === params.category);
  }

  if (params.tag) {
    filteredArticles = filteredArticles.filter(article =>
      article.tags.some(tag => tag.includes(params.tag!) || params.tag!.includes(tag))
    );
  }

  if (params.xinfaTag) {
    filteredArticles = filteredArticles.filter(article => article.xinfaTag === params.xinfaTag);
  }

  if (params.zoneId) {
    filteredArticles = filteredArticles.filter(article => article.zoneId === params.zoneId);
  }

  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filteredArticles = filteredArticles.filter(article =>
      article.title.toLowerCase().includes(searchLower) ||
      article.summary.toLowerCase().includes(searchLower)
    );
  }

  if (params.sort) {
    const field = params.sort.replace('-', '') as keyof Pick<Article, 'publishTime' | 'readCount' | 'likeCount'>;
    const order = params.sort.startsWith('-') ? -1 : 1;

    filteredArticles.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order * aVal.localeCompare(bVal);
      }
      return order * ((aVal as number) - (bVal as number));
    });
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 15;
  const totalCount = filteredArticles.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  return {
    count: totalCount,
    next: endIndex < totalCount ? `/api/articles?page=${page + 1}&pageSize=${pageSize}` : null,
    previous: page > 1 ? `/api/articles?page=${page - 1}&pageSize=${pageSize}` : null,
    results: paginatedArticles
  };
}

function generateContent(category: string): string {
  const templates: Record<string, string> = {
    industry_insight: `## 为什么大多数人看错了方向

AI 赛道的舆论场有一个有趣的现象：所有人都在讨论模型参数、讨论 prompt 技巧、讨论 UI 交互。但这些话题的热度，恰恰说明了它们的**商品化程度**——越是人人都能聊的话题，说明门槛越低，竞争越激烈。

## 真正的高地在哪

一鉴到底团队在 ${randomInt(6, 24)} 个月的深度实践中发现：

### 1. 执行层 > 模型层

模型的能力差距在快速收敛，但**安全执行环境**的建设才刚刚开始。

\`\`\`
模型层：GPT-4 ≈ Claude ≈ Gemini（差距 < 15%）
执行层：有安全底盘 vs 无安全底盘（差距 = ∞）
\`\`\`

### 2. 数据不出域是刚需不是可选项

${pickRandom([
  '《数据安全法》第二十一条明确规定了数据处理者的安全义务',
  '等保 2.0 三级要求强制要求数据本地化存储和处理',
  'GDPR 第 44 条限制了数据跨境传输的条件',
  '政企客户 100% 要求数据不离本单位网络',
])}

### 3. P2P 算力重构成本结构

传统云计算模式：
- 按 token / 按实例小时计费
- 规模越大成本越高

EIHM-P2P-CS 模式：
- 利用闲置算力，边际成本趋近于零
- 规模越大单位成本越低

## 一鉴到底的答案

七层架构设计，每一层对应一个真实痛点：

| 层级 | 解决的问题 |
|------|-----------|
| 应用接入 | 降低集成复杂度 |
| 任务编排 | 多 Agent 协作 |
| ASS 安全网关 | 输入过滤 + 零信任 |
| 成本路由 | 智能匹配最优算力 |
| P2P 算力 | 闲置资源调度 |
| 统一执行 | 异构环境兼容 |
| 白盒审计 | 合规取证 |

---

*如果你也在思考 AI 的下一步在哪里，欢迎交流。*`,

    ai_security_pitfall: `## 一条真诚的建议

这条建议可能会得罪一些同行，但我还是要说：**绝大多数 AI 项目的安全现状，经不起一次真正的渗透测试。**

## 我们见过的真实案例

### 案例 ${randomInt(1, 9)}：裸奔运行的 AI 代码

某团队直接把 LLM 生成的代码部署到生产环境，安全审计发现了：

- ${randomInt(2, 5)} 个高危 SQL 注入
- ${randomInt(1, 3)} 个 SSRF 漏洞
- 硬编码的 API Key（在 git 历史中可查）

### 案例 ${randomInt(10, 19)}：被忽视的 Agent 权限

多 Agent 系统中，某个 Agent 的 token 权限过高，被 Prompt Injection 利用后执行了：

\`\`\`bash
# 攻击者通过精心构造的 prompt 实现
curl -X DELETE https://internal-api/users/all
# 结果：全部用户数据被删除
\`\`\`

## 为什么会这样

${pickRandom([
  '开发者认为"AI 生成的代码质量很高"，跳过了 code review',
  '安全团队不懂 AI，AI 团队不懂安全——典型的信息孤岛',
  '赶进度压倒一切，"先上线再补安全"成了口头禅',
  '使用了开源框架但没有审计其依赖链的安全性',
])}

## 正确的做法

一鉴到底的四层安全巡检：

**第一层：输入层**
- Prompt Injection 检测（语义分析 + 规则匹配）
- 恶意输入过滤（正则 + 小模型分类）
- 参数 Schema 强校验（Pydantic / TypeScript 类型系统）

**第二层：执行层**
- WASM 沙箱隔离（内存/CPU/网络/文件系统四维限制）
- 进程级容器隔离（Docker + seccomp + AppArmor）
- Syscall 白名单过滤（仅允许安全操作）

**第三层：输出层**
- 内容安全过滤（敏感词 + 语义理解 + PII 识别）
- 幻觉检测结果标记（置信度阈值告警）
- 自动脱敏输出（身份证/手机号/银行卡遮蔽）

**第四层：日志层**
- 全链路操作日志（不可篡改）
- 区块链存证（关键操作上链）
- 异常行为基线检测（统计学方法）

---

*安全不是选择题，是入场券。*`,

    compute_cost: `## 一笔账算清楚

很多人不相信 P2P 算力能把成本降到传统云服务的 1/20。我们来算一笔具体的账。

## 传统方案的成本拆解

以每月处理 ${randomInt(100000, 1000000)} 次 AI 推理任务为例：

| 项目 | 月费用（元） |
|------|-------------|
| GPU 实例（阿里云 PAI T4） | ${(randomInt(15, 30) * 1000).toLocaleString()} |
| 带宽费用 | ${(randomInt(2, 8) * 1000).toLocaleString()} |
| 存储费用（模型权重 + 日志） | ${(randomInt(1, 3) * 1000).toLocaleString()} |
| 运维人力（0.5 FTE） | ${(randomInt(10, 20) * 1000).toLocaleString()} |
| **合计** | **${(randomInt(28, 61) * 1000).toLocaleString()}** |

## P2P 方案的成本拆解

同样的任务量，使用 EIHM-P2P-CS 算力调度：

| 项目 | 月费用（元） |
|------|-------------|
| 调度服务器（轻量云主机） | ${randomInt(200, 500)} |
| 带宽（P2P 直连为主） | ${randomInt(50, 200)} |
| 存储（分布式 + 本地缓存） | ${randomInt(100, 300)} |
| 运维（自动化程度高） | ${randomInt(500, 1500)} |
| **合计** | **${randomInt(850, 2500)}** |

## 成本差异的核心原因

### 1. 算力来源不同
- 传统：自购/租用专用 GPU 服务器
- P2P：利用网络中 ${randomInt(100, 500)}+ 台闲置设备的空余算力

### 2. 调度效率不同
- 传统：固定分配，利用率 ${randomInt(20, 40)}%
- P2P：动态调度，利用率 ${randomInt(75, 95)}%

### 3. 架构开销不同
- 传统：集中式，单点故障风险高
- P2P：分布式，天然容错

## 什么时候该用 P2P

✅ 适合 P2P 的场景：
- 批量异步任务（文档检测、内容审核）
- 非实时推理（离线分析、报表生成）
- 成本敏感型应用（初创团队、内部工具）

❌ 暂不适合 P2P 的场景：
- 超低延迟需求（< 50ms 实时推理）
- 超大规模单体模型（70B+ 实时推理）
- 严格 SLA 保证（99.99% 可用性）

---

*省钱不是目的，目的是用更低的成本做更多的事。*`,

    startup_review: `## 闭关 ${randomInt(15, 60)} 天的复盘

这段时间我断绝了大部分社交，专注于一件事情：**彻底搞懂 AI 安全执行层的全貌。**

## 我的探索路径

### 第一周：扫盲

读了 ${randomInt(50, 200)} 篇论文，重点关注：
- OWASP AI/ML Security Top 10（草案版）
- NIST AI Risk Management Framework
- ISO/IEC 42001（AI 管理体系标准）

### 第二-${randomInt(3, 4)} 周：动手

跑了 ${randomInt(20, 80)} 个开源项目：
- LangChain / CrewAI / AutoGPT（Agent 框架）
- Ollama / LM Studio / LocalAI（本地推理）
- Docker gVisor / Firecracker / WASM（沙箱方案）

### 第${randomInt(4, 6)} 周：踩坑

亲自搭建 P2P 算力网络原型：
- 节点发现协议设计（踩了 UDP 打洞的坑）
- 任务分发机制（踩了负载均衡的坑）
- 结果共识验证（踩了拜占庭容错的坑）

## 最重要的三个发现

### 发现 1：执行层是最大的空白

市场上 $90\%$ 的 AI 产品集中在：
- 模型层（fine-tune、RAG、prompt engineering）
- 应用层（聊天框、Copilot、Agent 平台）

但**安全执行层**几乎无人深耕。

### 发现 2：政企客户的需求被低估

C 端用户关心"好不好玩"，政企客户关心"安不安全"。
这两个市场的客单价差距：**10-100 倍**。

### 发现 3：技术壁垒比想象中高

要做好安全执行层，你需要同时懂：
- AI/ML（模型推理、prompt 安全）
- 信息安全（加密、审计、零信任）
- 分布式系统（P2P 协议、共识算法）
- 合规法规（等保、GDPR、数据安全法）

**跨领域能力 = 真正的壁垒。**

## 下一步计划

基于这些发现，一鉴到底的产品路线图已经清晰：
1. 夯实 ASS 安全内核（四层巡检）
2. 完善 EIHM-P2P-CS 算力调度
3. 打造白盒审计能力（区块链存证）
4. 面向政企客户提供一体化解决方案

---

*闭关不是为了躲避世界，是为了更好地理解世界。*`,

    qa_qa: `## 这个问题值得认真回答

"${pickRandom(qaQaTitles)}"

这是我最近被问到最多的一个问题。让我从多个角度来拆解。

## 直接回答

${pickRandom([
  '有红利，而且是政策 + 技术 + 市场三重红利叠加的窗口期。但红利不属于"躺赚"的人，属于愿意深钻的人。',
  '既是风口也有割韭菜的成分。关键是看你加入的是哪种网络：有技术壁垒的价值网络，还是纯拉人头的资金盘。',
  '技术上完全可行，而且已经有成熟的工业级方案。WebGPU + ONNX Runtime + WASM 沙箱，数据全程不离开用户设备。',
  '能入局，但建议从"使用者"角色开始，逐步过渡到"开发者"角色。一鉴到底存在的意义就是降低这个门槛。',
  '差距在数据安全、可靠性和合规性三个维度。C 端娱乐用免费工具没问题，商业场景一定要用付费方案。',
  '靠谱与否取决于架构设计。端到端加密、身份认证、信誉评分、沙箱隔离——四缺一就不靠谱。',
  '不一定。90% 的业务场景用现成 API 就够了。自研只在三种情况下有必要：数据绝对不出域、极致低延迟、有充足的资源和数据。',
  '根本原因是检测工具用的是概率匹配而非语义理解。需要结合多层分析才能提高准确率。',
  '能商用，注意开源协议即可。MIT/Apache 协议的组件可以自由商用，GPL 的要注意传染性。',
  '能稳定收益，前提是网络有充足的任务量和公平的分配机制。一鉴到底的"算力积分 + 任务竞价"双轨制确保长期参与者回报。',
  '不够用。AI 攻击是多维度的，单一防护必然存在盲区。四层纵深防御才是正确的思路。',
  '会成为主流之一，和云端推理互补而非替代。未来的形态是"端云协同"，智能路由自动决策。',
  '从执行层切入。大模型领域已被巨头垄断，执行层是最大痛点且供给稀缺，客户粘性更高。',
  '不仅能实现，已是成熟方案。WebGPU + ONNX Runtime + WASM + IndexedDB，全套技术栈都已就绪。',
  '红海 = 所有人都在做的方向（套壳、绘画、写作）。蓝海 = 有需求但供给不足的方向（安全执行、政企合规、数据不出域）。看政府采购目录就能找到答案。',
])}

## 给新手的建议

如果你正在考虑入局，我的建议是：

1. **先做用户再做 maker** — 用现有的安全执行工具，亲身体验完整流程
2. **从一个细分场景切入** — 不要想做"全能 AI 平台"
3. **重视安全和合规** — 这是 ToB 市场的入场券
4. **关注政策导向** — 数据安全法、等保 2.0、信创替代都是明确的信号

---

*有问题继续问，知无不言。*`,

    beginner_guide: `## 新手必读：${pickRandom(beginnerGuideTitles)}

这篇文章写给准备入局 AI 安全执行层赛道的新手朋友。我会尽量少用术语，多用大白话。

## 你需要知道的基本概念

### 什么是"执行层"？

如果把 AI 模型比作**大脑**，那么执行层就是**身体**。

大脑可以说："帮我查一下数据库里的用户信息"。
但如果没有身体的配合——没有权限控制、没有输入校验、没有日志记录——大脑的一句话可能导致灾难。

执行层的作用：**让 AI 的能力在安全、可控、可审计的环境中落地。**

### 为什么重要？

\`\`\`
❌ 没有执行层：AI 生成代码 → 直接运行 → 可能包含漏洞
✅ 有执行层：   AI 生成代码 → 安全审计 → 沙箱执行 → 日志记录
\`\`\`

## 入门路线图（5 步走）

### Step 1：搭建本地推理环境（1-2 天）

推荐工具：
- **Ollama**（最简单的本地模型运行器）
- **LM Studio**（可视化界面，适合新手）
- **LocalAI**（兼容 OpenAI API 格式）

先跑通一个 7B 模型的本地推理，感受一下"数据不出域"是什么体验。

### Step 2：理解代码安全基础（3-5 天）

学习内容：
- OWASP Top 10（Web 安全基础）
- OWASP AI/ML Top 10（AI 安全特有风险）
- 常见漏洞类型：SQL 注入、XSS、SSRF、命令注入

推荐资源：PortSwigger Academy（免费）

### Step 3：跑通第一个沙箱（2-3 天）

可选方案：
- **Docker**（最常用，注意非 root 运行）
- **Browser WASM**（浏览器原生沙箱，零安装）
- **gVisor**（Google 出品，内核级隔离）

目标：在沙箱中执行一段代码，并验证隔离有效性。

### Step 4：学习 AI 安全工具（3-5 天）

实操练习：
- 用 **Semgrep** 做 SAST 静态扫描
- 用 **gitleaks** 扫描密钥泄露
- 用 **Presidio** 做 PII 识别和脱敏

### Step 5：找到一个真实场景（持续）

从你自己的痛点出发：
- 做内容审核？（AI + 安全过滤）
- 做代码审计？（AI + 静态分析）
- 做文档检测？（AI + 本地推理）

**最好的学习方式是用真实项目驱动。**

## 常见的 ${randomInt(5, 7)} 个坑

${pickRandom([
  '1. 把 API Key 写进代码里 → 用 .env + 密钥管理服务\n2. 用 root 跑 Docker → 创建非特权用户\n3. 默认绑定 0.0.0.0 → 绑定 127.0.0.1\n4. 不检查依赖漏洞 → 每周跑一次 audit\n5. 日志打印敏感信息 → 配置脱敏规则',
  '1. AI 生成代码不经审查就上线 → 加 Code Review 流程\n2. prompt 越长越好 → 精简高效更重要\n3. 用最新模型效果最好 → 匹配场景才关键\n4. AI 能替代程序员 → 目前只能提效 30-50%\n5. 开源模型更安全 → 可能有后门和投毒',
  '1. 卖账号/代理模式 → 无技术壁垒\n2. 刷量矩阵运营 → 平台一封号全灭\n3. 割韭菜培训 → 学员无法落地\n4. 蹭热度引流 → 转化不了',
  '1. 公网 IP 暴露节点 → NAT/反向代理\n2. 明文通信 → TLS/mTLS 加密\n3. 不设资源上限 → 容器限制 CPU/内存\n4. 信任所有任务 → 签名验证+沙箱\n5. 忽略心跳检测 → 僵尸节点拖垮队列\n6. 无退出机制 → 优雅下线',
])}

---

*入门不难，难的是坚持。加油。*`,

    architecture_inside: `## 这篇文章可能触动一些人的利益

但有些事情，总得有人说。

## ${pickRandom(architectureInsideTitles)}

### 表面现象 vs 底层真相

${pickRandom([
  '**表面**：AI 编程工具越来越强大，代码质量越来越高。\n**真相**：未经审计的 AI 生成代码，平均每 100 行含有 1.2-3.7 个安全缺陷，高危漏洞占比 15%-23%。这个数据如果公开，会让大量 AI 编程工具的叙事崩塌。',
  '**表面**：大厂积极推广浏览器端 AI 推理。\n**真相**：浏览器推理普及 = 用户不调 API = 云厂商收入下降。Google 从不大张旗鼓推广 TensorFlow.js 替代 Cloud AI API，就是这个原因。',
  '**表面**：AI 架构就是"模型→提示词→输出"。\n**真相**：真正的执行层架构至少七层：应用接入→编排→安全网关→成本路由→算力调度→统一执行→审计存证。每一层都有独立的协议、状态机、故障恢复机制。',
  '**表面**：P2P 算力是分布式计算的创新方向。\n**真相**：90% 的 P2P 算力项目死于同一个原因——忽略了"安全信任"问题。节点互信、结果验证、恶意节点隔离，做不好这些，P2P 网络就是个巨大的 DDoS 放大器。',
  '**表面**：一层安全防护就够了。\n**真相**：现代 AI 攻击是多维度的——Prompt Injection 打输入层、沙箱逃逸打执行层、模型幻觉污染输出层、日志篡改破坏审计层。四层巡检研发成本是单层的 4-5 倍，所以大家都不愿做。',
  '**表面**：免费网页 IDE 是公益项目。\n**真相**：你的代码就是他们的训练数据。GitHub Copilot 的好用程度，来自于全球开发者上传的代码。商业化 IDE 的盈利模式：卖订阅或卖数据。',
  '**表面**：混栈架构是 AI 项目的常态。\n**真相**：Python + Node.js + Rust + Go 的组合导致：每种语言安全实践不同、依赖链攻击面叠加、跨语言错误处理容易遗漏。',
  '**表面**："数据不出域"就是把数据放本地文件夹。\n**真相**：真正的不出域需要：本地推理（WebGPU/WASM）+ 内存级传递 + 模型哈希校验 + 本地审计日志。缺任何一环都是伪命题。',
  '**表面**：零信任就是"不信任任何人"。\n**真相**：零信任的核心是"每次访问都重新验证"。Agent 上一次成功调用工具，下一次仍需重新验权；节点昨天完成了 100 个任务，今天第 101 个仍需重新验证。',
  '**表面**：AI 平台都应该敢做安全赔付承诺。\n**真相**：AI 系统攻击面太广太复杂，没人敢 100% 保证不出事。一旦承诺赔付，一个漏洞就可能带来天文数字的赔偿金。所以大家都不承诺。',
])}

## 一鉴到底的技术选择

基于以上分析，一鉴到底的架构决策：

| 技术决策 | 选择 | 原因 |
|---------|------|------|
| 推理引擎 | ONNX Runtime + WebGPU | 跨平台 + 浏览器原生 + 数据不出域 |
| 沙箱方案 | WASM + Docker 双模式 | 轻量级 + 企业级双覆盖 |
| 算力调度 | EIHM-P2P-CS | 经济智能匹配 + P2P 分布式 |
| 安全防护 | 四层巡检 | 纵深防御，层层独立 |
| 审计存证 | 区块链 | 不可篡改 + 合规取证 |
| 权限管控 | 零信任 | 每次访问重新验证 |

## 七层架构全景

\`\`\`
┌─────────────────────────────────────┐
│  ① 应用接入层（API / SDK / CLI）     │
├─────────────────────────────────────┤
│  ② 编排层（DAG / 多Agent协作）       │
├─────────────────────────────────────┤
│  ③ ASS 安全网关                     │
│   （输入过滤/权限管控/零信任）         │
├─────────────────────────────────────┤
│  ④ 成本路由层                       │
│   （EIHM智能匹配/地域合规路由）        │
├─────────────────────────────────────┤
│  ⑤ P2P 算力层                       │
│   （节点管理/心跳/信誉评分）          │
├─────────────────────────────────────┤
│  ⑥ 统一执行层                       │
│   （WASM沙箱/WebGPU/Python子进程）    │
├─────────────────────────────────────┤
│  ⑦ 白盒审计层                       │
│   （区块链存证/四层巡检报告）          │
└─────────────────────────────────────┘
\`\`\`

---

*技术内幕之所以叫"内幕"，就是因为知道的人太少。*`,
  };

  return templates[category] || templates.industry_insight;
}

export { categories, authors };