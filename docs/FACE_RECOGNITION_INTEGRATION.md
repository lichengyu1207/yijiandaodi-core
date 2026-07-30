# 人脸识别集成方案

## 一、技术选型

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **MediaPipe** | Google开源，性能优秀 | 需要模型加载 | ⭐⭐⭐⭐⭐ |
| **face-api.js** | 功能完整，易集成 | 模型较大（4MB+） | ⭐⭐⭐⭐ |
| **TensorFlow.js** | 灵活性高 | 需要自己训练模型 | ⭐⭐⭐ |

**推荐方案：MediaPipe**

---

## 二、MediaPipe集成方案

### 2.1 安装依赖

```bash
npm install @mediapipe/face_detection @mediapipe/camera_utils
```

### 2.2 人脸识别组件

```typescript
// src/components/FaceRecognition.tsx

import { useEffect, useRef, useState } from 'react'
import { FaceDetection } from '@mediapipe/face_detection'
import { Camera } from '@mediapipe/camera_utils'

interface FaceRecognitionProps {
  onSuccess: (faceData: string) => void
  onError: (error: string) => void
}

export default function FaceRecognition({ onSuccess, onError }: FaceRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [detecting, setDetecting] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)

  useEffect(() => {
    if (!videoRef.current) return

    const faceDetection = new FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
      }
    })

    faceDetection.setOptions({
      modelSelection: 0,
      minDetectionConfidence: 0.5
    })

    faceDetection.onResults((results) => {
      if (results.detections && results.detections.length > 0) {
        setFaceDetected(true)
        
        // 检测到人脸，提取特征
        const detection = results.detections[0]
        const faceData = JSON.stringify({
          boundingBox: detection.boundingBox,
          landmarks: detection.landmarks
        })
        
        // 保存人脸数据
        onSuccess(faceData)
      } else {
        setFaceDetected(false)
      }
    })

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await faceDetection.send({ image: videoRef.current })
        }
      },
      width: 640,
      height: 480
    })

    camera.start()

    return () => {
      camera.stop()
    }
  }, [onSuccess])

  return (
    <div className="face-recognition">
      <video
        ref={videoRef}
        className="face-video"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="face-canvas" />
      
      <div className="face-status">
        {detecting ? (
          <div className="detecting">正在识别...</div>
        ) : faceDetected ? (
          <div className="detected">✓ 人脸检测成功</div>
        ) : (
          <div className="hint">请将面部对准摄像头</div>
        )}
      </div>
    </div>
  )
}
```

### 2.3 集成到登录流程

```typescript
// src/pages/Auth.tsx

import FaceRecognition from '../components/FaceRecognition'

// 人脸识别登录
const loginWithFace = async () => {
  setFaceCapturing(true)
  setError('')

  // TODO: 实现人脸识别
}

const handleFaceDetected = async (faceData: string) => {
  try {
    // 发送人脸数据到后端验证
    const response = await fetch(`${API_BASE}/api/auth/login-with-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ face_data: faceData })
    })

    const data = await response.json()

    if (data.success) {
      setUser({
        id: data.user_id,
        phone: data.phone,
        name: data.name,
        is_realname: data.is_realname,
        face_registered: true,
        created_at: data.created_at
      })
      
      if (data.is_realname) {
        setStep('success')
      } else {
        setStep('realname')
      }
    } else {
      setError(data.error || '人脸识别失败')
    }
  } catch {
    setError('网络错误，请重试')
  } finally {
    setFaceCapturing(false)
  }
}
```

---

## 三、后端人脸识别API

### 3.1 人脸数据模型

```python
# backend/auth_app/models.py

class FaceData(models.Model):
    """人脸数据"""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    face_encoding = models.TextField()  # 人脸特征编码
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'face_data'
```

### 3.2 人脸识别API

```python
# backend/auth_app/face_views.py

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
import json

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_face(request):
    """注册人脸"""
    face_data = request.data.get('face_data')
    
    if not face_data:
        return Response({
            'success': False,
            'error': '未检测到人脸'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 保存人脸数据
    face_obj, created = FaceData.objects.get_or_create(
        user=request.user,
        defaults={'face_encoding': face_data}
    )
    
    if not created:
        face_obj.face_encoding = face_data
        face_obj.save()
    
    return Response({
        'success': True,
        'message': '人脸注册成功'
    })

@api_view(['POST'])
def login_with_face(request):
    """人脸登录"""
    face_data = request.data.get('face_data')
    
    # TODO: 实现人脸比对逻辑
    # 1. 提取人脸特征
    # 2. 与数据库中的人脸数据比对
    # 3. 返回用户信息
    
    return Response({
        'success': False,
        'error': '人脸识别功能开发中'
    }, status=status.HTTP_501_NOT_IMPLEMENTED)
```

---

## 四、安全措施

### 4.1 活体检测

```typescript
// 添加活体检测逻辑
const checkLiveness = async () => {
  // 1. 眨眼检测
  // 2. 张嘴检测
  // 3. 点头检测
  // 4. 摇头检测
}
```

### 4.2 数据加密

```typescript
// 人脸数据加密传输
import CryptoJS from 'crypto-js'

const encryptFaceData = (faceData: string) => {
  const key = 'your-secret-key'
  return CryptoJS.AES.encrypt(faceData, key).toString()
}
```

---

## 五、用户体验优化

### 5.1 引导提示

```typescript
<div className="face-guide">
  <div className="guide-step">
    <span>1. 确保光线充足</span>
  </div>
  <div className="guide-step">
    <span>2. 正对摄像头</span>
  </div>
  <div className="guide-step">
    <span>3. 保持稳定</span>
  </div>
</div>
```

### 5.2 错误处理

```typescript
const handleFaceError = (error: string) => {
  if (error.includes('permission')) {
    setError('请允许访问摄像头')
  } else if (error.includes('not found')) {
    setError('未检测到摄像头')
  } else {
    setError('人脸识别失败，请重试')
  }
}
```

---

## 六、实施步骤

### Phase 1: 基础集成（1天）
- 安装MediaPipe依赖
- 创建人脸识别组件
- 实现摄像头调用

### Phase 2: 功能开发（2天）
- 实现人脸检测
- 开发人脸注册API
- 开发人脸登录API

### Phase 3: 安全优化（1天）
- 添加活体检测
- 实现数据加密
- 添加防重放攻击

### Phase 4: 测试发布（1天）
- 功能测试
- 性能优化
- 用户体验优化

---

**人脸识别集成方案已创建，可按需实施！**