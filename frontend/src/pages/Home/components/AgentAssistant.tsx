import React, { useState, useRef, useEffect } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { Eye, CheckCircle, Lock, Gavel, Send, X } from 'lucide-react';
import type { AgentConfig } from './AgentRoles';
import { agentApi, type ChatResponse } from '@/api/agentApi';

const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
}

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Eye,
  CheckCircle,
  Lock,
  Gavel,
};

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

const MOCK_REPLIES: Record<string, string[]> = {
  auditor: [
    '检测已完成。内容风险扫描结果：未发现高风险项。风险等级：中。建议优化：1) 部分表述建议明确化；2) 建议补充数据来源说明。',
    '检测已完成。当前内容合规性评分：92/100。主要风险点已标注，可查看完整检测报告获取详细信息。',
  ],
  verifier: [
    '核验已完成。通过交叉比对3个可信来源，信息真实性置信度达到94.5%。所有关键事实点均已核实无误。',
    '多维度校验完成。来源可信度评估：高。时间戳一致性：通过。逻辑完整性：通过。综合结论：该信息可被采信。',
  ],
  archiver: [
    '存证已完成。内容已生成数字指纹并完成存证，存证哈希值：0x8f2a...e4c1。时间戳已锚定，具备完整性校验能力。',
    '存证服务已完成。该记录已生成不可篡改的时间戳证明，可通过存证编号进行后续核验。请妥善保管存证凭证。',
  ],
  judge: [
    '裁决分析已完成。基于规则库匹配与风险评估，初步判定结果为：合规。完整裁决报告包含判定依据、适用规则及决策路径。',
    '智能裁决已完成。根据预设规则库第3-7条规则，本次判定结论为：通过。如对结果有异议，可申请复核流程。',
  ],
};

interface AgentAssistantProps {
  open: boolean;
  onClose: () => void;
  initialRoleId?: string;
  agents?: AgentConfig[];
}

const AgentAssistant: React.FC<AgentAssistantProps> = ({
  open,
  onClose,
  initialRoleId,
  agents: propAgents,
}) => {
  const agents = propAgents || DEFAULT_AGENTS;
  const [activeId, setActiveId] = useState<string>(
    initialRoleId || (agents.length > 0 ? agents[0].id : '')
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find((a) => a.id === activeId) || agents[0];

  useEffect(() => {
    if (open && activeId) {
      const agent = agents.find((a) => a.id === activeId);
      if (agent) {
        setMessages([
          {
            id: `welcome-${Date.now()}`,
            role: 'system',
            content: `${agent.name}已就绪，请输入待检测内容`,
            timestamp: new Date(),
            agentId: agent.id,
          },
        ]);
      }
      setInputValue('');
    }
  }, [open, activeId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectRole = (roleId: string) => {
    if (roleId === activeId) return;
    setActiveId(roleId);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      agentId: activeId,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      const currentSessionId = sessionIds[activeId];
      const res: ChatResponse = await agentApi.sendMessage({
        agent_code: activeId,
        message: inputValue.trim(),
        session_id: currentSessionId,
      });

      if (res.session_id && !sessionIds[activeId]) {
        setSessionIds((prev) => ({ ...prev, [activeId]: res.session_id }));
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        agentId: activeId,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('发送消息失败:', err);
      const replies = MOCK_REPLIES[activeId] || ['感谢您的提问，我正在为您处理中...'];
      const replyContent = replies[Math.floor(Math.random() * replies.length)];

      const fallbackMsg: Message = {
        id: `assistant-fallback-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date(),
        agentId: activeId,
      };

      setMessages((prev) => [...prev, fallbackMsg]);
      message.warning('API连接失败，已切换至本地模拟回复');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      top={50}
      footer={null}
      closable={false}
      styles={{
        body: {
          padding: 0,
          height: 560,
          display: 'flex',
          overflow: 'hidden',
        },
        content: {
          borderRadius: 6,
          overflow: 'hidden',
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        },
      }}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>模块选择</div>
          {agents.map((agent) => {
            const IconComponent = ICON_MAP[agent.icon];
            const isActive = agent.id === activeId;
            return (
              <div
                key={agent.id}
                style={{
                  ...styles.roleItem,
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  borderLeft: isActive ? `3px solid ${agent.color}` : '3px solid transparent',
                  boxShadow: isActive
                    ? '0 1px 4px rgba(0,0,0,0.06)'
                    : 'none',
                }}
                onClick={() => handleSelectRole(agent.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ ...styles.roleIconSmall, backgroundColor: agent.bgColor }}>
                  {IconComponent && (
                    <IconComponent size={16} color={agent.color} />
                  )}
                </div>
                <span style={styles.roleNameSmall}>{agent.name}</span>
                <span
                  style={{
                    ...styles.statusDotSmall,
                    backgroundColor:
                      agent.status === 'active' ? '#22C55E' : '#D1D5DB',
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={styles.mainArea}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={{ ...styles.headerIconBg, backgroundColor: currentAgent?.bgColor }}>
                {currentAgent && (() => {
                  const IconComp = ICON_MAP[currentAgent.icon];
                  return IconComp ? <IconComp size={18} color={currentAgent.color} /> : null;
                })()}
              </div>
              <div>
                <div style={styles.headerName}>{currentAgent?.name}</div>
                <div style={styles.headerDesc}>
                  {currentAgent?.description.slice(0, 30)}...
                </div>
              </div>
            </div>
            <div style={styles.headerRight}>
              <span
                style={{
                  ...styles.statusTag,
                  borderColor: currentAgent?.color,
                  color: currentAgent?.color,
                }}
              >
                {currentAgent?.status === 'active' ? '运行中' : '已停用'}
              </span>
              <button style={styles.closeBtn} onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={styles.messageArea} ref={messagesEndRef}>
            {messages.map((msg) => {
              if (msg.role === 'system') {
                return (
                  <div key={msg.id} style={styles.systemMsgWrap}>
                    <div style={{
                      ...styles.systemMsg,
                      borderLeftColor: currentAgent?.color,
                    }}>
                      {msg.content}
                      <div style={styles.timestamp}>{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                );
              }

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} style={styles.userMsgWrap}>
                    <div style={styles.userMsg}>
                      {msg.content}
                      <div style={styles.timestamp}>{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} style={styles.aiMsgWrap}>
                  <div style={{
                    ...styles.aiMsg,
                    borderLeftColor: currentAgent?.color,
                  }}>
                    {msg.content}
                    <div style={styles.timestamp}>{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div style={styles.aiMsgWrap}>
                <div style={{
                  ...styles.aiMsg,
                  borderLeftColor: currentAgent?.color,
                }}>
                  <span style={styles.typingText}>正在思考...</span>
                </div>
              </div>
            )}
          </div>

          <div style={styles.inputArea}>
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="请输入待检测内容..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={styles.textarea}
            />
            <Button
              type="primary"
              icon={<Send size={14} />}
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              loading={sending}
              style={styles.sendBtn}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    backgroundColor: '#F8FAFC',
    borderRight: '1px solid #E2E8F0',
    padding: '16px 12px',
    flexShrink: 0,
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  roleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: 4,
  },
  roleIconSmall: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleNameSmall: {
    fontSize: 14,
    fontWeight: 500,
    color: '#334155',
    flex: 1,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#0F172A',
  },
  headerDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748B',
    transition: 'background-color 0.15s',
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    backgroundColor: '#FAFBFC',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  systemMsgWrap: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  systemMsg: {
    maxWidth: '75%',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: '12px 16px',
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.6,
    borderLeft: `3px solid`,
    borderBottomLeftRadius: 4,
  },
  userMsgWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  userMsg: {
    maxWidth: '70%',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    padding: '12px 16px',
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.6,
    borderBottomRightRadius: 4,
  },
  aiMsgWrap: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  aiMsg: {
    maxWidth: '75%',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: '12px 16px',
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.6,
    borderLeft: `3px solid`,
    borderBottomLeftRadius: 4,
  },
  typingText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  inputArea: {
    padding: '16px 20px',
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    resize: 'none' as const,
    fontSize: 13,
  },
  sendBtn: {
    borderRadius: 6,
    flexShrink: 0,
    height: 38,
  },
};

export default AgentAssistant;
