import { Outlet } from 'react-router-dom';
import FrontHeader from '@/components/FrontHeader';
import FrontFooter from '@/components/FrontFooter';
import './FrontLayout.css';

const STYLES = {
  layout: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    backgroundColor: '#FAFBFC',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 72,
  },
} as const;

const FrontLayout: React.FC = () => {
  return (
    <div style={STYLES.layout}>
      <FrontHeader />
      <main style={STYLES.main} className="front-layout-main">
        <Outlet />
      </main>
      <FrontFooter />
    </div>
  );
};

export default FrontLayout;
