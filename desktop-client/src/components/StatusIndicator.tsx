import React from 'react'

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'connecting'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  size = 'md', 
  showLabel = true 
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const statusConfig = {
    online: {
      color: 'bg-green-500',
      animation: 'animate-glow',
      label: '在线',
      textColor: 'text-green-500'
    },
    offline: {
      color: 'bg-gray-400',
      animation: '',
      label: '离线',
      textColor: 'text-gray-400'
    },
    busy: {
      color: 'bg-red-500',
      animation: 'animate-blink',
      label: '忙碌',
      textColor: 'text-red-500'
    },
    connecting: {
      color: 'bg-yellow-500',
      animation: 'animate-pulse',
      label: '连接中',
      textColor: 'text-yellow-500'
    }
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <span className={`${sizeClasses[size]} ${config.color} ${config.animation} rounded-full`} />
      {showLabel && (
        <span className={`${labelSizeClasses[size]} ${config.textColor} font-medium`}>
          {config.label}
        </span>
      )}
    </div>
  )
}

export default StatusIndicator
