import React, { useRef, useState, useCallback } from 'react'

interface FileDropZoneProps {
  onFileAccepted: (files: File[]) => void
  acceptedTypes?: string
  maxSizeMB?: number
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileAccepted,
  acceptedTypes = '.pdf,.txt,.md,.png,.jpg,.jpeg',
  maxSizeMB = 10
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateFiles = (files: FileList | File[]): File[] => {
    const validFiles: File[] = []
    const acceptedExtensions = acceptedTypes.split(',').map(ext => ext.trim().toLowerCase())

    Array.from(files).forEach(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (!acceptedExtensions.includes(extension)) {
        alert(`不支持的文件格式：${file.name}`)
        return
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`文件过大：${file.name}（最大 ${maxSizeMB}MB）`)
        return
      }

      validFiles.push(file)
    })

    return validFiles
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = validateFiles(e.dataTransfer.files)
    if (files.length > 0) {
      onFileAccepted(files)
    }
  }, [acceptedTypes, maxSizeMB, onFileAccepted])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = validateFiles(e.target.files)
      if (files.length > 0) {
        onFileAccepted(files)
      }
    }
    e.target.value = ''
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200
        ${isDragging 
          ? 'border-red-500 bg-red-50 scale-[1.02]' 
          : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-3">
        <svg 
          className={`w-12 h-12 ${isDragging ? 'text-red-500' : 'text-gray-400'}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
          />
        </svg>
        
        <div>
          <p className={`text-lg font-medium ${isDragging ? 'text-red-600' : 'text-gray-700'}`}>
            {isDragging ? '释放文件以上传' : '拖拽文件到此处上传'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            或点击选择文件
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          支持格式：{acceptedTypes} · 最大 {maxSizeMB}MB
        </p>
      </div>
    </div>
  )
}

export default FileDropZone
