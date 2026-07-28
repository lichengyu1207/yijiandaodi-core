import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Code2, ShieldCheck } from 'lucide-react';
import { Modal, Button } from 'antd';

const scenarios = [
  {
    id: 'enterprise',
    title: '企业团队协作',
    subtitle: '多人协同 · 权限分级 · 合规审计',
    description:
      '企业安全团队通过多智能体分工协作，自动完成代码审计、内容审核、风险识别等任务，支持权限分级和审计追溯。',
    features: ['多角色权限管理', '自动化流水线', '合规报告生成', '实时风险看板'],
    icon: <Building2 />,
    gradient: 'from-teal-500 to-emerald-600',
  },
  {
    id: 'developer',
    title: '个人开发者校验',
    subtitle: '一键触发 · 全栈检测 · 即时反馈',
    description:
      '独立开发者只需粘贴代码或文本，即可一键触发全链路智能体校验，从语法检查到安全漏洞扫描，秒级出结果。',
    features: ['零配置启动', '多语言支持', '详细修复建议', '历史记录追踪'],
    icon: <Code2 />,
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'compliance',
    title: '合规审计场景',
    subtitle: '法规对标 · 报告导出 · 痕迹留存',
    description:
      '满足等保、GDPR、个人信息保护法等法规要求，提供完整的审计链条和可追溯的校验记录，一键生成合规报告。',
    features: ['法规模板库', '审计轨迹图', 'HashChain 存证', '报告自动生成'],
    icon: <ShieldCheck />,
    gradient: 'from-emerald-500 to-teal-600',
  },
];

const demoSteps: Record<string, string[]> = {
  enterprise: [
    '① 接收审计任务 → 分发至各角色智能体',
    '② 代码检测Agent: 扫描仓库分支差异',
    '③ 风险识别Agent: 标记高危漏洞与违规调用',
    '④ 合规校验Agent: 对照策略库逐项检查',
    '⑤ 汇总报告 → 审计归档 → 权限公示',
  ],
  developer: [
    '① 粘贴代码 / 上传文件 → 选择校验类型',
    '② Agent调度器: 自动匹配最优Agent组合',
    '③ 并行执行: 语法检查 + 安全扫描 + 风格审查',
    '④ 结果聚合: 问题分级 + 修复建议 + 行号定位',
    '⑤ 一键导出报告 / 直接修复应用',
  ],
  compliance: [
    '① 选择合规框架（等保/GDPR/个保法）',
    '② 法规模板引擎: 加载对应检测规则集',
    '③ 多维扫描: 数据流追踪 + 权限核查 + 日志审计',
    '④ HashChain存证: 校验结果不可篡改上链',
    '⑤ 生成合规报告 → 支持导出PDF/JSON',
  ],
};

const ScenarioCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const switchTo = useCallback((index: number) => {
    setActiveIndex(index);
    setIsAutoPlaying(false);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % scenarios.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const currentScenario = scenarios[activeIndex];
  const currentSteps = demoSteps[currentScenario.id] || [];

  return (
    <section
      style={{
        background: '#fff',
        padding: '96px 0',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* 装饰渐变分隔线 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            'linear-gradient(90deg, transparent, rgba(20,184,166,0.3), rgba(15,118,110,0.5), rgba(20,184,166,0.3), transparent)',
        }}
      />

      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1E293B',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          协同场景
        </motion.h2>

        {/* Tab 切换栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
            marginBottom: 48,
          }}
        >
          {scenarios.map((scenario, index) => (
            <button
              key={scenario.id}
              onClick={() => switchTo(index)}
              onMouseEnter={() => setIsAutoPlaying(false)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom:
                  activeIndex === index
                    ? '2px solid #14B8A6'
                    : '2px solid transparent',
                color: activeIndex === index ? '#0F766E' : '#64748B',
                fontWeight: activeIndex === index ? 600 : 400,
                fontSize: '1rem',
                padding: '8px 4px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit',
              }}
            >
              {scenario.title}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScenario.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            style={{
              display: 'flex',
              gap: 48,
              alignItems: 'stretch',
            }}
            className="scenario-content-wrapper"
          >
            {/* 左侧：场景信息 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${currentScenario.gradient.includes('teal') ? '#14B8A6' : currentScenario.gradient.includes('cyan') ? '#06B6D4' : '#10B981'}, ${currentScenario.gradient.includes('emerald') ? '#10B981' : currentScenario.gradient.includes('blue') ? '#2563EB' : '#14B8A6'})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  marginBottom: 24,
                }}
              >
                <div style={{ width: 40, height: 40 }}>
                  {currentScenario.icon}
                </div>
              </div>

              <h3
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: '0 0 8px',
                }}
              >
                {currentScenario.title}
              </h3>

              <p
                style={{
                  fontSize: '0.95rem',
                  color: '#14B8A6',
                  fontWeight: 500,
                  margin: '0 0 16px',
                }}
              >
                {currentScenario.subtitle}
              </p>

              <p
                style={{
                  fontSize: '1rem',
                  lineHeight: 1.7,
                  color: '#64748B',
                  margin: '0 0 24px',
                }}
              >
                {currentScenario.description}
              </p>

              {/* 特性标签列表 */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                {currentScenario.features.map((feature) => (
                  <span
                    key={feature}
                    style={{
                      backgroundColor: 'rgba(20,184,166,0.08)',
                      color: '#0F766E',
                      borderRadius: 20,
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>

              <Button
                type="link"
                style={{
                  color: '#0F766E',
                  fontWeight: 600,
                  padding: 0,
                  alignSelf: 'flex-start',
                  fontSize: '0.95rem',
                }}
                onClick={() => setModalVisible(true)}
              >
                了解更多 →
              </Button>
            </div>

            {/* 右侧：模拟演示面板 */}
            <div
              style={{
                flex: 1,
                background: '#0F172A',
                borderRadius: 16,
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 300,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 18,
                }}
              >
                {[1, 2, 3].map((dot) => (
                  <div
                    key={dot}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background:
                        dot === 1 ? '#EF4444' : dot === 2 ? '#F59E0B' : '#22C55E',
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  color: '#94A3B8',
                  fontSize: '0.82rem',
                  lineHeight: 2,
                  fontFamily: "'Consolas', 'Monaco', monospace",
                  flex: 1,
                }}
              >
                {currentSteps.map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.4 }}
                    style={{
                      padding: '4px 0',
                      color: i === currentSteps.length - 1 ? '#14B8A6' : '#94A3B8',
                      fontWeight: i === currentSteps.length - 1 ? 600 : 400,
                    }}
                  >
                    {step}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modal */}
      <Modal
        title={currentScenario.title}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <p style={{ color: '#64748B', lineHeight: 1.7, marginBottom: 16 }}>
          {currentScenario.description}
        </p>
        <h4 style={{ color: '#1E293B', marginBottom: 12 }}>核心特性</h4>
        <ul style={{ paddingLeft: 20, color: '#475569', lineHeight: 2 }}>
          {currentScenario.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Modal>

      <style>{`
        @media (max-width: 800px) {
          .scenario-content-wrapper {
            flex-direction: column !important;
          }
        }
      `}</style>
    </section>
  );
};

export default ScenarioCarousel;
