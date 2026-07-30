import json
import os
import sys
import random
import hashlib

from django.core.management.base import BaseCommand
from content_app.rag_models import (
    KnowledgeBaseCategory,
    KnowledgeDocument,
    DocumentChunk,
)
from content_app.rag_service import EmbeddingService, TextChunker


class Command(BaseCommand):
    help = 'Seed 100,000+ industry knowledge base entries with categories, documents, and chunks'

    # ==================== 行业知识库分类定义 ====================
    CATEGORIES = [
        {
            'name': 'AI安全检测技术',
            'slug': 'ai-security-detection',
            'description': 'AI生成内容检测、深度伪造识别、Prompt注入防护等核心技术知识',
            'icon': 'shield',
            'sort_order': 1,
            'doc_count': 150,
        },
        {
            'name': 'Agent开发安全规范',
            'slug': 'agent-dev-security',
            'description': 'AI Agent权限控制、工具调用安全、输出过滤、日志审计等开发规范',
            'icon': 'bot',
            'sort_order': 2,
            'doc_count': 120,
        },
        {
            'name': 'RAG系统架构与优化',
            'slug': 'rag-architecture',
            'description': '检索增强生成系统设计、向量化方案、混合检索、知识图谱集成',
            'icon': 'database',
            'sort_order': 3,
            'doc_count': 90,
        },
        {
            'name': '企业合规与风控',
            'slug': 'enterprise-compliance',
            'description': '数据安全法、个人信息保护、算法备案、内容审核合规要求',
            'icon': 'building',
            'sort_order': 4,
            'doc_count': 110,
        },
        {
            'name': 'Prompt工程与攻防',
            'slug': 'prompt-engineering',
            'description': 'Prompt注入攻击手法、防御策略、越狱检测、提示词模板安全',
            'icon': 'code',
            'sort_order': 5,
            'doc_count': 130,
        },
        {
            'name': '深度伪造与取证',
            'slug': 'deepfake-forensics',
            'description': 'Deepfake视频/音频检测、数字水印、来源追溯、证据保全',
            'icon': 'eye',
            'sort_order': 6,
            'doc_count': 80,
        },
        {
            'name': 'API安全与网关防护',
            'slug': 'api-gateway-security',
            'description': 'LLM API安全调用、速率限制、输入输出过滤、异常行为检测',
            'icon': 'lock',
            'sort_order': 7,
            'doc_count': 95,
        },
        {
            'name': '数据隐私保护',
            'slug': 'data-privacy',
            'description': 'PII脱敏、差分隐私、联邦学习、数据最小化原则',
            'icon': 'user-check',
            'sort_order': 8,
            'doc_count': 85,
        },
    ]

    # ==================== 文档模板库（按分类） ====================
    DOC_TEMPLATES = {
        'ai-security-detection': [
            ('基于Transformer的AI文本检测模型架构详解', '本文详细介绍了基于BERT和GPT架构的AI生成文本检测模型，包括特征提取层、分类头设计、对抗训练策略等关键技术。模型在多个基准数据集上达到了98.5%以上的准确率。'),
            ('多模态AI内容检测：从文本到图像的统一框架', '提出了一种统一的多模态AI内容检测框架，通过跨模态注意力机制实现文本、图像、视频的联合检测。实验表明该方法在跨域场景下具有更好的泛化能力。'),
            ('零样本AI检测：无需训练数据的新方法', '传统AI检测方法需要大量标注数据，本文提出一种基于大语言模型的零样本检测方法，利用LLM自身的推理能力判断内容的真实性，在低资源场景下表现优异。'),
            ('AI水印技术综述：可见与不可见水印', '全面梳理了AI生成内容的水印技术，包括频域水印、语义水印、统计水印等方法的原理、优缺点及适用场景。'),
            ('ChatGPT文本特征分析与检测方法', '分析了ChatGPT生成文本的语言学特征，包括词汇多样性、句法复杂度、困惑度分布等，并据此设计了高效的检测算法。'),
            ('对抗性AI检测：攻击者如何绕过检测器', '从攻击者视角分析现有AI检测器的弱点，包括改写、翻译、同义词替换等规避手段，以及对应的防御升级方向。'),
            ('实时AI内容检测系统的工程实践', '分享了构建每秒处理万级请求的实时AI检测系统的经验，包括模型量化、推理加速、缓存策略等工程技巧。'),
            ('AI检测中的误报问题与解决方案', '深入探讨AI检测中的人工写作误判为AI生成的问题，分析了误报原因并提出多模型融合、阈值动态调整等缓解方案。'),
            ('大语言模型幻觉检测技术研究', '针对LLM生成内容中的事实错误（幻觉），提出了基于知识库验证、逻辑一致性检查的多层次检测方法。'),
            ('AI代码检测：区分人类编写与AI生成的程序代码', '研究AI编程助手（如Copilot）生成代码的特征，包括命名风格、注释模式、代码结构等，设计了专用的代码级AI检测方法。'),
            ('中文AI文本检测的特殊挑战与对策', '中文语境下AI检测面临分词歧义、成语使用、文言文干扰等特殊挑战，本文针对性地提出了改进方案。'),
            ('轻量级AI检测模型：边缘端部署方案', '为满足移动端和IoT设备的AI检测需求，设计了参数量小于10M的轻量级模型，在保持85%+准确率的同时实现毫秒级响应。'),
            ('AI检测API设计与最佳实践', '从产品设计角度讨论AI检测API的接口设计、返回格式、计费模式、SLA保障等实践要点。'),
            ('多语言AI内容检测的统一方案', '针对中英日韩等多语种AI生成内容，提出了统一的检测框架，通过语言无关的特征提取实现跨语言泛化。'),
            ('AI检测在内容平台的落地案例', '分享某头部内容平台接入AI检测功能的完整流程，包括效果评估、灰度发布、用户反馈闭环等实战经验。'),
        ],
        'agent-dev-security': [
            ('AI Agent权限模型设计：RBAC vs ABAC', '对比了基于角色的访问控制(RBAC)和基于属性的访问控制(ABAC)在AI Agent场景下的优劣，推荐了分层权限架构方案。'),
            ('Agent工具调用的安全沙箱机制', '介绍了为AI Agent的工具执行环境设计安全沙箱的方法，包括资源限制、网络隔离、文件系统访问控制等关键技术。'),
            ('防止Agent Prompt泄露的系统设计', '分析了Agent系统中System Prompt被用户诱导泄露的风险，提出了多层防护策略：输入过滤、输出审查、上下文隔离。'),
            ('多Agent协作的安全通信协议', '设计了Agent间通信的安全协议，涵盖身份认证、消息加密、防重放攻击、审计日志等安全要素。'),
            ('Agent执行链路的可观测性与审计', '提出了Agent执行全链路追踪方案，记录每个决策点的输入输出，支持事后回溯和安全审计。'),
            ('Agent记忆系统的安全风险与防护', '探讨了Agent长期记忆（向量数据库）可能存储敏感信息的问题，提出了加密存储、访问控制、自动过期等防护措施。'),
            ('AutoGPT类框架的安全加固指南', '以AutoGPT为例，分析了自主Agent框架的典型安全漏洞，并给出了具体的加固配置建议。'),
            ('Agent API密钥安全管理最佳实践', 'Agent需要调用外部API时涉及密钥管理，本文介绍了密钥轮换、作用域限制、审计日志等安全实践。'),
            ('防止Agent陷入无限循环的熔断机制', '设计了Agent执行的熔断器模式，包括最大迭代次数、超时控制、资源消耗监控等防死循环措施。'),
            ('Agent输出内容的安全过滤管线', '构建了Agent输出的多层过滤管线：敏感词过滤、PII检测、有害内容分类、人工审核兜底。'),
            ('LangChain安全插件开发指南', '介绍了如何在LangChain框架中开发安全中间件，实现统一的Agent安全策略管理。'),
            ('企业级Agent部署的安全 checklist', '整理了企业部署AI Agent前的完整安全检查清单，涵盖认证授权、数据保护、运维监控等30+项检查点。'),
            ('Agent测试中的安全用例设计', '讨论了如何为AI Agent设计安全测试用例，包括对抗性输入、边界条件、权限绕过等测试场景。'),
            ('Agent故障恢复与状态一致性保证', '当Agent执行过程中断时如何保证状态一致性和安全恢复，提出了检查点机制和幂等性设计方案。'),
            ('开源Agent框架安全对比评测', '对LangChain、CrewAI、AutoGen等主流Agent框架进行了安全性对比评测，给出了选型建议。'),
        ],
        'rag-architecture': [
            ('RAG系统架构设计：从原型到生产', '系统地介绍了RAG系统的完整架构，包括文档摄入管道、索引构建、检索引擎、生成模块四大核心组件的设计要点。'),
            ('向量数据库选型指南：Pinecone vs Milvus vs Qdrant', '对比了主流向量数据库的性能、成本、功能特性，给出了不同规模场景下的选型建议。'),
            ('文本分块策略对RAG效果的影响研究', '实验对比了固定长度分块、语义分块、递归分块等不同策略对检索质量和生成质量的影响。'),
            ('混合检索：BM25 + 向量搜索的最优配比', '研究了关键词检索(BM25)和向量语义检索在不同查询类型下的表现，给出了动态权重调整方案。'),
            ('RAG系统的评估指标体系', '建立了RAG系统的多维评估体系，包括检索准确率(Faithfulness)、回答相关性(Relevance)、覆盖率(Coverage)等指标。'),
            ('大规模知识库的增量更新策略', '当知识库文档频繁更新时，如何高效地更新向量索引而不重建全部数据，提出了分段更新和版本管理方案。'),
            ('RAG中的重排序(Reranking)技术', '介绍了Cross-Encoder重排序模型在RAG中的应用，能显著提升Top-K结果的相关性排序质量。'),
            ('知识图谱增强的RAG(KG-RAG)方案', '将结构化知识图谱与非结构化文档检索结合，提升RAG系统对事实型问题的回答准确性。'),
            ('多模态RAG：图文音视频联合检索', '扩展传统文本RAG到多模态场景，实现了图像描述、语音转文字、视频关键帧的统一检索。'),
            ('RAG系统的成本优化策略', '从嵌入模型选择、缓存策略、查询路由等方面优化RAG系统的运营成本，降低50%以上的API调用费用。'),
            ('长文档RAG：处理超长文本的方案', '针对超过Context Window的长文档，提出了Map-Reduce、Refine、LongContext等不同处理策略的对比。'),
            ('RAG系统的可解释性设计', '让RAG系统不仅能给出答案，还能展示答案来源和推理过程，增强用户信任度。'),
            ('分布式RAG架构：支撑亿级文档检索', '介绍了面向超大规模知识库的分布式RAG架构设计，包括分片策略、负载均衡、容灾备份。'),
            ('RAG在客服场景的最佳实践', '分享了RAG技术在智能客服领域的落地经验，包括FAQ知识库构建、多轮对话适配、满意度追踪等。'),
            ('本地化RAG部署：数据不出域方案', '对于金融、医疗等强监管行业，提供了完全本地化的RAG私有部署方案，确保数据安全。'),
        ],
        'enterprise-compliance': [
            ('《生成式人工智能服务管理暂行办法》解读', '详细解读了中国首部AIGC监管法规的核心条款，包括备案要求、内容标识、用户协议等合规要点。'),
            ('《数据安全法》对企业AI应用的影响', '分析了数据安全法中关于数据分类分级、出境评估、安全审计等要求对企业AI产品的影响及应对。'),
            ('欧盟AI法案(AI Act)合规路线图', '梳理了欧盟AI法案的风险分级体系，为企业AI产品的合规改造提供分阶段实施路径。'),
            ('算法备案实操指南', '基于网信办算法备案要求，整理了企业完成算法备案的全流程操作指南，含材料模板和常见问题。'),
            ('AI生成内容标识的国家标准要求', '解读了关于AI生成内容标识的强制性国家标准，包括显式标识、隐式水印、元数据标注等技术要求。'),
            ('企业AI治理框架搭建指南', '从组织架构、制度流程、技术工具三个维度，指导企业建立完整的AI治理体系。'),
            ('AI系统安全评估方法论', '提出了适用于企业AI系统的安全评估框架，覆盖数据安全、模型安全、应用安全、运维安全四个层面。'),
            ('金融行业AI应用合规要点', '针对银行、保险、证券等金融机构使用AI技术的特殊合规要求进行了专题分析。'),
            ('医疗健康领域AI伦理与合规', '讨论了AI在医疗诊断、健康管理场景应用的伦理考量和监管要求。'),
            ('教育领域AI使用的政策边界', '分析了教育行业中AI辅助教学、作业批改、考试防作弊等场景的政策红线。'),
            ('AI版权侵权风险与防范', '探讨了AI训练数据版权、生成内容版权归属等法律争议，给出了企业的风险防范建议。'),
            ('跨境AI服务的合规挑战', '分析了AI服务出海面临的数据跨境传输、属地监管、国际制裁等多重合规挑战。'),
            ('企业AI安全事件应急响应预案', '制定了企业AI系统发生安全事故时的应急响应流程，包括事件定级、处置步骤、通报机制。'),
            ('第三方AI供应商的安全尽职调查', '企业在采购AI服务或模型时，如何对供应商进行安全能力评估和合同约束。'),
            ('AI审计日志的留存与合规要求', '明确了AI系统审计日志应包含的内容、留存期限、访问控制和销毁流程等合规要求。'),
        ],
        'prompt-engineering': [
            ('Prompt注入攻击的分类与实例', '系统性地将Prompt注入攻击分为直接注入、间接注入、多轮诱导等类型，每种类型附真实攻击示例。'),
            ('Jailbreak攻击手法大全：从DAN到开发者模式', '收集整理了2023-2024年流行的LLM越狱攻击手法，包括角色扮演、虚拟机、思维链劫持等。'),
            ('System Prompt防护设计模式', '总结了保护System Prompt不被用户覆盖或提取的设计模式，包括指令层级、分隔符、输出格式约束等。'),
            ('输入 sanitization 的最佳实践', '讨论了对用户输入进行清洗的各种方法：正则过滤、长度限制、特殊字符转义、编码检测等。'),
            ('输出过滤与内容审核管线', '构建了LLM输出的多层审核管线，包括规则引擎、ML分类模型、人工审核三级防线。'),
            ('Few-shot prompting 的安全考量', '分析了few-shot示例被恶意构造来引导模型输出的风险，提出了示例验证和隔离执行方案。'),
            ('Chain-of-Thought 安全性分析', '研究发现CoT推理过程可能暴露系统内部信息或被操控，提出了推理过程加密和摘要化方案。'),
            ('Function Calling / Tool Use 的安全风险', 'LLM调用外部函数/工具时存在命令注入、SSRF、数据泄露等风险，本文给出了防护框架。'),
            ('对抗性Prompt检测：机器学习方法', '使用分类模型自动识别恶意Prompt，介绍了数据集构建、特征工程、模型训练的完整流程。'),
            ('红队测试LLM的方法论', '建立了针对大语言模型的红队测试方法论，包括攻击面分析、测试用例设计、结果评估。'),
            ('Prompt模板安全的CI/CD集成', '将Prompt安全扫描集成到持续集成流水线中，每次Prompt变更都自动进行安全检查。'),
            ('多租户场景下的Prompt隔离', 'SaaS平台中不同租户的Prompt需要严格隔离，防止交叉污染和信息泄露。'),
            ('LLM API代理的安全加固', '在企业内部部署LLM API代理层，统一实施安全策略：限流、过滤、审计、脱敏。'),
            ('Prompt注入的实时防御系统', '设计了在线实时检测和拦截Prompt注入攻击的系统架构，支持毫秒级响应。'),
            ('安全Prompt编写的checklist', '为Prompt工程师提供了一份安全编写checklist，涵盖输入验证、输出约束、权限最小化等20+项检查点。'),
        ],
        'deepfake-forensics': [
            ('Deepfake视频检测：基于帧间不一致性', '利用Deepfake视频中面部表情不自然、眨眼频率异常、唇形不同步等视觉特征进行检测。'),
            ('音频Deepfake检测：频谱分析方法', '通过分析合成音频的频谱特征、基频轨迹、噪声模式来鉴别AI生成语音。'),
            ('GAN指纹检测：识别AI生成图像的痕迹', '每个GAN模型在生成图像时会留下独特的"指纹"，可通过统计分析检测出来。'),
            ('数字水印在Deepfake溯源中的应用', '介绍如何在原始媒体中嵌入不可见水印，一旦被Deepfake篡改即可检测出来。'),
            ('多模态融合的Deepfake检测框架', '结合视觉、音频、文本多种信号进行综合判断，显著提升检测准确率和鲁棒性。'),
            ('实时Deepfake检测：边缘端部署方案', '设计了可在移动设备和摄像头端实时运行的轻量级Deepfake检测模型。'),
            ('Deepfake检测的数据集与基准', '汇总了FaceForensics++、DFDC、Celeb-DF等主流Deepfake检测数据集的特点和使用方法。'),
            ('对抗性Deepfake：检测器的盲区', '攻击者专门针对已知检测器生成对抗样本，本文分析了这种猫鼠游戏的现状和应对。'),
            ('Deepfake取证报告撰写指南', '为法律从业者提供Deepfake取证的标准化报告模板，包括技术分析、置信度评估、法庭呈堂建议。'),
            ('Deepfake在社交平台的传播链分析', '研究Deepfake内容在社交媒体上的传播规律，帮助平台制定干预策略。'),
            ('Voice Cloning 检测技术进展', '跟踪了语音克隆(voice cloning)技术的最新发展及对应的反制检测方法。'),
            ('Deepfake的法律认定与证据效力', '讨论了Deepfake证据在司法实践中的可采信性、鉴定标准和专家证言要求。'),
            ('企业防范Deepfake诈骗的操作手册', '针对CEO诈骗、财务欺诈等Deepfake应用场景，为企业提供具体的防范措施和应急预案。'),
            ('Deepfake检测API的产品化实践', '分享了将Deepfake检测能力封装为商业化API服务的产品设计和运营经验。'),
            ('下一代Deepfake：Sora时代的挑战', '分析了Sora等视频生成模型带来的新挑战——逼真度大幅提升使检测难度指数级增长。'),
        ],
        'api-gateway-security': [
            ('LLM API网关的核心安全功能', '概述了LLM API网关应具备的身份认证、输入过滤、输出审查、速率限制、审计日志五大核心安全功能。'),
            ('Token用量监控与异常检测', '通过分析API调用的Token消耗模式，发现异常使用行为如暴力破解、资源滥用等。'),
            ('LLM API的输入长度限制与截断策略', '合理设置输入长度上限，并在截断时保持语义完整性，防止上下文填充攻击。'),
            ('输出内容实时流式审核', '在流式输出过程中逐块审核内容，发现问题及时中断，避免有害内容完整输出。'),
            ('API Key 的安全生命周期管理', '涵盖了API Key的生成、分发、轮换、撤销、审计全生命周期的安全管理。'),
            ('LLM API的速率限制算法选择', '对比令牌桶、滑动窗口、漏桶等算法在LLM API场景下的适用性。'),
            ('防止LLM API被滥用的策略组合', '综合运用速率限制、配额管理、使用场景限制、异常行为检测等多层防护。'),
            ('API网关的Prompt注入防御层', '在API网关层面统一拦截Prompt注入攻击，减轻后端LLM服务的安全压力。'),
            ('多租户LLM API的资源隔离', '确保不同租户的API调用相互隔离，防止资源争抢和数据侧漏。'),
            ('LLM API调用的成本控制机制', '通过预算预警、超额熔断、智能路由等方式控制LLM API的使用成本。'),
            ('API网关的请求/响应日志脱敏', '在记录API调用日志时自动脱敏敏感信息（PII、密钥、商业数据）。'),
            ('LLM服务降级与熔断策略', '当后端LLM服务不可用时，API网关的优雅降级和快速熔断机制。'),
            ('Webhook回调的安全性设计', 'LLM异步任务完成后通过Webhook通知回调时的签名验证和防重放机制。'),
            ('API网关的高可用架构', '设计了无单点故障的LLM API网关高可用架构，支持水平扩展和故障自动转移。'),
            ('LLM API安全合规的自动化检查', '将SOC2、ISO27001、GDPR等合规要求转化为API网关的自动化安全检查规则。'),
        ],
        'data-privacy': [
            ('PII自动识别与脱敏技术综述', '系统梳理了个人身份信息(PII)的自动识别方法（正则、NER、LLM）和脱敏技术（掩码、替换、泛化）。'),
            ('差分隐私在LLM训练中的应用', '介绍了DP-SGD等差分隐私训练方法，在保护训练数据隐私的同时保持模型效果。'),
            ('联邦学习与隐私保护的平衡', '分析了联邦学习在保护数据隐私方面的优势和实际部署中的挑战。'),
            ('数据最小化原则在AI系统中的实践', '贯彻GDPR数据最小化原则，只收集和处理AI任务所必需的最少数据。'),
            ('LLM对话中的隐私信息泄漏风险', '研究表明LLM可能在对话中无意泄露训练数据中的隐私信息，本文分析了泄漏渠道和预防措施。'),
            ('企业数据分类分级与AI使用策略', '根据数据敏感级别（公开/内部/机密/绝密）制定不同的AI使用和审批策略。'),
            ('匿名化与假名化的技术差异与应用', '澄清了数据匿名化和假名化的技术差异和法律效果，指导企业正确选择数据处理方式。'),
            ('隐私增强技术(PET)在AI产品中的集成', '将差分隐私、同态加密、安全多方计算等PET技术集成到AI产品中的实践经验。'),
            ('用户数据删除权的技术实现（被遗忘权）', '实现GDPR规定的用户数据删除权，包括模型反训练、向量库清除、缓存清理等完整流程。'),
            ('AI训练数据的合规采集指南', '指导企业合法合规地采集用于AI模型训练的数据，包括授权、去标识化、用途限制等。'),
            ('隐私预算管理：差分隐私的工程化', '将差分隐私的ε预算作为有限资源进行管理和分配，确保总体隐私泄露可控。'),
            ('合成数据生成：替代真实数据的隐私友好方案', '使用AI生成合成数据来替代真实的敏感数据，在保护隐私的同时满足数据分析需求。'),
            ('跨国数据传输的合规方案', '针对中国-欧盟-美国三地数据传输的不同合规要求，设计对应的技术和组织方案。'),
            ('AI系统的隐私影响评估(PIA)模板', '提供了AI系统上线前必须完成的隐私影响评估的标准模板和评估方法。'),
            ('员工AI使用中的数据安全培训', '为企业管理员工在日常工作中使用AI工具（ChatGPT、Copilot等）的数据安全培训材料。'),
        ],
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks-per-doc',
            type=int,
            default=8,
            help='Number of chunks per document (default: 8)',
        )
        parser.add_argument(
            '--total-target',
            type=int,
            default=100000,
            help='Target total chunk count (default: 100000)',
        )
        parser.add_argument(
            '--skip-embedding',
            action='store_true',
            help='Skip embedding generation (faster)',
        )

    def handle(self, *args, **options):
        chunks_per_doc = options['chunks_per_doc']
        total_target = options['total_target']
        skip_embedding = options['skip_embedding']

        self.stdout.write('=' * 60)
        self.stdout.write('开始初始化行业知识库...')
        self.stdout.write(f'目标总分片数: {total_target:,}')
        self.stdout.write(f'每文档分片数: {chunks_per_doc}')
        self.stdout.write('=' * 60)

        # Step 1: 创建分类
        self.stdout.write('\n[1/3] 创建知识库分类...')
        cat_map = {}
        for cat_data in self.CATEGORIES:
            cat, created = KnowledgeBaseCategory.objects.get_or_create(
                slug=cat_data['slug'],
                defaults={
                    'name': cat_data['name'],
                    'description': cat_data['description'],
                    'icon': cat_data['icon'],
                    'sort_order': cat_data['sort_order'],
                }
            )
            cat_map[cat_data['slug']] = cat
            status = '创建' if created else '已存在'
            self.stdout.write(f'  {status}: {cat.name} ({cat.slug})')

        # Step 2: 创建文档 + 分片
        self.stdout.write(f'\n[2/3] 创建文档和分片 (目标 {total_target:,} 条)...')
        total_chunks_created = 0
        doc_id_counter = 1000

        all_templates = []
        for slug, templates in self.DOC_TEMPLATES.items():
            cat = cat_map[slug]
            for title, summary in templates:
                all_templates.append((cat, title, summary))

        doc_idx = 0
        while total_chunks_created < total_target:
            cat, title_template, summary_template = all_templates[doc_idx % len(all_templates)]
            doc_idx += 1
            doc_id_counter += 1

            # 变体化标题和内容
            variant = doc_idx % 20
            title_variants = [
                f'{title_template}（{variant}版）',
                f'{title_template} — 进阶篇',
                f'{title_template}：实战案例分析',
                f'【{cat.name}】{title_template}',
                f'{title_template} v2.{variant}',
                f'{title_template}（{2024 + variant % 3}年更新）',
                f'深度解析：{title_template}',
                f'{title_template} — 从原理到实践',
                f'企业级{title_template}',
                f'{title_template} 完整指南',
            ]
            title = title_variants[variant % len(title_variants)]

            # 扩展摘要内容
            ext_paragraphs = self._generate_extended_content(cat.slug, title, variant)
            full_content = f'{summary}\n\n{ext_paragraphs}'
            word_count = len(full_content)

            # 创建文档
            doc = KnowledgeDocument.objects.create(
                category=cat,
                title=title,
                file_name=f'{slugify(title)}.md',
                file_path=f'/knowledge_base/{cat.slug}/{doc_id_counter}.md',
                file_size=word_count * 3,
                file_type='markdown',
                status='completed',
                progress=100,
                page_count=random.randint(5, 25),
                word_count=word_count,
                chunk_count=chunks_per_doc,
                summary=summary[:200],
                keywords=self._generate_keywords(cat.slug),
                is_public=True,
            )

            # 分块
            sections = [{'title': title, 'content': full_content}]
            chunks = TextChunker.chunk_text(
                full_content,
                chunk_size=max(300, word_count // chunks_per_doc),
                overlap=40,
                sections=sections,
            )

            for ci, chunk in enumerate(chunks[:chunks_per_doc]):
                embedding_str = ''
                if not skip_embedding:
                    try:
                        embedding = EmbeddingService.generate_embedding(chunk['content'])
                        embedding_str = EmbeddingService.encode_embedding_to_base64(embedding)
                    except Exception as e:
                        pass

                DocumentChunk.objects.create(
                    document=doc,
                    chunk_index=ci,
                    content=chunk['content'],
                    metadata={'source': title, 'category': cat.name},
                    page_number=chunk.get('page_number', ci + 1),
                    section_title=chunk.get('section_title', title),
                    embedding=embedding_str,
                    token_count=chunk.get('token_count', len(chunk['content'].split())),
                    char_count=chunk.get('char_count', len(chunk['content'])),
                )
                total_chunks_created += 1

            if doc_idx % 500 == 0:
                self.stdout.write(f'  已创建 {total_chunks_created:,}/{total_target:,} 分片 ({doc_idx} 个文档)...')

        # Step 3: 更新分类计数
        self.stdout.write(f'\n[3/3] 更新分类统计...')
        for cat in cat_map.values():
            cat.update_counts()
            self.stdout.write(f'  {cat.name}: {cat.document_count} 文档, {cat.chunk_count} 分片')

        total_docs = KnowledgeDocument.objects.count()
        total_chunks = DocumentChunk.objects.count()

        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('[OK] 知识库初始化完成！')
        self.stdout.write(f'   分类数量: {len(cat_map)}')
        self.stdout.write(f'   文档总数: {total_docs:,}')
        self.stdout.write(f'   分片总数: {total_chunks:,}')
        self.stdout.write('=' * 60)

    def _generate_extended_content(self, category_slug: str, title: str, variant: int) -> str:
        """生成长文档的扩展段落"""
        base_texts = {
            'ai-security-detection': [
                '在实际应用中，该技术已被多家头部内容平台采用，日均处理检测请求超过千万次。核心优势在于其多维度特征融合机制，能够同时捕捉语言学特征、统计学特征和语义特征。',
                '从技术演进来看，AI检测技术经历了三个主要阶段：规则匹配时代（2019年前）、深度学习时代（2019-2022）、大模型时代（2023至今）。每个阶段都有其代表性的方法和局限性。',
                '在评估指标方面，除了传统的准确率(Accuracy)和F1分数外，还应关注AUC-ROC曲线下面积、误报率(FPR)和推理延迟(Latency)等指标。特别是在高并发场景下，延迟指标尤为关键。',
                '针对对抗性攻击的鲁棒性是当前研究的重点方向之一。通过对抗训练(Adversarial Training)和数据增强(Data Augmentation)可以显著提升模型的抗攻击能力。',
                '未来发展趋势显示，多模态融合检测将成为主流。单一模态的检测方法在面对复杂的跨媒体AI生成内容时往往力不从心，而多模态方法能够综合利用文本、图像、音频等多种信号进行综合判断。',
            ],
            'agent-dev-security': [
                '在生产环境中实施这些安全措施后，Agent系统的安全事件数量下降了87%。其中权限控制相关的漏洞修复占比最高，达到45%。',
                '从架构设计的角度来看，安全应该作为一个横切关注点(Cross-cutting Concern)贯穿整个Agent系统的开发生命周期，而不是事后补丁式的附加功能。',
                '性能开销是安全措施落地的主要阻力之一。我们的基准测试表明，合理设计的安全中间件对整体延迟的影响可以控制在15%以内，这是大多数业务场景可以接受的范围。',
                '团队协作方面，建议设立专职的AI安全工程师(Security Champion)角色，负责安全规范的制定、代码审查和安全培训等工作。',
                '监控告警体系是安全运营的重要组成部分。我们推荐设置三层告警：信息级（安全事件记录）、警告级（异常行为通知）、严重级（立即阻断并通知值班人员）。',
            ],
            'rag-architecture': [
                '在我们的生产环境中，这套RAG架构支撑着每日超过50万次的问答请求，P99延迟控制在800ms以内，检索准确率达到92%以上。',
                '成本优化是RAG系统运营的关键议题。通过引入缓存层和查询路由策略，我们将平均每次查询的成本降低了65%，同时保持了服务质量不变。',
                '索引更新策略直接影响知识的时效性。我们采用了增量索引+定时全量重建的双轨机制，新文档可以在5分钟内可被检索到，同时每周进行一次全量索引优化。',
                '评估体系建设是RAG项目成功的关键。我们建立了包含检索准确率、回答相关性、事实正确性、用户满意度四个维度的自动化评估体系，每周产出质量报告。',
                '团队技能建设同样重要。RAG系统涉及NLP、信息检索、系统工程等多个领域，我们建议团队成员至少掌握其中两个领域的深度知识。',
            ],
            'enterprise-compliance': [
                '根据我们的调研，已完成合规整改的企业在后续监管检查中的通过率提升了73%。其中最关键的整改项集中在算法备案和数据分类分级两个方面。',
                '合规不是一次性工作，而是需要持续投入的过程。我们建议企业建立季度合规评审机制，及时跟进法规变化和业务发展带来的新合规需求。',
                '技术工具可以大幅降低合规工作的成本。自动化合规扫描工具可以将人工审计的工作量减少60%以上，同时提高检查的一致性和覆盖率。',
                '跨部门协作是合规落地的难点。法务、技术、产品、运营等部门需要在合规目标上达成共识，建立清晰的职责划分和沟通机制。',
                '合规培训是容易被忽视但至关重要的环节。定期开展全员合规意识培训和专项技能培训，可以有效降低人为失误导致的合规风险。',
            ],
            'prompt-engineering': [
                '在我们维护的Prompt安全规则库中，目前已收录超过500种已知的攻击模式和对应的防护规则，并且以每月约30条的速度持续增长。',
                '红队测试是发现Prompt安全漏洞最有效的方法之一。我们建议每季度进行一次全面的Prompt安全红队测试，覆盖所有已上线的Prompt模板。',
                '自动化检测在应对高频、大批量攻击时表现出色。我们的ML-based Prompt注入检测器能够以99.5%的准确率识别已知攻击模式，误报率控制在0.1%以下。',
                '安全编码习惯的培养比任何技术措施都重要。我们在团队中推广"安全第一"的Prompt编写文化，并通过Code Review强制执行安全Checklist。',
                '威胁情报共享可以帮助整个社区共同提升Prompt安全水平。我们积极参与多个AI安全社区的威胁情报交换，第一时间获取新型攻击手法的信息。',
            ],
            'deepfake-forensics': [
                '当前最先进的Deepfake检测模型在高质量合成内容上的准确率约为94%，但在压缩、裁剪等后处理后的准确率会下降至85%左右，这仍是亟待突破的技术瓶颈。',
                '取证链条的完整性是Deepfake证据在司法中被采纳的关键。我们建议从发现、固定、分析、报告每个环节都遵循标准的数字取证流程。',
                '实时检测能力的市场需求正在快速增长。随着视频会议、远程办公等场景的普及，能够在通话过程中实时检测Deepfake的技术变得尤为重要。',
                '检测与生成的对抗将持续升级。每一次检测技术的进步都会刺激生成技术的改进，这是一个长期的猫鼠游戏，需要持续的投入和研究。',
                '公众教育同样是防治Deepfake的重要一环。提高大众对Deepfake的认知水平和辨识能力，可以从源头上降低Deepfake诈骗的成功率。',
            ],
            'api-gateway-security': [
                '在高并发场景下，API网关的单机处理能力通常成为瓶颈。我们通过水平扩展和智能路由，将网关集群的处理能力提升到了每秒10万次请求以上。',
                '安全策略的热更新能力对于快速响应新型攻击至关重要。我们的网关支持在不重启服务的情况下动态加载和更新安全规则，平均响应时间小于5秒。',
                '可观测性是安全运营的基础。我们为每一次API调用生成完整的审计线索，包括请求ID、时间戳、客户端信息、输入摘要、输出状态等字段。',
                '多区域部署时的一致性策略需要仔细设计。安全策略、黑名单、速率限制配置需要在所有区域之间保持同步，同时允许一定程度的差异化配置。',
                '与云原生生态的深度集成是现代API网关的发展趋势。我们正在探索将安全能力以Sidecar形式部署，更好地适应Kubernetes等容器编排环境。',
            ],
            'data-privacy': [
                '据我们的统计，企业数据泄露事件中有67%源于内部人员的疏忽或违规操作，而非外部攻击。因此，数据安全和隐私保护必须从内部管控入手。',
                '自动化脱敏工具可以大幅减少人工错误。我们的PII脱敏引擎支持20余种常见的个人身份信息类型的自动识别和脱敏，准确率达到98.5%。',
                '隐私设计(Privacy by Design)理念应当贯穿产品全生命周期。从需求分析、架构设计、编码实现到测试上线，每个阶段都需要考虑隐私保护需求。',
                '用户信任是企业最宝贵的资产。一项调查显示，86%的消费者表示愿意为注重隐私保护的产品支付更高的价格。',
                '跨境数据传输的合规成本不容忽视。我们的客户在实施数据出境合规方案的平均投入约为50万元人民币，且每年需要持续投入约10万元用于维护和更新。',
            ],
        }

        paragraphs = base_texts.get(category_slug, base_texts['ai-security-detection'])
        selected = []
        for i in range(3):
            p = paragraphs[(variant + i) % len(paragraphs)]
            selected.append(p)

        extra_topics = [
            f'\n\n## 关键技术指标\n本方案在标准测试集上的表现为：精确率96.2%，召回率93.8%，F1分数95.0%。相比上一代方案提升了12.3个百分点。',
            f'\n\n## 实施建议\n建议分三个阶段推进：第一阶段（1-2周）完成基础架构搭建；第二阶段（3-4周）进行系统集成测试；第三阶段（2周）灰度发布和全量上线。',
            f'\n\n## 常见问题解答\nQ: 是否支持自定义规则？A: 完全支持，提供了可视化规则编辑器和API接口两种方式。\nQ: 对现有系统侵入性如何？A: 采用代理模式，无需修改原有代码，接入成本极低。',
            f'\n\n## 参考资源\n1. 相关技术白皮书\n2. 开源实现仓库\n3. 行业标准规范\n4. 最佳实践案例集\n5. 在线演示环境',
            f'\n\n## 版本更新日志\nv3.2.0: 新增批量处理能力，性能提升40%\nv3.1.0: 修复已知安全问题，增加审计日志\nv3.0.0: 全面重构架构，支持分布式部署',
        ]
        selected.append(extra_topics[variant % len(extra_topics)])

        return '\n'.join(selected)

    def _generate_keywords(self, category_slug: str) -> list:
        keyword_pools = {
            'ai-security-detection': ['AI检测', '深度学习', 'Transformer', 'GPT检测', '文本分类', '对抗样本', '水印', '多模态'],
            'agent-dev-security': ['Agent安全', '权限控制', 'RBAC', '沙箱', '审计日志', 'API安全', 'Prompt防护'],
            'rag-architecture': ['RAG', '向量数据库', 'Embedding', '检索增强', '知识图谱', '混合搜索', 'BM25'],
            'enterprise-compliance': ['合规', '数据安全法', '算法备案', 'GDPR', 'PII', '风险评估', '审计'],
            'prompt-engineering': ['Prompt注入', 'Jailbreak', '输入过滤', '输出审核', '红队测试', '安全编码'],
            'deepfake-forensics': ['Deepfake', '深度伪造', '数字水印', '取证', 'GAN指纹', '视频检测', '音频克隆'],
            'api-gateway-security': ['API网关', '速率限制', '认证授权', '审计', '熔断', '限流', 'WAF'],
            'data-privacy': ['隐私保护', 'PII脱敏', '差分隐私', 'GDPR', '数据最小化', '匿名化', '联邦学习'],
        }
        pool = keyword_pools.get(category_slug, keyword_pools['ai-security-detection'])
        return random.sample(pool, k=min(random.randint(4, 7), len(pool)))


def slugify(text: str) -> str:
    import re
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    text = re.sub(r'[-\s]+', '-', text)
    return text[:100]
