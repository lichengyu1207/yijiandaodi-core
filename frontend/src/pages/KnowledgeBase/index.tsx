import { useState, useEffect } from 'react';
import {
  BookOpen,
  Upload,
  Search,
  Filter,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Eye,
  RefreshCw,
  FolderOpen,
  Database,
  ChevronRight,
} from 'lucide-react';
import {
  getKBCategories,
  getDocuments,
  uploadDocument,
  deleteDocument,
  getKBStatistics,
  getDocumentDetail,
  getDocumentChunks,
} from '@/api/ragApi';
import type { KBCategory, KBDocument } from '@/api/ragApi';

const KnowledgeBase: React.FC = () => {
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [docChunks, setDocChunks] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadCategories();
    loadStatistics();
  }, []);

  useEffect(() => {
    if (selectedCategory !== null) {
      loadDocuments();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const res: any = await getKBCategories();
      const data = res?.data || [];
      setCategories(Array.isArray(data) ? data : []);
      if (data.length > 0 && selectedCategory === null) {
        setSelectedCategory(data[0].id);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const res: any = await getKBStatistics();
      if (res?.data) setStats(res.data);
    } catch (error) {}
  };

  const loadDocuments = async () => {
    try {
      const params: any = { category_id: selectedCategory };
      if (searchText) params.search = searchText;

      const res: any = await getDocuments(params);
      const data = res?.data || res?.results || res || [];
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载文档失败:', error);
    }
  };

  useEffect(() => {
    if (selectedCategory !== null) {
      loadDocuments();
    }
  }, [searchText]);

  const handleUpload = async (file: File, title: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('category_id', String(selectedCategory));

    try {
      await uploadDocument(formData);
      setShowUploadModal(false);
      loadDocuments();
      loadCategories();
      loadStatistics();
    } catch (error: any) {
      alert(error?.response?.data?.message || '上传失败');
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('确定要删除这个文档吗？相关分片数据也会被删除。')) return;
    try {
      await deleteDocument(docId);
      loadDocuments();
      loadCategories();
      loadStatistics();
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleViewDetail = async (docId: number) => {
    setSelectedDoc(null);
    setDocChunks([]);
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const [detailRes, chunksRes] = await Promise.all([
        getDocumentDetail(docId),
        getDocumentChunks(docId),
      ]);
      setSelectedDoc(detailRes?.data || detailRes);
      setDocChunks(chunksRes?.data || []);
    } catch (error) {
      console.error('加载文档详情失败:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} color="#16A34A" />;
      case 'failed': return <AlertCircle size={14} color="#DC2626" />;
      default: return <Clock size={14} color="#F59E0B" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#16A34A';
      case 'failed': return '#DC2626';
      default: return '#F59E0B';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <BookOpen size={28} style={{ marginRight: 8 }} />
          RAG 知识库管理
        </h1>
        <p style={styles.subtitle}>文档上传、向量化存储、智能检索问答</p>

        {/* 统计卡片 */}
        {stats && (
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <FolderOpen size={20} color="#2563EB" />
              <div>
                <div style={styles.statValue}>{stats.total_categories}</div>
                <div style={styles.statLabel}>知识库分类</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <FileText size={20} color="#16A34A" />
              <div>
                <div style={styles.statValue}>{stats.total_documents}</div>
                <div style={styles.statLabel}>文档总数</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <Database size={20} color="#F59E0B" />
              <div>
                <div style={styles.statValue}>{stats.total_chunks}</div>
                <div style={styles.statLabel}>向量分片</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.mainLayout}>
        {/* 左侧：分类导航 */}
        <aside style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>知识库分类</h3>

          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              ...styles.categoryItem,
              background: selectedCategory === null ? '#EFF6FF' : 'transparent',
              borderColor: selectedCategory === null ? '#2563EB' : 'transparent',
            }}
          >
            <Database size={16} />
            全部分类
            {stats && (
              <span style={styles.categoryCount}>{stats.total_documents}</span>
            )}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                ...styles.categoryItem,
                background: selectedCategory === cat.id ? '#EFF6FF' : 'transparent',
                borderColor: selectedCategory === cat.id ? '#2563EB' : 'transparent',
              }}
            >
              <span style={{ fontSize: 18 }}>{cat.icon === 'folder' ? '📁' : '📂'}</span>
              <span style={styles.categoryName}>{cat.name}</span>
              <span style={styles.categoryCount}>{cat.document_count}</span>
            </button>
          ))}
        </aside>

        {/* 右侧：文档列表 */}
        <main style={styles.contentArea}>
          {/* 工具栏 */}
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <div style={styles.searchBox}>
                <Search size={16} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="搜索文档标题..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            </div>

            <div style={styles.toolbarRight}>
              <button onClick={() => { loadDocuments(); loadCategories(); }} style={styles.iconButton}>
                <RefreshCw size={16} />
              </button>
              <button onClick={() => setShowUploadModal(true)} style={styles.primaryButton}>
                <Upload size={16} />
                上传文档
              </button>
            </div>
          </div>

          {/* 文档列表 */}
          <div style={styles.documentList}>
            {documents.length === 0 ? (
              <div style={styles.emptyState}>
                <FileText size={48} color="#CBD5E1" />
                <p>暂无文档</p>
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                  上传PDF、Word、Markdown等格式文档，系统将自动解析、分块、向量化
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{ ...styles.primaryButton, marginTop: 16 }}
                >
                  上传第一个文档
                </button>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} style={styles.docCard}>
                  <div style={styles.docIcon}>
                    <FileText size={24} color="#64748B" />
                  </div>

                  <div style={styles.docInfo}>
                    <h4 style={styles.docTitle}>{doc.title}</h4>
                    <div style={styles.docMeta}>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>·</span>
                      <span>{doc.word_count} 字</span>
                      <span>·</span>
                      <span>{doc.chunk_count} 分片</span>
                    </div>
                    {doc.summary && (
                      <p style={styles.docSummary}>{doc.summary.slice(0, 120)}...</p>
                    )}
                  </div>

                  <div style={styles.docRight}>
                    <div style={{
                      ...styles.statusBadge,
                      color: getStatusColor(doc.status),
                      background: `${getStatusColor(doc.status)}10`,
                    }}>
                      {getStatusIcon(doc.status)}
                      <span>{doc.status_display || doc.status}</span>
                    </div>

                    {doc.progress > 0 && doc.status !== 'completed' && (
                      <div style={styles.progressBar}>
                        <div style={{
                          ...styles.progressFill,
                          width: `${doc.progress}%`,
                          background: getStatusColor(doc.status),
                        }} />
                        <span style={styles.progressText}>{doc.progress}%</span>
                      </div>
                    )}

                    <div style={styles.docActions}>
                      <button
                        onClick={() => handleViewDetail(doc.id)}
                        style={styles.actionBtn}
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={{ ...styles.actionBtn, color: '#EF4444' }}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* 上传弹窗 */}
      {showUploadModal && (
        <UploadModal
          categories={categories}
          selectedCategory={selectedCategory}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
        />
      )}

      {/* 文档详情弹窗 */}
      {showDetailModal && (
        <DocumentDetailModal
          document={selectedDoc}
          chunks={docChunks}
          loading={loadingDetail}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
};

// ==================== 上传弹窗组件 ====================

interface UploadModalProps {
  categories: KBCategory[];
  selectedCategory: number | null;
  onClose: () => void;
  onUpload: (file: File, title: string) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ categories, selectedCategory, onClose, onUpload }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      alert('请填写文档标题并选择文件');
      return;
    }

    setUploading(true);
    try {
      await onUpload(file, title);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <h2 style={modalStyles.title}>上传知识库文档</h2>

        <div style={modalStyles.formGroup}>
          <label style={modalStyles.label}>文档标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入文档标题"
            style={modalStyles.input}
          />
        </div>

        <div style={modalStyles.formGroup}>
          <label style={modalStyles.label}>选择文件 *</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.json,.html,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={modalStyles.fileInput}
          />
          <p style={modalStyles.hint}>
            支持格式：PDF、Word、TXT、Markdown、JSON等（最大50MB）
          </p>
        </div>

        <div style={modalStyles.formGroup}>
          <label style={modalStyles.label}>目标分类</label>
          <div style={modalStyles.selectedCategory}>
            {categories.find(c => c.id === selectedCategory)?.name || '未选择'}
          </div>
        </div>

        <div style={modalStyles.actions}>
          <button onClick={onClose} style={modalStyles.cancelBtn}>
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !title.trim() || uploading}
            style={{
              ...modalStyles.submitBtn,
              opacity: !file || !title.trim() || uploading ? 0.5 : 1,
            }}
          >
            {uploading ? '上传中...' : '确认上传'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== 文档详情弹窗 ====================

interface DocumentDetailModalProps {
  document: any;
  chunks: any[];
  loading: boolean;
  onClose: () => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  chunks,
  loading,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'chunks'>('info');

  if (loading) {
    return (
      <div style={detailStyles.overlay}>
        <div style={detailStyles.container}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <RefreshCw size={32} color="#94A3B8" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748B', marginTop: 16 }}>加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={detailStyles.overlay}>
        <div style={detailStyles.container}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <AlertCircle size={32} color="#CBD5E1" />
            <p style={{ color: '#94A3B8', marginTop: 12 }}>文档数据加载失败</p>
            <button onClick={onClose} style={{ ...modalStyles.cancelBtn, marginTop: 16 }}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const formatBytes = (b: number) => {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(1)} ${u[i]}`;
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    completed: { label: '已完成', color: '#16A34A' },
    failed: { label: '失败', color: '#DC2626' },
    uploading: { label: '上传中', color: '#F59E0B' },
    parsing: { label: '解析中', color: '#F59E0B' },
    chunking: { label: '分块中', color: '#3B82F6' },
    embedding: { label: '向量化中', color: '#8B5CF6' },
  };
  const st = statusMap[doc.status] || { label: doc.status, color: '#64748B' };

  return (
    <div style={detailStyles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={detailStyles.container}>
        {/* 头部 */}
        <div style={detailStyles.header}>
          <h2 style={detailStyles.title}>文档详情</h2>
          <button onClick={onClose} style={detailStyles.closeBtn}>✕</button>
        </div>

        {/* Tab 切换 */}
        <div style={detailStyles.tabBar}>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              ...detailStyles.tab,
              background: activeTab === 'info' ? '#EFF6FF' : 'transparent',
              color: activeTab === 'info' ? '#2563EB' : '#64748B',
              fontWeight: activeTab === 'info' ? 600 : 400,
            }}
          >📄 基本信息</button>
          <button
            onClick={() => setActiveTab('chunks')}
            style={{
              ...detailStyles.tab,
              background: activeTab === 'chunks' ? '#EFF6FF' : 'transparent',
              color: activeTab === 'chunks' ? '#2563EB' : '#64748B',
              fontWeight: activeTab === 'chunks' ? 600 : 400,
            }}
          >📑 分片列表 ({chunks.length})</button>
        </div>

        {/* 内容区 */}
        <div style={detailStyles.body}>
          {activeTab === 'info' ? (
            <div style={detailStyles.infoGrid}>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>文档标题</span>
                <span style={detailStyles.infoValue}>{doc.title}</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>文件名</span>
                <span style={detailStyles.infoValue}>{doc.file_name}</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>文件大小</span>
                <span style={detailStyles.infoValue}>{formatBytes(doc.file_size)}</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>文件类型</span>
                <span style={detailStyles.infoValue}>{doc.file_type_display || doc.file_type}</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>处理状态</span>
                <span style={{ ...detailStyles.infoValue, color: st.color }}>
                  ● {st.label}
                  {doc.status !== 'completed' && doc.status !== 'failed' && ` (${doc.progress}%)`}
                </span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>字数 / 分片</span>
                <span style={detailStyles.infoValue}>{doc.word_count || 0} 字 · {doc.chunk_count || 0} 片</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>分类</span>
                <span style={detailStyles.infoValue}>{doc.category_name || doc.category?.name || '-'}</span>
              </div>
              <div style={detailStyles.infoRow}>
                <span style={detailStyles.infoLabel}>创建时间</span>
                <span style={detailStyles.infoValue}>{doc.created_at}</span>
              </div>
              {doc.error_message && (
                <div style={detailStyles.infoRow}>
                  <span style={detailStyles.infoLabel}>错误信息</span>
                  <span style={{ ...detailStyles.infoValue, color: '#DC2626' }}>{doc.error_message}</span>
                </div>
              )}
              {doc.summary && (
                <div style={{ ...detailStyles.infoRow, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span style={detailStyles.infoLabel}>摘要预览</span>
                  <div style={detailStyles.summaryBox}>{doc.summary.slice(0, 500)}</div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {chunks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                  <Database size={40} style={{ marginBottom: 8 }} />
                  <p>暂无分片数据</p>
                  <p style={{ fontSize: 12 }}>文档可能还在处理中，或处理失败</p>
                </div>
              ) : (
                chunks.map((chunk) => (
                  <div key={chunk.id} style={detailStyles.chunkCard}>
                    <div style={detailStyles.chunkHeader}>
                      <span style={detailStyles.chunkIndex}>#{chunk.chunk_index + 1}</span>
                      <span style={detailStyles.chunkMeta}>
                        {chunk.section_title && <span style={detailStyles.chunkTag}>{chunk.section_title}</span>}
                        <span>P{chunk.page_number || '-'}</span>
                        <span>{chunk.char_count || 0}字符</span>
                      </span>
                    </div>
                    <div style={detailStyles.chunkContent}>{chunk.content}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== 详情弹窗样式 ====================

const detailStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    background: '#FFFFFF',
    borderRadius: '10px',
    width: '720px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #E2E8F0',
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  closeBtn: {
    width: 30, height: 30,
    border: 'none', borderRadius: '6px',
    background: '#F1F5F9',
    fontSize: '15px',
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #E2E8F0',
    padding: '0 24px',
  },
  tab: {
    padding: '11px 20px',
    border: 'none',
    background: 'transparent',
    fontSize: '14px',
    cursor: 'pointer',
    borderRadius: '6px 6px 0 0',
    transition: 'all 0.15s',
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 24px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '10px 16px',
    alignItems: 'baseline',
  },
  infoRow: {
    display: 'contents',
  },
  infoLabel: {
    fontSize: '13px',
    color: '#94A3B8',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: '14px',
    color: '#334155',
    wordBreak: 'break-word' as const,
  },
  summaryBox: {
    gridColumn: '2',
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.7,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '12px',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  chunkCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    marginBottom: '10px',
    overflow: 'hidden',
  },
  chunkHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#F8FAFC',
    borderBottom: '1px solid #F1F5F9',
  },
  chunkIndex: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#2563EB',
    background: '#EFF6FF',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  chunkMeta: {
    fontSize: '11px',
    color: '#94A3B8',
    display: 'flex',
    gap: 8,
  },
  chunkTag: {
    color: '#64748B',
    background: '#F1F5F9',
    padding: '1px 6px',
    borderRadius: '3px',
  },
  chunkContent: {
    padding: '10px 12px',
    fontSize: '13px',
    color: '#334155',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
};

// ==================== 样式定义 ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    background: '#F8FAFC',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
  },
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '20px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    flex: 1,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: 2,
  },
  mainLayout: {
    display: 'flex',
    gap: '24px',
    minHeight: '600px',
  },
  sidebar: {
    width: '260px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '16px',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 12px 0',
    paddingBottom: '12px',
    borderBottom: '1px solid #E2E8F0',
  },
  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid transparent',
    borderRadius: '6px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#334155',
    marginBottom: '4px',
    transition: 'all 0.15s',
  },
  categoryName: {
    flex: 1,
    textAlign: 'left',
  },
  categoryCount: {
    fontSize: '12px',
    color: '#94A3B8',
    background: '#F1F5F9',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '12px',
  },
  toolbarLeft: {
    display: 'flex',
    gap: '12px',
    flex: 1,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    flex: 1,
    maxWidth: '360px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    flex: 1,
    color: '#0F172A',
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    cursor: 'pointer',
    color: '#64748B',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  documentList: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '8px',
    flex: 1,
  },
  emptyState: {
    padding: '80px 40px',
    textAlign: 'center',
    color: '#94A3B8',
  },
  docCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid #F1F5F9',
    transition: 'background 0.15s',
  },
  docIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
    minWidth: 0,
  },
  docTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  docMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#94A3B8',
    marginBottom: 4,
  },
  docSummary: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    flexShrink: 0,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  progressBar: {
    position: 'relative' as const,
    width: '100px',
    height: '4px',
    background: '#E2E8F0',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s',
  },
  progressText: {
    fontSize: '11px',
    color: '#94A3B8',
    marginTop: 2,
  },
  docActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#64748B',
    borderRadius: '4px',
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    background: '#FFFFFF',
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '520px',
    width: '90%',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 24px 0',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    color: '#0F172A',
    boxSizing: 'border-box',
  },
  fileInput: {
    width: '100%',
    padding: '10px',
    border: '1px dashed #CBD5E1',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '12px',
    color: '#94A3B8',
    margin: '6px 0 0 0',
  },
  selectedCategory: {
    padding: '10px 12px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#334155',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  cancelBtn: {
    padding: '9px 20px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    background: '#FFFFFF',
    color: '#64748B',
    cursor: 'pointer',
    fontSize: '14px',
  },
  submitBtn: {
    padding: '9px 20px',
    background: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
};

export default KnowledgeBase;
