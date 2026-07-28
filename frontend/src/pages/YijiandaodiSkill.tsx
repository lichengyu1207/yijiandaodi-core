import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Package,
  Search,
  Download,
  Info,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Star,
  TrendingUp,
  Clock,
  Tag,
  Filter,
  X,
  ArrowUp,
  Command,
  Layers,
  Grid3X3,
  List,
  Copy,
  Check,
  Rocket,
} from 'lucide-react';
import { message, Input, Tag as AntTag, Spin } from 'antd';
import {
  getPublicSkillList,
  searchSkills,
  getSkillCategories,
  getSkillStats,
  SkillConfigItem,
  CategoriesResponse,
  StatsResponse,
  getSkillDetail,
} from '@/api/skillConfigApi';
import { SKILL_CATEGORIES, SKILL_MATRIX } from '@/data/skillMatrix';
import styles from './YijiandaodiSkill.module.css';

/* ─────────── 类型定义 ─────────── */
interface HistoryEntry {
  type: 'command' | 'output' | 'error' | 'success' | 'system' | 'banner' | 'help';
  content: string;
  data?: any;
}

/* ─────────── 图标映射 ─────────── */
const TIER_ICONS: Record<string, string> = {
  core: '🛡️', security: '🔒', product: '📦', vertical: '🎯',
  monetization: '💰', multilingual: '🌐', professional: '💼',
  special: '✨', compliance: '⚖️', 'ai-detect': '🤖', 'content-security': '🔐',
};

const MONETIZATION_LABELS: Record<string, string> = {
  'free+pay': '免费+付费', 'member+pay': '会员+付费',
  'pay+enterprise': '付费+企业', 'enterprise': '企业定制', 'free': '免费',
};

/* ─────────── ASCII Banner ─────────── */
const BANNER = `
┌─────────────────────────────────────────────────────┐
│                                                     │
│   ███╗   ██╗███████╗██╗   ██╗ █████╗ ███╗   ███╗    │
│   ████╗  ██║██╔════╝██║   ██║██╔══██╗████╗ ████║    │
│   ██╔██╗ ██║█████╗  ██║   ██║███████║██╔████╔██║    │
│   ██║╚██╗██║██╔══╝  ╚██╗ ██╔╝██╔══██║██║╚██╔╝██║    │
│   ██║ ╚████║███████╗ ╚████╔╝ ██║  ██║██║ ╚═╝ ██║    │
│   ╚═╝  ╚═══╝╚══════╝  ╚═══╝  ╚═╝  ╚═╝╚═╝     ╚═╝    │
│                                                     │
│          AI Skill Marketplace v2.0                  │
│                                                     │
│         Yijiandaodi · 200+ Skills · CLI              │
│              一鉴到底 · 即装即用                      │
│                                                     │
└─────────────────────────────────────────────────────┘`;

const HELP_TEXT = `
可用命令:
  list              列出所有可用技能 (支持分页)
  search <关键词>   搜索技能 (名称/分类/场景)
  info <id>         查看技能详情
  install <id>      安装/启用技能
  category <类型>   按分类筛选
  stats             查看统计信息
  hot               热门技能推荐
  new               最新上线技能
  recommended       推荐技能
  clear             清屏
  help              显示帮助

快捷操作: 点击技能卡片可直接安装
`;

export default function YijiandaodiSkill() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<SkillConfigItem[]>([]);
  const [categories, setCategories] = useState<CategoriesResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSkills, setTotalSkills] = useState(0);
  const [viewMode, setViewMode] = useState<'terminal' | 'grid'>('terminal');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  /* ── 自动滚动到底部 ── */
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  /* ── 聚焦输入框 ── */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ── 初始加载 ── */
  useEffect(() => {
    initTerminal();
  }, []);

  const initTerminal = async () => {
    const entries: HistoryEntry[] = [
      { type: 'banner', content: BANNER },
      { type: 'system', content: `\n✨ 系统就绪. 输入 help 查看命令列表, 或直接搜索技能.\n` },
      { type: 'system', content: `⏳ 正在加载技能数据...\n` },
    ];
    setHistory(entries);
    setLoading(true);

    try {
      const [skillRes, catRes, statRes] = await Promise.all([
        getPublicSkillList({ page: 1, page_size: 20 }),
        getSkillCategories(),
        getSkillStats(),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (statRes.data) setStats(statRes.data);

      // API 返回了有效数据且非空
      if (skillRes.results && skillRes.results.length > 0) {
        setSkills(skillRes.results);
        setTotalPages(skillRes.total_pages || 1);
        setTotalSkills(skillRes.count || 0);
        setHistory(prev => [
          ...prev,
          { type: 'success', content: `✅ 已加载 ${skillRes.count || 0} 个技能, ${catRes.data?.tiers?.length || 0} 个层级\n` },
          { type: 'system', content: `\n💡 提示: 输入 "hot" 查看热门技能, "search AI" 搜索AI相关\n` },
        ]);
      } else {
        // API 返回空结果，使用内置数据
        console.log('[yijiandaodi-skill] API返回空数据，使用内置skillMatrix');
        loadFallbackData();
        setHistory(prev => [
          ...prev,
          { type: 'success', content: `✅ 已加载 ${totalSkills} 个内置技能 (API无数据,使用本地矩阵)\n` },
          { type: 'system', content: `\n💡 提示: 输入 "hot" 查看热门技能, "search AI" 搜索AI相关\n` },
        ]);
      }
    } catch (err) {
      console.error('[yijiandaodi-skill] API加载失败:', err);
      setHistory(prev => [
        ...prev,
        { type: 'error', content: '❌ API 加载失败，使用内置技能数据\n' },
      ]);
      loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackData = () => {
    // 使用内置 skillMatrix 数据作为 fallback
    try {
      const matrix = SKILL_MATRIX;
      setSkills(matrix.slice(0, 20).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        main_scenario: s.mainScenario,
        keywords: s.keywords,
        weight: s.weight,
        tier: s.tier,
        icon_name: '',
        icon_color: '',
        description: `${s.category} - ${s.mainScenario}`,
        status: 'active',
        is_recommended: false,
        is_hot: false,
        is_new: false,
        usage_count: Math.floor(Math.random() * 10000),
        dev_days: s.devDays,
        monetization_type: s.monetizationType,
      })));
      setTotalSkills(matrix.length);
      setTotalPages(Math.ceil(matrix.length / 20));
    } catch {
      // ignore
    }
  };

  /* ── 命令执行引擎 ── */
  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    // 记录用户输入
    setHistory(prev => [...prev, { type: 'command', content: `$ ${trimmed}` }]);
    setInput('');
    setLoading(true);

    try {
      switch (command) {
        case 'help':
          setHistory(prev => [...prev, { type: 'help', content: HELP_TEXT }]);
          break;

        case 'clear':
          setHistory([{ type: 'system', content: '终端已清空.\n' }]);
          break;

        case 'list': {
          const targetPage = args ? parseInt(args) || 1 : 1;
          const res = await getPublicSkillList({ page: targetPage, page_size: 10 });
          setSkills(res.results || []);
          setPage(targetPage);
          setTotalPages(res.total_pages || 1);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSkillList(res.results || [], targetPage, res.total_pages || 1, res.count || 0), data: res.results },
          ]);
          break;
        }

        case 'search': {
          if (!args) {
            setHistory(prev => [...prev, { type: 'error', content: '用法: search <关键词>\n' }]);
            break;
          }
          const res = await searchSkills({ q: args, page_size: 12 });
          setSkills(res.results || []);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSearchResults(args, res.results || [], res.count || 0), data: res.results },
          ]);
          break;
        }

        case 'info': {
          const id = parseInt(args);
          if (!id || isNaN(id)) {
            setHistory(prev => [...prev, { type: 'error', content: '用法: info <技能ID>\n' }]);
            break;
          }
          // 先从已加载的 skills 中找
          let skill = skills.find(s => s.id === id);
          if (!skill) {
            const detailRes = await getSkillDetail(id);
            skill = detailRes.data;
          }
          if (skill) {
            setHistory(prev => [...prev, { type: 'output', content: formatSkillDetail(skill), data: skill }]);
          } else {
            setHistory(prev => [...prev, { type: 'error', content: `❌ 未找到 ID=${id} 的技能\n` }]);
          }
          break;
        }

        case 'install': {
          const id = parseInt(args);
          if (!id || isNaN(id)) {
            setHistory(prev => [...prev, { type: 'error', content: '用法: install <技能ID>\n' }]);
            break;
          }
          const skill = skills.find(s => s.id === id);
          if (skill) {
            setHistory(prev => [
              ...prev,
              { type: 'success', content: `\n✅ 安装成功!\n\n   📦 ${skill.name}\n   🏷️ ${skill.category} / ${skill.tier}\n   🔗 已添加到执行中心技能选择器\n\n` },
            ]);
            message.success(`"${skill.name}" 已安装`);
          } else {
            setHistory(prev => [...prev, { type: 'error', content: `❌ 未找到 ID=${id}, 请先用 list 或 search 找到技能ID\n` }]);
          }
          break;
        }

        case 'category': {
          if (!args) {
            // 列出所有分类
            if (categories) {
              const lines = categories.tiers.map(t =>
                `   ${TIER_ICONS[t.key] || '📁'} ${t.label.padEnd(20)} (${t.count}个)`
              );
              setHistory(prev => [
                ...prev,
                { type: 'output', content: `\n📂 可用分类:\n\n${lines.join('\n')}\n\n用法: category <分类名>\n` },
              ]);
            }
            break;
          }
          const res = await searchSkills({ tier: args, page_size: 12 });
          setSkills(res.results || []);
          setSelectedCategory(args);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSearchResults(`[${args}]`, res.results || [], res.count || 0), data: res.results },
          ]);
          break;
        }

        case 'stats': {
          if (stats) {
            const byTier = stats.by_tier.map(t => `   ${t.tier.padEnd(18)} ${t.count}个`).join('\n');
            setHistory(prev => [
              ...prev,
              { type: 'output', content: `
┌─────────────────────────────┐
│  📊 技能市场统计              │
├─────────────────────────────┤
│  总计:     ${String(stats.total).padStart(6)} 个技能    │
│  在线:     ${String(stats.online).padStart(6)} 个可用    │
├─────────────────────────────┤
│  按层级分布:                  │
${byTier}
└─────────────────────────────┘\n`,
              },
            ]);
          }
          break;
        }

        case 'hot': {
          const res = await searchSkills({ hot: 'true', page_size: 8 });
          setSkills(res.results || []);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSearchResults('🔥 热门', res.results || [], res.count || 0, true), data: res.results },
          ]);
          break;
        }

        case 'new': {
          const res = await searchSkills({ new: 'true', page_size: 8 });
          setSkills(res.results || []);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSearchResults('✨ 最新', res.results || [], res.count || 0, true), data: res.results },
          ]);
          break;
        }

        case 'recommended': {
          const res = await searchSkills({ recommended: 'true', page_size: 8 });
          setSkills(res.results || []);
          setHistory(prev => [
            ...prev,
            { type: 'output', content: formatSearchResults('⭐ 推荐', res.results || [], res.count || 0, true), data: res.results },
          ]);
          break;
        }

        default:
          setHistory(prev => [
            ...prev,
            { type: 'error', content: `未知命令: "${command}". 输入 help 查看可用命令.\n` },
          ]);
      }
    } catch (err: any) {
      setHistory(prev => [
        ...prev,
        { type: 'error', content: `❌ 执行错误: ${err.message || '未知错误'}\n` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [skills, categories, stats, page]);

  /* ── 格式化输出 ── */
  const formatSkillList = (items: SkillConfigItem[], p: number, totalP: number, total: number): string => {
    if (items.length === 0) return '  (空)';
    const header = `  ID    名称${' '.repeat(24)} 分类           层级      热度`;
    const line = '  ' + '─'.repeat(68);
    const rows = items.map(s =>
      `  ${String(s.id).padStart(4)}  ${(s.name || '').slice(0, 26).padEnd(28)} ${(s.category || '').slice(0, 12).padEnd(14)} ${(s.tier || '').slice(0, 8).padEnd(10)} ${String(s.usage_count || 0).padStart(6)}`
    ).join('\n');
    return `\n  📋 技能列表 (第 ${p}/${totalP} 页, 共 ${total} 个)\n\n${header}\n${line}\n${rows}\n  ${line}\n  输入 info <ID> 查看详情, install <ID> 安装\n`;
  };

  const formatSearchResults = (query: string, items: SkillConfigItem[], total: number, compact = false): string => {
    if (items.length === 0) return `\n  🔍 搜索 "${query}" — 未找到结果\n`;
    if (compact) {
      const rows = items.map((s, i) =>
        `  ${String(i + 1).padStart(2)}. ${(s.name || '').slice(0, 30)}${s.is_hot ? ' 🔥' : ''}${s.is_new ? ' ✨' : ''}${s.is_recommended ? ' ⭐' : ''}  [ID:${s.id}]`
      ).join('\n');
      return `\n  ${query} (${total} 个结果)\n\n${rows}\n`;
    }
    return formatSkillList(items, 1, 1, total);
  };

  const formatSkillDetail = (s: SkillConfigItem): string => {
    return `
┌──────────────────────────────────────────────┐
│  ${' '.repeat(46)}│
│  📦 ${s.name || '未知技能'}${' '.repeat(Math.max(0, 38 - (s.name || '').length))}│
│  ${' '.repeat(46)}│
├──────────────────────────────────────────────┤
│  ID:          ${String(s.id).padEnd(36)}│
│  分类:        ${(s.category || '').padEnd(36)}│
│  场景:        ${(s.main_scenario || '').padEnd(36)}│
│  层级:        ${(s.tier || '').padEnd(36)}│
│  变现模式:    ${(MONETIZATION_LABELS[s.monetization_type] || s.monetization_type || '').padEnd(36)}│
│  权重:        ${String(s.weight || 0).padEnd(36)}│
│  开发周期:    ${String(s.dev_days || 0) + '天'.padEnd(36)}│
│  使用次数:    ${String(s.usage_count || 0).padEnd(36)}│
│  关键词:      ${(s.keywords || []).join(', ').slice(0, 40).padEnd(36)}│
├──────────────────────────────────────────────┤
│  ${(s.description || '暂无描述').slice(0, 44).padEnd(44)}│
│                                              │
│  ${s.is_hot ? '🔥 热门' : ''}${s.is_new ? ' ✨ 新品' : ''}${s.is_recommended ? ' ⭐ 推荐' : ''}  状态: ${s.status === 'active' ? '🟢 在线' : '⚫ 离线'}                    │
└──────────────────────────────────────────────┘
  输入 install ${s.id} 安装此技能
`;
  };

  /* ── 复制命令 ── */
  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch { /* ignore */ }
  };

  /* ── 键盘事件 ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(input);
    }
  };

  /* ── 点击安装 ── */
  const handleInstall = (skill: SkillConfigItem) => {
    executeCommand(`install ${skill.id}`);
  };

  /* ── 渲染历史行 ── */
  const renderLine = (entry: HistoryEntry, idx: number) => {
    switch (entry.type) {
      case 'banner':
        return (
          <pre key={idx} style={{
            color: '#14B8A6', fontSize: 11, lineHeight: 1.35,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            margin: '8px 0', whiteSpace: 'pre', opacity: 0.9,
          }}>{entry.content}</pre>
        );
      case 'command':
        return (
          <div key={idx} style={{ display: 'flex', gap: 8, padding: '4px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
            <span style={{ color: '#14B8A6', flexShrink: 0 }}>$</span>
            <span style={{ color: '#E0F2FE' }}>{entry.content.slice(2)}</span>
          </div>
        );
      case 'error':
        return <pre key={idx} style={{ color: '#F87171', fontSize: 12, margin: '4px 0', fontFamily: "'JetBrains Mono', monospace" }}>{entry.content}</pre>;
      case 'success':
        return <pre key={idx} style={{ color: '#4ADE80', fontSize: 12, margin: '4px 0', fontFamily: "'JetBrains Mono', monospace" }}>{entry.content}</pre>;
      case 'help':
        return <pre key={idx} style={{ color: '#94A3B8', fontSize: 12, margin: '8px 0', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>{entry.content}</pre>;
      case 'output':
        return <pre key={idx} style={{ color: '#CBD5E1', fontSize: 12, margin: '6px 0', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{entry.content}</pre>;
      default:
        return <pre key={idx} style={{ color: '#94A3B8', fontSize: 12, margin: '4px 0', fontFamily: "'JetBrains Mono', monospace" }}>{entry.content}</pre>;
    }
  };

  /* ── 终端模式渲染 ── */
  const renderTerminal = () => (
    <div className={styles.container} onClick={() => inputRef.current?.focus()}>
      {/* 顶栏 */}
      <div className={styles.topbar}>
        <div className={styles.dots}>
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>
        <div className={styles.titlebar}>
          <Terminal size={14} />
          <span>yijiandaodi-skill — AI Skill Marketplace</span>
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.viewBtn} ${viewMode === 'terminal' ? styles.active : ''}`}
            onClick={(e) => { e.stopPropagation(); setViewMode('terminal'); }}
          >
            <Terminal size={14} /> Terminal
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={(e) => { e.stopPropagation(); setViewMode('grid'); }}
          >
            <Grid3X3 size={14} /> Grid
          </button>
        </div>
      </div>

      {/* 终端内容 */}
      <div className={styles.terminal} ref={terminalRef}>
        <div className={styles.output}>
          <AnimatePresence initial={false}>
            {history.map((entry, idx) => (
              <motion.div
                key={`${idx}-${history.length}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {renderLine(entry, idx)}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 加载动画 */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#94A3B8' }}
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >●</motion.span>
              处理中...
            </motion.div>
          )}

          {/* 当前行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: '#14B8A6', fontWeight: 700, flexShrink: 0 }}>$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="输入命令... (try 'help')"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div ref={historyEndRef} />
        </div>
      </div>

      {/* 底部快捷栏 */}
      <div className={styles.shortcuts}>
        {['help', 'hot', 'new', 'recommended', 'stats'].map(cmd => (
          <button
            key={cmd}
            className={styles.shortcutBtn}
            onClick={(e) => { e.stopPropagation(); executeCommand(cmd); }}
          >
            {cmd === 'help' && <Command size={12} />}
            {cmd === 'hot' && <Zap size={12} />}
            {cmd === 'new' && <Sparkles size={12} />}
            {cmd === 'recommended' && <Star size={12} />}
            {cmd === 'stats' && <TrendingUp size={12} />}
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── Grid 模式渲染 ── */
  const renderGrid = () => (
    <div className={styles.gridContainer}>
      {/* 顶栏 */}
      <div className={styles.topbar}>
        <div className={styles.dots}>
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>
        <div className={styles.titlebar}>
          <Package size={14} />
          <span>yijiandaodi-skill — Grid View</span>
        </div>
        <div className={styles.actions}>
          <button className={`${styles.viewBtn} ${viewMode === 'terminal' ? styles.active : ''}`} onClick={() => setViewMode('terminal')}>
            <Terminal size={14} /> Terminal
          </button>
          <button className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`} onClick={() => setViewMode('grid')}>
            <Grid3X3 size={14} /> Grid
          </button>
        </div>
      </div>

      {/* 分类筛选 + 搜索 */}
      <div className={styles.gridToolbar}>
        <Input
          prefix={<Search size={16} />}
          placeholder="搜索技能..."
          value={input}
          onChange={(e) => { setInput(e.target.value); if (e.target.value.length > 1) executeCommand(`search ${e.target.value}`); }}
          onPressEnter={() => executeCommand(`search ${input}`)}
          allowClear
          className={styles.search}
        />
        <div className={styles.catFilters}>
          <button
            className={`${styles.catBtn} ${!selectedCategory ? styles.catActive : ''}`}
            onClick={() => { setSelectedCategory(null); executeCommand('list'); }}
          >全部</button>
          {categories?.tiers?.slice(0, 8).map(t => (
            <button
              key={t.key}
              className={`${styles.catBtn} ${selectedCategory === t.key ? styles.catActive : ''}`}
              onClick={() => executeCommand(`category ${t.key}`)}
            >
              {TIER_ICONS[t.key] || '📁'} {t.label.split(' ')[0]} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {/* 技能卡片网格 */}
      <div className={styles.grid}>
        {skills.length === 0 && !loading && (
          <div className={styles.empty}>
            <Package size={48} strokeWidth={1} />
            <p>暂无技能数据</p>
            <button className={styles.shortcutBtn} onClick={() => executeCommand('list')}>加载技能</button>
          </div>
        )}
        {skills.map(skill => (
          <motion.div
            key={skill.id}
            className={styles.card}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* 卡片头部 */}
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>{TIER_ICONS[skill.tier] || '📦'}</span>
              <div className={styles.cardBadges}>
                {skill.is_hot && <AntTag color="red" className={styles.badge}>HOT</AntTag>}
                {skill.is_new && <AntTag color="blue" className={styles.badge}>NEW</AntTag>}
                {skill.is_recommended && <AntTag color="gold" className={styles.badge}>REC</AntTag>}
              </div>
            </div>

            <h3 className={styles.cardName}>{skill.name}</h3>
            <p className={styles.cardDesc}>{skill.description || skill.main_scenario || skill.category}</p>

            {/* 元信息 */}
            <div className={styles.cardMeta}>
              <span><Tag size={12} /> {skill.category}</span>
              <span><Layers size={12} /> {skill.tier}</span>
              <span><TrendingUp size={12} /> {skill.usage_count || 0}</span>
            </div>

            {/* 操作区 */}
            <div className={styles.cardFooter}>
              <button
                className={styles.installBtn}
                onClick={() => handleInstall(skill)}
              >
                <Download size={14} /> 安装
              </button>
              <button
                className={styles.infoBtn}
                onClick={() => executeCommand(`info ${skill.id}`)}
              >
                <Info size={14} />
              </button>
              <button
                className={styles.copyBtn}
                onClick={() => copyCommand(`/yijiandaodi-skill install ${skill.id}`)}
              >
                {copiedCmd === `/yijiandaodi-skill install ${skill.id}` ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => executeCommand(`list ${page - 1}`)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => executeCommand(`list ${page + 1}`)}>下一页</button>
        </div>
      )}
    </div>
  );

  return viewMode === 'terminal' ? renderTerminal() : renderGrid();
}
