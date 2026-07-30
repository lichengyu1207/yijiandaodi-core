import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Play,
  Copy,
  Trash2,
  Edit,
  Eye,
  Workflow,
  Zap,
  MessageSquare,
  GitBranch,
  Clock,
  ChevronRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Layers,
  LayoutTemplate,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { Card, Button, Input, Tag, Modal, message, Tooltip } from 'antd';
import workflowApi, { WorkflowItem } from '@/api/workflowApi';

const WorkflowList: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated');

  useEffect(() => {
    loadWorkflows();
  }, [typeFilter]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await workflowApi.getWorkflows({ type: typeFilter !== 'all' ? typeFilter : undefined });
      setWorkflows((res as any)?.data?.results || (res as any)?.data || []);
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个工作流吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await workflowApi.getWorkflowDetail(id);
          setWorkflows(workflows.filter(w => w.id !== id));
          message.success('已删除');
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleDuplicate = async (wf: WorkflowItem) => {
    try {
      const res = await workflowApi.duplicateWorkflow(wf.id, wf.name + ' (副本)');
      if ((res as any).success) {
        message.success('复制成功');
        loadWorkflows();
      }
    } catch { message.error('复制失败'); }
  };

  const getSortedWorkflows = () => {
    let sorted = [...workflows].filter(w =>
      w.name.toLowerCase().includes(searchText.toLowerCase()) ||
      w.description.toLowerCase().includes(searchText.toLowerCase())
    );

    switch (sortBy) {
      case 'updated':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'used':
        sorted.sort((a, b) => b.use_count - a.use_count);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return sorted;
  };

  const stats = {
    total: workflows.length,
    published: workflows.filter(w => w.status === 'published').length,
    draft: workflows.filter(w => w.status !== 'published').length,
    totalExecutions: workflows.reduce((sum, w) => sum + (w.use_count || 0), 0),
  };

  const TYPE_CONFIG: Record<string, { icon: typeof Workflow; color: string; gradient: string; label: string }> = {
    chatflow: { icon: MessageSquare, color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', label: '对话型' },
    workflow: { icon: Workflow, color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)', label: '自动化' },
    agent: { icon: Zap, color: '#10B981', gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', label: '智能体' },
    custom: { icon: GitBranch, color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', label: '自定义' },
  };

  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '32px 24px',
      background: '#F7F8FA',
      minHeight: '100vh',
    }}>
      {/* 头部区域 */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '32px',
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              margin: 0,
              color: '#1D2129',
              letterSpacing: '-0.5px',
            }}>
              工作流编排
            </h1>
            <p style={{
              fontSize: 15,
              color: '#86909C',
              marginTop: 8,
              margin: '8px 0 0 0',
            }}>
              可视化构建智能 Agent 工作流，拖拽编排、一键运行
            </p>
          </div>
          <Button
            size="large"
            icon={<Plus size={18} />}
            onClick={() => navigate('/workflow/editor')}
            style={{
              background: 'linear-gradient(135deg, #165DFF 0%, #722ED1 100%)',
              border: 'none',
              height: 48,
              padding: '0 28px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              boxShadow: '0 4px 12px rgba(22, 93, 255, 0.35)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(22, 93, 255, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 93, 255, 0.35)';
            }}
          >
            创建工作流
          </Button>
        </div>

        {/* 统计卡片行 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 28,
        }}>
          {[
            { icon: BarChart3, label: '总工作流数', value: stats.total, color: '#165DFF', bg: '#E8F3FF' },
            { icon: CheckCircle2, label: '已发布数', value: stats.published, color: '#00B42A', bg: '#E8F8ED' },
            { icon: FileText, label: '草稿数', value: stats.draft, color: '#FF7D00', bg: '#FFF7E8' },
            { icon: Zap, label: '总执行次数', value: stats.totalExecutions, color: '#165DFF', bg: '#E8F3FF' },
          ].map((stat, idx) => (
            <div key={idx} style={{
              background: stat.bg,
              borderRadius: 12,
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              transition: 'all 0.3s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <stat.icon size={24} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, lineHeight: 1.2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: '#86909C', marginTop: 2 }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<Search size={18} color="#C9CDD4" />}
            placeholder="搜索工作流名称或描述..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{
              width: 360,
              height: 40,
              borderRadius: 10,
              border: '1.5px solid #E5E6EB',
              fontSize: 14,
            }}
          />

          {/* 类型筛选器 - Tag 样式按钮组 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'all', label: '全部' },
              { value: 'chatflow', label: '对话型' },
              { value: 'workflow', label: '自动化' },
              { value: 'agent', label: '智能体' },
            ].map(type => (
              <button
                key={type.value}
                onClick={() => setTypeFilter(type.value)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: typeFilter === type.value ? '#165DFF' : '#F2F3F5',
                  color: typeFilter === type.value ? '#fff' : '#4E5969',
                  fontSize: 13,
                  fontWeight: typeFilter === type.value ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (typeFilter !== type.value) {
                    e.currentTarget.style.background = '#E5E6EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (typeFilter !== type.value) {
                    e.currentTarget.style.background = '#F2F3F5';
                  }
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* 排序下拉 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpDown size={16} color="#86909C" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              height: 36,
              padding: '6px 32px 6px 12px',
              borderRadius: 8,
              border: '1.5px solid #E5E6EB',
              background: '#fff',
              fontSize: 13,
              color: '#4E5969',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2386909C' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            <option value="updated">最新更新</option>
            <option value="used">最多使用</option>
            <option value="name">名称排序</option>
          </select>
        </div>
      </div>

      {/* 工作流列表 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: 20,
      }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} loading style={{ height: 280, borderRadius: 16 }} />
          ))
        ) : getSortedWorkflows().length === 0 ? (
          /* 空状态 */
          <div style={{
            gridColumn: 'span 2',
            textAlign: 'center',
            padding: '80px 40px',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 120,
              height: 120,
              margin: '0 auto 24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #E8F3FF 0%, #F5F0FF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}>
              <Layers size={48} color="#165DFF" />
            </div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#1D2129',
              margin: '0 0 12px 0',
            }}>
              开始创建你的第一个工作流
            </h3>
            <p style={{
              fontSize: 14,
              color: '#86909C',
              margin: '0 0 32px 0',
              lineHeight: 1.6,
            }}>
              从模板库快速开始，或从零搭建自定义流程
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => navigate('/workflow/editor')}
                style={{
                  background: 'linear-gradient(135deg, #165DFF 0%, #722ED1 100%)',
                  border: 'none',
                  height: 44,
                  padding: '0 24px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                创建工作流
              </Button>
              <Button
                icon={<LayoutTemplate size={16} />}
                style={{
                  height: 44,
                  padding: '0 24px',
                  borderRadius: 10,
                  borderColor: '#E5E6EB',
                  color: '#4E5969',
                  fontSize: 15,
                }}
              >
                浏览模板
              </Button>
            </div>
          </div>
        ) : (
          getSortedWorkflows().map(wf => {
            const typeCfg = TYPE_CONFIG[wf.workflow_type] || TYPE_CONFIG.custom;
            const TypeIcon = typeCfg.icon;

            return (
              <div
                key={wf.id}
                onClick={() => navigate(`/workflow/editor?id=${wf.id}`)}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 24,
                  cursor: 'pointer',
                  border: '1.5px solid transparent',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
                  e.currentTarget.style.borderColor = '#165DFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* 状态 Badge */}
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                }}>
                  <Tag
                    color={wf.status === 'published' ? 'success' : 'warning'}
                    style={{
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 12,
                      padding: '2px 10px',
                      border: 'none',
                    }}
                  >
                    {wf.status === 'published' ? '已发布' : '草稿'}
                  </Tag>
                </div>

                {/* 类型图标 + 名称 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: typeCfg.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${typeCfg.color}30`,
                  }}>
                    <TypeIcon size={28} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                    <h3 style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: '#1D2129',
                      margin: '0 0 6px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.3px',
                    }}>
                      {wf.name}
                    </h3>
                    <span style={{
                      fontSize: 12,
                      color: typeCfg.color,
                      fontWeight: 500,
                      background: `${typeCfg.color}12`,
                      padding: '3px 10px',
                      borderRadius: 6,
                      display: 'inline-block',
                    }}>
                      {typeCfg.label}
                    </span>
                  </div>
                </div>

                {/* 描述 */}
                <p style={{
                  fontSize: 13,
                  color: '#86909C',
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  margin: '0 0 20px 0',
                  minHeight: 42,
                }}>
                  {wf.description || '暂无描述'}
                </p>

                {/* 底部信息栏 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  paddingTop: 16,
                  borderTop: '1px solid #F2F3F5',
                  fontSize: 12,
                  color: '#C9CDD4',
                }}>
                  <Tooltip title={`版本 v${wf.version}`}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={14} /> v{wf.version}
                    </span>
                  </Tooltip>
                  <Tooltip title={new Date(wf.updated_at).toLocaleString()}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={14} /> {new Date(wf.updated_at).toLocaleDateString()}
                    </span>
                  </Tooltip>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <Zap size={14} /> {wf.use_count}次
                  </span>
                </div>

                {/* 操作按钮 - hover 时显示 */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(255,255,255,0.98), transparent)',
                  padding: '60px 24px 16px',
                  opacity: 0,
                  transition: 'opacity 0.25s ease',
                  display: 'flex',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0';
                }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/workflow/editor?id=${wf.id}`); }}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 8,
                      border: 'none',
                      background: '#165DFF',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#0E42D2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#165DFF';
                    }}
                  >
                    <Edit size={14} /> 编辑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(wf); }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: '1.5px solid #E5E6EB',
                      background: '#fff',
                      color: '#4E5969',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#165DFF';
                      e.currentTarget.style.color = '#165DFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E6EB';
                      e.currentTarget.style.color = '#4E5969';
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: '1.5px solid #FFECE8',
                      background: '#fff',
                      color: '#F53F3F',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FFF1F0';
                      e.currentTarget.style.borderColor = '#F53F3F';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#FFECE8';
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 全局动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.85;
          }
        }
      `}</style>
    </div>
  );
};

export default WorkflowList;