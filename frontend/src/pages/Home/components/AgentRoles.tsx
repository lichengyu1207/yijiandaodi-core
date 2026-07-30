import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, Lock, Gavel, MessageSquare, Bot } from 'lucide-react';
import AgentAssistant from './AgentAssistant';
import { agentApi, type AgentPublicItem } from '@/api/agentApi';

export interface AgentConfig {
  id: string;
  code: string;
  name: string;
  icon: 'Eye' | 'CheckCircle' | 'Lock' | 'Gavel';
  color: string;
  bgColor: string;
  description: string;
  status: 'active' | 'inactive';
  enabled: boolean;
}

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'auditor',
    code: 'auditor',
    name: '安全审计模块',
    icon: 'Eye',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: '内容风险扫描 / 敏感信息识别 / 合规检查',
    status: 'active',
    enabled: true,
  },
  {
    id: 'verifier',
    code: 'verifier',
    name: '真实性核验模块',
    icon: 'CheckCircle',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    description: '来源追溯 / 交叉比对 / 置信度评估',
    status: 'active',
    enabled: true,
  },
  {
    id: 'archiver',
    code: 'archiver',
    name: '数据存证模块',
    icon: 'Lock',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    description: '数字指纹 / 时间戳锚定 / 完整性校验',
    status: 'active',
    enabled: true,
  },
  {
    id: 'judge',
    code: 'judge',
    name: '智能裁决模块',
    icon: 'Gavel',
    color: '#EA580C',
    bgColor: '#FFF7ED',
    description: '规则匹配 / 风险评估 / 决策输出',
    status: 'active',
    enabled: true,
  },
];

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Eye,
  CheckCircle,
  Lock,
  Gavel,
};

interface AgentRolesProps {
  agentConfigs?: AgentConfig[];
  onOpenAssistant?: (roleId: string) => void;
}

const AgentRoles: React.FC<AgentRolesProps> = ({ agentConfigs, onOpenAssistant }) => {
  const [apiConfigs, setApiConfigs] = useState<AgentPublicItem[] | null>(null);
  const agents = agentConfigs || (apiConfigs ? apiConfigs.map((item) => ({
    id: String(item.id),
    code: item.code,
    name: item.name,
    icon: item.icon as 'Eye' | 'CheckCircle' | 'Lock' | 'Gavel',
    color: item.color,
    bgColor: item.bg_color,
    description: item.short_desc,
    status: item.enabled ? 'active' as const : 'inactive' as const,
    enabled: item.enabled,
  })) : DEFAULT_AGENTS);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const data = await agentApi.getPublicConfigs();
        if (Array.isArray(data) && data.length > 0) {
          setApiConfigs(data as AgentPublicItem[]);
        }
      } catch (err) {
        console.error('获取Agent公开配置失败，使用默认配置:', err);
      }
    };
    fetchConfigs();
  }, []);

  const activeCount = agents.filter((a) => a.status === 'active').length;

  const handleCardClick = (roleId: string) => {
    setSelectedRoleId(roleId);
    setAssistantOpen(true);
    onOpenAssistant?.(roleId);
  };

  const handleOpenAssistant = () => {
    setSelectedRoleId('');
    setAssistantOpen(true);
    onOpenAssistant?.('');
  };

  return (
    <section style={styles.section}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>多维协同安全检测体系</h2>
            <p style={styles.subtitle}>安全审计 · 真实性核验 · 数据存证 · 智能裁决</p>
          </div>
          <button style={styles.assistBtn} onClick={handleOpenAssistant}>
            <MessageSquare size={16} />
            启动检测助手
          </button>
        </div>

        <div className="agent-roles-grid" style={styles.grid}>
          {agents.map((agent) => {
            const IconComponent = ICON_MAP[agent.icon];
            return (
              <div
                key={agent.id}
                className="agent-role-card"
                style={styles.card}
                onClick={() => handleCardClick(agent.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={styles.cardHeader}>
                  <div style={{ ...styles.iconWrapper, backgroundColor: agent.bgColor }}>
                    {IconComponent && <IconComponent size={24} color={agent.color} />}
                  </div>
                  <div style={styles.nameRow}>
                    <span style={styles.roleName}>{agent.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          ...styles.statusDot,
                          backgroundColor: agent.status === 'active' ? '#22C55E' : '#D1D5DB',
                        }}
                      />
                      <span style={styles.statusText}>
                        {agent.status === 'active' ? '运行中' : '已停用'}
                      </span>
                    </div>
                  </div>
                </div>
                <p style={styles.roleDesc}>{agent.description}</p>
              </div>
            );
          })}
        </div>

        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            <Bot size={14} style={{ marginRight: 6 }} />
            <span style={styles.footerText}>当前激活角色：</span>
            <span style={styles.footerCount}>{activeCount}</span>
            <span style={styles.footerText}> / {agents.length}</span>
          </div>
          <div style={styles.footerRight}>
            <span
              style={{
                ...styles.systemDot,
                backgroundColor: activeCount > 0 ? '#22C55E' : '#D1D5DB',
              }}
            />
            <span style={styles.footerText}>
              {activeCount > 0 ? '系统运行正常' : '系统待启动'}
            </span>
          </div>
        </div>
      </div>

      <AgentAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        initialRoleId={selectedRoleId}
        agents={agents}
      />

      <style>{`
        @media (max-width: 1024px) {
          .agent-roles-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .agent-roles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  section: {
    width: '100%',
    padding: '48px 0',
    backgroundColor: '#FFFFFF',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 24px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  assistBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    border: '1px solid #E5E6EB',
    padding: '28px 24px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nameRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  roleName: {
    fontSize: 18,
    fontWeight: 600,
    color: '#0F172A',
  },
  statusText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  roleDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 1.7,
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    color: '#64748B',
    fontSize: 13,
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    color: '#64748B',
    fontSize: 13,
  },
  footerText: {
    fontSize: 13,
    color: '#86909C',
  },
  footerCount: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1D2129',
    margin: '0 4px',
  },
  systemDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: 6,
    display: 'inline-block',
  },
};

export default AgentRoles;
