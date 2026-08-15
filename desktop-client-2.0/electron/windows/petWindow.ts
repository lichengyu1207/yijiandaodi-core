/**
 * 桌宠窗口管理模块
 */

import { BrowserWindow, app, screen } from 'electron'
import path from 'path'

export type PetState = 'green' | 'yellow' | 'red'

export class PetWindow {
  private petWindow: BrowserWindow | null = null
  private currentState: PetState = 'green'

  create(): BrowserWindow {
    console.log('[小鉴桌宠] 开始创建桌面悬浮窗口...')

    const { width, height } = { width: 140, height: 170 }
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    console.log(`[小鉴桌宠] 屏幕尺寸: ${screenWidth}x${screenHeight}`)
    console.log(`[小鉴桌宠] 窗口位置: (${screenWidth - width - 50}, ${screenHeight - height - 100})`)

    this.petWindow = new BrowserWindow({
      width,
      height,
      x: screenWidth - width - 50,
      y: screenHeight - height - 100,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // 加载小鉴桌宠页面
    const htmlContent = this.generatePetHTML()
    this.petWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))

    // 窗口事件
    this.petWindow.on('closed', () => {
      console.log('[小鉴桌宠] 窗口已关闭')
      this.petWindow = null
    })

    this.petWindow.webContents.on('did-finish-load', () => {
      console.log('[小鉴桌宠] 页面加载完成，准备显示窗口')
      try {
        this.petWindow?.show()
        this.petWindow?.focus()
        console.log('[小鉴桌宠] ✅ 窗口已显示并聚焦')
      } catch (error) {
        console.error('[小鉴桌宠] ❌ 显示窗口失败:', error)
      }
    })

    this.petWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('[小鉴桌宠] ❌ 加载失败:', errorCode, errorDescription)
    })

    // 确保窗口可交互
    this.petWindow.setIgnoreMouseEvents(false)

    // 立即显示窗口
    console.log('[小鉴桌宠] 立即显示窗口...')
    this.petWindow.show()

    console.log('[小鉴桌宠] ✅ 桌面悬浮窗口创建完成')
    return this.petWindow
  }

  private generatePetHTML(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          width: 140px;
          height: 170px;
          overflow: hidden !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
        }
        
        body::-webkit-scrollbar {
          display: none !important;
        }
        html::-webkit-scrollbar {
          display: none !important;
        }
        
        body {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          -webkit-app-region: drag;
          user-select: none;
        }
        
        .pet-container {
          position: relative;
          width: 140px;
          height: 170px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .pet-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.3));
          animation: float 3s ease-in-out infinite;
        }
        .status-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #58D68D;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      </style>
    </head>
    <body>
      <div class="pet-container">
        <div class="status-indicator" id="indicator"></div>
        <img src="http://localhost:5173/pet-idle.png" alt="小鉴" class="pet-image" id="petImage">
      </div>
      <script>
        console.log('[桌面桌宠] 页面加载完成');
        
        document.body.addEventListener('click', () => {
          if (window.electronAPI?.openMainWindow) {
            window.electronAPI.openMainWindow();
          }
        });
        
        if (window.electronAPI?.onReminder) {
          window.electronAPI.onReminder((message) => {
            console.log('[桌面桌宠] 收到提醒:', message);
            showBubble(message);
          });
        }

        function showBubble(text) {
          const bubble = document.createElement('div');
          bubble.style.cssText = \`
            position: absolute;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            color: #2E86C1;
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            white-space: nowrap;
            animation: fadeInOut 3s ease-in-out forwards;
          \`;
          bubble.textContent = text;
          document.body.appendChild(bubble);
          setTimeout(() => bubble.remove(), 3000);
        }

        const style = document.createElement('style');
        style.textContent = \`
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
            15% { opacity: 1; transform: translateX(-50%) translateY(0); }
            85% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          }
        \`;
        document.head.appendChild(style);

        if (window.electronAPI?.onPetStateChange) {
          window.electronAPI.onPetStateChange((state) => {
            console.log('[桌面桌宠] 状态变化:', state);
            const indicator = document.getElementById('indicator');
            const petImage = document.getElementById('petImage');
            
            switch(state) {
              case 'green':
                indicator.style.background = '#58D68D';
                petImage.src = 'http://localhost:5173/pet-idle.png';
                break;
              case 'yellow':
                indicator.style.background = '#F7DC6F';
                petImage.src = 'http://localhost:5173/pet-thinking.png';
                break;
              case 'red':
                indicator.style.background = '#E74C3C';
                petImage.src = 'http://localhost:5173/pet-alert.png';
                break;
            }
          });
        }
        
        if (window.electronAPI?.getPetState) {
          window.electronAPI.getPetState().then(state => {
            console.log('[桌面桌宠] 初始状态:', state);
          });
        }
      </script>
    </body>
    </html>
  `
  }

  getWindow(): BrowserWindow | null {
    return this.petWindow
  }

  getState(): PetState {
    return this.currentState
  }

  setState(state: PetState) {
    this.currentState = state
  }

  send(channel: string, data: any) {
    this.petWindow?.webContents.send(channel, data)
  }

  isDestroyed(): boolean {
    return this.petWindow?.isDestroyed() ?? true
  }
}