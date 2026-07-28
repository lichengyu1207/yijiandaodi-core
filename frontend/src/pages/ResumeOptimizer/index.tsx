import { useState, useCallback, useMemo } from 'react';
import React from 'react';
import {
  Card, Button, Tag, Input, Upload, message, Progress, Row, Col,
  Space, Tooltip, Spin, Typography, Divider, Tabs, Menu, Select,
  Collapse, Empty, Statistic, Alert, Badge, Skeleton
} from 'antd';
import {
  FileText, Sparkles, Target, TrendingUp, Download, CheckCircle,
  AlertTriangle, Info, ChevronRight, ArrowRight, Upload as UploadIcon,
  FileCode, Type, AlignLeft, Hash, BookOpen, GraduationCap,
  Briefcase, Award, Star, Settings, RefreshCw, BarChart3,
  Eye, Zap, Shield, Trophy, Lightbulb, FileDown
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import resumeApi, { 
  type ResumeAnalysisItem, 
  type SectionAnalysis,
  type OptimizationItem
} from '@/api/resumeApi';
import { ResultCard } from '@/components/ResultCard';
import type { RiskLevel } from '@/components/ResultCard';
import './ResumeOptimizer.css';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

interface ResumeState {
  activeTab: 'upload' | 'paste';
  file: File | null;
  resumeText: string;
  analyzing: boolean;
  resumeData: ResumeAnalysisItem | null;
  selectedSection: string;
  optimizing: boolean;
  optimizedSections: Record<string, boolean>;
  diffData: DiffDataItem[] | null;
  targetPosition: string;
  targetIndustry: string;
  experienceLevel: string;
}

interface DiffDataItem {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  text: string;
  originalText?: string;
}

const SECTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  summary: { label: '个人信息', icon: <FileText size={16} />, color: '#165DFF' },
  experience: { label: '工作经历', icon: <Briefcase size={16} />, color: '#722ED1' },
  education: { label: '教育背景', icon: <GraduationCap size={16} />, color: '#00B42A' },
  skills: { label: '技能', icon: <Zap size={16} />, color: '#FA8C16' },
  projects: { label: '项目经验', icon: <Award size={16} />, color: '#F53F3F' },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#F53F3F', bg: '#FFECE8', label: 'P0' },
  important: { color: '#FA8C16', bg: '#FFF7E8', label: 'P1' },
  recommended: { color: '#FAAD14', bg: '#FFFBE6', label: 'P2' },
  optional: { color: '#86909C', bg: '#F2F3F5', label: 'P3' },
};

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return '#52C41A';
  if (score >= 60) return '#FAAD14';
  return '#F53F3F';
};

function ResumeOptimizer() {
  const [state, setState] = useState<ResumeState>({
    activeTab: 'upload',
    file: null,
    resumeText: '',
    analyzing: false,
    resumeData: null,
    selectedSection: 'summary',
    optimizing: false,
    optimizedSections: {},
    diffData: null,
    targetPosition: '',
    targetIndustry: '',
    experienceLevel: '',
  });

  const [radarAnimated, setRadarAnimated] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB');
      return false;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setState(prev => ({ ...prev, file, resumeText: e.target?.result as string || '' }));
      message.success(`文件 ${file.name} 上传成功`);
    };
    reader.readAsText(file);
    return false;
  }, []);

  const handleRemoveFile = useCallback(() => {
    setState(prev => ({ ...prev, file: null, resumeText: '' }));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!state.resumeText.trim()) {
      message.warning('请先上传或粘贴简历内容');
      return;
    }

    setState(prev => ({ ...prev, analyzing: true }));

    try {
      const response = await resumeApi.resume.analyze({
        resume_text: state.resumeText,
        target_position: state.targetPosition || undefined,
        target_industry: state.targetIndustry || undefined,
        experience_level: state.experienceLevel || undefined,
      });

      setState(prev => ({
        ...prev,
        analyzing: false,
        resumeData: response.data,
        radarAnimated: true,
      }));

      message.success('简历分析完成！');
    } catch (error) {
      setState(prev => ({ ...prev, analyzing: false }));
      message.error('分析失败，请重试');
      console.error('Analyze error:', error);
    }
  }, [state.resumeText, state.targetPosition, state.targetIndustry, state.experienceLevel]);

  const handleOptimizeSection = useCallback(async (sectionKey: string) => {
    if (!state.resumeData) return;

    setState(prev => ({ ...prev, optimizing: true, diffData: null }));

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockDiffData: DiffDataItem[] = generateMockDiff(sectionKey);
      
      setState(prev => ({
        ...prev,
        optimizing: false,
        diffData: mockDiffData,
        optimizedSections: { ...prev.optimizedSections, [sectionKey]: true },
      }));

      message.success(`${SECTION_CONFIG[sectionKey]?.label || sectionKey} 章节优化完成`);
    } catch (error) {
      setState(prev => ({ ...prev, optimizing: false }));
      message.error('优化失败，请重试');
    }
  }, [state.resumeData]);

  const handleAcceptAll = useCallback(() => {
    if (!state.diffData) return;
    message.success('已接受全部修改');
    setState(prev => ({ ...prev, diffData: null }));
  }, [state.diffData]);

  const handleReject = useCallback(() => {
    setState(prev => ({ ...prev, diffData: null }));
    message.info('已恢复原文');
  }, []);

  const radarData = useMemo(() => {
    if (!state.resumeData) return [];

    const { overall_score, ats_score, impact_score, clarity_score, completeness_score, ats_compatibility, keyword_analysis } = state.resumeData;

    return [
      { subject: '影响力', score: impact_score, fullMark: 100, key: 'impact' },
      { subject: '技能匹配', score: ats_score, fullMark: 100, key: 'ats' },
      { subject: '格式规范', score: clarity_score, fullMark: 100, key: 'clarity' },
      { subject: 'ATS友好', score: ats_compatibility?.overall_ats_probability || 75, fullMark: 100, key: 'ats_compat' },
      { subject: '关键词覆盖', score: keyword_analysis?.keyword_coverage_rate || 70, fullMark: 100, value: 'keywords' },
      { subject: '总体得分', score: overall_score, fullMark: 100, key: 'overall' },
    ];
  }, [state.resumeData]);

  const getLowestScoreSection = useCallback(() => {
    if (!state.resumeData?.section_analysis) return 'summary';

    let lowestScore = Infinity;
    let lowestSection = 'summary';

    Object.entries(state.resumeData.section_analysis).forEach(([key, analysis]) => {
      if (analysis.score < lowestScore) {
        lowestScore = analysis.score;
        lowestSection = key;
      }
    });

    return lowestSection;
  }, [state.resumeData]);

  const currentSectionData = useMemo(() => {
    if (!state.resumeData?.section_analysis) return null;
    return state.resumeData.section_analysis[state.selectedSection];
  }, [state.resumeData, state.selectedSection]);

  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="radar-tooltip">
          <div className="tooltip-title">{data.subject}</div>
          <div className="tooltip-score">
            <TrendingUp size={14} />
            <span>{data.score}分</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="resume-optimizer">
      {/* Hero Section */}
      <motion.div 
        className="hero-section"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="hero-content">
          <motion.div 
            className="hero-icons"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <FileText size={32} />
            <Sparkles size={28} color="#FFD700" />
          </motion.div>
          
          <Title level={1} className="hero-title">
            AI简历优化 | Resume Optimizer
          </Title>
          
          <Paragraph className="hero-subtitle">
            让您的简历在ATS系统和HR眼中脱颖而出
          </Paragraph>

          <div className="hero-features">
            <Space size="large">
              <div className="feature-item">
                <Target size={20} />
                <span>精准定位</span>
              </div>
              <div className="feature-item">
                <TrendingUp size={20} />
                <span>智能评分</span>
              </div>
              <div className="feature-item">
                <Sparkles size={20} />
                <span>AI优化</span>
              </div>
            </Space>
          </div>
        </div>
      </motion.div>

      {!state.resumeData ? (
        /* Upload/Paste Section */
        <motion.div 
          className="upload-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Card className="upload-card">
            <Tabs
              activeKey={state.activeTab}
              onChange={(key) => setState(prev => ({ ...prev, activeTab: key as 'upload' | 'paste' }))}
              centered
              items={[
                {
                  key: 'upload',
                  label: (
                    <span>
                      <UploadIcon size={16} style={{ marginRight: 8 }} />
                      PDF上传
                    </span>
                  ),
                  children: (
                    <div className="upload-area">
                      <Upload.Dragger
                        name="file"
                        multiple={false}
                        accept=".pdf,.docx,.txt"
                        beforeUpload={handleFileUpload}
                        showUploadList={false}
                        className="upload-dragger"
                      >
                        <p className="ant-upload-drag-icon">
                          <Upload size={48} color="#165DFF" />
                        </p>
                        <p className="ant-upload-text">
                          点击或拖拽简历文件到此区域
                        </p>
                        <p className="ant-upload-hint">
                          支持 PDF、DOCX、TXT 格式，文件大小不超过 10MB
                        </p>
                      </Upload.Dragger>

                      {state.file && (
                        <div className="file-info">
                          <FileCode size={16} />
                          <span>{state.file.name}</span>
                          <Tag color="blue">{(state.file.size / 1024).toFixed(1)} KB</Tag>
                          <Button type="link" danger onClick={handleRemoveFile}>
                            删除
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'paste',
                  label: (
                    <span>
                      <Type size={16} style={{ marginRight: 8 }} />
                      文本粘贴
                    </span>
                  ),
                  children: (
                    <div className="paste-area">
                      <TextArea
                        value={state.resumeText}
                        onChange={(e) => setState(prev => ({ ...prev, resumeText: e.target.value }))}
                        placeholder="请粘贴您的简历内容..."
                        autoSize={{ minRows: 10, maxRows: 20 }}
                        className="resume-textarea"
                      />
                      <div className="textarea-footer">
                        <Text type="secondary">
                          字符数：{state.resumeText.length}
                        </Text>
                        <Button
                          icon={<Sparkles size={14} />}
                          onClick={() => message.info('自动识别功能开发中')}
                          size="small"
                        >
                          自动识别简历结构
                        </Button>
                      </div>
                    </div>
                  ),
                },
              ]}
            />

            <Divider />

            <div className="target-settings">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Input
                    prefix={<Target size={16} />}
                    placeholder="目标职位（可选）"
                    value={state.targetPosition}
                    onChange={(e) => setState(prev => ({ ...prev, targetPosition: e.target.value }))}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Input
                    prefix={<Briefcase size={16} />}
                    placeholder="目标行业（可选）"
                    value={state.targetIndustry}
                    onChange={(e) => setState(prev => ({ ...prev, targetIndustry: e.target.value }))}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Select
                    placeholder="经验水平（可选）"
                    value={state.experienceLevel || undefined}
                    onChange={(value) => setState(prev => ({ ...prev, experienceLevel: value }))}
                    allowClear
                    style={{ width: '100%' }}
                    options={[
                      { value: 'entry', label: '初级 (0-2年)' },
                      { value: 'mid', label: '中级 (3-5年)' },
                      { value: 'senior', label: '高级 (6-10年)' },
                      { value: 'expert', label: '专家 (10年+)' },
                    ]}
                  />
                </Col>
              </Row>
            </div>

            <div className="analyze-button-wrapper">
              <Button
                type="primary"
                size="large"
                icon={<Sparkles size={20} />}
                loading={state.analyzing}
                onClick={handleAnalyze}
                disabled={!state.resumeText.trim()}
                className="analyze-button"
              >
                开始分析
              </Button>
            </div>
          </Card>

          {state.analyzing && (
            <div className="analyzing-overlay">
              <Spin size="large" tip="AI正在分析您的简历..." />
            </div>
          )}
        </motion.div>
      ) : (
        /* Analysis Results Section - 使用 ResultCard 组件 */
        <AnimatePresence mode="wait">
          <motion.div
            className="results-section"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ResultCard
              title="简历优化报告"
              riskLevel={(() => {
                const score = state.resumeData?.overall_score || 0;
                return (score >= 80 ? 'safe' : score >= 60 ? 'warning' : 'danger') as RiskLevel;
              })()}
              metrics={[
                { 
                  label: 'ATS兼容性', 
                  value: `${state.resumeData?.ats_compatibility?.overall_ats_probability || state.resumeData?.ats_score || 0}分`, 
                  color: (state.resumeData?.ats_compatibility?.overall_ats_probability || state.resumeData?.ats_score || 0) > 85 ? '#16A34A' : 
                         (state.resumeData?.ats_compatibility?.overall_ats_probability || state.resumeData?.ats_score || 0) > 70 ? '#EA580C' : '#DC2626'
                },
                { label: '关键词匹配', value: `${state.resumeData?.keyword_analysis?.keyword_coverage_rate || 0}%` },
                { label: '格式规范', value: `${state.resumeData?.clarity_score || 0}分` },
                { label: '改进项', value: `${state.resumeData?.critical_suggestions || 0}处` },
                { label: '总体得分', value: `${state.resumeData?.overall_score || 0}分` },
              ]}
              summary={state.resumeData?.executive_summary}
              suggestions={(state.resumeData?.suggestions || []).map((rec: any) => ({
                text: rec.text || rec,
                type: (rec.type === 'critical' || rec.priority === 'critical' ? 'warning' : 'improvement') as 'warning' | 'improvement',
              }))}
              onPrimaryAction={() => message.info('PDF导出功能开发中')}
              primaryActionText="导出优化简历"
              secondaryAction={() => setState({
                activeTab: 'upload',
                file: null,
                resumeText: '',
                analyzing: false,
                resumeData: null,
                selectedSection: 'summary',
                optimizing: false,
                optimizedSections: {},
                diffData: null,
                targetPosition: '',
                targetIndustry: '',
                experienceLevel: '',
              })}
              secondaryActionText="重新优化"
              showDataProtection={true}
              children={
                <div className="resume-radar-section">
                  {/* ⭐ 六维能力雷达图 - 保留特色！ */}
                  <h4 style={{ textAlign: 'center', marginBottom: 16, fontSize: 18, fontWeight: 600 }}>六维能力雷达图</h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e8e8e8" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#666', fontSize: 13, fontWeight: 500 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#999' }}
                      />
                      <RechartsTooltip content={<CustomRadarTooltip />} />
                      <Radar
                        name="当前简历"
                        dataKey="score"
                        stroke="#165DFF"
                        fill="url(#radarGradient)"
                        fillOpacity={0.6}
                        strokeWidth={2}
                        animationDuration={2000}
                        animationEasing="ease-in-out"
                      />
                      <defs>
                        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#165DFF" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#69B1FF" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                    </RadarChart>
                  </ResponsiveContainer>

                  {/* 雷达图维度详情 */}
                  <Collapse
                    ghost
                    className="dimension-details-collapse"
                    items={radarData.map((item) => ({
                      key: item.key,
                      label: (
                        <div className="collapse-header">
                          <Tag color={SCORE_COLOR(item.score)}>{item.subject}</Tag>
                          <Progress
                            percent={item.score}
                            size="small"
                            strokeColor={SCORE_COLOR(item.score)}
                            format={() => `${item.score}分`}
                            style={{ width: 120, marginLeft: 12 }}
                          />
                        </div>
                      ),
                      children: (
                        <div className="dimension-suggestions">
                          {getSuggestionsForDimension(item.key).map((suggestion, idx) => (
                            <div key={idx} className={`suggestion-item priority-${suggestion.priority}`}>
                              <Tag color={SEVERITY_CONFIG[suggestion.priority]?.color}>
                                {SEVERITY_CONFIG[suggestion.priority]?.label}
                              </Tag>
                              <div className="suggestion-content">
                                <div className="suggestion-title">{suggestion.title}</div>
                                <div className="suggestion-desc">{suggestion.description}</div>
                                {suggestion.example && (
                                  <div className="suggestion-example">
                                    <div className="example-before">
                                      <Text delete type="danger">Before: {suggestion.example.before}</Text>
                                    </div>
                                    <div className="example-after">
                                      <Text type="success">After: {suggestion.example.after}</Text>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ),
                    }))}
                  />

                  {/* Diff 对比视图 - 也保留在 children 中 */}
                  {state.diffData && !state.optimizing && (
                    <div className="diff-view-section" style={{ marginTop: 24 }}>
                      <h4 style={{ marginBottom: 16 }}>优化建议详情</h4>
                      <div className="diff-view-container">
                        <div className="diff-viewer">
                          <div className="diff-header">
                            <div className="diff-column original">
                              <Text strong><FileText size={16} style={{ marginRight: 8 }} />原文</Text>
                            </div>
                            <ArrowRight size={20} className="diff-arrow" />
                            <div className="diff-column optimized">
                              <Text strong><Sparkles size={16} style={{ marginRight: 8 }} />优化后</Text>
                            </div>
                          </div>

                          <div className="diff-content">
                            <div className="diff-original">
                              {state.diffData.map((line, idx) => (
                                <div
                                  key={idx}
                                  className={`diff-line ${line.type === 'removed' ? 'diff-removed' : ''}`}
                                >
                                  <span className="line-number">{idx + 1}</span>
                                  <span className="line-text">{line.originalText || line.text}</span>
                                </div>
                              ))}
                            </div>

                            <div className="diff-optimized">
                              {state.diffData.map((line, idx) => (
                                <div
                                  key={idx}
                                  className={`diff-line ${
                                    line.type === 'added' ? 'diff-added' :
                                    line.type === 'modified' ? 'diff-modified' : ''
                                  }`}
                                >
                                  <span className="line-number">{idx + 1}</span>
                                  <span className="line-text">{line.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="diff-actions">
                          <Space>
                            <Button
                              type="primary"
                              icon={<CheckCircle size={16} />}
                              onClick={handleAcceptAll}
                            >
                              接受全部修改
                            </Button>
                            <Button
                              icon={<RefreshCw size={16} />}
                              onClick={handleReject}
                            >
                              拒绝修改
                            </Button>
                          </Space>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              }
            />

            {/* 章节分析三栏布局 - 保留原有功能 */}
            <Row gutter={[20, 20]} className="section-analysis-layout" style={{ marginTop: 20 }}>
              {/* Left Sidebar - Section Navigation */}
              <Col xs={24} lg={6}>
                <Card className="section-nav-card" title="章节导航">
                  <Menu
                    mode="vertical"
                    selectedKeys={[state.selectedSection]}
                    onClick={({ key }) => setState(prev => ({ ...prev, selectedSection: key }))}
                    items={Object.entries(SECTION_CONFIG).map(([key, config]) => {
                      const sectionData = state.resumeData?.section_analysis?.[key];
                      return {
                        key,
                        icon: config.icon,
                        label: (
                          <div className="menu-item-label">
                            <span>{config.label}</span>
                            {sectionData && (
                              <Progress
                                type="circle"
                                percent={sectionData.score}
                                size={36}
                                strokeWidth={4}
                                strokeColor={SCORE_COLOR(sectionData.score)}
                                format={() => sectionData.score}
                              />
                            )}
                          </div>
                        ),
                      };
                    })}
                  />
                </Card>
              </Col>

              {/* Center Content - Selected Section Details */}
              <Col xs={24} lg={12}>
                <Card
                  className="section-content-card"
                  title={
                    <div className="section-title">
                      {SECTION_CONFIG[state.selectedSection]?.icon}
                      <span>{SECTION_CONFIG[state.selectedSection]?.label || state.selectedSection}</span>
                    </div>
                  }
                >
                  {currentSectionData ? (
                    <div className="section-detail">
                      <div className="section-score-row">
                        <Text strong>章节评分：</Text>
                        <Progress
                          percent={currentSectionData.score}
                          status={currentSectionData.score >= 80 ? 'success' : currentSectionData.score >= 60 ? 'normal' : 'exception'}
                          strokeColor={SCORE_COLOR(currentSectionData.score)}
                          style={{ width: 200 }}
                        />
                      </div>

                      {currentSectionData.strengths && currentSectionData.strengths.length > 0 && (
                        <div className="strengths-list">
                          <Title level={5}><CheckCircle size={16} style={{ marginRight: 8 }} />优势</Title>
                          <ul>
                            {currentSectionData.strengths.map((strength, idx) => (
                              <li key={idx}><CheckCircle size={14} color="#52C41A" />{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentSectionData.weaknesses && currentSectionData.weaknesses.length > 0 && (
                        <div className="weaknesses-list">
                          <Title level={5}><AlertTriangle size={16} style={{ marginRight: 8 }} />待改进</Title>
                          <ul>
                            {currentSectionData.weaknesses.map((weakness, idx) => (
                              <li key={idx}><AlertTriangle size={14} color="#FAAD14" />{weakness}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentSectionData.word_count && (
                        <div className="section-stats">
                          <Space wrap>
                            <Tag icon={<AlignLeft size={12} />}>字数: {currentSectionData.word_count}</Tag>
                            {currentEntryCount(currentSectionData) > 0 && (
                              <Tag icon={<Hash size={12} />}>条目: {currentEntryCount(currentSectionData)}</Tag>
                            )}
                          </Space>
                        </div>
                      )}

                      {currentSectionData.issues && currentSectionData.issues.length > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message="发现的问题"
                          description={
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {currentSectionData.issues.slice(0, 3).map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <Empty
                      description="此章节为空，建议补充"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button type="primary" onClick={() => message.info('请完善此章节内容')}>
                        了解如何完善
                      </Button>
                    </Empty>
                  )}
                </Card>
              </Col>

              {/* Right Sidebar - Quick Scores */}
              <Col xs={24} lg={6}>
                <Card className="quick-scores-card" title="快速评分总览">
                  <div className="scores-grid">
                    {Object.entries(SECTION_CONFIG).map(([key, config]) => {
                      const sectionData = state.resumeData?.section_analysis?.[key];
                      const score = sectionData?.score || 0;
                      
                      return (
                        <div
                          key={key}
                          className={`score-item ${state.selectedSection === key ? 'active' : ''}`}
                          onClick={() => setState(prev => ({ ...prev, selectedSection: key }))}
                        >
                          <Progress
                            type="circle"
                            percent={score}
                            size={64}
                            strokeWidth={6}
                            strokeColor={SCORE_COLOR(score)}
                            format={() => (
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{score}</span>
                            )}
                          />
                          <Text ellipsis style={{ marginTop: 8, fontSize: 12 }}>{config.label}</Text>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* AI Optimization Workspace */}
            <Card className="optimization-workspace-card" title={
              <div className="card-title-with-icon">
                <Sparkles size={20} />
                <span>AI优化工作区</span>
              </div>
            }>
              <div className="optimization-controls">
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} sm={8}>
                    <Select
                      value={state.selectedSection}
                      onChange={(value) => setState(prev => ({ ...prev, selectedSection: value, diffData: null }))}
                      style={{ width: '100%' }}
                      options={Object.entries(SECTION_CONFIG).map(([key, config]) => ({
                        value: key,
                        label: (
                          <span>
                            {config.icon}
                            <span style={{ marginLeft: 8 }}>{config.label}</span>
                            {state.resumeData?.section_analysis?.[key] && (
                              <Tag color={SCORE_COLOR(state.resumeData.section_analysis[key].score)} style={{ marginLeft: 8 }}>
                                {state.resumeData.section_analysis[key].score}分
                              </Tag>
                            )}
                          </span>
                        ),
                      }))}
                    />
                  </Col>

                  <Col xs={24} sm={8}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<Zap size={18} />}
                      loading={state.optimizing}
                      onClick={() => handleOptimizeSection(state.selectedSection)}
                      disabled={state.optimizedSections[state.selectedSection]}
                      block
                    >
                      {state.optimizedSections[state.selectedSection] ? '✓ 已优化' : '一键优化此章节'}
                    </Button>
                  </Col>

                  <Col xs={24} sm={8}>
                    <Text type="secondary" className="optimize-hint">
                      {state.optimizedSections[state.selectedSection]
                        ? '此章节已完成优化'
                        : `建议优先优化：${SECTION_CONFIG[getLowestScoreSection()]?.label}`
                      }
                    </Text>
                  </Col>
                </Row>
              </div>

              {state.optimizing && (
                <div className="optimization-loading">
                  <Spin tip="AI正在智能优化中..." />
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// Helper Functions
function generateMockDiff(sectionKey: string): DiffDataItem[] {
  const mockDiffs: Record<string, DiffDataItem[]> = {
    summary: [
      { type: 'removed', text: '', originalText: '有5年工作经验' },
      { type: 'added', text: '拥有5年全栈开发经验，主导过3个千万级用户产品的技术架构设计与落地实施' },
      { type: 'unchanged', text: '熟练掌握React、Vue等前端框架' },
      { type: 'modified', text: '精通React、Vue、Angular等主流前端框架，具备大型项目架构设计能力', originalText: '熟练掌握React、Vue等前端框架' },
    ],
    experience: [
      { type: 'removed', text: '', originalText: '负责公司网站开发' },
      { type: 'added', text: '负责公司核心电商平台的前端架构设计与性能优化，页面加载速度提升40%，日活用户突破50万' },
      { type: 'unchanged', text: '使用React + TypeScript技术栈' },
      { type: 'modified', text: '主导团队采用React 18 + TypeScript 5重构旧系统，代码可维护性提升60%', originalText: '使用React + TypeScript技术栈' },
    ],
    education: [
      { type: 'unchanged', text: '计算机科学与技术 本科' },
      { type: 'added', text: 'GPA: 3.8/4.0 | 专业排名前10% | 获得国家奖学金' },
      { type: 'modified', text: '主修课程：数据结构与算法、计算机网络、操作系统、软件工程（均分90+）', originalText: '主修课程：数据结构、算法' },
    ],
    skills: [
      { type: 'removed', text: '', originalText: '熟悉JavaScript' },
      { type: 'added', text: '精通 JavaScript ES6+、TypeScript 5.x，深入理解闭包、原型链、事件循环等核心概念' },
      { type: 'unchanged', text: '了解Node.js' },
      { type: 'modified', text: '熟练使用 Node.js + Express/Koa 构建后端服务，具备服务端渲染(SSR)实战经验', originalText: '了解Node.js' },
    ],
    projects: [
      { type: 'removed', text: '', originalText: '做了一个电商项目' },
      { type: 'added', text: '独立开发并上线B2C电商平台（月GMV破百万），涵盖商品管理、订单系统、支付对接等核心模块' },
      { type: 'unchanged', text: '使用Vue.js开发' },
      { type: 'modified', text: '基于 Vue 3 + Vite + Pinia 构建现代化前端工程，首屏加载时间控制在1.5s以内', originalText: '使用Vue.js开发' },
    ],
  };

  return mockDiffs[sectionKey] || mockDiffs.summary;
}

function getSuggestionsForDimension(dimensionKey: string): Array<{
  priority: string;
  title: string;
  description: string;
  example?: { before: string; after: string };
}> {
  const suggestionsMap: Record<string, any[]> = {
    impact: [
      {
        priority: 'critical',
        title: '缺少量化成果描述',
        description: '建议使用数字和具体指标来展示工作成果，如提升了XX%、节省了XX成本、服务了XX用户等',
        example: {
          before: '负责优化网站性能',
          after: '通过引入CDN和代码分割策略，将页面加载时间从3.2s降至1.1s，用户体验提升65%',
        },
      },
      {
        priority: 'important',
        title: '行动动词力度不足',
        description: '使用更强有力的行动动词开头，如"主导"、"构建"、"驱动"、"革新"等替代"参与"、"负责"、"协助"',
        example: {
          before: '参与了项目的开发工作',
          after: '主导了微服务架构的迁移工作，协调8人团队在3个月内完成核心模块的重构与上线',
        },
      },
      {
        priority: 'recommended',
        title: '缺乏业务影响力说明',
        description: '不仅要说做了什么，更要说明对业务的实际影响和价值贡献',
      },
    ],
    ats: [
      {
        priority: 'critical',
        title: '关键技能关键词缺失',
        description: '根据目标职位要求，建议添加以下高频关键词：XXX、YYY、ZZZ',
      },
      {
        priority: 'important',
        title: '技能描述过于笼统',
        description: '应具体到工具版本、应用场景、熟练程度等细节',
        example: {
          before: '熟悉数据库',
          after: '精通 MySQL 8.0、PostgreSQL 14，具备亿级数据表设计和查询优化经验',
        },
      },
    ],
    clarity: [
      {
        priority: 'recommended',
        title: '段落过长不易阅读',
        description: '建议每段控制在3行以内，使用项目符号列表展示多项信息',
      },
      {
        priority: 'optional',
        title: '专业术语过多',
        description: '平衡专业性与可读性，对非核心技术岗位可适当简化术语',
      },
    ],
    ats_compat: [
      {
        priority: 'critical',
        title: '格式可能不被ATS正确解析',
        description: '避免使用表格、文本框、页眉页脚等复杂排版元素',
      },
      {
        priority: 'important',
        title: '联系方式位置不当',
        description: '确保联系信息位于文档顶部且易于机器读取',
      },
    ],
    keywords: [
      {
        priority: 'critical',
        title: '行业热词覆盖率低',
        description: '当前仅覆盖40%的目标职位关键词，建议补充：云原生、DevOps、容器化等',
      },
      {
        priority: 'important',
        title: '缺少软技能关键词',
        description: '除了技术能力，还应体现：团队协作、项目管理、跨部门沟通等软实力',
      },
    ],
    overall: [
      {
        priority: 'critical',
        title: '整体竞争力不足',
        description: '综合各项维度，建议重点强化工作经历中的量化成果和影响力描述',
      },
      {
        priority: 'recommended',
        title: '简历长度需要调整',
        description: '对于当前经验水平，建议将简历控制在2页以内，突出最相关的工作经历',
      },
    ],
  };

  return suggestionsMap[dimensionKey] || suggestionsMap.overall;
}

function currentEntryCount(section: SectionAnalysis): number {
  return section.total_entries || 0;
}

export default ResumeOptimizer;
