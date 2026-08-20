import { useState, useEffect } from 'react'
import StatusIndicator from './components/StatusIndicator'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'
import Login from './pages/Login'
import { useAuthStore } from './store/useAuthStore'

type Page = 'dashboard' | 'settings' | 'tasks'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const { isAuthenticated, user, fetchUserInfo } = useAuthStore()

  // 初始化时检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user) {
      fetchUserInfo();
    }
  }, []);

  // 未登录则显示登录页面
  if (!isAuthenticated()) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'settings':
        return <Settings />
      case 'tasks':
        return <Tasks />
      default:
        return <Dashboard />
    }
  }

  const handleLogout = async () => {
    const { logout } = useAuthStore.getState();
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="fixed top-0 left-0 right-0 bg-black border-b border-gray-800 px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-red-500">一鉴到底</h1>
          <div className="flex gap-6">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`hover:text-red-400 transition-colors ${
                currentPage === 'dashboard' ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              仪表盘
            </button>
            <button
              onClick={() => setCurrentPage('tasks')}
              className={`hover:text-red-400 transition-colors ${
                currentPage === 'tasks' ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              任务
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`hover:text-red-400 transition-colors ${
                currentPage === 'settings' ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              设置
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
              <span className="text-sm font-medium">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <span className="text-sm">{user?.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            退出
          </button>
        </div>
      </nav>

      <main className="pt-20 p-6">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
