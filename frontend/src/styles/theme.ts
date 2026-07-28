import type { ThemeConfig } from 'antd';

const yiTheme: ThemeConfig = {
  token: {
    colorPrimary: '#165DFF',
    borderRadius: 6,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
    fontSize: 14,
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F5F7FA',
    colorBorder: '#E5E6EB',
    colorText: '#1D2129',
    colorTextSecondary: '#86909C',
    controlHeight: 36,
  },
  components: {
    Button: {
      primaryShadow: '0 2px 8px rgba(22, 93, 255, 0.20)',
      fontWeight: 500,
      borderRadius: 6,
    },
    Input: {
      activeBorderColor: '#165DFF',
      hoverBorderColor: '#165DFF',
      borderRadius: 6,
    },
    Card: {
      borderRadiusLG: 6,
      boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.06)',
    },
    Menu: {
      itemBorderRadius: 6,
      itemHeight: 40,
      itemSelectedColor: '#165DFF',
      itemSelectedBg: 'rgba(22, 93, 255, 0.06)',
      itemHoverBg: 'rgba(0,0,0,0.03)',
    },
    Layout: {
      siderBg: '#FFFFFF',
      headerBg: '#FFFFFF',
      bodyBg: '#F5F7FA',
      headerPadding: '0 24px',
    },
    Table: {
      borderRadius: 6,
    },
    Modal: {
      borderRadius: 6,
    },
  },
};

export default yiTheme;
