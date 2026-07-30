import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import React from 'react';
import {
  Card, Button, Tag, Modal, Input, message, Progress, Row, Col,
  Space, Tooltip, Segmented, Spin, Typography, Divider, Badge, Popover, Tabs,
  Drawer, Skeleton
} from 'antd';
import { ExclamationCircleFilled, WarningFilled, InfoCircleFilled } from '@ant-design/icons';
import {
  SpellCheck, PenTool, FileText, Sparkles, CheckCircle,
  AlertTriangle, Info, XCircle, ChevronRight, Wand2,
  BookOpen, Target, TrendingUp, Zap, Lightbulb,
  Type, AlignLeft, Hash, Clock, RefreshCw,
  CircleCheck, CircleAlert, CircleX, CircleMinus,
  ArrowRight, Copy, Replace, Eye, BarChart3,
  Languages, Gauge, MessageSquare, Star, Shield,
} from 'lucide-react';
import request from '@/utils/request';
import { ResultCard } from '@/components/ResultCard';
import type { RiskLevel } from '@/components/ResultCard';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

interface ErrorItem {
  error_type: 'grammar' | 'spelling' | 'punctuation' | 'style';
  position: { start: number; end: number };
  original_text: string;
  correction: string;
  suggestion: string;
  confidence: number;
  rule_name: string;
}

interface GrammarResult {
  errors: ErrorItem[];
  overall_score: number;
  stats: {
    word_count: number;
    sentence_count: number;
    avg_sentence_length: number;
    error_count: number;
  };
  processing_time_ms?: number;
}

interface StyleResult {
  readability: { score: number; grade: string; level: string };
  tone: { formality: number; confidence: number; clarity: number };
  voice: string;
  suggestions: string[];
  processing_time_ms?: number;
}

interface ImproveResult {
  improved_text: string;
  changes: Array<{
    original: string;
    improved: string;
    reason: string;
    type: string;
  }>;
  mode: string;
  processing_time_ms?: number;
}

type ModeType = 'check' | 'improve' | 'style';

const ERROR_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; underlineColor: string }> = {
  grammar: { color: '#F5222D', bg: '#FFF1F0', icon: <XCircle size={14} />, label: '语法错误', underlineColor: '#F5222D' },
  spelling: { color: '#FA8C16', bg: '#FFF7E8', icon: <AlertTriangle size={14} />, label: '拼写错误', underlineColor: '#FA8C16' },
  punctuation: { color: '#FAAD14', bg: '#FFFBE6', icon: <Info size={14} />, label: '标点问题', underlineColor: '#FAAD14' },
  style: { color: '#1890FF', bg: '#E6F7FF', icon: <PenTool size={14} />, label: '文风建议', underlineColor: '#1890FF' },
};

const SCORE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  excellent: { color: '#52C41A', bg: '#F6FFED', label: 'Excellent (90+)' },
  good: { color: '#1890FF', bg: '#E6F7FF', label: 'Good (70-89)' },
  fair: { color: '#FAAD14', bg: '#FFFBE6', label: 'Fair (50-69)' },
  poor: { color: '#F5222D', bg: '#FFF1F0', label: 'Needs Work (<50)' },
};

function getScoreLevel(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

const grammarCache = new Map<string, { result: GrammarResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 10;

function getCacheKey(text: string): string {
  return `${JSON.stringify(text).length}_${text.slice(0, 100)}`;
}

function getCachedResult(key: string): GrammarResult | null {
  const entry = grammarCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    grammarCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResult(key: string, result: GrammarResult): void {
  if (grammarCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = grammarCache.keys().next().value;
    if (oldestKey) grammarCache.delete(oldestKey);
  }
  grammarCache.set(key, { result, timestamp: Date.now() });
}

function useDebouncedCallback<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
  }, [delay]) as T;
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return debouncedFn;
}

interface UnderlineSVGProps {
  type: 'grammar' | 'spelling' | 'style' | 'punctuation';
}

const UnderlineSVG: React.FC<UnderlineSVGProps> = ({ type }) => {
  const colorMap: Record<string, string> = { grammar: '#F53F3F', spelling: '#FA8C16', style: '#1890FF', punctuation: '#FAAD14' };
  const color = colorMap[type] || colorMap.grammar;
  const isDashed = type === 'spelling';

  return (
    <svg width="100%" height="6" preserveAspectRatio="none" style={{ display: 'block', position: 'absolute', bottom: -2, left: 0 }}>
      <path
        d={`M0,3 Q12.5,0 25,3 T50,3 T75,3 T100,3`}
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeDasharray={isDashed ? '4,3' : 'none'}
      />
    </svg>
  );
};

const ERROR_ICON_MAP: Record<string, React.ReactNode> = {
  grammar: <ExclamationCircleFilled style={{ color: '#F53F3F', fontSize: 12 }} />,
  spelling: <WarningFilled style={{ color: '#FA8C16', fontSize: 12 }} />,
  punctuation: <WarningFilled style={{ color: '#FAAD14', fontSize: 12 }} />,
  style: <InfoCircleFilled style={{ color: '#1890FF', fontSize: 12 }} />,
};

export default function GrammarlyPage() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ModeType>('check');
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<GrammarResult | null>(null);
  const [styleResult, setStyleResult] = useState<StyleResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const [improveMode, setImproveMode] = useState<'fluency' | 'conciseness' | 'vocabulary'>('fluency');
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null);
  const [acceptedChanges, setAcceptedChanges] = useState<ErrorItem[]>([]);
  const [activeReportTab, setActiveReportTab] = useState('errors');
  const textareaRef = useRef<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return Number(localStorage.getItem('sidebar_width')) || 340; } catch { return 340; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detectingStatus, setDetectingStatus] = useState<string | null>(null);
  const lastCheckedTextRef = useRef<string>('');
  const detectingRangeRef = useRef<string>('');
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  function handleDragStart(e: React.MouseEvent) {
    if (isMobile || sidebarCollapsed) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(500, startWidthRef.current + delta));
      setSidebarWidth(newWidth);
    }
    function handleMouseUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const wordCount = text.length;
  const charCount = text.replace(/\s/g, '').length;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    try { localStorage.setItem('sidebar_width', String(sidebarWidth)); } catch {}
  }, [sidebarWidth]);

  async function performGrammarCheck(checkText: string) {
    if (!checkText.trim()) return;
    const cacheKey = getCacheKey(checkText);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      setCheckResult(cached);
      setDetectingStatus(null);
      lastCheckedTextRef.current = checkText;
      return;
    }

    setDetectingStatus('正在检测全文...');
    setLoading(true);
    try {
      const res = await request.post('/api/grammar/check/', { text: checkText });
      if (res.data?.success) {
        setCheckResult(res.data.data);
        setCachedResult(cacheKey, res.data.data);
        lastCheckedTextRef.current = checkText;
        message.success('语法检查完成！');
      } else {
        message.error(res.data?.message || '检查失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || '检查失败，请重试');
    }
    setLoading(false);
    setDetectingStatus(null);
  }

  function getIncrementalRange(newText: string): { rangeText: string; rangeLabel: string } | null {
    const prevText = lastCheckedTextRef.current;
    if (!prevText) return null;
    const prevParas = prevText.split(/\n\n+/).filter(p => p.trim());
    const newParas = newText.split(/\n\n+/).filter(p => p.trim());
    if (newParas.length === 0) return null;
    let startIdx = 0;
    let endIdx = newParas.length - 1;
    for (let i = 0; i < Math.min(prevParas.length, newParas.length); i++) {
      if (prevParas[i] !== newParas[i]) { startIdx = i; break; }
      if (i === Math.min(prevParas.length, newParas.length) - 1 && newParas.length > prevParas.length) {
        startIdx = prevParas.length;
      }
    }
    for (let j = 0; j < Math.min(prevParas.length, newParas.length); j++) {
      const pi = prevParas.length - 1 - j;
      const ni = newParas.length - 1 - j;
      if (pi >= 0 && ni >= 0 && prevParas[pi] !== newParas[ni]) { endIdx = ni; break; }
    }
    if (startIdx > endIdx) return null;
    const rangeText = newParas.slice(startIdx, endIdx + 1).join('\n\n');
    return { rangeText, rangeLabel: `正在检测第${startIdx + 1}-${endIdx + 1}段 (共${newParas.length}段)...` };
  }

  const debouncedCheck = useDebouncedCallback((currentText: string) => {
    if (mode !== 'check' || !currentText.trim()) return;
    const incremental = getIncrementalRange(currentText);
    if (incremental) {
      detectingRangeRef.current = incremental.rangeLabel;
      setDetectingStatus(incremental.rangeLabel);
      performGrammarCheck(currentText);
    } else {
      performGrammarCheck(currentText);
    }
  }, 300);

  useEffect(() => {
    if (mode === 'check' && text.trim() && !loading) {
      debouncedCheck(text);
    }
  }, [text]);

  async function handleCheck() {
    if (!text.trim()) { message.warning('请输入需要检查的文本'); return; }
    lastCheckedTextRef.current = '';
    await performGrammarCheck(text);
  }

  async function handleImprove() {
    if (!text.trim()) { message.warning('请输入需要改进的文本'); return; }
    setLoading(true);
    try {
      const res = await request.post('/api/grammar/improve/', { text, mode: improveMode });
      if (res.data?.success) {
        setImproveResult(res.data.data);
        message.success('文本改进完成！');
      } else {
        message.error(res.data?.message || '改进失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || '改进失败，请重试');
    }
    setLoading(false);
  }

  async function handleStyleAnalyze() {
    if (!text.trim()) { message.warning('请输入需要分析的文本'); return; }
    setLoading(true);
    try {
      const res = await request.post('/api/grammar/style/', { text });
      if (res.data?.success) {
        setStyleResult(res.data.data);
        message.success('文风分析完成！');
      } else {
        message.error(res.data?.message || '分析失败');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || '分析失败，请重试');
    }
    setLoading(false);
  }

  function handleAcceptChange(error: ErrorItem) {
    let newText = text;
    const orig = error.original_text;
    const corr = error.correction;
    const pos = newText.indexOf(orig);
    if (pos !== -1) {
      newText = newText.substring(0, pos) + corr + newText.substring(pos + orig.length);
      setText(newText);
      setAcceptedChanges(prev => [...prev, error]);
      if (checkResult) {
        setCheckResult({
          ...checkResult,
          errors: checkResult.errors.filter(e => e !== error),
          overall_score: Math.min(100, checkResult.overall_score + 5),
          stats: { ...checkResult.stats, error_count: checkResult.stats.error_count - 1 }
        });
      }
      message.success(`已接受修改: ${orig} → ${corr}`);
    }
  }

  function handleIgnoreError(error: ErrorItem) {
    if (checkResult) {
      setCheckResult({
        ...checkResult,
        errors: checkResult.errors.filter(e => e !== error)
      });
    }
    setActiveErrorIndex(null);
  }

  function handleApplyAllCorrections() {
    if (!checkResult || checkResult.errors.length === 0) return;
    let newText = text;
    const sortedErrors = [...checkResult.errors].sort((a, b) => b.position.start - a.position.start);
    sortedErrors.forEach(err => {
      const idx = newText.indexOf(err.original_text);
      if (idx !== -1) {
        newText = newText.substring(0, idx) + err.correction + newText.substring(idx + err.original_text.length);
      }
    });
    setText(newText);
    setAcceptedChanges(prev => [...prev, ...sortedErrors]);
    setCheckResult(null);
    message.success(`已应用全部 ${sortedErrors.length} 处修正`);
  }

  function handleUseImprovedText() {
    if (improveResult?.improved_text) {
      setText(improveResult.improved_text);
      message.success('已使用改进后的文本');
    }
  }

  function renderUnderlinedText(): React.ReactNode {
    if (!checkResult || checkResult.errors.length === 0) return text;

    const sortedErrors = [...checkResult.errors].sort((a, b) => a.position.start - b.position.start);
    const result: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedErrors.forEach((err, idx) => {
      if (err.position.start > lastEnd) {
        result.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd, err.position.start)}</span>);
      }

      const config = ERROR_TYPE_CONFIG[err.error_type] || ERROR_TYPE_CONFIG.grammar;
      const isActive = activeErrorIndex === idx;
      const iconType = err.error_type === 'punctuation' ? 'spelling' : err.error_type as 'grammar' | 'spelling' | 'style';

      result.push(
        <span
          key={`err-${idx}`}
          onClick={() => setActiveErrorIndex(isActive ? null : idx)}
          style={{
            cursor: 'pointer',
            padding: '0 1px',
            backgroundColor: isActive ? config.bg : 'transparent',
            borderRadius: 2,
            transition: 'background-color 0.15s ease',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {ERROR_ICON_MAP[err.error_type] || ERROR_ICON_MAP.grammar}
          {text.slice(err.position.start, err.position.end)}
          <UnderlineSVG type={iconType} />
          {isActive && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              zIndex: 10,
              minWidth: 280,
            }}>
              {renderSuggestionCard(err, idx)}
            </div>
          )}
        </span>
      );
      lastEnd = err.position.end;
    });

    if (lastEnd < text.length) {
      result.push(<span key="text-end">{text.slice(lastEnd)}</span>);
    }

    return <>{result}</>;
  }

  function renderSuggestionCard(error: ErrorItem, index: number) {
    const config = ERROR_TYPE_CONFIG[error.error_type] || ERROR_TYPE_CONFIG.grammar;

    return (
      <Card
        size="small"
        style={{
          width: 320,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          borderRadius: 10,
          border: `1px solid ${config.color}40`,
          marginBottom: 4,
        }}
        styles={{ body: { padding: '12px 14px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ color: config.color }}>{config.icon}</span>
          <Tag color={config.color} style={{ borderRadius: 4, fontSize: 11, margin: 0, fontWeight: 600 }}>
            {config.label}
          </Tag>
          <span style={{ fontSize: 11, color: '#86909C', marginLeft: 'auto' }}>
            置信度 {(error.confidence * 100).toFixed(0)}%
          </span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#86909C', marginBottom: 3 }}>原文:</div>
          <div style={{
            padding: '6px 10px',
            background: '#FFF1F0',
            borderRadius: 6,
            fontSize: 13,
            color: '#F5222D',
            textDecoration: 'line-through',
            textDecorationColor: '#F5222D',
          }}>
            {error.original_text}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#86909C', marginBottom: 3 }}>建议:</div>
          <div style={{
            padding: '6px 10px',
            background: '#F6FFED',
            borderRadius: 6,
            fontSize: 13,
            color: '#52C41A',
            fontWeight: 500,
          }}>
            {error.correction}
          </div>
        </div>

        {error.suggestion && (
          <div style={{ fontSize: 12, color: '#4E5969', marginBottom: 10, lineHeight: 1.6 }}>
            💡 {error.suggestion}
          </div>
        )}

        {error.rule_name && (
          <div style={{ fontSize: 11, color: '#C9CDD4', marginBottom: 10 }}>
            📖 规则: {error.rule_name}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            size="small"
            icon={<Replace size={14} />}
            onClick={() => handleAcceptChange(error)}
            style={{ borderRadius: 6, flex: 1, background: config.color, borderColor: config.color }}
          >
            接受修改
          </Button>
          <Button
            size="small"
            icon={<XCircle size={14} />}
            onClick={() => handleIgnoreError(error)}
            style={{ borderRadius: 6 }}
          >
            忽略
          </Button>
        </div>
      </Card>
    );
  }

  function renderScoreRing(score: number, size: number = 140) {
    const levelConfig = SCORE_CONFIG[getScoreLevel(score)];
    return (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <Progress
          type="circle"
          percent={score}
          size={size}
          strokeColor={levelConfig.color}
          trailColor="#F0F0F0"
          format={(p) => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: size * 0.22, fontWeight: 900, color: levelConfig.color }}>{p}</div>
              <div style={{ fontSize: size * 0.1, color: '#86909C', marginTop: -2 }}>分</div>
            </div>
          )}
        />
      </div>
    );
  }

  function renderSidebar() {
    if (!checkResult && !styleResult) return null;

    const score = checkResult?.overall_score ?? 70;
    const levelConfig = SCORE_CONFIG[getScoreLevel(score)];

    const errorStats = checkResult ? {
      grammar: checkResult.errors.filter(e => e.error_type === 'grammar').length,
      spelling: checkResult.errors.filter(e => e.error_type === 'spelling').length,
      punctuation: checkResult.errors.filter(e => e.error_type === 'punctuation').length,
      style: checkResult.errors.filter(e => e.error_type === 'style').length,
    } : { grammar: 0, spelling: 0, punctuation: 0, style: 0 };

    const totalErrors = Object.values(errorStats).reduce((a, b) => a + b, 0);

    return (
      <Card
        title={<span style={{ fontSize: 15, fontWeight: 700 }}><BarChart3 size={16} style={{ marginRight: 6 }} />写作分析</span>}
        style={{ borderRadius: 14, height: 'fit-content' }}
        styles={{ header: { borderBottom: '2px solid #1A6BA820', borderRadius: '14px 14px 0 0' } }}
      >
        {/* Overall Score */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #F0F0F0' }}>
          {renderScoreRing(score)}
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: levelConfig.color }}>
            {levelConfig.label.split(' ')[0]}
          </div>
          <div style={{ fontSize: 12, color: '#86909C' }}>{levelConfig.label.split('(')[1]?.replace(')', '')}</div>
        </div>

        {/* Error Categories */}
        {totalErrors > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>📊 错误分类</div>
            {Object.entries(ERROR_TYPE_CONFIG).map(([key, cfg]) => {
              const count = errorStats[key as keyof typeof errorStats];
              if (count === 0) return null;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', marginBottom: 4, borderRadius: 8, background: `${cfg.bg}`,
                  cursor: 'pointer', transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
                onClick={() => {
                  const idx = checkResult!.errors.findIndex(e => e.error_type === key);
                  if (idx !== -1) setActiveErrorIndex(idx);
                }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span style={{ fontSize: 13 }}>{cfg.label}</span>
                  </span>
                  <Badge count={count} style={{ backgroundColor: cfg.color, boxShadow: 'none', fontSize: 11 }} />
                </div>
              );
            })}
          </div>
        )}

        {/* Style Metrics */}
        {styleResult && (
          <>
            <Divider style={{ margin: '16px 0' }} />

            {/* Tone Bars */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 12 }}>🎯 文风指标</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#86909C' }}>正式度</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A6BA8' }}>{Math.round(styleResult.tone.formality * 100)}%</span>
                </div>
                <Progress
                  percent={Math.round(styleResult.tone.formality * 100)}
                  strokeColor="#1A6BA8" trailColor="#F0F0F0"
                  showInfo={false} size="small"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: '#C9CDD4' }}>Formal</span>
                  <span style={{ fontSize: 10, color: '#C9CDD4' }}>Casual</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#86909C' }}>清晰度</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#52C41A' }}>{Math.round(styleResult.tone.clarity * 100)}%</span>
                </div>
                <Progress
                  percent={Math.round(styleResult.tone.clarity * 100)}
                  strokeColor="#52C41A" trailColor="#F0F0F0"
                  showInfo={false} size="small"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: '#C9CDD4' }}>Clear</span>
                  <span style={{ fontSize: 10, color: '#C9CDD4' }}>Complex</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#86909C' }}>自信度</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1890FF' }}>{Math.round(styleResult.tone.confidence * 100)}%</span>
                </div>
                <Progress
                  percent={Math.round(styleResult.tone.confidence * 100)}
                  strokeColor="#1890FF" trailColor="#F0F0F0"
                  showInfo={false} size="small"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Tag
                  color={styleResult.voice === 'active' ? '#52C41A' : '#FAAD14'}
                  style={{ borderRadius: 12, fontWeight: 600 }}
                >
                  {styleResult.voice === 'active' ? '✨ 主动语态' : '📝 被动语态'}
                </Tag>
                <Tag color="#1890FF" style={{ borderRadius: 12 }}>
                  📚 {styleResult.readability.grade}
                </Tag>
                <Tag color={SCORE_CONFIG[getScoreLevel(styleResult.readability.score)].color} style={{ borderRadius: 12 }}>
                  {styleResult.readability.level}
                </Tag>
              </div>
            </div>
          </>
        )}

        {/* Readability Metrics from checkResult.stats */}
        {checkResult && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>📈 可读性指标</div>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ padding: '8px', background: '#EBF5FF', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#165DFF' }}>{checkResult.stats.word_count.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>字符数</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px', background: '#F9F0FF', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#722ED1' }}>{checkResult.stats.sentence_count}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>句子数</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px', background: '#FFF0E6', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#FF7D00' }}>{checkResult.stats.avg_sentence_length.toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>平均句长</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '8px', background: totalErrors > 0 ? '#FFF1F0' : '#F6FFED', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: totalErrors > 0 ? '#F53F3F' : '#00B42A' }}>{totalErrors}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>问题数</div>
                  </div>
                </Col>
              </Row>
            </div>
          </>
        )}

        {/* Quick Actions */}
        {(checkResult || improveResult) && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4E5969', marginBottom: 10 }}>⚡ 快速操作</div>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {checkResult && checkResult.errors.length > 0 && (
                  <Button
                    block
                    type="primary"
                    icon={<Zap size={14} />}
                    onClick={handleApplyAllCorrections}
                    style={{ borderRadius: 8, background: '#1A6BA8', borderColor: '#1A6BA8' }}
                  >
                    一键修正所有错误 ({checkResult.errors.length})
                  </Button>
                )}
                <Button
                  block
                  icon={<Wand2 size={14} />}
                  onClick={() => { setImproveMode('fluency'); setMode('improve'); handleImprove(); }}
                  style={{ borderRadius: 8 }}
                >
                  提升流畅性
                </Button>
                <Button
                  block
                  icon={<AlignLeft size={14} />}
                  onClick={() => { setImproveMode('conciseness'); setMode('improve'); handleImprove(); }}
                  style={{ borderRadius: 8 }}
                >
                  简化句子
                </Button>
                <Button
                  block
                  icon={<Sparkles size={14} />}
                  onClick={() => { setImproveMode('vocabulary'); setMode('improve'); handleImprove(); }}
                  style={{ borderRadius: 8 }}
                >
                  升级词汇
                </Button>
              </Space>
            </div>
          </>
        )}
      </Card>
    );
  }

  function renderBottomReport() {
    if (!checkResult && !styleResult && !improveResult) return null;

    const errorCount = checkResult?.errors.length || 0;
    const grammarErrors = checkResult?.errors.filter(e => e.error_type === 'grammar').length || 0;
    const spellingErrors = checkResult?.errors.filter(e => e.error_type === 'spelling').length || 0;
    const punctuationErrors = checkResult?.errors.filter(e => e.error_type === 'punctuation').length || 0;
    const styleSuggestions = checkResult?.errors.filter(e => e.error_type === 'style').length || 0;
    const advancedWords = styleResult?.suggestions?.length || 0;

    let riskLevel: RiskLevel = 'safe';
    if (errorCount > 10) riskLevel = 'critical';
    else if (errorCount > 3) riskLevel = 'danger';
    else if (errorCount > 0) riskLevel = 'warning';

    const score = checkResult?.overall_score ?? 70;
    const summaryText = errorCount === 0
      ? `✨ 太棒了！您的文本得分为 ${score} 分，未发现语法错误。`
      : `检测到 ${errorCount} 个问题需要处理，当前得分 ${score} 分。建议逐一查看并修正。`;

    const executionTime = checkResult?.processing_time_ms
      ? Math.round(checkResult.processing_time_ms / 1000)
      : undefined;

    function handleCopy() {
      if (!text) {
        message.warning('没有可复制的文本');
        return;
      }
      navigator.clipboard.writeText(text);
      message.success('已复制修正后的文本到剪贴板');
    }

    function handleReset() {
      setText('');
      setCheckResult(null);
      setStyleResult(null);
      setImproveResult(null);
      setAcceptedChanges([]);
      setActiveErrorIndex(null);
    }

    return (
      <div style={{ marginTop: 20 }}>
        <ResultCard
          title="语法检查报告"
          riskLevel={riskLevel}
          metrics={[
            { label: '错误总数', value: `${errorCount}个`, color: errorCount === 0 ? '#16A34A' : '#DC2626' },
            { label: '语法错误', value: `${grammarErrors}个`, color: grammarErrors > 0 ? '#DC2626' : '#16A34A' },
            { label: '拼写错误', value: `${spellingErrors}个`, color: spellingErrors > 0 ? '#FA8C16' : '#16A34A' },
            { label: '标点问题', value: `${punctuationErrors}个`, color: punctuationErrors > 0 ? '#FAAD14' : '#16A34A' },
            { label: '风格建议', value: `${styleSuggestions}条`, color: '#2563eb' },
            { label: '改进建议', value: `${advancedWords}处`, color: '#16a34a' },
          ]}
          summary={summaryText}
          suggestions={(checkResult?.errors || []).slice(0, 5).map(err => ({
            text: err.suggestion || `${err.original_text} → ${err.correction}`,
            type: err.error_type === 'grammar' || err.error_type === 'spelling' ? 'warning' as const : 'improvement' as const,
          }))}
          details={
            <div>
              {checkResult && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                      错误详情列表 ({checkResult.errors.length})
                    </h4>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                      {checkResult.errors.map((err, i) => {
                        const cfg = ERROR_TYPE_CONFIG[err.error_type] || ERROR_TYPE_CONFIG.grammar;
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                            marginBottom: 6, borderRadius: 8, background: i % 2 === 0 ? '#FAFBFC' : '#FFF',
                            borderLeft: `3px solid ${cfg.color}`,
                          }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%', background: cfg.bg,
                              color: cfg.color, fontSize: 12, fontWeight: 700, flexShrink: 0,
                            }}>
                              {i + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                  background: cfg.bg, color: cfg.color,
                                }}>
                                  {cfg.label}
                                </span>
                                <span style={{ fontSize: 11, color: '#C9CDD4' }}>{err.rule_name}</span>
                                <span style={{ fontSize: 11, color: '#C9CDD4', marginLeft: 'auto' }}>
                                  置信度 {(err.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: '#4E5969', marginBottom: 4, lineHeight: 1.6 }}>
                                <span style={{ color: '#F5222D', textDecoration: 'line-through' }}>{err.original_text}</span>
                                {' → '}
                                <span style={{ color: '#52C41A', fontWeight: 600 }}>{err.correction}</span>
                              </div>
                              {err.suggestion && (
                                <div style={{ fontSize: 12, color: '#86909C', lineHeight: 1.5 }}>
                                  💡 {err.suggestion}
                                </div>
                              )}
                            </div>
                            <Button
                              size="small"
                              type="primary"
                              ghost
                              icon={<CheckCircle size={14} />}
                              onClick={() => handleAcceptChange(err)}
                              style={{ borderRadius: 6, flexShrink: 0 }}
                            >
                              接受
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {acceptedChanges.length > 0 && (
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E5E6EB' }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#16A34A' }}>
                        ✓ 已接受的修改 ({acceptedChanges.length})
                      </h4>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {acceptedChanges.map((change, i) => (
                          <div key={i} style={{
                            padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                            background: '#F6FFED', borderLeft: '3px solid #52C41A',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            <CheckCircle size={14} color="#52C41A" />
                            <span style={{ fontSize: 13, color: '#F5222D', textDecoration: 'line-through' }}>
                              {change.original_text}
                            </span>
                            <ArrowRight size={12} color="#86909C" />
                            <span style={{ fontSize: 13, color: '#52C41A', fontWeight: 500 }}>
                              {change.correction}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {checkResult.errors.length > 0 && (
                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                      <Button
                        type="primary"
                        icon={<Zap size={14} />}
                        onClick={handleApplyAllCorrections}
                        style={{ borderRadius: 8, background: '#1A6BA8', borderColor: '#1A6BA8' }}
                      >
                        一键修正所有错误 ({checkResult.errors.length})
                      </Button>
                    </div>
                  )}
                </>
              )}

              {styleResult && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E5E6EB' }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#722ED1' }}>
                    📊 文风分析详情
                  </h4>
                  <Row gutter={[20, 16]}>
                    <Col xs={24} md={12}>
                      <div style={{ padding: '16px', background: '#EBF5FF', borderRadius: 10, marginBottom: 16 }}>
                        <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1A6BA8' }}>
                          可读性分析
                        </h5>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                          {renderScoreRing(styleResult.readability.score, 100)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#1A6BA8' }}>
                              {styleResult.readability.score}
                            </div>
                            <div style={{ fontSize: 11, color: '#86909C' }}>可读性分</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#722ED1' }}>
                              {styleResult.readability.grade}
                            </div>
                            <div style={{ fontSize: 11, color: '#86909C' }}>等级</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#52C41A' }}>
                              {styleResult.readability.level}
                            </div>
                            <div style={{ fontSize: 11, color: '#86909C' }}>水平</div>
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div style={{ padding: '16px', background: '#F9F0FF', borderRadius: 10, marginBottom: 16 }}>
                        <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#722ED1' }}>
                          语气分析
                        </h5>
                        {[
                          ['正式度', styleResult.tone.formality, '#1A6BA8'],
                          ['清晰度', styleResult.tone.clarity, '#52C41A'],
                          ['自信度', styleResult.tone.confidence, '#1890FF'],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color }}>
                                {Math.round(value * 100)}%
                              </span>
                            </div>
                            <Progress
                              percent={Math.round(value * 100)}
                              strokeColor={color}
                              trailColor="#F0F0F0"
                              showInfo={false}
                              size="small"
                            />
                          </div>
                        ))}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
                          <Tag
                            color={styleResult.voice === 'active' ? '#52C41A' : '#FAAD14'}
                            style={{ borderRadius: 12, fontWeight: 600 }}
                          >
                            {styleResult.voice === 'active' ? '✨ 主动语态' : '📝 被动语态'}
                          </Tag>
                        </div>
                      </div>
                    </Col>
                    <Col span={24}>
                      <div style={{ padding: '16px', background: '#FFFBE6', borderRadius: 10 }}>
                        <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#FA8C16' }}>
                          💡 改进建议
                        </h5>
                        {styleResult.suggestions.map((s, i) => (
                          <div key={i} style={{
                            padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                            background: '#FFFFFF', fontSize: 13, color: '#4E5969',
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                          }}>
                            <Lightbulb size={14} color="#FAAD14" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </Col>
                  </Row>
                </div>
              )}

              {improveResult && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E5E6EB' }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#722ED1' }}>
                    ✨ 改进详情 ({improveResult.mode})
                  </h4>
                  <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                    {improveResult.changes.map((c, i) => {
                      const changeTypeColors: Record<string, string> = {
                        grammar: '#F5222D', style: '#1890FF', vocabulary: '#722ED1', clarity: '#52C41A',
                      };
                      return (
                        <div key={i} style={{
                          padding: '12px 16px', marginBottom: 8, borderRadius: 10,
                          background: i % 2 === 0 ? '#FAFBFC' : '#FFF',
                          borderLeft: `3px solid ${changeTypeColors[c.type] || '#86909C'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Tag
                              color={changeTypeColors[c.type] || '#86909C'}
                              style={{ borderRadius: 4, fontSize: 11, fontWeight: 600 }}
                            >
                              {c.type}
                            </Tag>
                            <span style={{ fontSize: 12, color: '#86909C' }}>#{i + 1}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#4E5969', marginBottom: 4, lineHeight: 1.6 }}>
                            <span style={{ color: '#F5222D', textDecoration: 'line-through' }}>{c.original}</span>
                            {' → '}
                            <span style={{ color: '#52C41A', fontWeight: 600 }}>{c.improved}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#86909C' }}>原因: {c.reason}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          }
          onPrimaryAction={handleCopy}
          primaryActionText="复制修正文本"
          secondaryAction={handleReset}
          secondaryActionText="重新检查"
          executionTime={executionTime}
          showDataProtection={true}
        />
      </div>
    );
  }

  function renderErrorsTab() {
    if (!checkResult) return null;
    return (
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {checkResult.errors.map((err, i) => {
          const cfg = ERROR_TYPE_CONFIG[err.error_type] || ERROR_TYPE_CONFIG.grammar;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
              marginBottom: 6, borderRadius: 8, background: i % 2 === 0 ? '#FAFBFC' : '#FFF',
              borderLeft: `3px solid ${cfg.color}`,
            }}>
              <Badge count={i + 1} style={{ backgroundColor: cfg.color, boxShadow: 'none', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Tag color={cfg.color} style={{ borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{cfg.label}</Tag>
                  <span style={{ fontSize: 11, color: '#C9CDD4' }}>{err.rule_name}</span>
                  <span style={{ fontSize: 11, color: '#C9CDD4', marginLeft: 'auto' }}>{(err.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 13, color: '#4E5969', marginBottom: 4 }}>
                  <Text delete style={{ color: '#F5222D' }}>{err.original_text}</Text>
                  {' → '}
                  <Text strong style={{ color: '#52C41A' }}>{err.correction}</Text>
                </div>
                {err.suggestion && <div style={{ fontSize: 12, color: '#86909C' }}>{err.suggestion}</div>}
              </div>
              <Button size="small" type="primary" ghost icon={<CheckCircle size={14} />} onClick={() => handleAcceptChange(err)}>
                接受
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderHistoryTab() {
    return (
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {acceptedChanges.map((change, i) => (
          <div key={i} style={{
            padding: '8px 12px', marginBottom: 4, borderRadius: 6,
            background: '#F6FFED', borderLeft: '3px solid #52C41A',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle size={14} color="#52C41A" />
            <span style={{ fontSize: 13, color: '#F5222D', textDecoration: 'line-through' }}>{change.original_text}</span>
            <ArrowRight size={12} color="#86909C" />
            <span style={{ fontSize: 13, color: '#52C41A', fontWeight: 500 }}>{change.correction}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderStyleDetailTab() {
    if (!styleResult) return null;
    return (
      <Row gutter={[20, 16]}>
        <Col xs={24} md={12}>
          <Card size="small" title={<span style={{ color: '#1A6BA8', fontWeight: 700 }}>📊 可读性分析</span>} style={{ borderRadius: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {renderScoreRing(styleResult.readability.score, 100)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1A6BA8' }}>{styleResult.readability.score}</div>
                <div style={{ fontSize: 11, color: '#86909C' }}>可读性分</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#722ED1' }}>{styleResult.readability.grade}</div>
                <div style={{ fontSize: 11, color: '#86909C' }}>等级</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#52C41A' }}>{styleResult.readability.level}</div>
                <div style={{ fontSize: 11, color: '#86909C' }}>水平</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title={<span style={{ color: '#722ED1', fontWeight: 700 }}>🎯 语气分析</span>} style={{ borderRadius: 10 }}>
            {[
              ['正式度', styleResult.tone.formality, '#1A6BA8'],
              ['清晰度', styleResult.tone.clarity, '#52C41A'],
              ['自信度', styleResult.tone.confidence, '#1890FF'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(value * 100)}%</span>
                </div>
                <Progress percent={Math.round(value * 100)} strokeColor={color} trailColor="#F0F0F0" showInfo={false} size="small" />
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
              <Tag color={styleResult.voice === 'active' ? '#52C41A' : '#FAAD14'} style={{ borderRadius: 12, fontWeight: 600 }}>
                {styleResult.voice === 'active' ? '✨ 主动语态' : '📝 被动语态'}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={24}>
          <Card size="small" title={<span style={{ color: '#FA8C16', fontWeight: 700 }}>💡 改进建议</span>} style={{ borderRadius: 10 }}>
            {styleResult.suggestions.map((s, i) => (
              <div key={i} style={{
                padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                background: '#FFFBE6', fontSize: 13, color: '#4E5969',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <Lightbulb size={14} color="#FAAD14" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{s}</span>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    );
  }

  function renderImprovementsTab() {
    if (!improveResult) return null;
    const changeTypeColors: Record<string, string> = {
      grammar: '#F5222D', style: '#1890FF', vocabulary: '#722ED1', clarity: '#52C41A',
    };
    return (
      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        {improveResult.changes.map((c, i) => (
          <div key={i} style={{
            padding: '12px 16px', marginBottom: 8, borderRadius: 10,
            background: i % 2 === 0 ? '#FAFBFC' : '#FFF',
            borderLeft: `3px solid ${changeTypeColors[c.type] || '#86909C'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Tag color={changeTypeColors[c.type] || '#86909C'} style={{ borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {c.type}
              </Tag>
              <span style={{ fontSize: 12, color: '#86909C' }}>#{i + 1}</span>
            </div>
            <div style={{ fontSize: 13, color: '#4E5969', marginBottom: 4, lineHeight: 1.6 }}>
              <Text delete style={{ color: '#F5222D' }}>{c.original}</Text>
              {' → '}
              <Text strong style={{ color: '#52C41A' }}>{c.improved}</Text>
            </div>
            <div style={{ fontSize: 12, color: '#86909C' }}>原因: {c.reason}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px 36px', maxWidth: 1500, margin: '0 auto',
      background: 'linear-gradient(180deg, #FFFDF9 0%, #FBF9F6 100%)',
      minHeight: '100vh',
    }}>
      {/* ===== HERO SECTION ===== */}
      <div style={{
        textAlign: 'center', marginBottom: 28, padding: '32px 24px',
        background: 'linear-gradient(135deg, #1A6BA8 0%, #0D4A7C 30%, #08345A 60%, #1A6BA8 100%)',
        borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: '10%', width: 350, height: 350, background: 'rgba(26,107,168,0.1)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -100, right: '8%', width: 420, height: 420, background: 'rgba(82,196,26,0.06)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <SpellCheck size={28} color="#52C41A" />
            <PenTool size={22} color="#FAAD14" />
            <Languages size={22} color="#69B1FF" />
            <Tag color="#52C41A" style={{ borderRadius: 20, fontWeight: 800, border: 'none', color: '#1A6BA8', fontSize: 13, background: '#E8FFEA' }}>
              AI Writing Pro
            </Tag>
          </div>

          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, letterSpacing: 0.5 }}>
            AI 写作助手 | AI Writing Assistant
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 16, opacity: 0.92, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            实时语法纠错 · 智能文风优化 · 专业写作建议
          </p>

          {/* Feature Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              ['语法检测', <SpellCheck />, '#F5222D'],
              ['拼写纠正', <Target />, '#FA8C16'],
              ['文风分析', <PenTool />, '#1890FF'],
              ['词汇升级', <Sparkles />, '#722ED1'],
              ['可读性评分', <Gauge />, '#52C41A'],
            ].map(([label, icon, color], i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                background: 'rgba(255,255,255,0.1)', borderRadius: 20, border: `1px solid ${color}40`,
                fontSize: 13, fontWeight: 500,
              }}>
                <span style={{ color }}>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: (checkResult || styleResult) && !sidebarCollapsed ? `1fr ${sidebarWidth}px` : '1fr', gap: 22, position: 'relative' }}>
        {/* Left: Editor Area */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: '#1A6BA8' }}>
                <FileText size={20} /> 智能编辑器
              </span>
              {detectingStatus && (
                <span style={{ fontSize: 12, color: '#1A6BA8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Spin size="small" /> {detectingStatus}
                </span>
              )}
            </div>
          }
          style={{ borderRadius: 14 }}
          styles={{ header: { borderBottom: '2px solid rgba(26,107,168,0.15)', borderRadius: '14px 14px 0 0' } }}
        >

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', marginBottom: 14, background: '#FAFBFC',
            borderRadius: 10, border: '1px solid #E5E6EB', flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Word Count */}
              <Tooltip title="字符数">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#4E5969' }}>
                  <Hash size={14} color="#86909C" />
                  <strong>{wordCount.toLocaleString()}</strong> 字符
                </span>
              </Tooltip>

              {/* Error Count Badge */}
              {checkResult && checkResult.errors.length > 0 && (
                <Tooltip title={`${checkResult.errors.length} 个问题待处理`}>
                  <Badge count={checkResult.errors.length} style={{ backgroundColor: '#F5222D', boxShadow: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#F5222D' }}>
                      <AlertTriangle size={14} /> 问题
                    </span>
                  </Badge>
                </Tooltip>
              )}

              {/* Score Badge */}
              {checkResult && (
                <Tooltip title={`写作得分: ${checkResult.overall_score}`}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                    background: SCORE_CONFIG[getScoreLevel(checkResult.overall_score)].bg,
                    color: SCORE_CONFIG[getScoreLevel(checkResult.overall_score)].color,
                  }}>
                    <Star size={13} fill={SCORE_CONFIG[getScoreLevel(checkResult.overall_score)].color} />
                    {checkResult.overall_score}分
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Mode Switcher */}
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as ModeType)}
              size="small"
              style={{ borderRadius: 8 }}
              options={[
                { label: <span><SpellCheck size={13} /> 纠错模式</span>, value: 'check' },
                { label: <span><Wand2 size={13} /> 改进模式</span>, value: 'improve' },
                { label: <span><Gauge size={13} /> 分析模式</span>, value: 'style' },
              ]}
            />
          </div>

          {/* Editor / Text Area */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            {mode === 'check' && checkResult ? (
              <div
                ref={textareaRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const newText = (e.target as HTMLElement).innerText || '';
                  setText(newText);
                }}
                style={{
                  minHeight: 320, padding: '16px 18px', borderRadius: 10,
                  border: '1px solid #E5E6EB', fontSize: 15, lineHeight: 1.85,
                  outline: 'none', fontFamily: 'inherit', cursor: 'text',
                  background: '#FFF', overflowWrap: 'break-word',
                  '&:focus': { borderColor: '#1A6BA8', boxShadow: '0 0 0 2px rgba(26,107,168,0.1)' },
                  position: 'relative',
                }}
              >
                {renderUnderlinedText()}
                {detectingStatus && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)',
                    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5, pointerEvents: 'none',
                  }}>
                    <Skeleton active paragraph={{ rows: 4 }} title={false} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <TextArea
                  rows={12}
                  placeholder={
                    mode === 'check'
                      ? '在此输入或粘贴需要检查的文本...\n\n支持中英文混合 · 实时语法纠错 · 拼写检查 · 标点优化\n\n点击「开始检查」获取AI智能分析结果'
                      : mode === 'improve'
                      ? '在此输入或粘贴需要改进的文本...\n\n选择改进模式:\n· 流畅性 - 让表达更自然流畅\n· 简洁性 - 删除冗余，精炼表达\n· 词汇升级 - 使用更精准高级的词汇'
                      : '在此输入或粘贴需要分析的文本...\n\nAI将为您分析:\n· 可读性评分与年级水平\n· 正式度、清晰度、自信度\n· 语态识别（主动/被动）\n· 具体改进建议'
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{
                    borderRadius: 10, fontSize: 15, lineHeight: 1.85,
                    resize: 'vertical', minHeight: 320,
                  }}
                />
                {detectingStatus && mode !== 'check' && (
                  <div style={{
                    position: 'absolute', top: 40, left: 18, right: 18,
                    padding: '8px 14px', background: '#E6F7FF', borderRadius: 8,
                    fontSize: 13, color: '#1A6BA8', display: 'flex', alignItems: 'center', gap: 6,
                    zIndex: 3, pointerEvents: 'none',
                  }}>
                    <Spin size="small" /> {detectingStatus}
                  </div>
                )}
              </>
            )}

            {/* Underline Legend */}
            {mode === 'check' && checkResult && checkResult.errors.length > 0 && (
              <div style={{
                display: 'flex', gap: 16, marginTop: 8, padding: '8px 12px',
                background: '#FAFBFC', borderRadius: 8, fontSize: 12, color: '#86909C', flexWrap: 'wrap',
              }}>
                {Object.entries(ERROR_TYPE_CONFIG).map(([key, cfg]) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {ERROR_ICON_MAP[key] || null}
                    <span style={{ position: 'relative', width: 24, height: 6 }}>
                      <UnderlineSVG type={key as any} />
                    </span>
                    {cfg.label}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11 }}>点击下划线查看建议</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {mode === 'check' && (
              <Button
                type="primary"
                size="large"
                loading={loading}
                icon={<Sparkles />}
                onClick={handleCheck}
                style={{
                  borderRadius: 10, height: 48, fontSize: 16, fontWeight: 800,
                  background: 'linear-gradient(135deg, #1A6BA8 0%, #1890FF 100%)',
                  boxShadow: '0 4px 16px rgba(26,107,168,0.35)',
                  flex: 1, maxWidth: 200,
                }}
              >
                {loading ? '正在分析...' : '开始检查'}
              </Button>
            )}

            {mode === 'improve' && (
              <>
                <Segmented
                  value={improveMode}
                  onChange={(v) => setImproveMode(v as typeof improveMode)}
                  options={[
                    { label: '流畅性', value: 'fluency' },
                    { label: '简洁性', value: 'conciseness' },
                    { label: '词汇升级', value: 'vocabulary' },
                  ]}
                  style={{ borderRadius: 8 }}
                />
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  icon={<Wand2 />}
                  onClick={handleImprove}
                  style={{
                    borderRadius: 10, height: 48, fontSize: 16, fontWeight: 800,
                    background: 'linear-gradient(135deg, #722ED1 0%, #B37FEB 100%)',
                    boxShadow: '0 4px 16px rgba(114,46,209,0.35)',
                    flex: 1, maxWidth: 200,
                  }}
                >
                  {loading ? '正在改进...' : '开始改进'}
                </Button>
              </>
            )}

            {mode === 'style' && (
              <Button
                type="primary"
                size="large"
                loading={loading}
                icon={<Gauge />}
                onClick={handleStyleAnalyze}
                style={{
                  borderRadius: 10, height: 48, fontSize: 16, fontWeight: 800,
                  background: 'linear-gradient(135deg, #52C41A 0%, #73D13D 100%)',
                  boxShadow: '0 4px 16px rgba(82,196,26,0.35)',
                  flex: 1, maxWidth: 200,
                }}
              >
                {loading ? '正在分析...' : '分析文风'}
              </Button>
            )}

            <Button
              size="large"
              icon={<RefreshCw size={16} />}
              onClick={() => {
                setText('');
                setCheckResult(null); setStyleResult(null); setImproveResult(null);
                setAcceptedChanges([]); setActiveErrorIndex(null);
              }}
              style={{ borderRadius: 10, height: 48 }}
            >
              清空
            </Button>
          </div>

          {/* Improve Result Display */}
          {improveResult && mode === 'improve' && (
            <div style={{ marginTop: 20 }}>
              <Divider orientation="left"><span style={{ fontSize: 15, fontWeight: 800, color: '#722ED1' }}>
                <Wand2 size={16} style={{ marginRight: 6 }} /> 改进结果 ({improveResult.mode})
              </span></Divider>
              <Card
                size="small"
                style={{
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #F9F0FF, #F6FFED)',
                  border: '1px solid #722ED130',
                }}
              >
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#722ED1' }}>
                    改进后文本 ({improveResult.changes.length} 处修改):
                  </span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<Copy size={14} />}
                    onClick={() => {
                      navigator.clipboard.writeText(improveResult.improved_text);
                      message.success('已复制到剪贴板');
                    }}
                    style={{ borderRadius: 6 }}
                  >
                    复制
                  </Button>
                </div>
                <div style={{
                  padding: '14px 16px', background: '#FFF', borderRadius: 8,
                  fontSize: 14, lineHeight: 1.85, color: '#1D2129',
                  whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto',
                  border: '1px solid #E5E6EB',
                }}>
                  {improveResult.improved_text}
                </div>
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    icon={<Replace size={14} />}
                    onClick={handleUseImprovedText}
                    style={{ borderRadius: 8, background: '#722ED1', borderColor: '#722ED1' }}
                  >
                    使用此版本替换原文
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </Card>

        {/* Right: Sidebar with drag handle */}
        {(checkResult || styleResult) && !sidebarCollapsed && !isMobile && (
          <div style={{ position: 'relative', display: 'flex' }}>
            <div
              onMouseDown={handleDragStart}
              style={{
                width: 4, cursor: 'col-resize', flexShrink: 0,
                background: '#E8E4DE', borderRadius: 2,
                transition: 'background 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (!isDraggingRef.current) e.currentTarget.style.background = '#1A6BA8'; }}
              onMouseLeave={(e) => { if (!isDraggingRef.current) e.currentTarget.style.background = '#E8E4DE'; }}
            />
            <div style={{ width: sidebarWidth, overflow: 'hidden' }}>
              {renderSidebar()}
            </div>
          </div>
        )}
        {/* Desktop collapsed toggle button */}
        {(checkResult || styleResult) && !isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              position: 'absolute', top: 0, right: -36,
              width: 28, height: 56, borderRadius: '0 6px 6px 0',
              border: 'none', background: '#1A6BA8', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, zIndex: 10, boxShadow: '2px 0 6px rgba(0,0,0,0.08)',
              writingMode: 'vertical-lr', textOrientation: 'mixed',
            }}
          >
            {sidebarCollapsed ? '展开 ▸' : '◂ 收起'}
          </button>
        )}

      {/* Mobile Drawer for Sidebar */}
      <Drawer
        title={<span><BarChart3 size={16} style={{ marginRight: 6 }} />写作分析</span>}
        placement="bottom"
        height="70%"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        zIndex={1001}
        styles={{ body: { padding: 12, overflowY: 'auto' } }}
      >
        {renderSidebar()}
      </Drawer>

      {/* Mobile floating drawer trigger button */}
      {(checkResult || styleResult) && isMobile && (
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 20,
            width: 52, height: 52, borderRadius: 26, border: 'none',
            background: 'linear-gradient(135deg, #1A6BA8 0%, #1890FF 100%)',
            color: '#fff', cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, boxShadow: '0 4px 16px rgba(26,107,168,0.4)',
            zIndex: 1000, lineHeight: 1.3,
          }}
        >
          分析面板 ↑
        </button>
      )}
      </div>

      {/* Bottom Report Area */}
      {renderBottomReport()}
    </div>
  );
}
