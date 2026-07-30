import * as React from 'react';
import { Modal, Button, Tag, Spin, Space, Divider, Descriptions, message } from 'antd';
import {
  AlipayCircleOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  MobileOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import {
  alipayPagePay,
  alipayWapPay,
  submitAlipayForm,
  mockPay,
  isMobileDevice,
} from '@/api/paymentApi';
import styles from './index.module.css';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  orderInfo: {
    order_no: string;
    order_type: string;
    amount: number | string;
    subject: string;
    status?: string;
  } | null;
  onPaySuccess?: (result: any) => void;
}

type PaymentMethod = 'alipay' | 'mock';

type PaymentStatus = 'idle' | 'loading' | 'success';

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  orderInfo,
  onPaySuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('alipay');
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('idle');

  const mobileDevice = React.useMemo(() => isMobileDevice(), []);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!visible) {
      setPaymentMethod('alipay');
      setPaymentStatus('idle');
    }
  }, [visible]);

  // 动态计算弹窗宽度：移动端接近全屏
  const modalWidth = mobileDevice ? 'calc(100vw - 16px)' : 520;

  // Handle payment submission
  const handlePay = async () => {
    if (!orderInfo) {
      message.error('订单信息不存在');
      return;
    }

    setPaymentStatus('loading');

    try {
      if (paymentMethod === 'alipay') {
        await handleAlipayPay();
      } else {
        await handleMockPay();
      }
    } catch (error: any) {
      console.error('[PaymentModal] Payment error:', error);
      setPaymentStatus('idle');
      message.error(error?.message || '支付失败，请稍后重试');
    }
  };

  // Handle Alipay payment flow
  const handleAlipayPay = async () => {
    try {
      const payFn = mobileDevice ? alipayWapPay : alipayPagePay;
      const result = await payFn(orderInfo.order_no);

      if (result.fallback_mock) {
        message.warning('支付宝 SDK 未安装，已切换至模拟支付');
        setPaymentStatus('idle');
        setPaymentMethod('mock');
        return;
      }

      if (result.success && result.data?.payment_html) {
        submitAlipayForm(result.data.payment_html);
      } else {
        throw new Error(result.message || '获取支付信息失败');
      }
    } catch (error: any) {
      throw error;
    }
  };

  // Handle Mock payment flow (for development)
  const handleMockPay = async () => {
    try {
      const result = await mockPay(orderInfo!.order_no);

      if (result.success) {
        setPaymentStatus('success');

        if (onPaySuccess) {
          onPaySuccess(result.data);
        }

        message.success('模拟支付成功');
      } else {
        throw new Error(result.message || '模拟支付失败');
      }
    } catch (error: any) {
      throw error;
    }
  };

  // Format amount display
  const formatAmount = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return numAmount.toFixed(2);
  };

  // Get order type display text
  const getOrderTypeDisplay = (orderType: string): string => {
    const typeMap: Record<string, string> = {
      vip_membership: 'VIP会员',
      quota_package: '额度包',
      digital_product: '数字商品',
      course: '课程',
    };
    return typeMap[orderType] || orderType;
  };

  // Render payment method options
  const renderPaymentMethods = () => (
    <div className={styles.paymentMethodSection}>
      <div className={styles.paymentMethodTitle}>选择支付方式</div>
      <div className={styles.paymentMethodList}>
        {/* Alipay Option */}
        <div
          className={`${styles.paymentMethodItem} ${paymentMethod === 'alipay' ? styles.selected : ''}`}
          onClick={() => paymentStatus === 'idle' && setPaymentMethod('alipay')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && paymentStatus === 'idle' && setPaymentMethod('alipay')}
        >
          <div className={styles.paymentMethodIcon}>
            <AlipayCircleOutlined />
          </div>
          <div className={styles.paymentMethodInfo}>
            <div className={styles.paymentMethodName}>支付宝</div>
            <div className={styles.paymentMethodDesc}>
              推荐使用支付宝快捷支付
            </div>
          </div>
          <div className={styles.paymentMethodCheck}>
            <span className={styles.paymentMethodCheckIcon}>
              <CheckCircleOutlined style={{ fontSize: 11 }} />
            </span>
          </div>
        </div>

        {/* Mock Payment Option */}
        <div
          className={`${styles.paymentMethodItem} ${styles.mock} ${paymentMethod === 'mock' ? styles.selected : ''}`}
          onClick={() => paymentStatus === 'idle' && setPaymentMethod('mock')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && paymentStatus === 'idle' && setPaymentMethod('mock')}
        >
          <div className={styles.paymentMethodIcon}>
            <SafetyCertificateOutlined />
          </div>
          <div className={styles.paymentMethodInfo}>
            <div className={styles.paymentMethodName}>模拟支付</div>
            <div className={styles.paymentMethodDesc}>
              开发测试用，不会产生实际扣款
            </div>
          </div>
          <div className={styles.paymentMethodCheck}>
            <span className={styles.paymentMethodCheckIcon}>
              <CheckCircleOutlined style={{ fontSize: 11 }} />
            </span>
          </div>
        </div>
      </div>

      {/* Device indicator for Alipay */}
      {paymentMethod === 'alipay' && (
        <div className={styles.deviceIndicator}>
          {mobileDevice ? <MobileOutlined /> : <DesktopOutlined />}
          <span>{mobileDevice ? '移动端 - WAP支付' : 'PC端 - 网页支付'}</span>
        </div>
      )}
    </div>
  );

  // Render loading state
  const renderLoadingState = () => (
    <div className={styles.loadingContainer}>
      <Spin
        indicator={<LoadingOutlined style={{ fontSize: 36, color: '#1677FF' }} spin />}
      />
      <div className={styles.loadingText}>正在跳转支付宝...</div>
      <div className={styles.loadingSubText}>请勿关闭此窗口</div>
    </div>
  );

  // Render success state
  const renderSuccessState = () => (
    <div className={styles.successContainer}>
      <div className={styles.successIcon}>
        <CheckCircleOutlined />
      </div>
      <div className={styles.successTitle}>支付成功</div>
      <div className={styles.successDesc}>
        您的订单已支付完成，感谢您的支持
      </div>
      <Button
        type="primary"
        className={styles.successButton}
        onClick={() => {
          onClose();
        }}
      >
        完成
      </Button>
    </div>
  );

  // Render main content based on status
  const renderContent = () => {
    if (paymentStatus === 'loading') {
      return renderLoadingState();
    }

    if (paymentStatus === 'success') {
      return renderSuccessState();
    }

    return (
      <>
        {/* Amount Display */}
        <div className={styles.amountSection}>
          <div className={styles.amountGlow} />
          <div className={styles.amountLabel}>支付金额</div>
          <div className={styles.amountValue}>
            <span className={styles.amountCurrency}>¥</span>
            <span>{orderInfo ? formatAmount(orderInfo.amount) : '0.00'}</span>
          </div>
        </div>

        <Divider className={styles.sectionDivider} />

        {/* Order Info */}
        <div className={styles.orderInfoSection}>
          <div className={styles.orderInfoTitle}>
            <SafetyCertificateOutlined className={styles.orderInfoIcon} />
            订单信息
          </div>
          <Descriptions column={1} size="small" labelStyle={{ color: '#8892a6' }}>
            <Descriptions.Item label="订单号">
              <Space size={4}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {orderInfo?.order_no || '-'}
                </span>
                {orderInfo?.status && (
                  <Tag
                    color={
                      orderInfo.status === 'paid'
                        ? 'green'
                        : orderInfo.status === 'pending'
                        ? 'blue'
                        : 'default'
                    }
                    style={{
                      marginLeft: 4,
                      fontSize: 11,
                      padding: '0 8px',
                    }}
                  >
                    {orderInfo.status === 'paid'
                      ? '已支付'
                      : orderInfo.status === 'pending'
                      ? '待支付'
                      : orderInfo.status}
                  </Tag>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="商品名称">
              {orderInfo?.subject || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="订单类型">
              {orderInfo ? getOrderTypeDisplay(orderInfo.order_type) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Payment Method Selection */}
        {renderPaymentMethods()}

        {/* Pay Button */}
        <Button
          type="primary"
          icon={<AlipayCircleOutlined className={styles.payButtonIcon} />}
          className={styles.payButton}
          onClick={handlePay}
          disabled={!orderInfo}
        >
          立即支付
        </Button>

        {/* Security Badge */}
        <div className={styles.securityBadge}>
          <SafetyCertificateOutlined className={styles.securityBadgeIcon} />
          <span>安全支付保障，资金安全有保障</span>
        </div>
      </>
    );
  };

  return (
    <Modal
      title="订单支付"
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      maskClosable={paymentStatus !== 'loading'}
      className={styles.paymentModal}
      width={modalWidth}
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  );
};

export default PaymentModal;
