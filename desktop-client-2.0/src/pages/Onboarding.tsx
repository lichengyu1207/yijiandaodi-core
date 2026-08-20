/**
 * 首次启动授权引导页
 * 新用户首次登录后展示，逐项授予操作权限；完成后写入权限配置并进入主界面
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PermissionList, { PERMISSION_GROUPS } from '../components/PermissionList'

interface OnboardingProps {
  /** 完成授权后的回调（用于父组件更新引导状态） */
  onComplete?: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate()
  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = (window as any).electronAPI

  useEffect(() => {
    if (!api?.getPermissionConfig) {
      // 非 Electron 环境（浏览器开发预览）直接放行
      setLoaded(true)
      return
    }
    api
      .getPermissionConfig()
      .then((res: any) => {
        const cfg = res?.data || res
        if (cfg?.granted) setGranted(cfg.granted)
        setLoaded(true)
      })
      .catch(() => {
        setLoaded(true)
      })
  }, [])

  // 全选
  const allowAll = () => {
    const all: Record<string, boolean> = {}
    for (const group of PERMISSION_GROUPS) {
      for (const item of group.items) all[item.key] = true
    }
    setGranted(all)
  }

  const toggle = (key: string, value: boolean) => {
    setGranted((prev) => ({ ...prev, [key]: value }))
  }

  const finish = async () => {
    if (!api?.setPermissionConfig || !api?.completeOnboarding) {
      // 非 Electron 环境直接进入主界面
      onComplete?.()
      navigate('/', { replace: true })
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.setPermissionConfig(granted)
      await api.completeOnboarding()
      onComplete?.()
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.message || '保存授权失败，请重试')
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#666' }}>正在加载...</div>
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <img src="/logo.png" alt="一鉴到底" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
          <h1>欢迎使用一鉴到底</h1>
          <p>
            本应用会在本地进行文件、剪贴板、网络、API 调用等监控，并为治理 Agent 提供自动操作能力。
            为保障您的数据安全，请先选择授权以下操作（未授权的一律不会执行）：
          </p>
        </div>

        <PermissionList granted={granted} onChange={toggle} />

        {error && (
          <div className="notice-error" style={{ padding: 10, marginTop: 12, borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="onboarding-actions">
          <button type="button" className="btn btn-secondary" onClick={allowAll} disabled={saving}>
            全部允许
          </button>
          <button type="button" className="btn btn-primary" onClick={finish} disabled={saving}>
            {saving ? '保存中...' : '同意并开始使用'}
          </button>
        </div>
        <div className="onboarding-tip">
          提示：后续可随时在「系统设置 → 操作权限」中修改授权。
        </div>
      </div>
    </div>
  )
}
