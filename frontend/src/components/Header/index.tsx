import { Avatar, Dropdown, Space, Typography } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { UserInfo } from '@/api/auth';
import logoImg from '@/assets/logo.png';
import './Header.css';

interface HeaderProps {
  collapsed: boolean;
  onToggle: () => void;
  user: UserInfo | null;
  onLogout: () => void;
  onMobileToggle?: () => void;
  mobileOpen?: boolean;
  isMobile?: boolean;
}

const { Text } = Typography;

const Header: React.FC<HeaderProps> = ({ collapsed, onToggle, user, onLogout, onMobileToggle, isMobile }) => {
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: onLogout,
    },
  ];

  return (
    <div className="yi-header">
      <div className="header-left">
        {/* 移动端汉堡菜单按钮 */}
        {onMobileToggle && (
          <button className="mobile-menu-btn" onClick={onMobileToggle}>
            <MenuOutlined />
          </button>
        )}
        <button className="collapse-btn desktop-only" onClick={onToggle}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
        <div className="brand-section">
          <img src={logoImg} alt="" className="header-logo" />
          <Text strong className="brand-name">一鉴到底</Text>
        </div>
      </div>

      <div className="header-right">
        <Space size={16}>
          <BellOutlined className="header-icon" />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <Space className="user-info" style={{ cursor: 'pointer' }}>
              <Avatar
                size={30}
                icon={<UserOutlined />}
                src={user?.avatar}
                style={{ backgroundColor: '#1A6BA8', flexShrink: 0 }}
              />
              <Text ellipsis className="username-text">
                {user?.username || '管理员'}
              </Text>
            </Space>
          </Dropdown>
        </Space>
      </div>
    </div>
  );
};

export default Header;
