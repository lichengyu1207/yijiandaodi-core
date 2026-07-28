import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Tooltip, Switch, Tag, Space, message } from 'antd';
import {
  AudioOutlined, AudioMutedOutlined,
  SettingOutlined, StopOutlined
} from '@ant-design/icons';
import { systemApi } from '@/api/systemApi';

interface VoiceAssistantProps {
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
}

export default function VoiceAssistant({ position = 'bottom-right' }: VoiceAssistantProps) {
  const [enabled, setEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchConfig();
    const saved = localStorage.getItem('voice_enabled');
    if (saved) setEnabled(saved === 'true');
  }, []);

  useEffect(() => {
    if (isRecording && config.max_record_seconds > 0) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= config.max_record_seconds) {
            stopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    if (!isRecording && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const fetchConfig = async () => {
    if (!localStorage.getItem('token')) return;
    setLoadingConfig(true);
    try {
      const res = await systemApi.getVoiceConfig();
      setConfig(res?.data || {});
    } catch {
      // silent
    }
    setLoadingConfig(false);
  };

  const toggleEnabled = async (checked: boolean) => {
    setEnabled(checked);
    localStorage.setItem('voice_enabled', String(checked));
    try {
      await systemApi.updateVoiceConfig({ voice_enabled: String(checked) });
    } catch {
      // silent
    }
    if (checked) {
      message.success('语音助手已开启，说「唤醒词」即可唤醒');
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      message.warning('当前浏览器不支持语音识别功能');
      return;
    }
    setIsRecording(true);
    setRecordingTime(0);
    const maxSec = config.max_record_seconds || 30;
    message.info('开始录音... (' + maxSec + '秒上限)');
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { right: 24, bottom: 100 },
    'bottom-left': { left: 24, bottom: 100 },
    'top-right': { right: 24, top: 80 },
  };
  const posStyle = positionStyles[position] || positionStyles['bottom-right'];

  const pulseAnim = 'pulse 1.5s infinite';

  const btnStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: isRecording
      ? '#EF4444'
      : enabled
        ? 'linear-gradient(135deg, #7C3AED, #5B21B6)'
        : '#CBD5E1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'not-allowed',
    boxShadow: isRecording
      ? '0 2px 16px rgba(239,68,68,0.5), 0 0 0 6px rgba(239,68,68,0.15)'
      : enabled
        ? '0 4px 12px rgba(124,58,237,0.3)'
        : 'none',
    transition: 'all 0.3s ease',
    animation: isRecording ? pulseAnim : undefined,
  };

  const wakeLabel = config.wake_word || '小助手';
  const tooltipTitle = enabled ? '语音助手已开启（' + wakeLabel + '）' : '语音助手未开启';
  const maxSecDisplay = config.max_record_seconds || 30;

  return (
    <div className="voice-assistant-btn" style={{ position: 'fixed', zIndex: 9998, ...posStyle }}>
      <Tooltip title={tooltipTitle}>
        <div
          onClick={() => enabled && handleMicClick()}
          style={btnStyle}
        >
          {isRecording ? (
            <StopOutlined style={{ fontSize: 18, color: '#fff' }} />
          ) : enabled ? (
            <AudioOutlined style={{ fontSize: 18, color: '#fff' }} />
          ) : (
            <AudioMutedOutlined style={{ fontSize: 18, color: '#94A3B8' }} />
          )}
        </div>
      </Tooltip>

      {isRecording && (
        <div style={{
          textAlign: 'center', marginTop: 4,
          fontSize: 11, color: '#EF4444', fontWeight: 600,
          animation: pulseAnim,
        }}>
          {'录音中 ' + recordingTime + 's / ' + maxSecDisplay + 's'}
        </div>
      )}

      <Tooltip title="语音设置">
        <div
          onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
          style={{
            position: 'absolute', top: -36, left: 0,
            cursor: 'pointer', padding: '3px 8px',
            borderRadius: 10, fontSize: 11, color: '#666',
            background: '#fff', border: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <SettingOutlined /> 设置
        </div>
      </Tooltip>

      {showSettings && (
        <div style={{
          position: 'absolute', bottom: 52, width: 280,
          background: '#fff', borderRadius: 12,
          padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: '1px solid #E2E8F0', zIndex: 10001,
        }}>
          <div style={{ marginBottom: 14, fontWeight: 600, color: '#1E293B' }}>语音助手设置</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#475569' }}>启用语音助手</span>
            <Switch size="small" checked={enabled} onChange={toggleEnabled} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>唤醒词</div>
            <Tag color={enabled ? 'blue' : 'default'}>{wakeLabel}</Tag>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
              {'最长录音时长：' + maxSecDisplay + '秒'}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>TTS引擎</div>
            <Space size={4}>
              <Tag color={config.tts_engine === 'browser' ? 'blue' : 'default'}>浏览器内置</Tag>
              <Tag color={config.tts_engine === 'api' ? 'blue' : 'default'}>API</Tag>
            </Space>
          </div>

          <Button
            type="primary"
            block
            size="small"
            icon={<SettingOutlined />}
            onClick={() => {
              window.location.href = '/admin/system-settings';
              setShowSettings(false);
            }}
            style={{ borderRadius: 6 }}
          >
            进入详细配置
          </Button>
        </div>
      )}
    </div>
  );
}
