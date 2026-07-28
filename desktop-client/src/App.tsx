import { useState } from 'react'
import StatusIndicator from './components/StatusIndicator'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'

type Page = 'dashboard' | 'settings' | 'tasks'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

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
        <StatusIndicator />
      </nav>

      <main className="pt-20 p-6">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
