import React, { useState } from 'react'

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    allowCompute: true,
    maxTasks: 3,
    maxMemory: 1024,
    encryptedOnly: false,
    dataPath: 'C:\\Users\\Data\\.yijiandaodi',
    serverUrl: 'https://api.yijiandaodi.com'
  })

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSliderChange = (key: 'maxTasks' | 'maxMemory', value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleClearCache = () => {
    if (confirm('确定要清除本地缓存吗？此操作不可撤销。')) {
      setIsClearingCache(true)
      setTimeout(() => {
        setIsClearingCache(false)
        alert('缓存已清除')
      }, 1000)
    }
  }

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true)
    setTimeout(() => {
      setIsCheckingUpdate(false)
      alert('当前已是最新版本 v1.0.0')
    }, 1500)
  }

  const handleViewLogs = () => {
    alert('日志文件位置：~/.yijiandaodi/logs/')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">配置节点参数与系统选项</p>
      </div>

      {/* 算力贡献设置 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          算力贡献
        </h2>

        <div className="space-y-6">
          {/* 允许贡献闲置算力 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">允许贡献闲置算力</p>
              <p className="text-sm text-gray-500 mt-1">当节点空闲时自动接收并执行计算任务</p>
            </div>
            <button
              onClick={() => handleToggle('allowCompute')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allowCompute ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.allowCompute ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 最大同时任务数 */}
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900">最大同时任务数</p>
                <p className="text-sm text-gray-500 mt-1">限制并行执行的算力任务数量（1-5）</p>
              </div>
              <span className="text-lg font-bold text-red-600">{settings.maxTasks}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={settings.maxTasks}
              onChange={(e) => handleSliderChange('maxTasks', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 个任务</span>
              <span>5 个任务</span>
            </div>
          </div>

          {/* 最大内存占用 */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900">最大内存占用</p>
                <p className="text-sm text-gray-500 mt-1">单个任务可使用的最大内存（256MB - 2048MB）</p>
              </div>
              <span className="text-lg font-bold text-red-600">{settings.maxMemory} MB</span>
            </div>
            <input
              type="range"
              min="256"
              max="2048"
              step="128"
              value={settings.maxMemory}
              onChange={(e) => handleSliderChange('maxMemory', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>256 MB</span>
              <span>2048 MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 隐私与安全设置 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          隐私与安全
        </h2>

        <div className="space-y-6">
          {/* 仅接收加密任务 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">仅接收加密任务</p>
              <p className="text-sm text-gray-500 mt-1">只接受经过端到端加密的计算任务</p>
            </div>
            <button
              onClick={() => handleToggle('encryptedOnly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.encryptedOnly ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.encryptedOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 数据存储位置 */}
          <div className="py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900 mb-2">数据存储位置</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={settings.dataPath}
                onChange={(e) => setSettings(prev => ({ ...prev, dataPath: e.target.value }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                readOnly
              />
              <button 
                onClick={() => alert('请选择数据存储目录')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                更改
              </button>
            </div>
          </div>

          {/* 清除本地缓存 */}
          <div className="py-3">
            <p className="font-medium text-gray-900 mb-2">缓存管理</p>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${isClearingCache ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isClearingCache ? '清除中...' : '清除本地缓存'}
            </button>
          </div>
        </div>
      </div>

      {/* 关于 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          关于
        </h2>

        <div className="space-y-6">
          {/* 版本信息 */}
          <div className="py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900 mb-1">客户端版本</p>
            <p className="text-sm text-gray-600">v1.0.0 (Build 20240601)</p>
          </div>

          {/* 服务端地址 */}
          <div className="py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900 mb-2">服务端地址</p>
            <input
              type="text"
              value={settings.serverUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, serverUrl: e.target.value }))}
              placeholder="输入服务端 API 地址"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isCheckingUpdate ? '检查中...' : '检查更新'}
            </button>

            <button
              onClick={handleViewLogs}
              className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              查看日志
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
