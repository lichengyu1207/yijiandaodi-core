import { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Typography, Space, Spin, Tag } from 'antd';
import { FileProtectOutlined, EyeOutlined, EyeInvisibleOutlined, CheckSquareOutlined, BorderOutlined } from '@ant-design/icons';
import type { PrivacyAgreementItem } from '@/api/systemApi';
import { systemApi } from '@/api/systemApi';

const { Text, Paragraph } = Typography;

interface PrivacyAgreementModalProps {
  open: boolean;
  onClose: () => void;
  onAgreed?: () => void;
}

export default function PrivacyAgreementModal({ open, onClose, onAgreed }: PrivacyAgreementModalProps) {
  const [agreements, setAgreements] = useState<PrivacyAgreementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailAgreement, setDetailAgreement] = useState<PrivacyAgreementItem | null>(null);

  useEffect(() => {
    if (open) fetchAgreements();
  }, [open]);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const res = await systemApi.getActiveAgreements();
      const data = res?.data || res;
      const list = (data?.data || []) as PrivacyAgreementItem[];
      setAgreements(list);
      const initial: Record<string, boolean> = {};
      list.forEach(a => { initial[a.id] = false; });
      setCheckedMap(initial);
      // 无协议数据 → 自动视为已同意并关闭弹窗，不阻塞用户
      if (list.length === 0) {
        localStorage.setItem('privacy_consent', 'true');
        onAgreed?.();
        onClose?.();
      }
    } catch {
      // API 请求失败也不阻塞用户（后端可能未配置协议接口）
      console.warn('[Privacy] 获取协议失败，自动跳过');
      localStorage.setItem('privacy_consent', 'true');
      onAgreed?.();
      onClose?.();
    }
    setLoading(false);
  };

  const handleCheck = (id: number | string, checked: boolean) => {
    setCheckedMap(prev => ({ ...prev, [id]: checked }));
  };

  const toggleExpand = (id: string | number) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openDetail = (agreement: PrivacyAgreementItem) => {
    setDetailAgreement(agreement);
    setDetailModalOpen(true);
  };

  const handleSelectAll = () => {
    const all: Record<string, boolean> = {};
    agreements.forEach(a => { all[a.id] = true; });
    setCheckedMap(all);
  };

  const handleDeselectAll = () => {
    const none: Record<string, boolean> = {};
    agreements.forEach(a => { none[a.id] = false; });
    setCheckedMap(none);
  };

  const handleAgreeAll = async () => {
    const userId = localStorage.getItem('user_id') || 'anonymous';
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const username = userInfo?.username || '';

    setSubmitting(true);
    let allOk = true;
    for (const agreement of agreements) {
      if (agreement.is_required && !checkedMap[agreement.id]) continue;
      try {
        await systemApi.submitConsent({
          user_id: userId,
          username,
          agreement_type: agreement.agreement_type,
          agreement_version: agreement.version,
          status: checkedMap[agreement.id] ? 'agreed' : 'declined',
        });
      } catch {
        allOk = false;
      }
    }

    localStorage.setItem('privacy_consent', 'true');
    localStorage.setItem('privacy_consent_time', new Date().toISOString());
    setSubmitting(false);

    if (allOk) onAgreed?.();
    onClose();
  };

  const requiredChecked = agreements
    .filter(a => a.is_required)
    .every(a => checkedMap[a.id]);

  const optionalCount = agreements.filter(a => !a.is_required).length;
  const optionalChecked = agreements
    .filter(a => !a.is_required)
    .filter(a => checkedMap[a.id]).length;

  const typeLabelMap: Record<string, string> = {
    privacy: '隐私政策',
    terms: '服务条款',
    cookie: 'Cookie政策',
  };
  const typeColorMap: Record<string, string> = {
    privacy: 'red',
    terms: 'blue',
    cookie: 'green',
  };

  return (
    <>
      <Modal
        title={
          <Space><FileProtectOutlined style={{ color: '#165DFF' }} /><span>隐私政策与用户协议</span></Space>
        }
        open={open}
        onCancel={onClose}
        destroyOnHidden
        width={680}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Button size="small" onClick={handleDeselectAll} style={{ borderRadius: 6, marginRight: 8 }}>
                <BorderOutlined /> 全不选
              </Button>
              <Button size="small" type="link" onClick={handleSelectAll} style={{ borderRadius: 6 }}>
                <CheckSquareOutlined /> 全部勾选
              </Button>
            </div>
            <Space>
              <Button onClick={onClose} style={{ borderRadius: 6 }}>稍后再说</Button>
              <Button
                type="primary"
                onClick={handleAgreeAll}
                loading={submitting}
                disabled={!requiredChecked}
                style={{ borderRadius: 6, background: '#165DFF' }}
              >
                同意并继续
              </Button>
            </Space>
          </div>
        }
        closable={false}
        maskClosable={false}
      >
        <Spin spinning={loading}>
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#F0F7FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
            <Text style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
              为了更好地为您提供服务，请您仔细阅读以下协议。点击协议标题可展开查看完整内容，
              必选项（红色标签）需要同意后才能使用本平台。
            </Text>
          </div>

          {agreements.length === 0 && !loading && (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: '#94A3B8', background: '#F8FAFC',
              borderRadius: 8, border: '1px dashed #CBD5E1',
            }}>
              <FileProtectOutlined style={{ fontSize: 36, color: '#CBD5E1', marginBottom: 12 }} />
              <p style={{ margin: 0 }}>暂无生效中的协议内容</p>
            </div>
          )}

          {agreements.map(agreement => {
            const expanded = !!expandedMap[agreement.id];
            const checked = !!checkedMap[agreement.id];
            return (
              <div key={agreement.id} style={{
                border: '1px solid ' + (checked ? '#86EFAC' : '#E2E8F0'),
                borderRadius: 8,
                marginBottom: 12,
                background: checked ? '#F0FDF4' : '#FFFFFF',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                boxShadow: checked ? '0 1px 6px rgba(34,197,94,0.12)' : 'none',
              }}>
                <div
                  onClick={() => toggleExpand(agreement.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={(e) => { e.stopPropagation(); handleCheck(agreement.id, e.target.checked); }}
                    style={{ marginTop: 2 }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong style={{ fontSize: 14, color: '#1E293B' }}>{agreement.title}</Text>
                      <Tag color={typeColorMap[agreement.agreement_type] || 'default'} style={{ borderRadius: 4, margin: 0 }}>
                        {typeLabelMap[agreement.agreement_type] || agreement.agreement_type}
                      </Tag>
                      <Tag style={{ borderRadius: 4, margin: 0 }}>v{agreement.version}</Tag>
                      {agreement.is_required && (
                        <Tag color="error" style={{ borderRadius: 4, margin: 0 }}>必选</Tag>
                      )}
                    </div>

                    {!expanded && (
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                        点击展开查看完整内容
                      </Text>
                    )}

                    {expanded && (
                      <div style={{
                        maxHeight: 260,
                        overflowY: 'auto',
                        marginTop: 10,
                        padding: 12,
                        background: '#FAFBFC',
                        borderRadius: 6,
                        border: '1px solid #F1F5F9',
                        fontSize: 13,
                        lineHeight: 1.85,
                        color: '#475569',
                      }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(agreement.content) }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2, flexShrink: 0 }}>
                    {expanded ? (
                      <EyeInvisibleOutlined style={{ color: '#94A3B8', fontSize: 14 }} />
                    ) : (
                      <EyeOutlined style={{ color: '#94A3B8', fontSize: 14 }} />
                    )}
                  </div>
                </div>

                {expanded && (
                  <div style={{
                    borderTop: '1px solid #F1F5F9',
                    padding: '6px 16px 8px',
                    textAlign: 'right',
                    background: '#FAFBFC',
                  }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={(e) => { e.stopPropagation(); openDetail(agreement); }}
                      style={{ fontSize: 12, padding: '0 4px' }}
                    >
                      新窗口查看完整内容
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {!requiredChecked && agreements.length > 0 && (
            <div style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              borderRadius: 8,
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>!</span>
              请勾选所有必选项（标有红色「必选」标签）后才能继续使用。
            </div>
          )}

          {optionalCount > 0 && agreements.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选可选协议：{optionalCount} / {optionalCount}
              </Text>
            </div>
          )}
        </Spin>
      </Modal>

      <Modal
        title={detailAgreement ? detailAgreement.title : '协议详情'}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        destroyOnHidden
        width={720}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} style={{ borderRadius: 6 }}>
            关闭
          </Button>,
        ]}
      >
        {detailAgreement && (
          <div style={{
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: 20,
            background: '#FAFBFC',
            borderRadius: 8,
            border: '1px solid #F1F5F9',
            fontSize: 14,
            lineHeight: 1.9,
            color: '#334155',
          }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(detailAgreement.content) }}
          />
        )}
      </Modal>
    </>
  );
}
