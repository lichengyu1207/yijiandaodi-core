import { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Space, Upload, App, Switch, Select, Divider, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import type { IDomEditor, IEditorConfig, IToolbarConfig, IUploadConfig } from '@wangeditor/editor';
import { contentApi, ArticleFormData } from '@/api/content';
import './ArticleEditor.css';

interface ArticleEditorProps {
  open: boolean;
  articleId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ open, articleId, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [html, setHtml] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const toolbarConfig: Partial<IToolbarConfig> = {
    excludeKeys: [
      'fullScreen',
      'group-video',
    ],
  };

  const uploadImageConfig: IUploadConfig = {
    server: '/api/content/upload-image/',
    fieldName: 'file',
    maxFileSize: 5 * 1024 * 1024,
    allowedFileTypes: ['image/*'],
    meta: {},
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    onInsertedImage(imgNode: any) {
      if (imgNode) {
        console.log('图片已插入', imgNode);
      }
    },
    onError(file: File, err: any) {
      message.error(`图片上传失败: ${file.name}`);
      console.error(err);
    },
  };

  const editorConfig: Partial<IEditorConfig> = {
    placeholder: '请输入文章内容...',
    onChange(editor: IDomEditor) {
      setHtml(editor.getHtml());
    },
    MENU_CONF: {
      uploadImage: uploadImageConfig,
    },
  };

  useEffect(() => {
    if (open) {
      if (articleId) {
        contentApi.getArticle(articleId).then((data: any) => {
          const articleData = data.data || data;
          form.setFieldsValue({
            title: articleData.title,
            summary: articleData.summary || '',
            status: articleData.status,
            cover_image: articleData.cover_image || articleData.cover_image_url || '',
            xinfa_tag: articleData.xinfa_tag || '',
            zone_id: articleData.zone_id || '',
            is_pinned: articleData.is_pinned || false,
            hook_line: articleData.hook_line || '',
            cta_text: articleData.cta_text || '',
            cta_link: articleData.cta_link || '',
            real_case_title: articleData.real_case_title || '',
          });
          setHtml(articleData.content || '');
          setCoverUrl(articleData.cover_image_url || articleData.cover_image || null);
          setGalleryUrls(Array.isArray(articleData.gallery_images) ? articleData.gallery_images : []);
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          xinfa_tag: '',
          zone_id: '',
          is_pinned: false,
          hook_line: '',
          cta_text: '',
          cta_link: '',
          real_case_title: '',
        });
        setHtml('');
        setCoverUrl(null);
        setGalleryUrls([]);
      }
    }
  }, [open, articleId]);

  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
        setEditor(null);
      }
    };
  }, [editor]);

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const res: any = await contentApi.uploadImage(file);
      const url = (res?.data?.url) || (res?.url) || '';
      setCoverUrl(url.startsWith('http') ? url : `${window.location.origin}${url}`);
      form.setFieldValue('cover_image', url);
      message.success('封面上传成功');
    } catch {
      message.error('封面上传失败');
    } finally {
      setCoverUploading(false);
    }
    return false;
  };

  const removeCover = () => {
    setCoverUrl(null);
    form.setFieldValue('cover_image', '');
  };

  const handleGalleryUpload = async (file: File) => {
    if (galleryUrls.length >= 3) {
      message.warning('最多上传3张图片');
      return false;
    }
    setGalleryUploading(true);
    try {
      const res: any = await contentApi.uploadImage(file);
      const url = (res?.data?.url) || (res?.url) || '';
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      setGalleryUrls(prev => [...prev, fullUrl]);
      message.success('图片添加成功');
    } catch {
      message.error('图片上传失败');
    } finally {
      setGalleryUploading(false);
    }
    return false;
  };

  const removeGalleryImage = (index: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (status: string) => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload: ArticleFormData = {
        ...values,
        content: html,
        cover_image: coverUrl || null,
        gallery_images: galleryUrls.length > 0 ? galleryUrls : [],
        status: status as 'draft' | 'published',
        xinfa_tag: values.xinfa_tag || '',
        zone_id: values.zone_id || '',
        is_pinned: values.is_pinned || false,
        hook_line: values.hook_line || '',
        cta_text: values.cta_text || '',
        cta_link: values.cta_link || '',
        real_case_title: values.real_case_title || '',
      };

      if (articleId) {
        await contentApi.updateArticle(articleId, payload);
        message.success('文章更新成功');
      } else {
        await contentApi.createArticle(payload);
        message.success(status === 'published' ? '发布成功' : '草稿保存成功');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.detail || error?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="article-editor-wrapper" style={{ display: open ? 'block' : 'none' }}>
      <Form
        form={form}
        layout="vertical"
        className="article-editor-form"
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入文章标题' }, { max: 200, message: '标题不能超过200字' }]}
        >
          <Input placeholder="请输入文章标题" size="large" />
        </Form.Item>

        <Form.Item name="summary" label="摘要">
          <Input.TextArea
            rows={2}
            placeholder="选填，简短描述文章内容"
            maxLength={300}
            showCount
          />
        </Form.Item>

        <Form.Item label="封面图">
          <div className="cover-upload-area">
            {coverUrl ? (
              <div className="cover-preview">
                <img src={coverUrl} alt="封面" />
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  className="cover-remove-btn"
                  onClick={removeCover}
                >
                  移除
                </Button>
              </div>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => { handleCoverUpload(file); return false; }}
                disabled={coverUploading}
              >
                <div className="cover-placeholder">
                  <PlusOutlined />
                  <span>{coverUploading ? '上传中...' : '点击上传封面图'}</span>
                  <span className="cover-hint">支持 JPG/PNG/GIF/WebP，最大 5MB</span>
                </div>
              </Upload>
            )}
          </div>
        </Form.Item>

        {/* 多图上传（信息流三图模式） */}
        <Form.Item
          label={
            <span>
              信息流配图
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>
                （可选，最多3张，用于信息流三图展示模式）
              </span>
            </span>
          }
          extra={
            galleryUrls.length > 0 &&
            `已添加 ${galleryUrls.length}/3 张`
          }
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {galleryUrls.map((url, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  width: 100,
                  height: 100,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #E2E8F0',
                }}
              >
                <img src={url} alt={`配图${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  style={{ position: 'absolute', top: 2, right: 2, padding: '0 4px', fontSize: 10 }}
                  onClick={() => removeGalleryImage(index)}
                />
              </div>
            ))}
            {galleryUrls.length < 3 && (
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => { handleGalleryUpload(file); return false; }}
                disabled={galleryUploading}
              >
                <div style={{
                  width: 100, height: 100, borderRadius: 8,
                  border: '1px dashed #D1D5DB', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: galleryUploading ? 'not-allowed' : 'pointer',
                  background: '#FAFBFC',
                  gap: 4,
                }}>
                  <PlusOutlined style={{ color: '#94A3B8', fontSize: 18 }} />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    {galleryUploading ? '上传中...' : '添加图片'}
                  </span>
                </div>
              </Upload>
            )}
          </div>
        </Form.Item>

        {/* ===== 心法设置区块 ===== */}
        <div style={{ background: 'rgba(124,58,237,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(124,58,237,0.08)' }}>
          <Divider orientation="left" plain style={{ margin: '0 0 16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ThunderboltOutlined style={{ color: '#7C3AED' }} />
              <span>心法设置</span>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>（Agent 风格文章必填）</span>
            </span>
          </Divider>

          <Form.Item name="xinfa_tag" label="心法标签" tooltip="选择最匹配的心法风格，决定前台展示的标签颜色和分类">
            <Select
              placeholder="选择心法标签..."
              allowClear
              options={[
                { value: 'agent_pitfall', label: '🔥 Agent避坑 — 注入/泄露/越权风险' },
                { value: 'dev_survival', label: '💊 开发保命 — 开发者防坑指南' },
                { value: 'corp_compliance', label: '🛡️ 企业合规 — 合规审计/权限管控' },
                { value: 'pitfall_records', label: '⚠️ 踩坑实录 — 真实安全事故复盘' },
              ]}
            />
          </Form.Item>

          <Form.Item name="zone_id" label="Agent 专区" tooltip="文章归属的 Agent 用户群体">
            <Select
              placeholder="选择专区..."
              allowClear
              options={[
                { value: 'dev', label: '👨‍💻 个人开发者 — 防注入、防泄露、基础检测' },
                { value: 'enterprise', label: '🏢 企业部署 — 合规保命、防攻击、权限管控' },
                { value: 'multi_agent', label: '🤖 多智能体 — 信任链防护、防劫持、防投毒' },
                { value: 'pitfall_records', label: '⚠️ 真实踩坑 — 全行业安全事故复盘' },
              ]}
            />
          </Form.Item>

          <Form.Item name="hook_line" label="扎心钩子" tooltip="开头第一句就要抓住眼球，如：'兄弟们，你写的Agent被一句话注入搞崩？'">
            <Input.TextArea
              rows={2}
              placeholder="输入一句扎心的钩子话，让读者忍不住点进来..."
              maxLength={200}
              showCount
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          {/* 精选置顶 + 排序权重（同一行两列） */}
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="is_pinned" label="精选置顶" valuePropName="checked" style={{ flex: 1, marginBottom: 16 }}
              tooltip="开启后会在首页信息流顶部横向大卡片展示">
              <Switch checkedChildren="置顶" unCheckedChildren="普通" />
            </Form.Item>

            <Form.Item name="sort_order" label="排序权重" style={{ flex: 1, marginBottom: 16 }}
              tooltip="数字越大越靠前，精选文章建议设置较高权重">
              <InputNumber min={0} max={999} placeholder="0-999" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          {/* CTA 转化设置（同一行两列） */}
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="cta_text" label="CTA 引导文案" style={{ flex: 1, marginBottom: 16 }}
              tooltip="文章中间插入的转化按钮文字，如'点击检测你的Agent注入风险'">
              <Input placeholder="如：点击检测你的 Agent →" maxLength={50} />
            </Form.Item>

            <Form.Item name="cta_link" label="CTA 跳转链接" style={{ flex: 1, marginBottom: 16 }}
              tooltip="CTA 按钮点击后跳转的地址，留空则跳转到 AI 对话中心">
              <Input placeholder="/chat 或留空" maxLength={200} />
            </Form.Item>
          </div>

          <Form.Item name="real_case_title" label="真实案例标题" tooltip="文章中的真实踩坑案例小节标题">
            <Input placeholder="如：SolarWinds 供应链攻击事件分析" maxLength={200} />
          </Form.Item>
        </div>

        <Form.Item label="正文内容">
          <div className="editor-toolbar">
            <Toolbar
              editor={editor}
              defaultConfig={toolbarConfig}
              mode="default"
              style={{ borderBottom: '1px solid #E8E4DE' }}
            />
          </div>
          <div ref={editorRef} className="editor-container">
            <Editor
              defaultConfig={editorConfig}
              value={html}
              onCreated={(instance) => setEditor(instance)}
              mode="default"
              style={{ height: '520px', overflowY: 'hidden', minHeight: 400 }}
            />
          </div>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
          <Space>
            <Button onClick={() => handleSave('draft')} loading={loading}>
              存草稿
            </Button>
            <Button type="primary" onClick={() => handleSave('published')} loading={loading}>
              发布
            </Button>
            <Button onClick={onClose}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default ArticleEditor;
