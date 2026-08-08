/**
 * 治理健康度仪表盘 - MVP 版本
 */

import React, { useState, useEffect } from 'react'
import { Card, Progress, Alert, Statistic, Row, Col, Typography } from 'antd'
import { 
  CheckCircleOutlined, 
  WarningOutlined, 
  CloseCircleOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  SafetyOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

interface HealthMetrics {
  accuracy: { 
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  performance: { 
    avgResponseTime: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  falsePositiveRate: { 
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  overallHealth: number
  overallStatus: 'healthy' | 'degraded' | 'critical'
  timestamp: number
}

interface HealthDashboardProps {
  refreshInterval?: number
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({ 
  refreshInterval = 10000 
}) => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 获取健康度指标
    const fetchMetrics = async () => {
      try {
        setError(null)
        
        // 调用 IPC API
        const result = await window.electronAPI.getHealthMetrics()
        
        if (result) {
          setMetrics(result)
        }
      } catch (err) {
        console.error('[HealthDashboard] 获取指标失败:', err)
        setError('无法获取健康度指标')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval])

  if (error) {
    return (
      <Alert
        message="错误"
        description={error}
        type="error"
        showIcon
      />
    )
  }

  if (loading || !metrics) {
    return (
      <Card loading>
        <div style={{ height: 300 }} />
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'degraded':
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'critical':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <CheckCircleOutlined />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return '#52c41a'
      case 'degraded':
      case 'warning':
        return '#faad14'
      case 'critical':
        return '#ff4d4f'
      default:
        return '#52c41a'
    }
  }

  return (
    <div className="health-dashboard" style={{ padding: '24px' }}>
      <Title level={2}>
        <DashboardOutlined /> 系统治理健康度
      </Title>
      
      {/* 整体健康度 */}
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <Progress
            type="circle"
            percent={metrics.overallHealth}
            strokeColor={getStatusColor(metrics.overallStatus)}
            format={percent => (
              <div>
                <div style={{ fontSize: 36, fontWeight: 'bold' }}>
                  {percent?.toFixed(1)}%
                </div>
                <div style={{ fontSize: 14, color: '#888' }}>
                  整体健康度
                </div>
              </div>
            )}
            size={200}
          />
        </div>
        
        <Alert
          message={`系统状态: ${
            metrics.overallStatus === 'healthy' ? '健康' :
            metrics.overallStatus === 'degraded' ? '降级' : '严重'
          }`}
          type={metrics.overallStatus === 'healthy' ? 'success' : 
                metrics.overallStatus === 'degraded' ? 'warning' : 'error'}
          icon={getStatusIcon(metrics.overallStatus)}
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* 详细指标 */}
      <Row gutter={[16, 16]}>
        {/* 准确率 */}
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={
                <span>
                  <SafetyOutlined /> 校验准确率
                </span>
              }
              value={(metrics.accuracy.value * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ 
                color: getStatusColor(metrics.accuracy.status)
              }}
              prefix={getStatusIcon(metrics.accuracy.status)}
            />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={metrics.accuracy.value * 100}
                strokeColor={getStatusColor(metrics.accuracy.status)}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                基线: {(metrics.accuracy.baseline * 100).toFixed(1)}%
              </Text>
            </div>
          </Card>
        </Col>

        {/* 响应时间 */}
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={
                <span>
                  <ThunderboltOutlined /> 响应时间
                </span>
              }
              value={metrics.performance.avgResponseTime.toFixed(0)}
              suffix="ms"
              valueStyle={{ 
                color: getStatusColor(metrics.performance.status)
              }}
              prefix={getStatusIcon(metrics.performance.status)}
            />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={Math.max(0, 100 - metrics.performance.avgResponseTime / 10)}
                strokeColor={getStatusColor(metrics.performance.status)}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                基线: {metrics.performance.baseline}ms
              </Text>
            </div>
          </Card>
        </Col>

        {/* 误报率 */}
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={
                <span>
                  <WarningOutlined /> 误报率
                </span>
              }
              value={(metrics.falsePositiveRate.value * 100).toFixed(2)}
              suffix="%"
              valueStyle={{ 
                color: getStatusColor(metrics.falsePositiveRate.status)
              }}
              prefix={getStatusIcon(metrics.falsePositiveRate.status)}
            />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={(1 - metrics.falsePositiveRate.value) * 100}
                strokeColor={getStatusColor(metrics.falsePositiveRate.status)}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                基线: {(metrics.falsePositiveRate.baseline * 100).toFixed(1)}%
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 更新时间 */}
      <div style={{ marginTop: 24, textAlign: 'center', color: '#888' }}>
        <Text type="secondary">
          最后更新: {new Date(metrics.timestamp).toLocaleString()}
        </Text>
      </div>
    </div>
  )
}

export default HealthDashboard