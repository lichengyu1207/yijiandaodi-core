import { useState, useEffect, useMemo } from 'react';
import { sanitizeHTML } from '@/utils/sanitize';
import { Table, Button, Tag, Space, Popconfirm, Input, Typography, App, Select, DatePicker, Modal, Tooltip, message, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, FireFilled,
  EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined,
  LoadingOutlined, FilterOutlined, ClearOutlined
} from '@ant-design/icons';
import { contentApi, Article } from '@/api/content';
import ArticleEditor from '@/components/ArticleEditor';
import './ContentArticles.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const ContentArticles: React.FC = () => {
  const { message: msg } = App.useApp();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [authorFilter, setAuthorFilter] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [xinfaFilter, setXinfaFilter] = useState<string | undefined>();
  const [zoneFilter, setZoneFilter] = useState<string | undefined>();
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  const [authors, setAuthors] = useState<{ id: number; name: string; avatar: string }[]>([]);

  const fetchAuthors = async () => {
    try {
      const data: any = await contentApi.getAuthors();
      if (Array.isArray(data)) {
        setAuthors(data.map((a: any) => ({ id: a.id || a.user_id, name: a.name || a.username || a.nickname || '未知', avatar: a.avatar || '' })));
      }
    } catch {}
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params: any = {
        keyword: keyword || undefined,
        status: statusFilter,
        xinfa_tag: xinfaFilter,
        zone_id: zoneFilter,
        is_pinned: pinnedOnly ? 'true' : undefined,
        author_id: authorFilter,
        page: currentPage,
        page_size: pageSize,
      };
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');

      const data: any = await contentApi.getArticles(params);
      const results = Array.isArray(data) ? data : (data?.results || []);
      setArticles(results);
      setTotal(data?.count ?? results.length);
    } catch {
      msg.error('获取文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [statusFilter, xinfaFilter, zoneFilter, pinnedOnly, currentPage, pageSize]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchArticles();
  };

  const handlePublish = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await contentApi.deleteArticle(id);
      msg.success('删除成功');
      fetchArticles();
    } catch {
      msg.error('删除失败');
    }
  };

  const handleBatchPublish = async () => {
    try {
      await contentApi.batchPublish(selectedRowKeys as number[]);
      msg.success(`成功发布 ${selectedRowKeys.length} 篇文章`);
      setSelectedRowKeys([]);
      fetchArticles();
    } catch {
      msg.error('批量发布失败');
    }
  };

  const handleBatchUnpublish = async () => {
    try {
      await contentApi.batchUnpublish(selectedRowKeys as number[]);
      msg.success(`成功下架 ${selectedRowKeys.length} 篇文章`);
      setSelectedRowKeys([]);
      fetchArticles();
    } catch {
      msg.error('批量下架失败');
    }
  };

  const handleBatchDelete = async () => {
    try {
      await contentApi.batchDelete(selectedRowKeys as number[]);
      msg.success(`成功删除 ${selectedRowKeys.length} 篇文章`);
      setSelectedRowKeys([]);
      fetchArticles();
    } catch {
      msg.error('批量删除失败');
    }
  };

  const handleEditorSuccess = () => {
    setEditorOpen(false);
    setEditingId(null);
    fetchArticles();
  };

  const openPreview = (article: Article) => {
    setPreviewArticle(article);
    setPreviewOpen(true);
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) setSelectedRowKeys([...selectedRowKeys, id]);
    else setSelectedRowKeys(selectedRowKeys.filter(k => k !== id));
  };

  const columns: ColumnsType<Article> = [
    {
      key: 'selection',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, record: Article) => (
        <Checkbox
          checked={selectedRowKeys.includes(record.id)}
          onChange={(e) => handleSelectOne(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      ellipsis: false,
      sorter: true,
      render: (text: string, record: Article) => (
        <Tooltip title={text} placement="topLeft" styles={{ root: { maxWidth: 500 } }}>
          <a
            className="article-title-link"
            onClick={(e) => { e.stopPropagation(); openPreview(record); }}
            style={{
              color: '#1D2129', fontWeight: 500, fontSize: 14,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', lineHeight: '22px'
            }}
          >
            {text}
            {record.is_pinned && <FireFilled style={{ color: '#F59E0B', marginLeft: 6, fontSize: 12 }} />}
          </a>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '已发布', value: 'published' },
        { text: '审核中', value: 'reviewing' },
        { text: '草稿', value: 'draft' },
        { text: '已下架', value: 'archived' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => {
        const map: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
          published: { bg: '#E8FFEF', color: '#00B42A', label: '已发布', icon: <CheckCircleOutlined /> },
          reviewing: { bg: '#FFF7E8', color: '#FF7D00', label: '审核中', icon: <LoadingOutlined spin /> },
          draft: { bg: '#F2F3F5', color: '#86909C', label: '草稿', icon: <ClockCircleOutlined /> },
          archived: { bg: '#FFECE8', color: '#F53F3F', label: '已下架', icon: <StopOutlined /> },
        };
        const s = map[status] || map.draft;
        return (
          <Tag style={{
            background: s.bg, color: s.color, border: 'none', borderRadius: 4,
            padding: '2px 10px', fontSize: 12, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {s.icon} {s.label}
          </Tag>
        );
      },
    },
    {
      title: '心法标签',
      dataIndex: 'xinfa_tag',
      key: 'xinfa_tag',
      width: 130,
      render: (tag: string) => {
        if (!tag) return <span style={{ color: '#C4CCD8' }}>—</span>;
        const map: Record<string, { label: string; color: string }> = {
          agent_pitfall: { label: '🔥 避坑', color: '#7C3AED' },
          dev_survival: { label: '💊 保命', color: '#EC4899' },
          corp_compliance: { label: '🛡️ 合规', color: '#059669' },
          pitfall_records: { label: '⚠️ 踩坑实录', color: '#F59E0B' },
        };
        const info = map[tag] || { label: tag, color: '#64748B' };
        return (
          <Tag style={{ borderRadius: 12, border: 'none', color: '#fff', background: info.color }}>
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: '专区',
      dataIndex: 'zone_id',
      key: 'zone_id',
      width: 120,
      render: (z: string) => {
        if (!z) return <span style={{ color: '#C4CCD8' }}>—</span>;
        const map: Record<string, string> = {
          dev: '👨‍💻 个人开发者',
          enterprise: '🏢 企业部署',
          multi_agent: '🤖 多智能体',
          pitfall_records: '⚠️ 真实踩坑',
        };
        return <span>{map[z] || z}</span>;
      },
    },
    {
      title: '作者',
      dataIndex: ['author_name', 'author_avatar'],
      key: 'author',
      width: 120,
      render: (_: any, record: Article) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: record.author_avatar ? `url(${record.author_avatar}) center/cover` : 'linear-gradient(135deg,#667eea,#764ba2)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 13 }}>{record.author_name || '—'}</span>
        </div>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      sorter: true,
      render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '--',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: Article) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button
              type="link" size="small" icon={<EditOutlined />}
              style={{ color: '#4080FF', minWidth: 40, height: 40, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => { e.stopPropagation(); handleEdit(record.id); }}
            >
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定删除这篇文章吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={(e) => { e?.stopPropagation(); handleDelete(record.id); }}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="link" size="small" danger icon={<DeleteOutlined />}
                style={{ color: '#F53F3F', minWidth: 40, height: 40, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => e.stopPropagation()}
              >
                删除
              </Button>
            </Tooltip>
          </Popconfirm>
          <Tooltip title="预览">
            <Button
              type="link" size="small" icon={<EyeOutlined />}
              style={{ minWidth: 40, height: 40, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => { e.stopPropagation(); openPreview(record); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="content-articles-page">
      <div className="admin-page-header">
        <div className="admin-header-left">
          <Title level={4} style={{ margin: 0 }}>📝 文章管理</Title>
        </div>
        <div className="admin-header-right">
          <Button type="primary" icon={<PlusOutlined />} onClick={handlePublish}>
            发布文章
          </Button>
        </div>
      </div>

      <div className="admin-filter-bar">
        <Input
          placeholder="搜索标题或摘要..."
          prefix={<SearchOutlined style={{ color: '#B8B8B8' }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
          style={{ width: 220 }}
          size="middle"
        />

        <Select
          placeholder="状态筛选"
          allowClear
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          style={{ width: 120 }}
          size="middle"
          options={[
            { value: 'published', label: '✅ 已发布' },
            { value: 'reviewing', label: '⏳ 审核中' },
            { value: 'draft', label: '📝 草稿' },
            { value: 'archived', label: '❌ 已下架' },
          ]}
        />

        <Select
          placeholder="作者筛选"
          allowClear
          showSearch
          optionFilterProp="label"
          value={authorFilter}
          onChange={(v) => { setAuthorFilter(v); setCurrentPage(1); }}
          style={{ width: 140 }}
          size="middle"
          options={authors.map(a => ({ value: a.id, label: a.name }))}
        />

        <RangePicker
          value={dateRange}
          onChange={(dates) => { setDateRange(dates as [Dayjs, Dayjs]); setCurrentPage(1); }}
          placeholder={['开始日期', '结束日期']}
          size="middle"
          style={{ width: 240 }}
        />

        <Select
          placeholder="心法标签"
          allowClear
          value={xinfaFilter}
          onChange={(v) => { setXinfaFilter(v); setCurrentPage(1); }}
          style={{ width: 130 }}
          size="middle"
          options={[
            { value: 'agent_pitfall', label: '🔥 避坑' },
            { value: 'dev_survival', label: '💊 保命' },
            { value: 'corp_compliance', label: '🛡️ 合规' },
            { value: 'pitfall_records', label: '⚠️ 踩坑实录' },
          ]}
        />

        <Select
          placeholder="专区"
          allowClear
          value={zoneFilter}
          onChange={(v) => { setZoneFilter(v); setCurrentPage(1); }}
          style={{ width: 140 }}
          size="middle"
          options={[
            { value: 'dev', label: '👨‍💻 个人开发者' },
            { value: 'enterprise', label: '🏢 企业部署' },
            { value: 'multi_agent', label: '🤖 多智能体' },
            { value: 'pitfall_records', label: '⚠️ 真实踩坑' },
          ]}
        />

        <Button
          icon={<FireFilled />}
          type={pinnedOnly ? 'primary' : 'default'}
          onClick={() => { setPinnedOnly(!pinnedOnly); setCurrentPage(1); }}
          size="middle"
        >
          只看精选
        </Button>
      </div>

      {selectedRowKeys.length > 0 && (
        <div className="admin-batch-bar">
          <span className="batch-info">已选择 <strong>{selectedRowKeys.length}</strong> 项</span>
          <Space>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={handleBatchPublish}>
              批量发布
            </Button>
            <Button size="small" icon={<StopOutlined />} danger onClick={handleBatchUnpublish}>
              批量下架
            </Button>
            <Popconfirm title={`确定删除选中的 ${selectedRowKeys.length} 篇文章吗？此操作不可恢复`} onConfirm={handleBatchDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                批量删除
              </Button>
            </Popconfirm>
            <Button size="small" icon={<ClearOutlined />} onClick={() => setSelectedRowKeys([])}>
              清除选择
            </Button>
          </Space>
        </div>
      )}

      {!editorOpen && (
        <Table
          columns={columns}
          dataSource={articles}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            columnWidth: 50,
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showTotal: (t) => `共 ${t} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showQuickJumper: true,
            size: 'default',
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
          }}
          scroll={{ x: 1200 }}
          rowClassName={() => 'admin-table-row'}
          size="middle"
          className="admin-article-table"
        />
      )}

      <ArticleEditor
        open={editorOpen}
        articleId={editingId}
        onClose={() => { setEditorOpen(false); setEditingId(null); }}
        onSuccess={handleEditorSuccess}
      />

      <Modal
        title={null}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewOpen(false)}>关闭</Button>,
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => {
            setPreviewOpen(false);
            if (previewArticle) handleEdit(previewArticle.id);
          }}>
            编辑文章
          </Button>,
        ]}
        width={720}
        destroyOnHidden
      >
        {previewArticle && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>
              {previewArticle.title}
            </h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: '#86909C', paddingBottom: 16, borderBottom: '1px solid #F0F2F5' }}>
              <span>{previewArticle.author_name || '未知作者'}</span>
              <span>创建于 {previewArticle.created_at ? dayjs(previewArticle.created_at).format('YYYY-MM-DD HH:mm') : ''}</span>
              <span>阅读 {previewArticle.read_count || 0}</span>
              <Tag color={previewArticle.status === 'published' ? 'green' : 'default'}>
                {previewArticle.status === 'published' ? '已发布' : '草稿'}
              </Tag>
            </div>
            {previewArticle.summary && (
              <div style={{ background: '#F7F8FA', padding: 16, borderRadius: 6, marginBottom: 20, fontSize: 14, color: '#4E5969', lineHeight: 1.8 }}>
                {previewArticle.summary}
              </div>
            )}
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(previewArticle.content) || '<p style="color:#86909C">暂无内容</p>' }}
              style={{
                fontSize: 14, lineHeight: 1.8, color: '#1D2129',
                maxHeight: 400, overflowY: 'auto', paddingRight: 8,
              }}
            />
          </div>
        )}
      </Modal>

      <style>{`
        .content-articles-page {
          /* 确保页面容器不会超出视口 */
          max-width: 100vw;
          overflow-x: hidden;
        }

        .admin-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .admin-filter-bar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          padding: 16px;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #F0F2F5;
          margin-bottom: 16px;
        }
        .admin-batch-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: #E8F3FF;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .batch-info {
          font-size: 14px;
        }
        .batch-info strong {
          color: #165DFF;
          font-weight: 700;
        }

        /* 表格容器：确保在小屏幕上可横向滚动 */
        :global(.admin-article-table) {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        :global(.admin-article-table .ant-table) {
          min-width: 900px; /* 保证表格有最小宽度，触发横向滚动 */
        }

        :global(.admin-article-table .ant-table-thead > tr > th) {
          background: #F7F8FA !important;
          height: 48px !important;
          padding: 0 16px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #1D2129 !important;
          border-bottom: 1px solid #F0F2F5 !important;
        }

        :global(.admin-article-table .ant-table-tbody > tr > td) {
          height: 64px !important;
          padding: 0 16px !important;
          border-bottom: 1px solid #F0F2F5 !important;
          vertical-align: middle !important;
        }

        :global(.admin-table-row:hover > td) {
          background: #F7F8FA !important;
        }

        :global(.admin-article-table .ant-pagination) {
          margin-top: 16px;
        }
        :global(.admin-article-table .ant-pagination-item) {
          border-radius: 6px;
          min-width: 32px;
          height: 32px;
          line-height: 32px;
        }
        :global(.admin-article-table .ant-pagination-item-active) {
          background: #165DFF;
          border-color: #165DFF;
        }

        /* 手机端表格紧凑化 */
        @media (max-width: 768px) {
          .admin-page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .admin-filter-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .admin-filter-bar > * {
            width: 100% !important;
            max-width: 100% !important;
          }

          .admin-batch-bar {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
          }

          :global(.admin-article-table .ant-table) {
            min-width: 800px;
          }

          :global(.admin-article-table .ant-table-thead > tr > th),
          :global(.admin-article-table .ant-table-tbody > tr > td) {
            padding: 8px 6px !important;
            height: auto !important;
            min-height: 44px;
          }

          :global(.admin-article-table .ant-pagination-options) {
            display: none;
          }
        }

        @media (max-width: 480px) {
          :global(.admin-article-table .ant-table) {
            min-width: 700px;
          }

          :global(.admin-article-table .ant-table-thead > tr > th),
          :global(.admin-article-table .ant-table-tbody > tr > td) {
            padding: 6px 4px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ContentArticles;
