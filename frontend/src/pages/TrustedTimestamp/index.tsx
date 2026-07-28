import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Button, Tag, Descriptions, message, Statistic, Row, Col } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, SafetyOutlined, LinkOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

/**
 * 可信时间戳页面
 * 显示国家授时中心北京时间
 */

const TrustedTimestampPage: React.FC = () => {
  const [beijingTime, setBeijingTime] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 获取北京时间
  const fetchBeijingTime = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/auth/timestamp/now/');
      setBeijingTime(response.data);
    } catch (error) {
      message.error('获取时间失败');
    } finally {
      setLoading(false);
    }
  };

  // 自动刷新
  useEffect(() => {
    fetchBeijingTime();
    
    if (autoRefresh) {
      const interval = setInterval(fetchBeijingTime, 1000); // 每秒刷新
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // 格式化显示时间
  const formatTime = (isoTime: string) => {
    if (!isoTime) return '--';
    const date = new Date(isoTime);
    return {
      date: date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      full: date.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }),
    };
  };

  const timeDisplay = beijingTime ? formatTime(beijingTime.beijing_time) : null;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* 标题 */}
        <Card>
          <Space align="center">
            <SafetyOutlined style={{ fontSize: '32px', color: '#165DFF' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>可信时间戳服务</Title>
              <Text type="secondary">国家授时中心北京时间（UTC+8）</Text>
            </div>
          </Space>
        </Card>

        {/* 时间显示 */}
        <Card loading={loading}>
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Statistic
                title="北京时间"
                value={timeDisplay?.time || '--:--:--'}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: '36px', fontFamily: 'monospace' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="日期"
                value={timeDisplay?.date || '----/--/--'}
                valueStyle={{ fontSize: '36px', fontFamily: 'monospace' }}
              />
            </Col>
          </Row>
          
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Text style={{ fontSize: '48px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {beijingTime?.unix_timestamp || '--------'}
            </Text>
            <br />
            <Text type="secondary">Unix时间戳（毫秒级精度）</Text>
          </div>
        </Card>

        {/* 时间源信息 */}
        <Card title="时间源信息">
          <Descriptions column={2}>
            <Descriptions.Item label="时间源">
              <Tag color="blue">{beijingTime?.source || 'ntp.ntsc.ac.cn'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="时区">
              <Tag color="green">{beijingTime?.timezone || 'Asia/Shanghai'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="精度">
              <Tag color="purple">毫秒级</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="授时中心">
              <a href="http://www.ntsc.ac.cn" target="_blank" rel="noopener noreferrer">
                中国科学院国家授时中心 <LinkOutlined />
              </a>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* NTP服务器列表 */}
        <Card title="NTP服务器列表">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>国家授时中心提供以下NTP服务器：</Text>
            <Space wrap>
              <Tag color="blue">ntp.ntsc.ac.cn</Tag>
              <Tag color="blue">time1.ntsc.ac.cn</Tag>
              <Tag color="blue">time2.ntsc.ac.cn</Tag>
              <Tag color="green">cn.ntp.org.cn</Tag>
              <Tag color="orange">time.windows.com（备用）</Tag>
              <Tag color="orange">time.nist.gov（备用）</Tag>
            </Space>
          </Space>
        </Card>

        {/* 法律效力 */}
        <Card title="法律效力">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text>满足《电子签名法》对时间戳的要求</Text>
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text>司法级不可篡改证据链</Text>
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text>国家授时中心可信时间源</Text>
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text>SHA-256哈希签名</Text>
            </div>
          </Space>
        </Card>

        {/* 控制按钮 */}
        <Card>
          <Space>
            <Button 
              type="primary" 
              icon={<ClockCircleOutlined />}
              onClick={fetchBeijingTime}
              loading={loading}
            >
              手动刷新
            </Button>
            <Button 
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '暂停自动刷新' : '开启自动刷新'}
            </Button>
          </Space>
          <Text type="secondary" style={{ marginLeft: '16px' }}>
            当前状态：{autoRefresh ? '每秒自动刷新' : '手动刷新'}
          </Text>
        </Card>

      </Space>
    </div>
  );
};

export default TrustedTimestampPage;