/**
 * 操作权限清单组件（首次启动引导 + 设置页共用）
 * 按四类分组展示可授权操作，onChange 即时回调
 */

export interface PermissionGroup {
  title: string
  items: Array<{ key: string; label: string; desc: string }>
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: '系统监控类',
    items: [
      { key: 'fileMonitor', label: '文件系统监控', desc: '监控指定目录下的文件创建/修改/删除/重命名，计算哈希并进行深度校验。' },
      { key: 'clipboardMonitor', label: '剪贴板监控', desc: '检测复制内容中的敏感信息与安全风险。' },
      { key: 'networkMonitor', label: '网络请求监控', desc: '捕获本机网络请求，识别外联风险。' },
      { key: 'apiCallMonitor', label: 'API 调用监控', desc: '通过本地代理捕获 AI 平台 API 调用，识别请求中的违规风险并记录存证。' },
    ],
  },
  {
    title: '进程与资源监控',
    items: [
      { key: 'processMonitor', label: '进程监控', desc: '识别剪映/即梦/Premiere/AE 等生产工具的使用会话并记录。' },
      { key: 'resourceMonitor', label: '资源监控', desc: '内存/CPU 使用率监控与阈值告警。' },
    ],
  },
  {
    title: '治理 Agent 写操作',
    items: [
      { key: 'agentWrite', label: '治理 Agent 写操作', desc: '允许 Agent 自动执行存证/风险标记等写操作；未授权时一律拒绝（fail-closed）。' },
    ],
  },
  {
    title: '系统集成类',
    items: [
      { key: 'autoStart', label: '开机自启动', desc: '系统登录时自动在后台启动本应用。' },
      { key: 'tray', label: '托盘常驻', desc: '关闭窗口后保留系统托盘图标；未授权时关闭窗口即退出应用。' },
      { key: 'notifications', label: '系统通知', desc: '风险告警与状态提醒的系统通知。' },
    ],
  },
]

interface PermissionListProps {
  granted: Record<string, boolean>
  onChange: (key: string, value: boolean) => void
  disabled?: boolean
}

export default function PermissionList({ granted, onChange, disabled }: PermissionListProps) {
  return (
    <div className="permission-groups">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.title} className="permission-group">
          <div className="permission-group-title">{group.title}</div>
          {group.items.map((item) => (
            <label key={item.key} className="form-group permission-item">
              <span className="permission-item-head">
                <input
                  type="checkbox"
                  checked={Boolean(granted[item.key])}
                  disabled={disabled}
                  onChange={(e) => onChange(item.key, e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span className="permission-item-label">{item.label}</span>
              </span>
              <span className="form-hint">{item.desc}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
