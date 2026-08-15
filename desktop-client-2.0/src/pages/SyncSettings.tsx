import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Box,
  Alert,
  Snackbar,
  LinearProgress
} from '@mui/material'
import {
  Sync as SyncIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'

interface SyncConfig {
  enabled: boolean
  autoSync: boolean
  syncInterval: number
  lastSyncTime?: string
}

const SyncSettings: React.FC = () => {
  const [config, setConfig] = useState<SyncConfig>({
    enabled: true,
    autoSync: true,
    syncInterval: 30
  })
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const result = await (window as any).electronAPI?.getSyncConfig?.()
      if (result.success) {
        setConfig(result.data)
      }
    } catch (error) {
      console.error('加载同步配置失败:', error)
    }
  }

  const saveConfig = async (newConfig: Partial<SyncConfig>) => {
    setLoading(true)
    try {
      const result = await (window as any).electronAPI?.saveSyncConfig?.(newConfig)
      if (result.success) {
        setConfig({ ...config, ...newConfig })
        setSnackbar({ open: true, message: '配置已保存', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: result.error || '保存失败', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: '保存失败', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const result = await (window as any).electronAPI?.syncNow?.()
      if (result.success) {
        setSnackbar({
          open: true,
          message: `同步成功！上传 ${result.uploaded || 0} 条，下载 ${result.downloaded || 0} 条`,
          severity: 'success'
        })
        await loadConfig() // 刷新最后同步时间
      } else {
        setSnackbar({ open: true, message: result.error || '同步失败', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: '同步失败', severity: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const handleUploadOnly = async () => {
    setSyncing(true)
    try {
      const result = await (window as any).electronAPI?.uploadData?.()
      if (result.success) {
        setSnackbar({ open: true, message: `上传成功！共 ${result.uploaded || 0} 条`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: result.error || '上传失败', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: '上传失败', severity: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDownloadOnly = async () => {
    setSyncing(true)
    try {
      const result = await (window as any).electronAPI?.downloadData?.()
      if (result.success) {
        setSnackbar({ open: true, message: `下载成功！共 ${result.downloaded || 0} 条`, severity: 'success' })
      } else {
        setSnackbar({ open: true, message: result.error || '下载失败', severity: 'error' })
      }
    } catch (error) {
      setSnackbar({ open: true, message: '下载失败', severity: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon /> 同步设置
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            基本设置
          </Typography>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => saveConfig({ enabled: e.target.checked })}
                  disabled={loading}
                />
              }
              label="启用云端同步"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
              开启后，您的数据将自动同步到云端
            </Typography>
          </Box>

          <Box sx={{ mt: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.autoSync}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => saveConfig({ autoSync: e.target.checked })}
                  disabled={loading || !config.enabled}
                />
              }
              label="自动同步"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
              应用启动时和定期自动同步数据
            </Typography>
          </Box>

          <Box sx={{ mt: 3, ml: 4 }}>
            <Typography gutterBottom>
              同步间隔: {config.syncInterval} 分钟
            </Typography>
            <Slider
              value={config.syncInterval}
              onChange={(_: any, value: number | number[]) => saveConfig({ syncInterval: value as number })}
              min={5}
              max={120}
              step={5}
              marks={[
                { value: 5, label: '5分钟' },
                { value: 30, label: '30分钟' },
                { value: 60, label: '1小时' },
                { value: 120, label: '2小时' }
              ]}
              disabled={loading || !config.enabled || !config.autoSync}
              sx={{ maxWidth: 400 }}
            />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            手动同步
          </Typography>

          {config.lastSyncTime && (
            <Alert severity="info" sx={{ mb: 2 }}>
              上次同步时间: {new Date(config.lastSyncTime).toLocaleString('zh-CN')}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={syncing ? <SyncIcon className="spin" /> : <SyncIcon />}
              onClick={handleSyncNow}
              disabled={syncing || !config.enabled}
            >
              {syncing ? '同步中...' : '立即同步'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleUploadOnly}
              disabled={syncing || !config.enabled}
            >
              仅上传
            </Button>

            <Button
              variant="outlined"
              startIcon={<CloudDownloadIcon />}
              onClick={handleDownloadOnly}
              disabled={syncing || !config.enabled}
            >
              仅下载
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            数据管理
          </Typography>

          <Typography variant="body2" color="text.secondary">
            清除同步数据不会删除本地数据，只会重置同步状态
          </Typography>

          <Button
            variant="outlined"
            color="warning"
            onClick={async () => {
              const result = await (window.electronAPI as any).clearSyncData?.()
              if (result.success) {
                setSnackbar({ open: true, message: '同步数据已清除', severity: 'success' })
                await loadConfig()
              }
            }}
          >
            清除同步数据
          </Button>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default SyncSettings