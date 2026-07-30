import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Avatar, Tag, Space, Badge, Tooltip, Empty, Spin } from 'antd';
import {
  CustomerServiceOutlined, CloseOutlined, SendOutlined,
  PaperClipOutlined, MinusCircleOutlined, MessageOutlined
} from '@ant-design/icons';
import type { IMMessageItem } from '@/api/systemApi';
import { systemApi } from '@/api/systemApi';

const { TextArea } = Input;

interface IMChatWidgetProps {
  defaultOpen?: boolean;
}

export default function IMChatWidget({ defaultOpen = false }: IMChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<IMMessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      initSession();
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initSession = async () => {
    setLoading(true);
    try {
      const sid = localStorage.getItem('im_session_id') || `sess_${Date.now()}`;
      setSessionId(sid);
      localStorage.setItem('im_session_id', sid);
      const res = await systemApi.getIMHistory({ session_id: sid, limit: 50 });
      const list = (res?.data || []) as IMMessageItem[];
      setMessages(list);
    } catch {}
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;

    const userMsg: IMMessageItem = {
      id: Date.now(),
      session_id: sessionId,
      sender_type: 'user',
      sender_type_display: '我',
      user_id: null,
      message_type: 'text',
      content: text,
      file_url: '',
      is_read: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      const res = await systemApi.sendIMMessage({
        session_id: sessionId,
        content: text,
        message_type: 'text',
      });
      const payload = res?.data || res;
      const newSessionId = payload.session_id || sessionId;
      if (newSessionId !== sessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('im_session_id', newSessionId);
      }

      const autoReplies = (payload.auto_replies || []) as IMMessageItem[];
      if (autoReplies.length > 0) {
        setTimeout(() => {
          setMessages(prev => [...prev, ...autoReplies]);
        }, 500);
      }
    } catch {
      const fallbackMsg: IMMessageItem = {
        id: Date.now() + 1,
        session_id: sessionId,
        sender_type: 'agent',
        sender_type_display: '客服',
        user_id: null,
        message_type: 'text',
        content: '感谢您的留言，客服人员会尽快回复您。',
        file_url: '',
        is_read: true,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setInputValue(text);
    handleSend();
  };

  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 9999,
          cursor: 'pointer',
        }}
        onClick={() => { setIsOpen(true); setIsMinimized(false); setUnreadCount(0); }}
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890FF, #096DD9)',
            boxShadow: '0 4px 16px rgba(24,144,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s, box-shadow 0.3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <CustomerServiceOutlined style={{ fontSize: 26, color: '#fff' }} />
          </div>
        </Badge>
        <div style={{
          textAlign: 'center', marginTop: 4,
          fontSize: 11, color: '#666', fontWeight: 500
        }}>
          在线客服
        </div>
      </div>
    );
  }

  return (
    <div className="im-chat-widget im-chat-widget-panel" style={{
      position: 'fixed',
      right: 20,
      bottom: 20,
      width: 360,
      height: isMinimized ? 48 : 520,
      zIndex: 10000,
      borderRadius: 12,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'height 0.3s ease',
      border: '1px solid #E2E8F0',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1890FF, #096DD9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'move',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={32} style={{ background: '#E6F7FF', color: '#1890FF' }}>
            <CustomerServiceOutlined />
          </Avatar>
          <div>
            <TextS strong style={{ color: '#fff', fontSize: 14 }}>智能客服</TextS>
            <TextS style={{ color: '#BAE7FF', fontSize: 11 }}>在线 · 通常5分钟内回复</TextS>
          </div>
        </div>
        <Space size={4}>
          {!isMinimized && (
            <Tooltip title="最小化">
              <Button
                type="text"
                icon={<MinusCircleOutlined />}
                onClick={() => setIsMinimized(true)}
                style={{ color: '#fff' }}
                size="small"
              />
            </Tooltip>
          )}
          {isMinimized && (
            <Button
              type="text"
              onClick={() => setIsMinimized(false)}
              style={{ color: '#fff', fontSize: 11 }}
              size="small"
            >
              展开
            </Button>
          )}
          <Tooltip title="关闭">
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setIsOpen(false)}
              style={{ color: '#fff' }}
              size="small"
            />
          </Tooltip>
        </Space>
      </div>

      {!isMinimized && (
        <>
          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#F8FAFC' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : messages.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>
                    您好！有什么可以帮您的吗？
                  </span>
                }
              />
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{
                  display: 'flex',
                  marginBottom: 10,
                  justifyContent: msg.sender_type === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {msg.sender_type !== 'user' && (
                    <Avatar
                      size={30}
                      style={{
                        background: msg.sender_type === 'auto_reply' ? '#F0FDF4' : '#E6F7FF',
                        color: msg.sender_type === 'auto_reply' ? '#16A34A' : '#1890FF',
                        flexShrink: 0,
                        marginRight: 8,
                        fontSize: 12,
                      }}
                    >
                      {msg.sender_type === 'auto_reply' ? 'AI' : '客'}
                    </Avatar>
                  )}
                  <div style={{
                    maxWidth: '70%',
                    padding: '10px 14px',
                    borderRadius: msg.sender_type === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    background: msg.sender_type === 'user'
                      ? '#1890FF'
                      : '#fff',
                    color: msg.sender_type === 'user' ? '#fff' : '#334155',
                    fontSize: 13,
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    {msg.content}
                  </div>
                  {msg.sender_type === 'user' && (
                    <Avatar
                      size={30}
                      style={{ background: '#FEF2F2', color: '#EF4444', flexShrink: 0, marginLeft: 8, fontSize: 12 }}
                    >我</Avatar>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          <div style={{
            padding: '6px 12px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
          }}>
            {['你好', '如何使用系统？', '联系人工客服', '反馈问题'].map(q => (
              <Tag
                key={q}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
                onClick={() => handleQuickReply(q)}
              >{q}</Tag>
            ))}
          </div>

          {/* Input area */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <TextArea
              autoSize={{ minRows: 1, maxRows: 3 }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="输入消息...（Shift+Enter换行）"
              style={{ borderRadius: 8, fontSize: 13 }}
              disabled={sending}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!inputValue.trim()}
              style={{ flexShrink: 0 }}
            />
          </div>
        </>
      )}

      {isMinimized && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 8,
          cursor: 'pointer',
        }}
          onClick={() => setIsMinimized(false)}
        >
          <MessageOutlined style={{ color: '#1890FF' }} />
          <TextS style={{ color: '#334155', fontSize: 13 }}>点击展开对话 ({messages.length}条消息)</TextS>
        </div>
      )}
    </div>
  );
}

function TextS({ children, style, strong, ...rest }: any) {
  return <span style={{ ...style, fontWeight: strong ? 700 : undefined }} {...rest}>{children}</span>;
}
