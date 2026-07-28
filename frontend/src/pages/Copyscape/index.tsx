import { useState, useEffect } from 'react';
import React from 'react';
import {
  Card, Button, Tag, Input, Upload, message, Progress,
  Row, Col, Empty, Space, Spin, Typography, Divider,
  Tabs, Table, Statistic, Steps, Switch, Select, InputNumber
} from 'antd';
import {
  Search, Globe, ShieldCheck, Check, ExternalLink,
  FileText, AlertTriangle, Clock, RefreshCw, Download,
  Share2, Eye, Target, Zap, Activity, TrendingUp,
  BarChart3, Lock, Bell, Settings, Upload as UploadIcon,
  Database, FileSearch, ScanLine, Link2, Webhook
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import copyscapeApi, { type PlagiarismScanItem, type MatchedSource } from '@/api/copyscapeApi';
import { ResultCard } from '@/components/ResultCard';
import type { RiskLevel } from '@/components/ResultCard';
import './Copyscape.css';

const { Text, Title, Paragraph } = Typography;

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

interface BatchItem {
  url: string;
  label: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  similarity?: number;
  result?: PlagiarismScanItem;
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  const domain = extractDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function UniqueScoreRing({ score }: { score: number }) {
  const getColor = (percent: number) => {
    if (percent >= 90) return '#52c41a';
    if (percent >= 70) return '#faad14';
    return '#ff4d4f';
  };

  const color = getColor(score);
  const label = score >= 90 ? '高度原创' : score >= 70 ? '部分相似' : '疑似抄袭';

  return (
    <div className="copyscape-score-ring">
      <Progress
        type="circle"
        percent={Math.round(score)}
        size={200}
        strokeColor={color}
        trailColor="#f0f0f0"
        strokeWidth={12}
        format={(percent) => (
          <div className="score-ring-content">
            <div className="score-value" style={{ color }}>{percent}</div>
            <div className="score-label">{label}</div>
            <div className="score-unit">唯一性分数</div>
          </div>
        )}
      />
    </div>
  );
}

function MatchedSourceCard({ source, index }: { source: MatchedSource; index: number }) {
  const riskColor = source.risk_level === 'high' ? '#ff4d4f' : source.risk_level === 'medium' ? '#faad14' : '#165dff';

  return (
    <Card
      key={source.source_url}
      size="small"
      className={`matched-source-card risk-${source.risk_level}`}
    >
      <Row gutter={[16, 12]} align="middle">
        <Col xs={24} sm={4} className="source-favicon-col">
          <img
            src={getFaviconUrl(source.source_url)}
            alt=""
            className="source-favicon"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </Col>

        <Col xs={24} sm={14}>
          <div className="source-info">
            <a
              href={source.source_url}
              target="_blank"
              rel="noreferrer"
              className="source-title"
            >
              {source.source_title || source.domain}
              <ExternalLink size={12} style={{ marginLeft: 6 }} />
            </a>

            <div className="source-domain">
              <Globe size={12} />
              <span>{source.domain}</span>
            </div>

            <Progress
              percent={Math.round(source.similarity_percent)}
              size="small"
              status={source.similarity_percent > 80 ? 'exception' : 'active'}
              strokeColor={riskColor}
              className="source-similarity-bar"
            />

            {source.matched_snippets?.[0]?.text && (
              <div className="match-snippet">
                "{source.matched_snippets[0].text.substring(0, 150)}..."
              </div>
            )}
          </div>
        </Col>

        <Col xs={24} sm={6}>
          <Space direction="vertical" size={8} className="source-actions">
            <a href={source.source_url} target="_blank" rel="noreferrer">
              <Button
                icon={<ExternalLink />}
                size="small"
                block
              >
                访问来源
              </Button>
            </a>

            <Tag
              color={riskColor}
              className="similarity-tag"
            >
              {Math.round(source.similarity_percent)}% 相似
            </Tag>

            <Tag color={source.is_verified ? 'green' : 'default'}>
              {source.is_verified ? '已验证' : '未验证'}
            </Tag>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

function StatsSummary({ data }: { data: PlagiarismScanItem }) {
  return (
    <Row gutter={[16, 16]} className="stats-summary">
      <Col xs={12} sm={6}>
        <Card className="stat-card stat-total">
          <Statistic
            title="总匹配来源"
            value={data.total_sources || 0}
            prefix={<FileSearch size={18} color="#165DFF" />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card className="stat-card stat-exact">
          <Statistic
            title="完全匹配"
            value={data.exact_matches || 0}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<Target size={18} color="#ff4d4f" />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card className="stat-card stat-near">
          <Statistic
            title="近似重复"
            value={data.near_duplicates || 0}
            valueStyle={{ color: '#faad14' }}
            prefix={<AlertTriangle size={18} color="#faad14" />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card className="stat-card stat-para">
          <Statistic
            title="改写替换"
            value={data.paraphrased || 0}
            valueStyle={{ color: '#165DFF' }}
            prefix={<RefreshCw size={18} color="#165DFF" />}
          />
        </Card>
      </Col>
    </Row>
  );
}

function SingleUrlScanner({
  url,
  setUrl,
  scanning,
  setScanning,
  currentStep,
  setCurrentStep,
  scanResult,
  setScanResult
}: {
  url: string;
  setUrl: (v: string) => void;
  scanning: boolean;
  setScanning: (v: boolean) => void;
  currentStep: number;
  setCurrentStep: (v: number) => void;
  scanResult: PlagiarismScanItem | null;
  setScanResult: (v: PlagiarismScanItem | null) => void;
}) {
  const [pageTitle, setPageTitle] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    if (url && URL_REGEX.test(url)) {
      setDomain(extractDomain(url));
      setPageTitle(extractDomain(url));
    } else {
      setDomain('');
      setPageTitle('');
    }
  }, [url]);

  const simulateProgress = () => {
    setCurrentStep(0);
    for (let i = 0; i <= 5; i++) {
      setTimeout(() => setCurrentStep(i), (i + 1) * 800);
    }
  };

  const handleScan = async () => {
    if (!url.trim()) {
      message.warning('请输入URL');
      return;
    }

    if (!URL_REGEX.test(url)) {
      message.error('请输入有效的URL地址');
      return;
    }

    setScanning(true);
    setCurrentStep(0);
    setScanResult(null);

    try {
      simulateProgress();

      const response = await copyscapeApi.plagiarism.scan({
        original_text: url,
        content_type: 'web_url'
      });

      setScanResult(response.data);
      setCurrentStep(5);
      message.success('检测完成！');
    } catch (error: any) {
      console.error('Scan error:', error);
      message.error(error.response?.data?.message || error.message || '检测失败，请检查URL是否有效');
    } finally {
      setScanning(false);
    }
  };

  const isValidUrl = url.length > 0 && URL_REGEX.test(url);

  return (
    <div className="single-url-scanner">
      {!scanResult ? (
        <>
          <div className="url-input-section">
            <label className="input-label">
              <Globe size={16} />
              输入网页 URL 地址
            </label>

            <Input
              size="large"
              placeholder="输入网页URL，如 https://example.com/article"
              prefix={
                isValidUrl ? (
                  <img
                    src={getFaviconUrl(url)}
                    alt=""
                    className="input-favicon"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Link2 size={18} color="#86909C" />
                )
              }
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPressEnter={handleScan}
              disabled={scanning}
              allowClear
            />

            {isValidUrl && (
              <Card className="url-preview-card" size="small">
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space>
                      <img
                        src={getFaviconUrl(url)}
                        alt=""
                        className="preview-favicon"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div>
                        <strong>{pageTitle}</strong>
                        <p className="preview-domain">{domain}</p>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleScan}
                      loading={scanning}
                      icon={<Search />}
                    >
                      开始检测
                    </Button>
                  </Col>
                </Row>
              </Card>
            )}

            {url && !isValidUrl && (
              <div className="url-error-hint">
                <AlertTriangle size={14} />
                请输入完整的URL，包含 http:// 或 https:// 前缀
              </div>
            )}
          </div>

          {scanning && (
            <div className="progress-section">
              <Steps
                current={currentStep}
                className="scan-steps"
              >
                <Step title="DNS解析" icon={currentStep === 0 ? <Spin size="small" /> : currentStep > 0 ? <Check size={16} /> : <Database size={16} />} />
                <Step title="HTML下载" icon={currentStep === 1 ? <Spin size="small" /> : currentStep > 1 ? <Check size={16} /> : <Download size={16} />} />
                <Step title="正文提取" icon={currentStep === 2 ? <Spin size="small" /> : currentStep > 2 ? <Check size={16} /> : <FileText size={16} />} />
                <Step title="文本分段" icon={currentStep === 3 ? <Spin size="small" /> : currentStep > 3 ? <Check size={16} /> : <ScanLine size={16} />} />
                <Step title="向量化" icon={currentStep === 4 ? <Spin size="small" /> : currentStep > 4 ? <Check size={16} /> : <Zap size={16} />} />
                <Step title="相似度检索" icon={currentStep === 5 ? <Spin size="small" /> : <Search size={16} />} />
              </Steps>
              <div className="progress-text">
                正在执行: {['DNS解析', 'HTML下载', '正文提取', '文本分段', '向量化', '相似度检索'][currentStep] || '准备中'}...
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="result-section">
          {(() => {
            const overallSimilarity = scanResult.overall_similarity || 0;
            const matchedSources = scanResult.match_sources || [];
            const urlCount = 1;
            const duplicateWords = Math.round(overallSimilarity * (scanResult.unique_score || 100) / 100);

            const riskLevel: RiskLevel = overallSimilarity < 5 ? 'safe' : overallSimilarity < 20 ? 'warning' : overallSimilarity < 50 ? 'danger' : 'critical';

            const summaryText = scanResult.executive_summary ||
              (overallSimilarity < 5
                ? '未发现明显抄袭风险，内容具有高度原创性'
                : `检测到 ${overallSimilarity.toFixed(1)}% 的相似度，建议仔细核查匹配来源`);

            return (
              <ResultCard
                title="抄袭检测报告"
                riskLevel={riskLevel}
                metrics={[
                  {
                    label: '总体相似度',
                    value: `${overallSimilarity.toFixed(1)}%`,
                    color: overallSimilarity < 5 ? '#16A34A' : overallSimilarity < 20 ? '#EA580C' : '#DC2626'
                  },
                  { label: '匹配来源', value: `${matchedSources.length}个`, color: '#2563eb' },
                  { label: '检测URL数', value: `${urlCount}个` },
                  { label: '重复字数', value: `${duplicateWords}字` },
                ]}
                summary={summaryText}
                suggestions={[
                  {
                    text: matchedSources.length > 0
                      ? `发现 ${matchedSources.length} 个疑似匹配来源，请逐一核查`
                      : '未发现抄袭风险',
                    type: matchedSources.length > 0 ? 'warning' as const : 'info' as const
                  },
                  { text: '建议对高相似度段落进行改写或标注引用', type: 'improvement' as const },
                ]}
                details={
                  <div>
                    <Row gutter={[24, 24]} style={{ marginBottom: 16 }}>
                      <Col xs={24} lg={8}>
                        <UniqueScoreRing score={scanResult.unique_score || 0} />
                      </Col>
                      <Col xs={24} lg={16}>
                        <StatsSummary data={scanResult} />
                      </Col>
                    </Row>

                    {Array.isArray(matchedSources) && matchedSources.length > 0 && (
                      <div className="sources-list">
                        {matchedSources.map((source, index) => (
                          <MatchedSourceCard key={source.source_url} source={source} index={index} />
                        ))}
                      </div>
                    )}

                    {(!Array.isArray(matchedSources) || matchedSources.length === 0) && (
                      <Empty
                        description="未发现匹配来源，内容具有高度原创性"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ padding: '60px 0' }}
                      >
                        <ShieldCheck size={64} color="#52c41a" style={{ marginBottom: 16 }} />
                      </Empty>
                    )}
                  </div>
                }
                onPrimaryAction={() => message.info('正在生成报告...')}
                primaryActionText="下载完整报告"
                secondaryAction={() => {
                  setScanResult(null);
                  setCurrentStep(0);
                }}
                secondaryActionText="重新检测"
                showDataProtection={true}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

function BatchUploader({
  batchData,
  setBatchData
}: {
  batchData: BatchItem[];
  setBatchData: (v: BatchItem[]) => void;
}) {
  const [batchScanning, setBatchScanning] = useState(false);

  const handleCSVUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        const items: BatchItem[] = lines.map(line => {
          const parts = line.split(',').map(p => p.trim());
          return {
            url: parts[0] || '',
            label: parts[1] || '',
            status: 'pending' as const
          };
        }).filter(item => item.url && URL_REGEX.test(item.url));

        if (items.length === 0) {
          message.error('未找到有效URL，请检查CSV格式');
          return;
        }

        setBatchData(items);
        message.success(`成功导入 ${items.length} 个URL`);
      } catch (error) {
        message.error('CSV文件解析失败');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleBatchScan = async () => {
    if (batchData.length === 0) {
      message.warning('请先上传CSV文件');
      return;
    }

    setBatchScanning(true);
    const results = [...batchData];

    for (let i = 0; i < results.length; i++) {
      results[i].status = 'scanning';
      setBatchData([...results]);

      try {
        const response = await copyscapeApi.plagiarism.scan({
          original_text: results[i].url,
          content_type: 'web_url'
        });

        results[i] = {
          ...results[i],
          status: 'completed',
          similarity: response.data.overall_similarity,
          result: response.data
        };
      } catch (error) {
        results[i].status = 'failed';
      }

      setBatchData([...results]);
    }

    setBatchScanning(false);
    message.success(`批量检测完成！共 ${results.length} 个URL`);
  };

  const columns: ColumnsType<BatchItem> = [
    {
      title: 'URL',
      dataIndex: 'url',
      ellipsis: true,
      render: (url: string) => (
        <a href={url} target="_blank" rel="noreferrer" className="batch-url">
          {url}
        </a>
      )
    },
    {
      title: '标签',
      dataIndex: 'label',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          completed: { color: 'green', text: '已完成' },
          scanning: { color: 'blue', text: '检测中' },
          failed: { color: 'red', text: '失败' },
          pending: { color: 'default', text: '等待中' }
        };
        const config = statusConfig[status] || statusConfig.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '相似度',
      dataIndex: 'similarity',
      width: 100,
      render: (v?: number) => v != null ? `${v.toFixed(1)}%` : '-'
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => record.result && (
        <Button
          type="link"
          size="small"
          icon={<Eye />}
          onClick={() => message.info('查看详情功能开发中')}
        >
          查看
        </Button>
      )
    }
  ];

  return (
    <div className="batch-uploader">
      <Upload.Dragger
        accept=".csv,.txt"
        multiple={false}
        showUploadList={false}
        beforeUpload={handleCSVUpload}
        className="batch-upload-dragger"
      >
        <p className="ant-upload-drag-icon">
          <UploadIcon size={48} color="#165DFF" />
        </p>
        <p className="upload-text">点击或拖拽CSV文件到此区域</p>
        <p className="upload-hint">格式：url, label（两列，无表头）</p>
      </Upload.Dragger>

      {batchData.length > 0 && (
        <>
          <div className="batch-toolbar">
            <Space>
              <span className="batch-count">
                已导入 {batchData.length} 个URL
              </span>
            </Space>
            <Space>
              <Button
                danger
                onClick={() => setBatchData([])}
                size="small"
              >
                清空列表
              </Button>
              <Button
                type="primary"
                onClick={handleBatchScan}
                loading={batchScanning}
                disabled={batchScanning}
                icon={<ScanLine />}
              >
                {batchScanning ? '批量检测中...' : `开始批量检测 (${batchData.length})`}
              </Button>
            </Space>
          </div>

          <Table
            dataSource={batchData}
            columns={columns}
            rowKey={(_, index) => `batch-${index}`}
            pagination={false}
            size="middle"
            scroll={{ x: 600 }}
            className="batch-table"
          />

          {batchData.filter(d => d.status === 'completed').length > 0 && (
            <div className="batch-summary">
              <Card size="small">
                <Space>
                  <CheckCircle2 size={20} color="#52c41a" />
                  <span>
                    批量检测完成：
                    <Tag color="green">{batchData.filter(d => d.status === 'completed').length} 成功</Tag>
                    <Tag color="red">{batchData.filter(d => d.status === 'failed').length} 失败</Tag>
                  </span>
                </Space>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MonitorSettings() {
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [alertThreshold, setAlertThreshold] = useState(10);

  return (
    <Card
      className="monitor-settings-card"
      title={
        <span>
          <Settings size={16} style={{ marginRight: 8 }} />
          监控设置
        </span>
      }
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div className="monitor-option">
          <div className="option-header">
            <span className="option-label">
              <Bell size={14} />
              定期复查
            </span>
            <Switch
              checked={monitorEnabled}
              onChange={setMonitorEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
          {monitorEnabled && (
            <Select
              defaultValue="weekly"
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'daily', label: '每天' },
                { value: 'weekly', label: '每周' },
                { value: 'monthly', label: '每月' },
              ]}
              style={{ width: 200, marginTop: 8 }}
            />
          )}
        </div>

        <div className="monitor-option">
          <div className="option-header">
            <span className="option-label">
              <AlertTriangle size={14} />
              告警阈值
            </span>
          </div>
          <div className="threshold-input">
            <InputNumber
              min={1}
              max={100}
              value={alertThreshold}
              onChange={(v) => setAlertThreshold(v || 10)}
              addonAfter="%"
              disabled={!monitorEnabled}
              style={{ width: 160 }}
            />
            <span className="threshold-hint">
              发现新相似内容超过此值时通知
            </span>
          </div>
        </div>

        <Button
          type="primary"
          disabled={!monitorEnabled}
          icon={<Webhook />}
          block
          onClick={() => message.success('监控配置已保存')}
        >
          保存监控配置
        </Button>
      </Space>
    </Card>
  );
}

const Step = Steps.Step;

function CheckCircle2({ size, color }: { size?: number; color?: string }) {
  return <Check size={size} color={color} />;
}

export default function CopyscapePage() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [scanResult, setScanResult] = useState<PlagiarismScanItem | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState<BatchItem[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="copyscape-page">
      {/* Hero Section */}
      <div className="copyscape-hero">
        <div className="hero-bg-decoration" />
        <div className="hero-content">
          <div className="hero-badge">
            <ShieldCheck size={18} color="#34D399" />
            <Globe size={18} color="#60A5FA" />
            <Search size={18} color="#FBBF24" />
            <span>全网抄袭检测系统</span>
          </div>

          <h1 className="hero-title">
            全网抄袭检测
            <span className="hero-subtitle"> | Plagiarism Scanner</span>
          </h1>

          <p className="hero-description">
            检测您的网页内容是否被抄袭或重复使用
            <br />
            支持 DNS 解析 · HTML 抓取 · 文本提取 · 向量比对 · 相似度检索
          </p>

          <div className="hero-features">
            {[
              { icon: <Database size={14} />, label: 'DNS解析', color: '#60A5FA' },
              { icon: <Download size={14} />, label: 'HTML下载', color: '#A78BFA' },
              { icon: <FileText size={14} />, label: '正文提取', color: '#F472B6' },
              { icon: <Zap size={14} />, label: '向量化', color: '#FBBF24' },
              { icon: <Search size={14} />, label: '相似检索', color: '#34D399' },
              { icon: <ShieldCheck size={14} />, label: '安全可靠', color: '#F87171' },
            ].map((feature, i) => (
              <div key={i} className="feature-tag" style={{ borderColor: `${feature.color}40` }}>
                <span style={{ color: feature.color }}>{feature.icon}</span>
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="copyscape-main">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'single' | 'batch')}
          centered
          size="large"
          className="copyscape-tabs"
          items={[
            {
              key: 'single',
              label: (
                <span className="tab-label">
                  <Search size={16} />
                  单个URL检测
                </span>
              ),
              children: (
                <SingleUrlScanner
                  url={url}
                  setUrl={setUrl}
                  scanning={scanning}
                  setScanning={setScanning}
                  currentStep={currentStep}
                  setCurrentStep={setCurrentStep}
                  scanResult={scanResult}
                  setScanResult={setScanResult}
                />
              )
            },
            {
              key: 'batch',
              label: (
                <span className="tab-label">
                  <UploadIcon size={16} />
                  批量CSV上传
                </span>
              ),
              children: (
                <BatchUploader
                  batchData={batchData}
                  setBatchData={setBatchData}
                />
              )
            }
          ]}
        />

        <MonitorSettings />
      </div>
    </div>
  );
}
