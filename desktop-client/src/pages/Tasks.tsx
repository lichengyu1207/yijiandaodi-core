import React, { useEffect, useState } from 'react'
import useTaskStore from '../stores/task.store'
import FileDropZone from '../components/FileDropZone'

type FilterTab = 'all' | 'executing' | 'completed' | 'failed'

const Tasks: React.FC = () => {
  const { tasks, clearCompleted } = useTaskStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const mockTasks: Array<{
      taskId: string
      type: string
      status: 'pending' | 'executing' | 'completed' | 'failed'
      shardProgress: { completed: number; total: number }
      duration: number
      result?: object
      error?: string
      createdAt: string
    }> = [
      {
        taskId: 'TASK-20240601-001',
        type: '图像识别',
        status: 'completed',
        shardProgress: { completed: 10, total: 10 },
        duration: 325,
        result: { accuracy: 0.95 },
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        taskId: 'TASK-20240601-002',
        type: '数据加密',
        status: 'executing',
        shardProgress: { completed: 7, total: 15 },
        duration: 180,
        createdAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        taskId: 'TASK-20240601-003',
        type: '模型训练',
        status: 'pending',
        shardProgress: { completed: 0, total: 20 },
        duration: 0,
        createdAt: new Date().toISOString()
      },
      {
        taskId: 'TASK-20240531-001',
        type: '文件处理',
        status: 'failed',
        shardProgress: { completed: 3, total: 8 },
        duration: 120,
        error: '内存不足',
        createdAt: new Date(Date.now() - 7200000).toISOString()
      },
      {
        taskId: 'TASK-20240531-002',
        type: '哈希计算',
        status: 'completed',
        shardProgress: { completed: 50, total: 50 },
        duration: 89,
        result: { hash: 'sha256:abc123...' },
        createdAt: new Date(Date.now() - 10800000).toISOString()
      },
      {
        taskId: 'TASK-20240530-001',
        type: '视频转码',
        status: 'executing',
        shardProgress: { completed: 12, total: 30 },
        duration: 450,
        createdAt: new Date(Date.now() - 27000000).toISOString()
      },
      {
        taskId: 'TASK-20240530-002',
        type: '文本分析',
        status: 'completed',
        shardProgress: { completed: 100, total: 100 },
        duration: 67,
        result: { sentiment: 'positive' },
        createdAt: new Date(Date.now() - 36000000).toISOString()
      },
      {
        taskId: 'TASK-20240529-001',
        type: '密码破解',
        status: 'failed',
        shardProgress: { completed: 1500, total: 10000 },
        duration: 2400,
        error: '超时',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        taskId: 'TASK-20240529-002',
        type: '区块链验证',
        status: 'completed',
        shardProgress: { completed: 200, total: 200 },
        duration: 156,
        result: { valid: true },
        createdAt: new Date(Date.now() - 90000000).toISOString()
      },
      {
        taskId: 'TASK-20240528-001',
        type: '机器学习推理',
        status: 'pending',
        shardProgress: { completed: 0, total: 5 },
        duration: 0,
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        taskId: 'TASK-20240528-002',
        type: '基因组分析',
        status: 'executing',
        shardProgress: { completed: 45, total: 120 },
        duration: 3200,
        createdAt: new Date(Date.now() - 180000000).toISOString()
      },
      {
        taskId: 'TASK-20240527-001',
        type: '图像生成',
        status: 'completed',
        shardProgress: { completed: 8, total: 8 },
        duration: 512,
        result: { image_id: 'img_12345' },
        createdAt: new Date(Date.now() - 259200000).toISOString()
      }
    ]

    mockTasks.forEach(task => useTaskStore.getState().addTask(task))
  }, [])

  const filteredTasks = tasks.filter(task => {
    if (activeTab !== 'all' && task.status !== activeTab) return false
    if (searchQuery && !task.taskId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.type.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage)

  const handleFileAccepted = (files: File[]) => {
    console.log('接收到的文件：', files)
    alert(`已接收 ${files.length} 个文件，准备上传...`)
  }

  const handleViewDetail = (taskId: string) => {
    alert(`查看任务详情：${taskId}`)
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'executing', label: '执行中' },
    { key: 'completed', label: '已完成' },
    { key: 'failed', label: '失败' }
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">任务列表</h1>
        <p className="text-sm text-gray-500 mt-1">查看和管理所有计算任务</p>
      </div>

      {/* 文件上传区域 */}
      <FileDropZone onFileAccepted={handleFileAccepted} />

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Tab 切换 */}
          <div className="flex gap-2 border-b border-gray-200 sm:border-b-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 sm:hidden" />
                )}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="搜索任务 ID 或类型..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 任务列表表格 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {paginatedTasks.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-gray-500 text-lg">暂无任务数据</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? '尝试调整搜索关键词' : activeTab !== 'all' ? '该分类下暂无任务' : '任务将在此处显示'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      任务ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      分片进度
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用时
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedTasks.map((task) => (
                    <tr key={task.taskId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{task.taskId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{task.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                task.status === 'failed' ? 'bg-red-500' :
                                task.status === 'completed' ? 'bg-green-500' :
                                task.status === 'executing' ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                              style={{ width: `${(task.shardProgress.completed / task.shardProgress.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {task.shardProgress.completed}/{task.shardProgress.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {task.duration > 0 ? formatDuration(task.duration) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetail(task.taskId)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  显示第 <span className="font-medium">{startIndex + 1}</span> 至{' '}
                  <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredTasks.length)}</span> 条，
                  共 <span className="font-medium">{filteredTasks.length}</span> 条
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm rounded transition-colors ${
                        currentPage === page
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部操作 */}
      {(activeTab === 'completed' || activeTab === 'failed') && filteredTasks.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (confirm('确定要清除所有已完成/失败的任务吗？')) {
                clearCompleted()
              }
            }}
            className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            清除{activeTab === 'completed' ? '已完成' : '失败'}的任务
          </button>
        </div>
      )}
    </div>
  )
}

// 状态标签组件
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = {
    pending: { label: '等待', className: 'bg-gray-100 text-gray-700' },
    executing: { label: '执行中', className: 'bg-blue-100 text-blue-700' },
    completed: { label: '完成', className: 'bg-green-100 text-green-700' },
    failed: { label: '失败', className: 'bg-red-100 text-red-700' }
  }

  const { label, className } = config[status as keyof typeof config] || config.pending

  return (
    <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  )
}

// 格式化持续时间
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分`
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
}

export default Tasks
