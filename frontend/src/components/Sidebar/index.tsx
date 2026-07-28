import { Menu } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  UserOutlined,
  LockOutlined,
  UnorderedListOutlined,
  AuditOutlined,
  MenuOutlined as MenuIcon,
  RobotOutlined,
  BookOutlined,
  HistoryOutlined,
  AlertOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  DollarCircleOutlined,
  LoginOutlined,
  ShieldCheckOutlined,
  TeamOutlined as TeamIcon,
  SettingOutlined as SettingIcon2,
  SafetyCertificateOutlined as SafetyCertIcon2,
  CloseOutlined,
  EditOutlined,
  CrownOutlined,
  GiftOutlined,
  ApiOutlined,
  KeyOutlined,
  PlusCircleOutlined,
  SafetyCertificateOutlined as SafetyIcon,
  WalletOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import logoImg from '@/assets/logo.png';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/useAuthStore';
import './Sidebar.css';

interface SiderMenuProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  selectedKeys: string[];
  onClick: (info: { key: string }) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  content: <FileTextOutlined />,
  user: <TeamOutlined />,
  security: <SafetyCertificateOutlined />,
  data: <DatabaseOutlined />,
  analysis: <BarChartOutlined />,
  setting: <SettingOutlined />,
  role: <UserOutlined />,
  menu: <MenuIcon />,
  log: <UnorderedListOutlined />,
  audit: <AuditOutlined />,
  lock: <LockOutlined />,
  default: <FileTextOutlined />,
};

/* ===== 全量管理菜单（管理员可见） ===== */
const staticMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/admin/content',
    icon: <FileTextOutlined />,
    label: '内容管理',
    children: [
      { key: '/admin/content/articles', label: '文章列表' },
      { key: '/admin/content/categories', label: '分类管理' },
    ],
  },
  {
    key: '/admin/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
  {
    key: '/admin/security',
    icon: <SafetyCertificateOutlined />,
    label: '安全中心',
  },
  {
    key: '/admin/data',
    icon: <DatabaseOutlined />,
    label: '数据管理',
  },
  {
    key: '/admin/analysis',
    icon: <BarChartOutlined />,
    label: '数据分析',
  },
  {
    key: '/admin/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
  {
    key: '/admin/agent-config',
    icon: <RobotOutlined />,
    label: 'Agent配置',
  },
  {
    key: '/admin/security-group',
    icon: <SafetyCertificateOutlined />,
    label: '安全防护',
    children: [
      { key: '/admin/security-config', label: '规则配置' },
      { key: '/admin/security-logs', label: '风控日志' },
      { key: '/admin/security-test', label: '安全检验' },
    ],
  },
  {
    key: '/admin/rag-group',
    icon: <BookOutlined />,
    label: 'RAG知识库',
    children: [
      { key: '/admin/knowledge-base', label: '文档管理' },
      { key: '/admin/rag-search', label: '检索测试' },
      { key: '/admin/rag-operation-logs', label: '操作审计' },
    ],
  },
  {
    key: '/admin/risk-control-group',
    icon: <AlertOutlined />,
    label: '风控规则',
    children: [
      { key: '/admin/risk-control', label: '规则管理' },
      { key: '/admin/risk-control-audit', label: '审核日志' },
    ],
  },
  {
    key: '/admin/security-center',
    icon: <SafetyCertificateOutlined />,
    label: '统一安全中心',
  },
  {
    key: '/admin/creator-review',
    icon: <AuditOutlined />,
    label: '创作者审核',
  },
  {
    key: '/admin/dev-review',
    icon: <ApiOutlined />,
    label: '开发者审核',
  },
  {
    key: '/admin/system-settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
  {
    key: '/admin/log-center-group',
    icon: <HistoryOutlined />,
    label: '日志中心',
    children: [
      { key: '/admin/login-logs', label: '登录日志' },
      { key: '/admin/operation-logs', label: '操作日志' },
      { key: '/admin/permission-intercept-logs', label: '权限拦截日志' },
    ],
  },
  {
    key: '/admin/system-manage-group',
    icon: <SettingIcon2 />,
    label: '系统管理',
    children: [
      { key: '/admin/frontend-user-manage', label: '前台用户管理' },
      { key: '/admin/system-security-config', label: '安全配置' },
      { key: '/admin/function-card-manage', label: '功能卡片管理' },
    ],
  },
  {
    key: '/mall-group',
    icon: <ShopOutlined />,
    label: '数字商城',
    children: [
      { key: '/mall', label: '商城首页' },
      { key: '/mall/products', label: '产品列表' },
      { key: '/mall/cart', label: '购物车' },
      { key: '/mall/orders', label: '订单管理' },
      { key: '/mall/user-center', label: '个人中心' },
    ],
  },
];

/* ===== 普通用户/会员可见菜单（RBAC 最小集） ===== */
const userMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/admin/my-tools',
    icon: <SafetyIcon />,
    label: '我的检测',
    children: [
      { key: '/my-reports', label: '检测报告', icon: <FileTextOutlined /> },
      { key: '/detect', label: 'AI检测', icon: <RobotOutlined /> },
    ],
  },
  {
    key: '/admin/my-data',
    icon: <PieChartOutlined />,
    label: '我的数据',
    children: [
      { key: '/order-center', label: '订单统计', icon: <ShoppingCartOutlined /> },
      { key: '/mall/user-center', label: '配额余额', icon: <WalletOutlined /> },
    ],
  },
  {
    key: '/admin/apply-group',
    icon: <PlusCircleOutlined />,
    label: '申请权限',
    children: [
      { key: '/apply-creator', label: '申请创作者', icon: <CrownOutlined /> },
      { key: '/apply-developer', label: '申请API开发者', icon: <ApiOutlined /> },
    ],
  },
  {
    key: '/mall-group',
    icon: <ShopOutlined />,
    label: '商城服务',
    children: [
      { key: '/mall/products', label: '商品浏览' },
      { key: '/pricing', label: '定价方案' },
    ],
  },
  {
    key: '/admin/log-center-group',
    icon: <HistoryOutlined />,
    label: '我的记录',
    children: [
      { key: '/admin/login-logs', label: '登录记录' },
      { key: '/admin/operation-logs', label: '操作记录' },
    ],
  },
];

/* ===== 创作者菜单 ===== */
const creatorMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/admin/creator-group',
    icon: <CrownOutlined />,
    label: '创作者中心',
    children: [
      { key: '/admin/creator-stats', label: '我的创作数据', icon: <BarChartOutlined /> },
      { key: '/admin/content/articles', label: '内容管理', icon: <FileTextOutlined /> },
      { key: '/admin/publish-article', label: '发布文章', icon: <EditOutlined /> },
      { key: '/admin/tipping-records', label: '打赏管理', icon: <GiftOutlined /> },
    ],
  },
  {
    key: '/mall-group',
    icon: <ShopOutlined />,
    label: '我的订单与商品',
    children: [
      { key: '/mall/user-center', label: '个人中心' },
      { key: '/mall/orders', label: '我的订单' },
      { key: '/mall/products', label: '商品浏览' },
      { key: '/mall/cart', label: '购物车' },
    ],
  },
  {
    key: '/admin/log-center-group',
    icon: <HistoryOutlined />,
    label: '我的记录',
    children: [
      { key: '/admin/login-logs', label: '登录记录' },
      { key: '/admin/operation-logs', label: '操作记录' },
    ],
  },
];

/* ===== API开发者菜单 ===== */
const developerMenuItems: MenuProps['items'] = [
  {
    key: '/admin',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/admin/developer-group',
    icon: <ApiOutlined />,
    label: '开发者中心',
    children: [
      { key: '/admin/api-keys', label: 'API密钥', icon: <KeyOutlined /> },
      { key: '/admin/api-stats', label: '使用统计', icon: <BarChartOutlined /> },
      { key: '/admin/api-docs', label: 'API文档', icon: <BookOutlined /> },
    ],
  },
  {
    key: '/mall-group',
    icon: <ShopOutlined />,
    label: '我的订单与商品',
    children: [
      { key: '/mall/user-center', label: '个人中心' },
      { key: '/mall/orders', label: '我的订单' },
    ],
  },
];

/* 根据角色过滤静态菜单（客户端 RBAC 安全网） */
function getFilteredStaticMenus(userRole?: string | null, isCreator?: boolean, isDeveloper?: boolean): MenuProps['items'] {
  const isAdmin = ['super_admin', 'admin'].includes(userRole || '');

  if (isAdmin) {
    return staticMenuItems;
  }

  if (isCreator) {
    return creatorMenuItems;
  }

  if (isDeveloper) {
    return developerMenuItems;
  }

  return userMenuItems;
}

function convertToMenuItems(menus: any[]): MenuProps['items'] {
  return menus
    .filter((m) => m.menu_type !== 'button' && m.visible !== false)
    .map((menu) => {
      const item: any = {
        key: menu.path || `/admin/${menu.code}`,
        label: menu.name,
        icon: ICON_MAP[menu.icon || ''] || ICON_MAP.default,
      };
      
      if (menu.children && menu.children.length > 0) {
        const childItems = convertToMenuItems(menu.children);
        if (childItems.length > 0) {
          item.children = childItems;
        }
      }
      
      return item;
    })
    .filter(Boolean);
}

const SiderMenu: React.FC<SiderMenuProps> = ({
  collapsed,
  selectedKeys,
  onClick,
  mobileOpen = false,
  onMobileClose,
}) => {
  const { menus, loaded } = usePermission();
  const user = useAuthStore((s) => s.user);

  const menuItems = (loaded && menus.length > 0)
    ? convertToMenuItems(menus)
    : getFilteredStaticMenus(user?.role, user?.is_creator, user?.is_developer);

  return (
    <>
      {/* 移动端遮罩层 */}
      {mobileOpen && (
        <div
          className="mobile-sider-overlay"
          onClick={onMobileClose}
        />
      )}
      <div className={`yi-sider ${collapsed ? 'yi-sider-collapsed' : ''} ${mobileOpen ? 'mobile-visible' : ''}`}>
        {/* 移动端关闭按钮 */}
        {mobileOpen && (
          <button className="mobile-sider-close-btn" onClick={onMobileClose}>
            <CloseOutlined />
          </button>
        )}
        <div className="sider-logo">
          <img src={logoImg} alt="" className="sider-logo-img" />
          {!collapsed && <span className="sider-logo-text">一鉴到底</span>}
        </div>
      <Menu
        mode="inline"
        theme="light"
        inlineCollapsed={collapsed}
        selectedKeys={selectedKeys}
        items={menuItems}
        onClick={onClick}
        className="sider-menu"
      />
    </div>
    </>
  );
};

export default SiderMenu;
