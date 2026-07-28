import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  Card, Button, Tag, Modal, Input, Upload, message, Progress,
  Row, Col, Alert, Empty, Badge, Space, Tooltip, Segmented,
  Spin, Typography, Divider, Tabs, Table, Statistic, Steps, Collapse
} from 'antd';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Upload as UploadIcon, FileText, Sparkles, Search, Eye,
  Brain, Copy, Fingerprint, Target, Zap, Gauge,
  BarChart3, TrendingUp, Clock, PlayCircle, RefreshCw,
  ScanLine, FileSearch, BookOpen, Bot, UserCheck, Shuffle,
  ChevronRight, Download, Info, Link, Globe, FileCode,
  Layers, PieChart, Activity, Award, Star, Lock, Unlock,
  ArrowRight, Check, X, AlertOctagon, FileDown, Share2,
  Plus, Minus, Maximize2, ExternalLink, Hash, Type,
  AlignLeft, Quote, Highlighter, Filter, Grid3X3,
  GripVertical, RotateCw, Pause, Play, File, FileType
} from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { dualEngineApi, type DualEngineItem, type SentenceAnalysis, type SourceMatch } from '@/api/dualEngineApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { ResultCard } from '@/components/ResultCard';
import type { RiskLevel } from '@/components/ResultCard';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

interface BatchItem {
  id: string;
  fileName: string;
  content: string;
  status: 'pending' | 'scanning' | 'completed' | 'error';
  result?: DualEngineItem;
  error?: string;
}

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; desc: string }> = {
  human_written: {
    color: '#00B42A', bg: '#E8FFEA',
    icon: <UserCheck size={16} />, label: '人工撰写', desc: '文本极大概率为人工原创撰写'
  },
  ai_generated: {
    color: '#722ED1', bg: '#F9F0FF',
    icon: <Bot size={16} />, label: 'AI生成', desc: '文本极大概率为AI模型生成'
  },
  mixed_content: {
    color: '#FA8C16', bg: '#FFF7E8',
    icon: <Shuffle size={16} />, label: '混合内容', desc: '包含人工撰写与AI生成混合内容'
  },
  plagiarized: {
    color: '#F53F3F', bg: '#FFECE8',
    icon: <Copy size={16} />, label: '抄袭内容', desc: '检测到疑似抄袭自其他来源的内容'
  },
  ai_plus_plagiarism: {
    color: '#D9363E', bg: '#FFF1F0',
    icon: <AlertTriangle size={16} />, label: 'AI+抄袭', desc: '同时检测到AI生成和抄袭特征'
  },
  inconclusive: {
    color: '#86909C', bg: '#F2F3F5',
    icon: <Info size={16} />, label: '无法判定', desc: '文本过短或特征不明显，无法可靠判定'
  },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: '#00B42A', high: '#165DFF', medium: '#FA8C16', low: '#86909C',
};

const MODEL_BADGE_COLORS: Record<string, string> = {
  'GPT-4': '#10A37F', 'GPT-4o': '#10A37F', 'GPT-4-Turbo': '#10A37F',
  'Claude-3.5': '#D97706', 'Claude-3': '#D97706',
  'Gemini-Pro': '#4285F4', 'Gemini-Ultra': '#4285F4',
  'DeepSeek-V3': '#165DFF', 'DeepSeek-R1': '#165DFF',
  'Llama-3': '#6366F1', 'Unknown-Mixed': '#86909C', 'None': '#00B42A',
};

function OriginalityScorecard({ data }: { data: DualEngineItem }) {
  const vc = VERDICT_CONFIG[data.overall_verdict] || VERDICT_CONFIG.inconclusive;
  const scoreColor = data.originality_score >= 90 ? '#00B42A' : data.originality_score >= 70 ? '#FAAD14' : '#F53F3F';

  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 32px',
      background: `linear-gradient(135deg, ${vc.bg} 0%, #FFFFFF 100%)`,
      borderRadius: 20,
      border: `3px solid ${vc.color}`,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 8px 32px ${vc.color}20`
    }}>
      <div style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        background: `${vc.color}08`,
        borderRadius: '50%'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 24
        }}>
          {vc.icon}
          <span style={{
            fontSize: 26,
            fontWeight: 900,
            color: vc.color
          }}>
            综合判定：{vc.label}
          </span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <Progress
            type="circle"
            percent={Math.round(data.originality_score)}
            size={180}
            strokeColor={scoreColor}
            trailColor="#E5E6EB"
            strokeWidth={12}
            format={(p) => (
              <div>
                <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor }}>{p}</div>
                <div style={{ fontSize: 18, color: '#86909C', marginTop: -4 }}>/100</div>
              </div>
            )}
          />
        </div>

        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: scoreColor,
          marginBottom: 8
        }}>
          原创性得分
        </div>
        <div style={{ fontSize: 14, color: '#86909C', marginBottom: 24 }}>
          Originality Score
        </div>

        <Space size={[12, 12]} wrap justify="center">
          <Tag
            color={CONFIDENCE_COLORS[data.confidence_level] || '#86909C'}
            style={{ borderRadius: 16, padding: '6px 16px', fontSize: 13, fontWeight: 600 }}
          >
            置信度: {data.confidence_display}
          </Tag>
          {data.ai_model_detected && (
            <Tag
              color={MODEL_BADGE_COLORS[data.ai_model_detected] || '#86909C'}
              style={{ borderRadius: 16, padding: '6px 16px', fontSize: 13, fontWeight: 600 }}
            >
              <Bot size={14} style={{ marginRight: 4 }} />
              {data.ai_model_detected}
            </Tag>
          )}
        </Space>

        <div style={{
          marginTop: 24,
          padding: '16px 24px',
          background: 'rgba(255,255,255,0.8)',
          borderRadius: 12,
          fontSize: 14,
          color: '#4E5969',
          lineHeight: 1.7
        }}>
          {vc.desc}
        </div>
      </div>
    </div>
  );
}

function DualEngineGauge({ data }: { data: DualEngineItem }) {
  return (
    <Row gutter={[24, 24]} align="middle">
      <Col xs={24} md={11}>
        <Card
          style={{
            borderRadius: 16,
            height: '100%',
            background: 'linear-gradient(135deg, #F9F0FF 0%, #FFFFFF 100%)',
            border: '2px solid #722ED130'
          }}
          bodyStyle={{ padding: 'clamp(16px, 3vw, 32px) clamp(12px, 2.5vw, 24px)' }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: '6px 14px',
              background: '#722ED110',
              borderRadius: 20
            }}>
              <Brain size={18} color="#722ED1" />
              <span style={{ fontSize: 'clamp(13, 1.5vw, 15)', fontWeight: 700, color: '#722ED1' }}>引擎 A</span>
            </div>

            <Progress
              type="circle"
              percent={Math.round(data.ai_score)}
              size={typeof window !== 'undefined' && window.innerWidth < 768 ? 110 : 140}
              strokeColor="#722ED1"
              trailColor="#F9F0FF"
              strokeWidth={10}
              format={(p) => (
                <div>
                  <div style={{ fontSize: 'clamp(28, 4vw, 36)', fontWeight: 900, color: '#722ED1' }}>{p}</div>
                  <div style={{ fontSize: 'clamp(11, 1.5vw, 14)', color: '#86909C' }}>%</div>
                </div>
              )}
            />

            <div style={{
              marginTop: 12,
              fontSize: 'clamp(14, 2vw, 17)',
              fontWeight: 800,
              color: '#1D2129'
            }}>
              AI 检测分数
            </div>
            <div style={{ fontSize: 'clamp(11, 1.3vw, 13)', color: '#86909C' }}>AI Content Detection</div>

            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: '#FFFFFF80',
              borderRadius: 10,
              fontSize: 'clamp(11, 1.3vw, 13)',
              color: '#4E5969',
              lineHeight: 1.7
            }}>
              检测文本是否由 AI 模型生成<br/>
              支持 GPT-4 / Claude / Gemini / DeepSeek 等
            </div>
          </div>
        </Card>
      </Col>

      <Col xs={24} md={2}>
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: typeof window !== 'undefined' && window.innerWidth < 768 ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          margin: typeof window !== 'undefined' && window.innerWidth < 768 ? '8px 0' : undefined
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #722ED1, #F472B6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(114,46,209,0.3)'
          }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontSize: 11, color: '#86909C', fontWeight: 600 }}>融合</span>
        </div>
      </Col>

      <Col xs={24} md={11}>
        <Card
          style={{
            borderRadius: 16,
            height: '100%',
            background: 'linear-gradient(135deg, #FFF0F6 0%, #FFFFFF 100%)',
            border: '2px solid #F472B630'
          }}
          bodyStyle={{ padding: 'clamp(16px, 3vw, 32px) clamp(12px, 2.5vw, 24px)' }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: '6px 14px',
              background: '#F472B610',
              borderRadius: 20
            }}>
              <Copy size={18} color="#F472B6" />
              <span style={{ fontSize: 'clamp(13, 1.5vw, 15)', fontWeight: 700, color: '#F472B6' }}>引擎 B</span>
            </div>

            <Progress
              type="circle"
              percent={Math.round(data.plagiarism_score)}
              size={typeof window !== 'undefined' && window.innerWidth < 768 ? 110 : 140}
              strokeColor="#F472B6"
              trailColor="#FFF0F6"
              strokeWidth={10}
              format={(p) => (
                <div>
                  <div style={{ fontSize: 'clamp(28, 4vw, 36)', fontWeight: 900, color: '#F53F3F' }}>{p}</div>
                  <div style={{ fontSize: 'clamp(11, 1.5vw, 14)', color: '#86909C' }}>%</div>
                </div>
              )}
            />

            <div style={{
              marginTop: 12,
              fontSize: 'clamp(14, 2vw, 17)',
              fontWeight: 800,
              color: '#1D2129'
            }}>
              抄袭检测分数
            </div>
            <div style={{ fontSize: 'clamp(11, 1.3vw, 13)', color: '#86909C' }}>Plagiarism Detection</div>

            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: '#FFFFFF80',
              borderRadius: 10,
              fontSize: 'clamp(11, 1.3vw, 13)',
              color: '#4E5969',
              lineHeight: 1.7
            }}>
              检测文本与已知来源的相似度<br/>
              支持直接复制、改写、结构抄袭等模式
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function SentenceAnalysisView({ sentences }: { sentences: SentenceAnalysis[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const SENTENCE_COLOR: Record<string, { bg: string; border: string; text: string; tag: string }> = {
    human_written: { bg: '#E8FFEA', border: '#00B42A', text: '#167D2C', tag: '#00B42A' },
    ai_generated: { bg: '#F9F0FF', border: '#722ED1', text: '#531DAB', tag: '#722ED1' },
    mixed: { bg: '#FFF7E8', border: '#FA8C16', text: '#B57A1C', tag: '#FA8C16' },
    plagiarized: { bg: '#FFF1F0', border: '#F53F3F', text: '#C41D33', tag: '#F53F3F' },
  };

  const verdictLabels: Record<string, string> = {
    human_written: '✅ 人工撰写',
    ai_generated: '🤖 AI 生成',
    mixed: '🔀 混合内容',
    plagiarized: '📋 抄袭内容',
  };

  useEffect(() => {
    if (sentences.length > 0 && expandedIndex === null) {
      setExpandedIndex(0);
    }
  }, [sentences]);

  if (sentences.length === 0) {
    return (
      <Empty
        description="暂无逐句分析数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: '60px 0' }}
      />
    );
  }

  return (
    <div style={{
      maxHeight: typeof window !== 'undefined' && window.innerWidth < 768 ? 'none' : 520,
      overflowY: typeof window !== 'undefined' && window.innerWidth < 768 ? 'visible' : 'auto',
      paddingRight: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 8
    }}>
      {sentences.map((s, i) => {
        const sc = SENTENCE_COLOR[s.sentence_verdict] || SENTENCE_COLOR.human_written;
        const isExpanded = expandedIndex === i;

        return (
          <div
            key={i}
            onClick={() => setExpandedIndex(isExpanded ? null : i)}
            style={{
              padding: isExpanded ? 'clamp(12px, 2vw, 16px) clamp(10px, 2.5vw, 20px)' : 'clamp(10px, 1.5vw, 12px) clamp(10px, 2vw, 16px)',
              marginBottom: 8,
              borderRadius: 12,
              background: sc.bg,
              borderLeft: `5px solid ${sc.border}`,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: isExpanded ? `0 4px 16px ${sc.border}20` : 'none',
              transform: isExpanded ? 'translateX(4px)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: typeof window !== 'undefined' && window.innerWidth < 768 ? 8 : 12 }}>
              <div style={{
                minWidth: typeof window !== 'undefined' && window.innerWidth < 768 ? 24 : 30,
                height: typeof window !== 'undefined' && window.innerWidth < 768 ? 24 : 30,
                borderRadius: '50%',
                background: sc.border,
                color: '#fff',
                fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {s.index + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'clamp(13, 1.5vw, 14.5)',
                  color: sc.text,
                  lineHeight: 1.75,
                  wordBreak: 'break-word',
                  fontWeight: isExpanded ? 500 : 400
                }}>
                  {s.text}
                </div>

                <div style={{
                  display: 'flex',
                  gap: typeof window !== 'undefined' && window.innerWidth < 768 ? 6 : 10,
                  marginTop: 6,
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <Tag
                    color={sc.tag}
                    style={{
                      borderRadius: 6,
                      fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11,
                      fontWeight: 700,
                      padding: '1px 8px'
                    }}
                  >
                    {verdictLabels[s.sentence_verdict] || s.sentence_verdict}
                  </Tag>

                  <Tooltip title={`AI 生成概率: ${(s.ai_probability * 100).toFixed(1)}%`}>
                    <Tag style={{ borderRadius: 6, fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11 }}>
                      AI: {(s.ai_probability * 100).toFixed(0)}%
                    </Tag>
                  </Tooltip>

                  <Tooltip title={`抄袭相似度: ${(s.plagiarism_similarity * 100).toFixed(1)}%`}>
                    <Tag style={{ borderRadius: 6, fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11 }}>
                      抄袭: {(s.plagiarism_similarity * 100).toFixed(0)}%
                    </Tag>
                  </Tooltip>

                  {s.key_reason && (
                    <Tooltip title={s.key_reason}>
                      <Info size={typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 14} style={{ color: '#86909C', cursor: 'help' }} />
                    </Tooltip>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isExpanded ? <Minus size={typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 14} /> : <Plus size={typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 14} />}
                    <span style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11, color: '#86909C' }}>
                      {isExpanded ? '收起' : '展开'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    marginTop: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 14,
                    paddingTop: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 14,
                    borderTop: `1px solid ${sc.border}40`,
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <Row gutter={[typeof window !== 'undefined' && window.innerWidth < 768 ? 8 : 16, 12]}>
                      <Col span={12}>
                        <div style={{
                          padding: '8px 12px',
                          background: '#FFFFFF90',
                          borderRadius: 8
                        }}>
                          <div style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11, color: '#86909C', marginBottom: 4 }}>
                            置信度
                          </div>
                          <Progress
                            percent={Math.round(s.confidence * 100)}
                            size="small"
                            strokeColor={sc.border}
                            showInfo={false}
                          />
                          <div style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12, fontWeight: 700, color: sc.text, marginTop: 4 }}>
                            {(s.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{
                          padding: '8px 12px',
                          background: '#FFFFFF90',
                          borderRadius: 8
                        }}>
                          <div style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11, color: '#86909C', marginBottom: 4 }}>
                            位置信息
                          </div>
                          <div style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12, fontWeight: 600, color: '#4E5969' }}>
                            字符 {s.start_char} - {s.end_char}
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {Array.isArray(s.ai_markers) && s.ai_markers.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 9 : 11, color: '#86909C', marginBottom: 4 }}>
                          AI 特征标记:
                        </div>
                        <Space size={[4, 4]} wrap>
                          {s.ai_markers.map((marker, mi) => (
                            <Tag key={mi} color="purple" style={{ borderRadius: 4, fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 8 : 10 }}>
                              {marker}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )}

                    {s.source_ref && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 10px',
                        background: '#FFF1F0',
                        borderRadius: 6,
                        fontSize: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 12,
                        color: '#F53F3F',
                        fontWeight: 600
                      }}>
                        🔗 关联来源: {s.source_ref}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{
                display: typeof window !== 'undefined' && window.innerWidth < 768 ? 'none' : 'flex',
                flexDirection: 'column',
                gap: 4,
                flexShrink: 0,
                alignItems: 'center'
              }}>
                <Progress
                  type="circle"
                  percent={Math.round(s.ai_probability * 100)}
                  size={40}
                  strokeColor={s.ai_probability > 0.6 ? '#722ED1' : '#00B42A'}
                  format={() => ''}
                />
                <span style={{ fontSize: 9, color: '#86909C', fontWeight: 600 }}>AI%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceComparisonView({ sources }: { sources: SourceMatch[] }) {
  const typeColors: Record<string, string> = {
    direct_copy: '#F53F3F',
    paraphrase: '#FF7D00',
    structural: '#FA8C16',
    self_plagiarism: '#86909C',
    translation: '#165DFF',
    mosaic: '#722ED1',
  };

  const sourceTypeColors: Record<string, string> = {
    academic_paper: '#722ED1',
    news_article: '#165DFF',
    web_page: '#00B42A',
    book: '#FA8C16',
    social_media: '#F472B6',
    unknown: '#86909C',
  };

  const typeLabels: Record<string, string> = {
    direct_copy: '直接复制',
    paraphrase: '改写/同义替换',
    structural: '结构抄袭',
    self_plagiarism: '自我抄袭',
    translation: '翻译抄袭',
    mosaic: '混合拼接',
  };

  if (sources.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: '#E8FFEA',
        borderRadius: 16,
        border: '2px dashed #00B42A'
      }}>
        <CheckCircle2 size={64} color="#00B42A" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: '#00B42A', marginBottom: 8 }}>
          未发现疑似抄袭来源
        </div>
        <div style={{ fontSize: 14, color: '#86909C' }}>
          文本内容具有较高的原创性 ✨
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 8 }}>
      {sources.map((src, i) => (
        <div
          key={i}
          style={{
            padding: '18px 22px',
            marginBottom: 14,
            borderRadius: 14,
            background: i % 2 === 0 ? '#FAFBFC' : '#FFFFFF',
            border: `2px solid ${(typeColors[src.plagiarism_type] || '#E5E6EB')}30`,
            transition: 'all 0.2s ease',
            ':hover': {
              borderColor: typeColors[src.plagiarism_type] || '#E5E6EB',
              boxShadow: `0 4px 16px ${(typeColors[src.plagiarism_type] || '#E5E6EB')}20`
            }
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            flexWrap: 'wrap'
          }}>
            <Badge
              count={i + 1}
              style={{
                backgroundColor: typeColors[src.plagiarism_type] || '#86909C',
                boxShadow: 'none',
                fontSize: 13,
                fontWeight: 800
              }}
            />

            <Tag
              color={typeColors[src.plagiarism_type] || '#86909C'}
              style={{
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 12px'
              }}
            >
              {typeLabels[src.plagiarism_type] || src.plagiarism_type.replace('_', ' ')}
            </Tag>

            <Tag
              color={sourceTypeColors[src.source_type] || '#86909C'}
              style={{
                borderRadius: 8,
                fontSize: 12,
                padding: '4px 12px'
              }}
            >
              <FileText size={12} style={{ marginRight: 4 }} />
              {src.source_type.replace('_', '/')}
            </Tag>

            <div style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              background: '#FFF1F0',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 900,
              color: '#F53F3F'
            }}>
              相似度 {src.similarity_percent.toFixed(0)}%
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: '#FFF1F0',
            borderRadius: 10,
            borderLeft: '4px solid #F53F3F',
            marginBottom: 10
          }}>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 6, fontWeight: 600 }}>
              匹配文本片段:
            </div>
            <div style={{
              fontSize: 14,
              color: '#4E5969',
              lineHeight: 1.7,
              fontStyle: 'italic'
            }}>
              "{src.matched_text_segment}"
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: 20,
            fontSize: 13,
            color: '#86909C',
            flexWrap: 'wrap'
          }}>
            <span>
              <Target size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {src.location_in_text}
            </span>
            <span>
              <FileSearch size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {src.source_description}
            </span>
            <span>
              <ShieldCheck size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              置信度: {(src.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapChart({ sentences }: { sentences: SentenceAnalysis[] }) {
  if (!sentences || sentences.length === 0) return null;

  const maxChars = Math.max(...sentences.map(s => s.text.length), 1);

  const getHeatColor = (score: number): string => {
    const pct = score * 100;
    if (pct <= 30) return '#00B42A';
    if (pct <= 70) return '#FAAD14';
    return '#F53F3F';
  };

  const getHeatLabel = (score: number): string => {
    const pct = score * 100;
    if (pct <= 30) return '人工撰写';
    if (pct <= 70) return '疑似AI';
    return '高度疑似AI';
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        fontSize: 15,
        fontWeight: 800,
        color: '#1D2129',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <BarChart3 size={18} color="#F53F3F" />
        AI 概率热力图
        <span style={{ fontSize: 12, fontWeight: 400, color: '#86909C', marginLeft: 4 }}>
          ({sentences.length} 段)
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: 3,
        alignItems: 'flex-end',
        padding: '16px 8px',
        background: '#FAFBFC',
        borderRadius: 12,
        overflowX: 'auto'
      }}>
        {sentences.map((s, i) => {
          const heightPercent = Math.max(20, (s.text.length / maxChars) * 100);
          const color = getHeatColor(s.ai_probability);

          return (
            <Tooltip
              key={i}
              title={
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>第 {s.index + 1} 句</div>
                  <div>AI概率: {(s.ai_probability * 100).toFixed(1)}%</div>
                  <div>判定: {getHeatLabel(s.ai_probability)}</div>
                  <div>字符数: {s.text.length}</div>
                </div>
              }
            >
              <div
                style={{
                  minWidth: Math.max(12, 300 / sentences.length),
                  maxWidth: 40,
                  height: `${heightPercent}%`,
                  minHeight: 16,
                  background: `linear-gradient(180deg, ${color}cc, ${color})`,
                  borderRadius: [4, 4, 0, 0],
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  flexShrink: 0,
                  ':hover': {
                    transform: 'scaleY(1.05)',
                    boxShadow: `0 0 12px ${color}60`
                  }
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 10,
        padding: '0 8px'
      }}>
        {[
          { label: '人工 (0-30%)', color: '#00B42A' },
          { label: '疑似 (30-70%)', color: '#FAAD14' },
          { label: 'AI (70-100%)', color: '#F53F3F' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#86909C' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineReplay({ data }: { data: DualEngineItem }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  const stages = [
    { label: '文本预处理', icon: <FileText size={14} />, desc: '分词、清洗、标准化', time: `${data.processing_time_ms * 0.1 | 0}ms` },
    { label: 'AI特征提取', icon: <Brain size={14} />, desc: '困惑度、突发性、语义分析', time: `${data.ai_engine_time_ms | 0}ms` },
    { label: '抄袭比对', icon: <Copy size={14} />, desc: '相似度计算、来源匹配', time: `${data.plagiarism_engine_time_ms | 0}ms` },
    { label: '融合判定', icon: <Zap size={14} />, desc: '双引擎结果加权融合', time: `${data.processing_time_ms * 0.15 | 0}ms` },
    { label: '报告生成', icon: <FileDown size={14} />, desc: '综合评分、详细报告输出', time: `${data.processing_time_ms * 0.05 | 0}ms` },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    if (currentStage >= stages.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCurrentStage(s => s + 1), 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStage]);

  useEffect(() => {
    setCurrentStage(stages.length - 1);
  }, []);

  const handlePlayPause = () => {
    if (currentStage >= stages.length - 1) {
      setCurrentStage(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        fontSize: 15,
        fontWeight: 800,
        color: '#1D2129',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <PlayCircle size={18} color="#1A6BA8" />
        检测过程回放
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',
        background: '#F7F8FA',
        borderRadius: 10
      }}>
        <Button
          type="primary"
          shape="circle"
          size="small"
          icon={isPlaying ? <Pause size={14} /> : <Play size={14} />}
          onClick={handlePlayPause}
          style={{ flexShrink: 0 }}
        />

        <input
          type="range"
          min={0}
          max={stages.length - 1}
          value={currentStage}
          onChange={(e) => { setCurrentStage(Number(e.target.value)); setIsPlaying(false); }}
          style={{
            flex: 1,
            accentColor: '#1A6BA8',
            cursor: 'pointer',
            height: 6
          }}
        />

        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#1A6BA8',
          whiteSpace: 'nowrap',
          minWidth: 60,
          textAlign: 'right'
        }}>
          {stages[currentStage].label}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 8
      }}>
        {stages.map((stage, i) => {
          const isActive = i === currentStage;
          const isPast = i < currentStage;

          return (
            <div
              key={i}
              onClick={() => { setCurrentStage(i); setIsPlaying(false); }}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: isActive ? '#E8F3FF' : isPast ? '#E8FFEA' : '#FFFFFF',
                border: `2px solid ${
                  isActive ? '#1A6BA8' :
                  isPast ? '#00B42A50' :
                  '#E5E6EB'
                }`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                opacity: isPast && !isActive ? 0.75 : 1,
                transform: isActive ? 'scale(1.02)' : 'none'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                color: isActive ? '#1A6BA8' : isPast ? '#00B42A' : '#86909C'
              }}>
                {stage.icon}
                <span style={{ fontSize: 12, fontWeight: 700 }}>{stage.label}</span>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#1A6BA8',
                    animation: 'pulse 1.5s infinite'
                  }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: '#86909C', lineHeight: 1.5 }}>
                {stage.desc}
              </div>
              <div style={{ fontSize: 10, color: '#C9CDD4', marginTop: 4, fontWeight: 600 }}>
                耗时 ~{stage.time}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFileTypeIcon(fileName: string): { icon: React.ReactNode; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return { icon: <FileText size={18} />, color: '#F53F3F' };
    case 'doc':
    case 'docx':
      return { icon: <FileType size={18} />, color: '#165DFF' };
    case 'txt':
      return { icon: <File size={18} />, color: '#00B42A' };
    default:
      return { icon: <FileCode size={18} />, color: '#86909C' };
  }
}

const getRiskLevel = (score: number): RiskLevel => {
  if (score >= 80) return 'safe';
  if (score >= 50) return 'warning';
  if (score >= 30) return 'danger';
  return 'critical';
};

function BatchUploadComponent({
  onBatchComplete
}: {
  onBatchComplete: (results: BatchItem[]) => void;
}) {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleFilesUpload = async (files: File[]) => {
    const newItems: BatchItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      content: '',
      status: 'pending' as const
    }));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        newItems[i].content = text;
      } catch (e) {
        newItems[i].status = 'error';
        newItems[i].error = '文件读取失败';
      }
    }

    setBatchItems(prev => [...prev, ...newItems]);
  };

  const processBatch = async () => {
    setIsProcessing(true);
    const results = [...batchItems];

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (item.status === 'error' || !item.content.trim()) continue;

      results[i].status = 'scanning';
      setBatchItems([...results]);

      try {
        const res = await dualEngineApi.scan({
          original_text: item.content,
          file_name: item.fileName,
          file_size: new Blob([item.content]).size
        });

        results[i].status = 'completed';
        results[i].result = res.data.data;
        setBatchItems([...results]);
      } catch (e: any) {
        results[i].status = 'error';
        results[i].error = e.response?.data?.message || e.message || '检测失败';
        setBatchItems([...results]);
      }
    }

    setIsProcessing(false);
    onBatchComplete(results);
  };

  const retryItem = async (id: string) => {
    const item = batchItems.find(i => i.id === id);
    if (!item || !item.content.trim()) return;

    const results = [...batchItems];
    const idx = results.findIndex(i => i.id === id);
    results[idx].status = 'scanning';
    results[idx].error = undefined;
    setBatchItems([...results]);

    try {
      const res = await dualEngineApi.scan({
        original_text: item.content,
        file_name: item.fileName,
        file_size: new Blob([item.content]).size
      });
      results[idx].status = 'completed';
      results[idx].result = res.data.data;
    } catch (e: any) {
      results[idx].status = 'error';
      results[idx].error = e.response?.data?.message || e.message || '检测失败';
    }
    setBatchItems([...results]);
  };

  const removeItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setBatchItems([]);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newItems = [...batchItems];
    const [removed] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, removed);
    setBatchItems(newItems);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <Card
      style={{ borderRadius: 16, marginTop: 20 }}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800 }}>
          <Layers size={20} /> 批量上传检测
        </span>
      }
      extra={
        <Space>
          {batchItems.length > 0 && (
            <Button size="small" danger onClick={clearAll}>
              清空队列
            </Button>
          )}
        </Space>
      }
    >
      <Upload.Dragger
        accept=".txt,.docx,.pdf,.odt,.md,.json,.csv"
        multiple
        showUploadList={false}
        beforeUpload={(file) => {
          handleFilesUpload([file]);
          return false;
        }}
        style={{
          borderRadius: 12,
          marginBottom: 16,
          background: '#FAFBFC',
          borderColor: '#C9CDD4'
        }}
      >
        <p className="ant-upload-drag-icon">
          <UploadIcon size={36} color="#C9CDD4" />
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#4E5969' }}>
          点击或拖拽多个文件到此区域
        </p>
        <p style={{ fontSize: 12, color: '#C9CDD4' }}>
          支持 .txt .docx .pdf .odt 格式，可同时上传多个文件
        </p>
      </Upload.Dragger>

      {batchItems.length > 0 && (
        <>
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#F2F3F5',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#4E5969' }}>
              检测队列 ({batchItems.length} 个文件)
              <span style={{ fontSize: 12, color: '#86909C', marginLeft: 8, fontWeight: 400 }}>
                · 拖拽左侧手柄可排序
              </span>
            </span>
            <Button
              type="primary"
              loading={isProcessing}
              disabled={isProcessing}
              onClick={processBatch}
              icon={<Sparkles />}
              style={{ borderRadius: 8 }}
            >
              {isProcessing ? '正在批量检测...' : `开始批量检测 (${batchItems.length})`}
            </Button>
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
            {batchItems.map((item, index) => {
              const fileType = getFileTypeIcon(item.fileName);
              const isDragging = dragIndex === index;

              return (
                <div
                  key={item.id}
                  draggable={!isProcessing && item.status !== 'scanning'}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: '12px 14px',
                    marginBottom: 8,
                    borderRadius: 10,
                    background: isDragging ? '#E8F3FF' : '#FFFFFF',
                    border: isDragging ? '2px dashed #1A6BA8' : '1px solid #E5E6EB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: isProcessing || item.status === 'scanning' ? 'default' : 'grab',
                    opacity: isDragging ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(index); }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: '#F2F3F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'grab',
                      color: '#C9CDD4',
                      ':hover': { color: '#86909C', background: '#E5E6EB' }
                    }}
                  >
                    <GripVertical size={14} />
                  </div>

                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${fileType.color}10`,
                    color: fileType.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {fileType.icon}
                  </div>

                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background:
                      item.status === 'completed' ? '#E8FFEA' :
                      item.status === 'scanning' ? '#FFF7E8' :
                      item.status === 'error' ? '#FFF1F0' :
                      '#F2F3F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {item.status === 'completed' && <CheckCircle2 size={18} color="#00B42A" />}
                    {item.status === 'scanning' && <Spin size="small" />}
                    {item.status === 'error' && <X size={18} color="#F53F3F" />}
                    {item.status === 'pending' && <Clock size={18} color="#86909C" />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1D2129',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      {item.fileName}
                      {item.status === 'scanning' && (
                        <Tag color="orange" style={{ borderRadius: 4, fontSize: 10, padding: '0 6px', lineHeight: '16px', marginLeft: 4 }}>处理中</Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909C', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{item.content.length.toLocaleString()} 字符</span>
                      {item.result && <span style={{ color: '#00B42A' }}>原创 {item.result.originality_score.toFixed(0)}%</span>}
                      {item.error && (
                        <Tooltip title={`错误详情：${item.error}`}>
                          <span style={{ color: '#F53F3F', cursor: 'help', textDecoration: 'underline dotted' }}>
                            上传失败
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {item.status === 'error' && item.content.trim() && (
                      <Tooltip title="重新上传此文件">
                        <Button
                          type="text"
                          size="small"
                          icon={<RotateCw size={14} />}
                          onClick={(e) => { e.stopPropagation(); retryItem(item.id); }}
                          style={{ color: '#165DFF' }}
                        />
                      </Tooltip>
                    )}
                    <Button
                      type="text"
                      size="small"
                      icon={<X size={14} />}
                      onClick={() => removeItem(item.id)}
                      disabled={item.status === 'scanning'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {batchItems.filter(i => i.status === 'completed').length > 0 && (
        <div style={{
          marginTop: 16,
          padding: '16px',
          background: '#E8FFEA',
          borderRadius: 10,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00B42A', marginBottom: 8 }}>
            ✓ 批量检测完成！
          </div>
          <div style={{ fontSize: 13, color: '#4E5969' }}>
            成功完成 {batchItems.filter(i => i.status === 'completed').length} / {batchItems.length} 个文件的检测
          </div>
        </div>
      )}
    </Card>
  );
}

export default function OriginalityPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [contentText, setContentText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<DualEngineItem | null>(null);
  const [activeTab, setActiveTab] = useState<'sentences' | 'sources' | 'report'>('sentences');
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScan = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!contentText.trim() && !urlInput.trim()) {
      message.warning('请输入需要检测的文本或URL地址');
      return;
    }

    let textToScan = contentText;

    if (urlInput.trim() && !contentText.trim()) {
      message.info('正在抓取网页内容...');
      try {
        const response = await fetch(`/api/fetch-url?url=${encodeURIComponent(urlInput.trim())}`);
        if (!response.ok) throw new Error('URL抓取失败');
        const data = await response.json();
        textToScan = data.content || '';
        if (!textToScan) {
          message.error('无法从该URL获取有效内容，请尝试直接粘贴文本');
          return;
        }
        message.success(`成功获取网页内容 (${textToScan.length} 字符)`);
      } catch (e) {
        message.error('URL抓取失败，请检查链接是否有效或直接粘贴文本内容');
        return;
      }
    }

    setScanning(true);

    try {
      const res = await dualEngineApi.scan({
        original_text: textToScan,
        file_name: fileName || urlInput ? `originality-${Date.now()}.txt` : undefined,
        file_size: new Blob([textToScan]).size,
      });

      message.success('✨ 双引擎检测完成！');
      setCurrentResult(res.data.data);
      window.scrollTo({ top: 500, behavior: 'smooth' });
    } catch (e: any) {
      message.error(
        e.response?.data?.detail ||
        e.response?.data?.message ||
        e.response?.data?.error ||
        '检测失败，请重试'
      );
    }

    setScanning(false);
  }, [contentText, urlInput, fileName, isAuthenticated, navigate]);

  const handleExportPDF = () => {
    if (!currentResult) return;
    message.info('正在生成 PDF 报告...');
    console.log('导出PDF:', currentResult.id);
  };

  const handleShareReport = () => {
    if (!currentResult) return;
    const shareUrl = `${window.location.origin}/originality/report/${currentResult.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('报告链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败，请手动分享');
    });
  };

  const handleNewScan = () => {
    setCurrentResult(null);
    setContentText('');
    setUrlInput('');
    setFileName('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBatchComplete = (results: BatchItem[]) => {
    const completedResults = results.filter(r => r.status === 'completed' && r.result);
    if (completedResults.length > 0) {
      setCurrentResult(completedResults[0].result!);
      message.success(`批量检测完成，共 ${completedResults.length} 个文件`);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #FFFDF9 0%, #FBF9F6 50%, #F5F7FA 100%)'
    }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        padding: '60px 24px 48px',
        background: 'linear-gradient(135deg, #1A6BA8 0%, #0D4A7C 50%, #063455 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: -100,
          left: '-10%',
          width: 500,
          height: 500,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          bottom: -120,
          right: '-10%',
          width: 600,
          height: 600,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '50%'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            padding: '8px 20px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 24,
            backdropFilter: 'blur(10px)'
          }}>
            <ShieldCheck size={20} color="#34D399" />
            <Brain size={20} color="#A78BFA" />
            <span style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.5
            }}>
              Dual Engine Technology
            </span>
          </div>

          <h1 style={{
            margin: 0,
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: -0.5,
            lineHeight: 1.2,
            marginBottom: 16
          }}>
            AI 原创性检测
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #34D399, #60A5FA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              AI Content & Plagiarism Detector
            </span>
          </h1>

          <p style={{
            margin: '16px auto 0',
            fontSize: 'clamp(14px, 2vw, 17px)',
            color: 'rgba(255,255,255,0.88)',
            maxWidth: 800,
            lineHeight: 1.8,
            fontWeight: 400
          }}>
            采用双引擎并行架构，同时运行 AI 内容检测和抄袭相似度分析
            <br />
            精准识别 GPT-4 / Claude / Gemini / DeepSeek 等 AI 模型生成内容
            <br />
            支持逐句级别分析 · 来源匹配追踪 · 专业级检测报告
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            marginTop: 28,
            flexWrap: 'wrap'
          }}>
            {[
              { icon: <Brain size={16} />, label: 'AI 检测引擎', color: '#A78BFA' },
              { icon: <Copy size={16} />, label: '抄袭检测引擎', color: '#F472B6' },
              { icon: <Zap size={16} />, label: '融合算法', color: '#34D399' },
              { icon: <Target size={16} />, label: '逐句高亮', color: '#60A5FA' },
              { icon: <Bot size={16} />, label: '模型指纹', color: '#FBBF24' },
              { icon: <FileSearch size={16} />, label: '来源追踪', color: '#F87171' },
            ].map((feature, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 20,
                border: `1px solid ${feature.color}30`,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                backdropFilter: 'blur(4px)'
              }}>
                <span style={{ color: feature.color }}>{feature.icon}</span>
                {feature.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: 1280,
        margin: '-40px auto 40px',
        padding: '0 24px',
        position: 'relative',
        zIndex: 2
      }}>
        {!currentResult ? (
          /* Input Section */
          <Card
            style={{
              borderRadius: 20,
              boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
              border: 'none'
            }}
            styles={{ body: { padding: '32px' } }}
          >
            <Tabs
              defaultActiveKey="text"
              centered
              size="large"
              items={[
                {
                  key: 'text',
                  label: (
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      <Type size={16} style={{ marginRight: 6 }} />
                      文本输入
                    </span>
                  ),
                  children: (
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#1D2129',
                        marginBottom: 12
                      }}>
                        粘贴或输入待检测文本
                        <span style={{
                          fontWeight: 400,
                          color: '#86909C',
                          marginLeft: 8,
                          fontSize: 13
                        }}>
                          (支持中英文混合，建议不少于200字)
                        </span>
                      </label>
                      <TextArea
                        rows={10}
                        placeholder='在此粘贴需要检测的文案内容...&#10;&#10;例如：文章、论文、博客、产品描述、营销文案等&#10;&#10;双引擎将同时进行：&#10;  ✓ 引擎A → AI内容检测（识别GPT-4/Claude/Gemini/DeepSeek等）&#10;  ✓ 引擎B → 抄袭相似度检测（来源匹配+改写识别+结构分析）&#10;  ✓ 融合算法 → 计算综合原创性得分'
                        value={contentText}
                        onChange={(e) => setContentText(e.target.value)}
                        style={{
                          borderRadius: 12,
                          fontSize: 14.5,
                          lineHeight: 1.85,
                          resize: 'vertical'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: 13, color: '#86909C' }}>
                          {contentText.length.toLocaleString()} 字符
                          {' · '}
                          ~{Math.ceil(contentText.length / 2)} 字
                          {' · '}
                          ~{contentText.split(/\s+/).filter(w => w).length} 词
                        </span>
                        {fileName && (
                          <Tag color="blue" style={{ borderRadius: 8 }}>
                            <FileText size={12} style={{ marginRight: 4 }} />
                            {fileName}
                          </Tag>
                        )}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'upload',
                  label: (
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      <UploadIcon size={16} style={{ marginRight: 6 }} />
                      文件上传
                    </span>
                  ),
                  children: (
                    <div>
                      <Upload.Dragger
                        accept=".txt,.docx,.pdf,.odt"
                        showUploadList={false}
                        beforeUpload={(f) => {
                          setFileName(f.name);
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setContentText(e.target?.result as string || '');
                          };
                          reader.readAsText(f);
                          return false;
                        }}
                        style={{
                          borderRadius: 14,
                          padding: '48px 24px',
                          background: '#FAFBFC',
                          borderColor: '#C9CDD4'
                        }}
                      >
                        <p className="ant-upload-drag-icon">
                          <UploadIcon size={48} color="#1A6BA8" />
                        </p>
                        <p style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#1D2129',
                          marginBottom: 8
                        }}>
                          点击或拖拽文件到此区域上传
                        </p>
                        <p style={{ fontSize: 13, color: '#86909C' }}>
                          支持 .txt .docx .pdf .odt 格式
                          <br />
                          文件大小限制: 10MB
                        </p>
                      </Upload.Dragger>
                    </div>
                  )
                },
                {
                  key: 'url',
                  label: (
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      <Globe size={16} style={{ marginRight: 6 }} />
                      URL 输入
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '20px 0' }}>
                      <label style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#1D2129',
                        marginBottom: 12
                      }}>
                        输入网页 URL 地址
                        <span style={{
                          fontWeight: 400,
                          color: '#86909C',
                          marginLeft: 8,
                          fontSize: 13
                        }}>
                          (系统将自动抓取页面文本内容进行检测)
                        </span>
                      </label>
                      <Input
                        size="large"
                        placeholder="https://example.com/article"
                        prefix={<Link size={18} color="#86909C" />}
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onPressEnter={handleScan}
                        style={{
                          borderRadius: 12,
                          fontSize: 15
                        }}
                      />
                      <div style={{
                        marginTop: 12,
                        padding: '12px 16px',
                        background: '#FFFBE6',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#B57A1C'
                      }}>
                        <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                        注意: URL 抓取功能需要后端支持，如无法使用可直接粘贴文本内容
                      </div>
                    </div>
                  )
                }
              ]}
            />

            <Divider style={{ margin: '28px 0' }} />

            <div style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <Button
                type="primary"
                size="large"
                loading={scanning}
                disabled={!contentText.trim() && !urlInput.trim()}
                onClick={handleScan}
                icon={<Sparkles />}
                style={{
                  borderRadius: 12,
                  height: 56,
                  fontSize: 18,
                  fontWeight: 900,
                  minWidth: 240,
                  background: scanning
                    ? '#86909C'
                    : 'linear-gradient(135deg, #1A6BA8 0%, #0D4A7C 100%)',
                  boxShadow: scanning
                    ? 'none'
                    : '0 6px 24px rgba(26,107,168,0.35)',
                  transition: 'all 0.3s ease'
                }}
              >
                {scanning ? (
                  <span>
                    <Spin size="small" style={{ marginRight: 8 }} />
                    双引擎正在并行分析...
                  </span>
                ) : (
                  '🚀 开始检测'
                )}
              </Button>

              <Button
                size="large"
                icon={<Layers />}
                onClick={() => setShowBatchMode(!showBatchMode)}
                style={{
                  borderRadius: 12,
                  height: 56,
                  fontSize: 15,
                  fontWeight: 700,
                  borderWidth: 2
                }}
              >
                批量上传模式
              </Button>
            </div>

            {!isAuthenticated && (
              <Alert
                message="登录后即可使用完整功能"
                description="未登录用户仅可体验基础功能，登录后可保存历史记录、使用批量检测等高级功能"
                type="info"
                showIcon
                style={{
                  marginTop: 20,
                  borderRadius: 12,
                  border: '1px solid #91CAFF'
                }}
                action={
                  <Button type="link" onClick={() => navigate('/login')}>
                    立即登录 <ArrowRight size={14} />
                  </Button>
                }
              />
            )}
          </Card>
        ) : (
          /* Results Section - 使用 ResultCard 组件 */
          <div style={{ animation: 'fadeInUp 0.5s ease' }}>
            <ResultCard
              title="原创性检测报告"
              riskLevel={getRiskLevel(currentResult.originality_score)}
              metrics={[
                {
                  label: '原创度',
                  value: `${currentResult.originality_score.toFixed(1)}%`,
                  color: currentResult.originality_score >= 80 ? '#16A34A' : currentResult.originality_score >= 50 ? '#EA580C' : '#DC2626'
                },
                { label: 'AI检测分数', value: `${currentResult.ai_score.toFixed(1)}%` },
                { label: '抄袭检测分数', value: `${currentResult.plagiarism_score.toFixed(1)}%` },
                { label: '检测字数', value: `${currentResult.word_count}字` },
              ]}
              summary={
                currentResult.overall_verdict === 'human_written'
                  ? '您的文章原创度较高，符合平台要求'
                  : currentResult.overall_verdict === 'ai_generated'
                  ? '检测到文本可能由AI生成，建议进行人工润色和修改'
                  : currentResult.overall_verdict === 'plagiarized'
                  ? '发现疑似抄袭内容，请检查并修改相关段落'
                  : '检测完成，请查看详细分析结果'
              }
              suggestions={[
                ...(currentResult.originality_score < 80 ? [{ text: '建议补充更多个人观点和独特见解', type: 'improvement' as const }] : []),
                ...(currentResult.ai_score > 50 ? [{ text: 'AI生成概率较高，建议增加人工撰写的个性化表达', type: 'warning' as const }] : []),
                ...(currentResult.plagiarism_score > 30 ? [{ text: '存在相似来源，建议引用或改写相关内容', type: 'warning' as const }] : []),
              ]}
              onPrimaryAction={handleExportPDF}
              primaryActionText="下载检测报告"
              secondaryAction={handleNewScan}
              secondaryActionText="重新检测"
              executionTime={currentResult.processing_time_ms / 1000}
              showDataProtection={true}
            >
              {/* 保留原有的核心可视化组件 */}
              <div style={{ marginBottom: 24 }}>
                <OriginalityScorecard data={currentResult} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <DualEngineGauge data={currentResult} />
              </div>

              {/* Visualization Toolbar */}
              <Card
                style={{
                  borderRadius: 16,
                  marginBottom: 24,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
                }}
                bodyStyle={{ padding: '16px 20px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1D2129' }}>
                    <Highlighter size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom', color: '#1A6BA8' }} />
                    可视化工具
                  </span>
                  <Space size={[8, 8]} wrap>
                    <Button
                      type={highlightMode ? 'primary' : 'default'}
                      size="small"
                      icon={<Highlighter size={14} />}
                      onClick={() => setHighlightMode(!highlightMode)}
                      style={{
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        ...(highlightMode ? {} : { borderColor: '#C9CDD4' })
                      }}
                    >
                      高亮模式 {highlightMode ? 'ON' : 'OFF'}
                    </Button>
                  </Space>
                </div>

                {highlightMode && Array.isArray(currentResult.sentence_analyses) && currentResult.sentence_analyses.length > 0 && (
                  <div style={{
                    marginTop: 16,
                    padding: '20px',
                    background: '#FFFFFF',
                    borderRadius: 12,
                    border: '1px solid #E5E6EB',
                    maxHeight: 400,
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 12,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#E6FFED', border: '1px solid #00B42A40' }} />
                        人工撰写
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#F3E8FF', border: '1px solid #722ED140' }} />
                        AI生成
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#FFE6E6', border: '1px solid #F53F3F40' }} />
                        抄袭内容
                      </span>
                    </div>
                    <div style={{
                      fontSize: 14,
                      lineHeight: 2,
                      color: '#4E5969',
                      letterSpacing: 0.2
                    }}>
                      {currentResult.sentence_analyses.map((sentence, i) => {
                        let bgColor = '#E6FFED';
                        if (sentence.sentence_verdict === 'ai_generated') bgColor = '#F3E8FF';
                        else if (sentence.sentence_verdict === 'plagiarized') bgColor = '#FFE6E6';
                        else if (sentence.sentence_verdict === 'mixed') bgColor = '#FFF7E8';

                        return (
                          <span
                            key={i}
                            style={{
                              background: bgColor,
                              padding: '2px 5px',
                              borderRadius: 3,
                              transition: 'background 0.2s ease',
                              whiteSpace: 'pre-wrap'
                            }}
                            title={`${sentence.sentence_verdict} · AI: ${(sentence.ai_probability * 100).toFixed(0)}%`}
                          >
                            {sentence.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>

              {/* Distribution Stats */}
              <Card
                style={{
                  borderRadius: 16,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
                }}
                title={
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1D2129' }}>
                    <PieChart size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
                    逐句判定分布
                  </span>
                }
              >
                <Row gutter={[24, 16]}>
                  {[
                    { label: '✍️ 人工撰写', pct: currentResult.human_written_percent, color: '#00B42A', icon: <UserCheck /> },
                    { label: '🤖 AI 生成', pct: currentResult.ai_generated_percent, color: '#722ED1', icon: <Bot /> },
                    { label: '🔀 混合内容', pct: currentResult.mixed_content_percent, color: '#FA8C16', icon: <Shuffle /> },
                    { label: '📋 抄袭内容', pct: currentResult.plagiarized_percent, color: '#F53F3F', icon: <Copy /> },
                  ].map((item, i) => (
                    <Col xs={12} sm={6} key={i}>
                      <div style={{
                        padding: '16px',
                        background: `${item.color}08`,
                        borderRadius: 12,
                        textAlign: 'center',
                        border: `2px solid ${item.color}20`
                      }}>
                        <div style={{ marginBottom: 8, color: item.color }}>
                          {React.cloneElement(item.icon as React.ReactElement, { size: 24 })}
                        </div>
                        <Progress
                          type="circle"
                          percent={item.pct}
                          size={70}
                          strokeColor={item.color}
                          trailColor={`${item.color}15`}
                          strokeWidth={8}
                          format={(p) => <span style={{ fontSize: 16, fontWeight: 900, color: item.color }}>{p?.toFixed(1)}</span>}
                        />
                        <div style={{
                          marginTop: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#4E5969'
                        }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: item.color, marginTop: 4 }}>
                          {item.pct.toFixed(1)}%
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </ResultCard>

            {/* Processing Info - 放在 ResultCard 外部 */}
            <div style={{
              textAlign: 'center',
              padding: '20px',
              fontSize: 13,
              color: '#86909C',
              background: '#FAFBFC',
              borderRadius: 12,
              marginTop: 28
            }}>
              <Space size={[20, 12]} wrap justify="center">
                <span><FileText size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> {currentResult.word_count} 字</span>
                <span><Hash size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> {currentResult.sentence_count} 句</span>
                <span><Clock size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> 耗时 {currentResult.processing_time_ms}ms</span>
                <span><Brain size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> AI 引擎 {currentResult.ai_engine_time_ms}ms</span>
                <span><Copy size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> 抄袭引擎 {currentResult.plagiarism_engine_time_ms}ms</span>
              </Space>
            </div>

            {/* Detailed Analysis Modal/Section - 作为独立区域保留完整功能 */}
            <Card
              style={{
                borderRadius: 16,
                marginTop: 28,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
              }}
            >
              <Segmented
                value={activeTab}
                onChange={(v) => setActiveTab(v as any)}
                block
                size="large"
                style={{
                  marginBottom: 24,
                  borderRadius: 12,
                  padding: 6,
                  background: '#F2F3F5'
                }}
                options={[
                  {
                    label: (
                      <span style={{ fontWeight: 700 }}>
                        <Highlighter size={16} style={{ marginRight: 6 }} />
                        逐句分析
                        {Array.isArray(currentResult.sentence_analyses) && (
                          <Badge
                            count={currentResult.sentence_analyses.length}
                            style={{
                              marginLeft: 8,
                              backgroundColor: '#1A6BA8',
                              fontSize: 11
                            }}
                          />
                        )}
                      </span>
                    ),
                    value: 'sentences'
                  },
                  {
                    label: (
                      <span style={{ fontWeight: 700 }}>
                        <FileSearch size={16} style={{ marginRight: 6 }} />
                        来源对比
                        {Array.isArray(currentResult.source_matches) && (
                          <Badge
                            count={currentResult.source_matches.length}
                            style={{
                              marginLeft: 8,
                              backgroundColor: '#F53F3F',
                              fontSize: 11
                            }}
                          />
                        )}
                      </span>
                    ),
                    value: 'sources'
                  },
                  {
                    label: (
                      <span style={{ fontWeight: 700 }}>
                        <FileText size={16} style={{ marginRight: 6 }} />
                        详细报告
                      </span>
                    ),
                    value: 'report'
                  }
                ]}
              />

              {activeTab === 'sentences' && (
                <div>
                  <HeatmapChart
                    sentences={Array.isArray(currentResult.sentence_analyses)
                      ? currentResult.sentence_analyses
                      : []
                    }
                  />
                  <SentenceAnalysisView
                    sentences={Array.isArray(currentResult.sentence_analyses)
                      ? currentResult.sentence_analyses
                      : []
                    }
                  />
                </div>
              )}

              {activeTab === 'sources' && (
                <SourceComparisonView
                  sources={Array.isArray(currentResult.source_matches)
                    ? currentResult.source_matches
                    : []
                  }
                />
              )}

              {activeTab === 'report' && (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  <TimelineReplay data={currentResult} />

                  {/* Executive Summary */}
                  {currentResult.executive_summary && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#1D2129',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <Award size={20} color="#FAAD14" />
                        执行摘要
                      </div>
                      <div style={{
                        padding: '20px 24px',
                        background: 'linear-gradient(135deg, #FFFBEB, #FEFCE8)',
                        borderRadius: 12,
                        fontSize: 14,
                        color: '#4E5969',
                        lineHeight: 1.9,
                        whiteSpace: 'pre-wrap',
                        border: '2px solid #FAAD1430'
                      }}>
                        {currentResult.executive_report}
                      </div>
                    </div>
                  )}

                  {/* Detailed Metrics */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#1D2129',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <Activity size={20} color="#1A6BA8" />
                      详细指标
                    </div>
                    <Row gutter={[16, 16]}>
                      {[
                        { label: '可读性评分', value: currentResult.reading_ease_score, unit: '/100', icon: <BookOpen />, color: '#00B42A' },
                        { label: '词汇丰富度', value: currentResult.vocab_richness, unit: '', icon: <Type />, color: '#722ED1' },
                        { label: '风格一致性', value: (currentResult.style_consistency * 100), unit: '%', icon: <AlignLeft />, color: '#FA8C16' },
                        { label: '平均句长', value: currentResult.avg_sentence_length, unit: '字符', icon: <Hash />, color: '#165DFF' },
                      ].map((metric, i) => (
                        <Col xs={12} sm={6} key={i}>
                          <div style={{
                            padding: '16px',
                            background: '#FAFBFC',
                            borderRadius: 12,
                            textAlign: 'center',
                            border: `2px solid ${metric.color}20`
                          }}>
                            <div style={{ color: metric.color, marginBottom: 8 }}>
                              {React.cloneElement(metric.icon as React.ReactElement, { size: 22 })}
                            </div>
                            <div style={{
                              fontSize: 24,
                              fontWeight: 900,
                              color: metric.color
                            }}>
                              {typeof metric.value === 'number' ? metric.value.toFixed(1) : '-'}
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#86909C' }}>
                                {metric.unit}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: '#86909C',
                              marginTop: 4,
                              fontWeight: 600
                            }}>
                              {metric.label}
                            </div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>

                  {/* AI Model Detected */}
                  {currentResult.ai_model_detected && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#1D2129',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <Bot size={20} color="#722ED1" />
                        AI 模型推测
                      </div>
                      <div style={{
                        padding: '16px 20px',
                        background: '#F9F0FF',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        border: '2px solid #722ED120'
                      }}>
                        <Tag
                          color={MODEL_BADGE_COLORS[currentResult.ai_model_detected] || '#86909C'}
                          style={{
                            borderRadius: 10,
                            fontSize: 16,
                            fontWeight: 800,
                            padding: '8px 20px'
                          }}
                        >
                          🤖 {currentResult.ai_model_detected}
                        </Tag>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1D2129' }}>
                            识别置信度
                          </div>
                          <Progress
                            percent={Math.round(currentResult.ai_model_confidence * 100)}
                            strokeColor="#722ED1"
                            style={{ maxWidth: 200, marginTop: 4 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Report */}
                  {currentResult.detailed_report && (
                    <div>
                      <div style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#1D2129',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <FileText size={20} color="#86909C" />
                        完整检测报告
                      </div>
                      <div style={{
                        padding: '20px 24px',
                        background: '#F7F8FA',
                        borderRadius: 12,
                        fontSize: 13.5,
                        color: '#4E5969',
                        lineHeight: 1.9,
                        whiteSpace: 'pre-wrap',
                        fontFamily: '"SF Mono", Monaco, "Courier New", monospace'
                      }}>
                        {currentResult.detailed_report}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Batch Upload Component */}
        {showBatchMode && !currentResult && (
          <BatchUploadComponent onBatchComplete={handleBatchComplete} />
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        @media (max-width: 768px) {
          .ant-segmented {
            overflow-x: auto;
            flex-wrap: nowrap;
          }
        }

        @media (max-width: 480px) {
          .ant-card-head-title {
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
