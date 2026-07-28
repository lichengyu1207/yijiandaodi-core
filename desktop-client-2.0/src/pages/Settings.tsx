import { useState, useEffect } from 'react'
import './Settings.css'

interface ServiceStatus {
  running: boolean
  port: number
  uptime: string
  requests: number
}

export default function Settings() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    running: false,
    port: 9092,
    uptime: '0s',
    requests: 0
  })
  
  const [apiConfig, setApiConfig] = useState({
    endpoint: 'http://localhost:9092',
    deepseekKey: ''
  })
  
  const [llmConfig, setLLMConfig] = useState({
    mode: 'builtin', // builtin, custom, local
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    apiBase: 'https://api.deepseek.com'
  })

  const [_loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkServiceStatus()
    const interval = setInterval(checkServiceStatus, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const checkServiceStatus = async () => {
    try {
      const response = await fetch('http://localhost:9092/health', { 
        signal: AbortSignal.timeout(2000) 
      })
      if (response.ok) {
        setServiceStatus(prev => ({
          ...prev,
          running: true
        }))
        setLoading(false)
        setError(null)
      }
    } catch (err) {
      setServiceStatus(prev => ({
        ...prev,
        running: false
      }))
      setLoading(false)
      setError('无法连接到服务')
    }
  }
  
  const handleStartService = async () => {
    console.log('启动服务...')
    // TODO: 通过 IPC 调用主进程启动服务
  }
  
  const handleStopService = async () => {
    console.log('停止服务...')
    // TODO: 通过 IPC 调用主进程停止服务
  }

  return (
    <div className="settings-page">
      {/* 服务状态 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">服务状态</h2>
          <span className={`status-badge ${serviceStatus.running ? 'running' : 'stopped'}`}>
            {serviceStatus.running ? '运行中' : '已停止'}
          </span>
        </div>

        {error && (
          <div style={{
            padding: 12,
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13
          }}>
            ⚠️ {error} - 后台服务正在启动中，请稍候
          </div>
        )}
        
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.port}</div>
            <div className="stat-label">监听端口</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.uptime}</div>
            <div className="stat-label">运行时间</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.requests}</div>
            <div className="stat-label">处理请求</div>
          </div>
        </div>
        
        <div className="button-group">
          <button 
            className="btn btn-primary"
            onClick={handleStartService}
            disabled={serviceStatus.running}
          >
            启动服务
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleStopService}
            disabled={!serviceStatus.running}
          >
            停止服务
          </button>
        </div>
      </section>
      
      {/* API 配置 */}
      <section className="settings-section">
        <h2 className="section-title">API 配置</h2>
        
        <div className="form-group">
          <label className="form-label">API 端点</label>
          <input 
            type="text"
            className="form-input"
            value={apiConfig.endpoint}
            onChange={(e) => setApiConfig({ ...apiConfig, endpoint: e.target.value })}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">DeepSeek API 密钥</label>
          <input 
            type="password"
            className="form-input"
            value={apiConfig.deepseekKey}
            onChange={(e) => setApiConfig({ ...apiConfig, deepseekKey: e.target.value })}
            placeholder="sk-xxxxxxxx"
          />
          <div className="form-hint">用于 Grok 智能分析引擎</div>
        </div>
        
        <button className="btn btn-primary">保存配置</button>
      </section>
      
      {/* LLM 智能分析配置 */}
      <section className="settings-section">
        <h2 className="section-title">LLM 智能分析</h2>
        
        <div className="mode-selector">
          <button 
            className={`mode-btn ${llmConfig.mode === 'builtin' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'builtin' })}
          >
            <div className="mode-icon">📦</div>
            <div className="mode-name">内置模型</div>
            <div className="mode-desc">开箱即用，无需配置</div>
          </button>
          
          <button 
            className={`mode-btn ${llmConfig.mode === 'custom' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'custom' })}
          >
            <div className="mode-icon">🔑</div>
            <div className="mode-name">自定义模型</div>
            <div className="mode-desc">使用自己的 API Key</div>
          </button>
          
          <button 
            className={`mode-btn ${llmConfig.mode === 'local' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'local' })}
          >
            <div className="mode-icon">💻</div>
            <div className="mode-name">本地模型</div>
            <div className="mode-desc">完全本地，隐私优先</div>
          </button>
        </div>
        
        {llmConfig.mode === 'builtin' && (
          <div className="config-panel">
            <div className="info-box">
              <span className="info-icon">✓</span>
              <span className="info-text">使用一鉴到底内置的 DeepSeek 模型，无需配置即可使用。</span>
            </div>
            <div className="feature-list">
              <div className="feature-item">✓ 智能风险分析</div>
              <div className="feature-item">✓ 代码安全检测</div>
              <div className="feature-item">✓ 风险解释说明</div>
            </div>
          </div>
        )}
        
        {llmConfig.mode === 'custom' && (
          <div className="config-panel">
            <div className="form-group">
              <label className="form-label">模型提供商</label>
              <select 
                className="form-select"
                value={llmConfig.provider}
                onChange={(e) => setLLMConfig({ ...llmConfig, provider: e.target.value })}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="qwen">阿里云通义千问</option>
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="zhipu">智谱 AI</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input 
                type="password"
                className="form-input"
                value={llmConfig.apiKey}
                onChange={(e) => setLLMConfig({ ...llmConfig, apiKey: e.target.value })}
                placeholder="输入您的 API Key"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">模型</label>
              <select 
                className="form-select"
                value={llmConfig.model}
                onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
              >
                {llmConfig.provider === 'deepseek' && (
                  <>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                    <option value="deepseek-coder">DeepSeek Coder</option>
                  </>
                )}
                {llmConfig.provider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">API Base URL（可选）</label>
              <input 
                type="text"
                className="form-input"
                value={llmConfig.apiBase}
                onChange={(e) => setLLMConfig({ ...llmConfig, apiBase: e.target.value })}
                placeholder="自定义 API 端点"
              />
              <div className="form-hint">留空使用默认端点</div>
            </div>
          </div>
        )}
        
        {llmConfig.mode === 'local' && (
          <div className="config-panel">
            <div className="info-box warning">
              <span className="info-icon">⚠️</span>
              <span className="info-text">需要先安装并启动 Ollama 本地模型服务</span>
            </div>
            
            <div className="form-group">
              <label className="form-label">本地模型</label>
              <select 
                className="form-select"
                value={llmConfig.model}
                onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
              >
                <option value="deepseek-coder:6.7b">DeepSeek Coder 6.7B</option>
                <option value="deepseek-coder:1.3b">DeepSeek Coder 1.3B</option>
                <option value="codellama:7b">Code Llama 7B</option>
                <option value="mistral:7b">Mistral 7B</option>
              </select>
            </div>
            
            <div className="feature-list">
              <div className="feature-item">✓ 完全本地运行，数据不上网</div>
              <div className="feature-item">✓ 隐私保护最大化</div>
              <div className="feature-item">⚠️ 需要足够的本地算力</div>
            </div>
            
            <button className="btn btn-secondary" style={{ marginTop: 16 }}>
              检查 Ollama 状态
            </button>
          </div>
        )}
        
        <button className="btn btn-primary" style={{ marginTop: 16 }}>
          保存 LLM 配置
        </button>
      </section>
      
      {/* 数据管理 */}
      <section className="settings-section">
        <h2 className="section-title">数据管理</h2>

        <div className="info-row">
          <span className="info-label">本地存储路径</span>
          <code className="info-value">
            C:\Users\用户名\AppData\Roaming\一鉴到底\data
          </code>
        </div>

        <p className="info-text">
          所有审计数据存储在本地，不上传云端
        </p>

        <div className="button-group">
          <button className="btn btn-secondary">备份数据</button>
          <button className="btn btn-secondary">清除日志</button>
        </div>
      </section>
      
      {/* 法律声明 */}
      <section className="settings-section warning-section">
        <h2 className="section-title" style={{ color: '#F85149' }}>免责声明</h2>
        <p className="warning-text">
          本工具旨在提供辅助性的 AI 行为分析与存证服务。所有分析报告仅供参考，
          不构成最终安全结论。用户应自行判断并承担所有操作决定所带来的风险与责任。
        </p>
        <div className="button-group">
          <button className="btn btn-secondary btn-sm">查看用户协议</button>
          <button className="btn btn-secondary btn-sm">查看隐私政策</button>
        </div>
      </section>
    </div>
  )
}