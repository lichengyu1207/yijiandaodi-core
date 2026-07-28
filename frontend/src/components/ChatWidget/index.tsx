import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, X, Bot, ShieldCheck, FileCheck, Gavel, GripVertical } from 'lucide-react';
import { agentApi } from '@/api/agentApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentRole {
  code: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const ROLE_CONFIGS: Record<string, AgentRole> = {
  auditor: {
    code: 'auditor',
    name: '审计官',
    icon: <ShieldCheck size={16} />,
    color: '#2563EB',
    bgColor: '#EFF6FF',
  },
  verifier: {
    code: 'verifier',
    name: '验证官',
    icon: <FileCheck size={16} />,
    color: '#059669',
    bgColor: '#ECFDF5',
  },
  archiver: {
    code: 'archiver',
    name: '存证官',
    icon: <Bot size={16} />,
    color: '#D97706',
    bgColor: '#FFFBEB',
  },
  judge: {
    code: 'judge',
    name: '裁决官',
    icon: <Gavel size={16} />,
    color: '#7C3AED',
    bgColor: '#F5F3FF',
  },
};

const STORAGE_KEY_PREFIX = 'chat_widget_';
const POSITION_KEY = 'chat_widget_position';
const DEFAULT_POS = { left: -1, top: -1 };

function loadPosition(): { left: number; top: number } {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_POS };
}

function savePosition(pos: { left: number; top: number }) {
  localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
}

function clampPosition(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const maxLeft = window.innerWidth - width - 8;
  const maxTop = window.innerHeight - height - 8;
  return {
    left: Math.max(8, Math.min(left, maxLeft)),
    top: Math.max(8, Math.min(top, maxTop)),
  };
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('auditor');
  const [sessionId, setSessionId] = useState<string>('');
  const [position, setPosition] = useState<{ left: number; top: number }>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, elemX: 0, elemY: 0 });
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    agentApi.getPublicConfigs().catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeRole) return;
    const savedMessages = localStorage.getItem(`${STORAGE_KEY_PREFIX}messages_${activeRole}`);
    const savedSessionId = localStorage.getItem(`${STORAGE_KEY_PREFIX}session_${activeRole}`);
    setMessages(savedMessages ? JSON.parse(savedMessages) : []);
    setSessionId(savedSessionId || '');
  }, [activeRole]);

  useEffect(() => {
    if (activeRole) localStorage.setItem(`${STORAGE_KEY_PREFIX}messages_${activeRole}`, JSON.stringify(messages));
  }, [messages, activeRole]);

  useEffect(() => {
    if (sessionId && activeRole) localStorage.setItem(`${STORAGE_KEY_PREFIX}session_${activeRole}`, sessionId);
  }, [sessionId, activeRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setUnreadCount(prev => prev + 1);
    }
  }, [messages, isOpen]);

  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: trimmedInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    try {
      const res: any = await agentApi.sendMessage({ agent_code: activeRole, message: trimmedInput, session_id: sessionId || undefined });
      const data = res?.data || res;
      if (data?.session_id) setSessionId(data.session_id);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data?.reply || res?.reply || '（无回复内容）', timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: '抱歉，消息发送失败，请稍后重试。', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, activeRole, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) { setUnreadCount(0); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const startDrag = (e: React.MouseEvent, elemWidth: number, elemHeight: number) => {
    const currentLeft = position.left >= 0 ? position.left : window.innerWidth - elemWidth - 24;
    const currentTop = position.top >= 0 ? position.top : window.innerHeight - elemHeight - 24;
    setIsDragging(true);
    setDragStart({ mouseX: e.clientX, elemX: currentLeft, elemY: currentTop });
    e.preventDefault();
  };

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.mouseX;
    const dy = e.clientY - dragStart.mouseY;
    const isOpenState = isOpen;
    const w = isOpenState ? 380 : 56;
    const h = isOpenState ? 520 : 56;
    const newPos = clampPosition(dragStart.elemX + dx, dragStart.elemY + dy, w, h);
    setPosition(newPos);
  }, [isDragging, dragStart, isOpen]);

  const onDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  }, [isDragging, position]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    return () => { window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd); };
  }, [isDragging, onDragMove, onDragEnd]);

  const currentRoleConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS.auditor;
  const posLeft = position.left >= 0 ? position.left : undefined;
  const posTop = position.top >= 0 ? position.top : undefined;

  const baseBtnStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: posTop !== undefined ? undefined : 24,
    right: posLeft !== undefined ? undefined : 24,
    left: posLeft !== undefined ? posLeft : undefined,
    top: posTop !== undefined ? posTop : undefined,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    border: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: isDragging ? '0 8px 24px rgba(37, 99, 235, 0.5)' : '0 4px 12px rgba(37, 99, 235, 0.4)',
    zIndex: 9999,
    transition: isDragging ? 'none' : 'all 0.2s ease',
    transform: isDragging ? 'scale(1.08)' : undefined,
    userSelect: 'none',
  };

  const winStyle: React.CSSProperties = {
    position: 'fixed',
    left: posLeft !== undefined ? posLeft : undefined,
    top: posTop !== undefined ? posTop : undefined,
    bottom: posTop === undefined ? 90 : undefined,
    right: posLeft === undefined ? 24 : undefined,
    width: 380,
    height: 520,
    borderRadius: 6,
    background: '#fff',
    boxShadow: isDragging ? '0 12px 40px rgba(0, 0, 0, 0.18)' : '0 8px 32px rgba(0, 0, 0, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 10000,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
  };

  return (
    <div className="chat-widget">
      <>
      <style>{`
        @keyframes pulse { 0%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes typing { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-8px);opacity:1} }
        .cw-ta::-webkit-scrollbar{width:4px} .cw-ta::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}
        .cw-msg::-webkit-scrollbar{width:4px} .cw-msg::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}
      `}</style>

      {!isOpen && (
        <button
          ref={btnRef}
          style={baseBtnStyle}
          onClick={(e) => { if (!isDragging) handleToggle(); }}
          onMouseDown={(e) => startDrag(e, 56, 56)}
          onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)'; }}}
          onMouseLeave={(e) => { if (!isDragging) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}}
        >
          <GripVertical size={12} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', top: 6 }} />
          <MessageSquare size={24} color="#fff" />
          {unreadCount > 0 && (<span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', border: '2px solid #fff' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>)}
          {unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', animation: 'pulse 2s infinite' }} />}
        </button>
      )}

      {isOpen && (
        <div className="chat-widget-panel"
          style={winStyle}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('.chat-header')) {
              startDrag(e, 380, 520);
            }
          }}
        >
          <div className="chat-header" style={{ padding: '12px 16px', background: currentRoleConfig.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <Bot size={18} />
              <span>AI 智能助手</span>
              {isDragging && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>拖动中...</span>}
            </div>
            <button onClick={handleToggle} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {Object.entries(ROLE_CONFIGS).map(([code, config]) => (
              <button key={code} onClick={() => setActiveRole(code)} style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s ease', background: 'transparent', color: '#6B7280', ...(activeRole === code ? { background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: currentRoleConfig.color } : {}) }}>
                {config.icon}
                <span>{config.name}</span>
              </button>
            ))}
          </div>

          <div className="cw-msg" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#F9FAFB' }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8 }}>
                <Bot size={40} strokeWidth={1} />
                <div style={{ fontSize: 14, textAlign: 'center', padding: '0 20px' }}>您好！我是{currentRoleConfig.name}，有什么可以帮您的？</div>
              </div>
            ) : messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 6, fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word', background: msg.role === 'user' ? '#2563EB' : '#fff', color: msg.role === 'user' ? '#fff' : '#1F2937', borderBottomRightRadius: msg.role === 'user' ? 2 : 6, borderBottomLeftRadius: msg.role === 'user' ? 6 : 2, boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, paddingHorizontal: 4 }}>{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', alignSelf: 'flex-start', alignItems: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', gap: 4 }}>
                  {[0, 0.2, 0.4].map((d, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: currentRoleConfig.color, animation: `typing 1.4s infinite ease-in-out`, animationDelay: `${d}s` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea ref={inputRef} className="cw-ta" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={`输入消息与${currentRoleConfig.name}对话...`} rows={1} style={{ flex: 1, padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, resize: 'none', outline: 'none', maxHeight: 80, fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
              onFocus={(e) => { e.target.style.borderColor = currentRoleConfig.color; e.target.style.boxShadow = `0 0 0 2px ${currentRoleConfig.bgColor}`; }}
              onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
            />
            <button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} style={{ width: 36, height: 36, borderRadius: 6, border: 'none', background: !inputValue.trim() || isLoading ? '#D1D5DB' : currentRoleConfig.color, color: '#fff', cursor: !inputValue.trim() || isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
    </div>
  );
};

export default ChatWidget;
