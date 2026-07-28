import React, { useState } from 'react';
import { Modal, Input, Radio, Button, message, Avatar, Space, Tag, Divider, Tooltip, Card } from 'antd';
import { Coffee, Heart, Gift, Star, Send, MessageSquare, UserCheck } from 'lucide-react';
import tippingApi from '@/api/tippingApi';

const { TextArea } = Input;

interface TippingButtonProps {
  creatorId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  sourcePage?: string;
  sourceId?: string;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
}

const PRESET_AMOUNTS = [3, 5, 10, 20, 50];
const QUICK_MESSAGES = [
  '太棒了！感谢你的帮助！☕',
  '这个检测报告非常有用！',
  '支持一下，继续加油！💪',
  '希望能帮助更多人！🌟',
];

export default function TippingButton({
  creatorId,
  creatorName = '一鉴到底团队',
  sourcePage = 'other',
  sourceId = '',
  size = 'default',
  style,
}: TippingButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

  const finalAmount = amount || (customAmount ? parseFloat(customAmount) : null);

  const handleSendTip = async () => {
    if (!finalAmount || finalAmount < 1) {
      message.warning('请选择或输入打赏金额（最低 ¥1）');
      return;
    }
    if (!creatorId) {
      message.warning('暂无打赏对象');
      return;
    }

    setSending(true);
    try {
      const res = await tippingApi.tip.send({
        creator_id: creatorId,
        amount: finalAmount,
        message: message || undefined,
        is_anonymous: isAnonymous,
        source_page: sourcePage,
        source_id: sourceId,
        payment_method: 'test',
      });

      if ((res as any).message) {
        message.success((res as any).message);
      }
      setOpen(false);
      setAmount(null);
      setCustomAmount('');
      setMessage('');
      setIsAnonymous(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '打赏失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Tooltip title={`给 ${creatorName} 买杯咖啡 ☕`}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: size === 'small' ? '4px 12px' : size === 'large' ? '10px 24px' : '6px 16px',
            background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: size === 'small' ? 12 : size === 'large' ? 15 : 13,
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(255,107,53,0.3)',
            transition: 'all 0.2s ease',
            ...style,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Coffee size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
          {size !== 'small' && '打赏'}
        </button>
      </Tooltip>

      <Modal
        title={
          <Space>
            <Coffee size={22} style={{ color: '#FF6B35' }} />
            <span>为 {creatorName} 买杯咖啡 ☕</span>
          </Space>
        }
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={440}
        destroyOnHidden
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p style={{ color: '#86909C', fontSize: 14, margin: 0 }}>
            你的支持是创作者持续产出的最大动力
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            marginBottom: 10,
          }}>
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => { setAmount(val); setCustomAmount(''); }}
                style={{
                  padding: '10px 0',
                  borderRadius: 10,
                  border: `2px solid ${amount === val ? '#FF6B35' : '#E5E6EB'}`,
                  background: amount === val ? '#FFF7F2' : '#fff',
                  color: amount === val ? '#FF6B35' : '#333',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                ¥{val}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Input
              prefix={<span style={{ color: '#86909C', marginRight: 4 }}>¥</span>}
              placeholder="自定义金额"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^\d.]/g, ''));
                setAmount(null);
              }}
              type="number"
              min={1}
              style={{ borderRadius: 10, height: 42, fontSize: 15 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <TextArea
            placeholder="留句话给创作者（可选）..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 3 }}
            maxLength={200}
            showCount
            style={{ borderRadius: 10 }}
          />
          
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_MESSAGES.map((msg) => (
              <Tag
                key={msg}
                onClick={() => setMessage(msg)}
                style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
              >
                {msg}
              </Tag>
            ))}
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Radio.Group
            value={isAnonymous ? 'anonymous' : 'public'}
            onChange={(e) => setIsAnonymous(e.target.value === 'anonymous')}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="public">
              <UserCheck size={14} /> 公开
            </Radio.Button>
            <Radio.Button value="anonymous">
              <Gift size={14} /> 匿名
            </Radio.Button>
          </Radio.Group>
        </div>

        <Button
          type="primary"
          block
          size="large"
          icon={<Send size={16} />}
          loading={sending}
          disabled={!finalAmount || finalAmount < 1}
          onClick={handleSendTip}
          style={{
            height: 48,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
            borderColor: 'transparent',
            boxShadow: !finalAmount || finalAmount < 1 ? 'none' : '0 4px 16px rgba(255,107,53,0.35)',
          }}
        >
          {finalAmount ? `打赏 ¥${finalAmount.toFixed(2)}` : '选择金额后打赏'}
        </Button>

        <p style={{ textAlign: 'center', color: '#C9CDD4', fontSize: 11, marginTop: 10, marginBlockEnd: 0 }}>
          💡 打赏后可在「我的打赏」中查看记录
        </p>
      </Modal>
    </>
  );
}
