import React, { useEffect, useState } from 'react'
import useNodeStore from '../stores/node.store'
import useTaskStore from '../stores/task.store'
import StatusIndicator from '../components/StatusIndicator'

const Dashboard: React.FC = () => {
  const { status, resources, todayComputeHours, totalComputeHours, points, location, reputationScore, updateMetrics, updateStats } = useNodeStore()
  const { tasks, activeCount } = useTaskStore()
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const mockDataInterval = setInterval(() => {
      updateMetrics({
        cpuUsage: Math.random() * 100,
        memoryUsage: 30 + Math.random() * 50,
        gpuUsage: Math.random() > 0.5 ? Math.random() * 100 : null
      })
      updateStats({
        computeHours: parseFloat((Math.random() * 5).toFixed(1)),
        points: Math.floor(Math.random() * 1000)
      })
    }, 3000)

    const mockTasks = [
      {
        taskId: 'TASK-001',
        type: '图像识别',
        status: 'executing' as const,
        shardProgress: { completed: 7, total: 10 },
        duration: 245,
        createdAt: new Date(Date.now() - 245000).toISOString()
      },
      {
        taskId: 'TASK-002',
        type: '数据加密',
        status: 'completed' as const,
        shardProgress: { completed: 5, total: 5 },
        duration: 180,
        result: { hash: 'abc123' },
        createdAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        taskId: 'TASK-003',
        type: '模型训练',
        status: 'pending' as const,
        shardProgress: { completed: 0, total: 20 },
        duration: 0,
        createdAt: new Date().toISOString()
      }
    ]

    mockTasks.forEach(task => useTaskStore.getState().addTask(task))

    return () => clearInterval(mockDataInterval)
  }, [])

  const handleSync = () => {
    setIsSyncing(true)
    setTimeout(() => setIsSyncing(false), 1500)
  }

  const getProgressColor = (value: number) => {
    if (value < 50) return 'bg-green-500'
    if (value < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    switch (status) {
      case 'online': return '在线'
      case 'offline': return '离线'
      case 'busy': return '忙碌'
      case 'connecting': return '连接中'
      case 'error': return '异常'
      default: return '未知'
    }
  }

  const recentTasks = tasks.slice(0, 10)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-sm text-gray-500 mt-1">节点运行状态与算力贡献概览</p>
        </div>
        <StatusIndicator status={status} size="lg" />
      </div>

      {/* 统计卡片区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 节点状态卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">节点状态</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator status={status === 'error' ? 'offline' : status} size="sm" />
            <span className="text-xl font-bold text-gray-900">{getStatusText()}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{location}</p>
        </div>

        {/* 算力贡献卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">算力贡献</h3>
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900">{todayComputeHours.toFixed(1)} <span className="text-base font-normal text-gray-500">核·小时</span></p>
            <p className="text-xs text-gray-500">累计 {totalComputeHours.toFixed(1)} 小时</p>
          </div>
        </div>

        {/* 积分收益卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">积分收益</h3>
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-gray-900">{points.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">信誉评分：{reputationScore}/5.0</p>
        </div>

        {/* 活跃任务卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">活跃任务</h3>
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">当前运行中</p>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：资源使用率 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">实时资源使用率</h3>
          
          <div className="space-y-6">
            {/* CPU 使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  CPU 使用率
                </span>
                <span className={`text-sm font-bold ${resources.cpuUsage > 80 ? 'text-red-600' : resources.cpuUsage > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {resources.cpuUsage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(resources.cpuUsage)}`}
                  style={{ width: `${resources.cpuUsage}%` }}
                />
              </div>
            </div>

            {/* 内存使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  内存使用率
                </span>
                <span className={`text-sm font-bold ${resources.memoryUsage > 80 ? 'text-red-600' : resources.memoryUsage > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {resources.memoryUsage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(resources.memoryUsage)}`}
                  style={{ width: `${resources.memoryUsage}%` }}
                />
              </div>
            </div>

            {/* GPU 使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  GPU 使用率
                </span>
                <span className="text-sm font-bold text-gray-500">
                  {resources.gpuUsage !== null ? `${resources.gpuUsage.toFixed(1)}%` : '未检测'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${resources.gpuUsage ? getProgressColor(resources.gpuUsage) : 'bg-gray-300'}`}
                  style={{ width: `${resources.gpuUsage || 0}%` }}
                />
              </div>
            </div>

            {/* 磁盘信息 */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">可用磁盘空间</span>
                <span className="font-medium text-gray-900">128.5 GB / 256 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：最近任务列表 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">最近任务</h3>
            <button 
              onClick={() => window.location.hash = '#tasks'}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              查看全部 →
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-gray-500">暂无任务数据</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentTasks.map((task) => (
                <div 
                  key={task.taskId}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">{task.type}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="text-xs text-gray-500">{task.taskId}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-600">
                      {task.shardProgress.completed}/{task.shardProgress.total}
                    </p>
                    <p className="text-xs text-gray-400">
                      {task.duration > 0 ? `${Math.floor(task.duration / 60)}分${task.duration % 60}秒` : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部快捷操作区 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h3>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? '同步中...' : '手动同步状态'}
          </button>

          <button 
            onClick={() => window.location.hash = '#tasks'}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            查看历史记录
          </button>

          <button 
            onClick={() => window.location.hash = '#settings'}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            打开设置
          </button>
        </div>
      </div>
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
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  )
}

export default Dashboard
