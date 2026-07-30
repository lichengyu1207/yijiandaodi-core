import { Typography, Empty } from 'antd';
import { useLocation } from 'react-router-dom';
import './PagePlaceholder.css';

const { Title, Paragraph } = Typography;

const PagePlaceholder: React.FC = () => {
  const location = useLocation();
  const pathMap: Record<string, string> = {
    '/admin/content': '内容管理',
    '/admin/content/articles': '文章列表',
    '/admin/content/categories': '分类管理',
    '/admin/users': '用户管理',
    '/admin/security': '安全中心',
    '/admin/data': '数据管理',
    '/admin/analysis': '数据分析',
    '/admin/settings': '系统设置',
  };

  const title = pathMap[location.pathname] || '页面开发中';

  return (
    <div className="page-placeholder">
      <Title level={4} style={{ marginBottom: 8 }}>{title}</Title>
      <Paragraph type="secondary" style={{ color: '#B8B3AC', marginBottom: 32 }}>
        该模块正在开发中，敬请期待
      </Paragraph>
      <Empty description={false} />
    </div>
  );
};

export default PagePlaceholder;
