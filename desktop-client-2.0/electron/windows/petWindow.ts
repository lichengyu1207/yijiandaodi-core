/**
 * 桌宠窗口管理模块（P1/P2/P3 融合升级版）
 *
 * 融会贯通三类能力的人格化外壳：
 *  - 渲染层（P3）：内联 CSS/SVG 帧动画，不依赖外部图片/开发服务器，生产可用；
 *    状态情绪（green/yellow/red/thinking）+ 角色信息 + 治理气泡播报。
 *  - 驱动层：PetWindow 提供窄接口 setState/showBubble/setCharacter，
 *    被 petPlugin（P1 治理钩子）与既有监控器回调（updatePetState）共用。
 */

import { BrowserWindow, app, screen } from 'electron'
import path from 'path'

export type PetState = 'green' | 'yellow' | 'red' | 'thinking'

/** 桌宠角色信息（来自 P2 companion 系统） */
export interface PetCharacterInfo {
  name: string
  species: string
  rarity: string
  rarityStars: string
  shiny: boolean
  stats: Record<string, number>
}

export class PetWindow {
  private petWindow: BrowserWindow | null = null
  private currentState: PetState = 'green'

  create(): BrowserWindow {
    console.log('[小鉴桌宠] 开始创建桌面悬浮窗口...')

    const { width, height } = { width: 150, height: 190 }
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

    // 加载小鉴桌宠页面（内联动画渲染，不依赖开发服务器图片）
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
        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
          width: 150px; height: 190px;
          overflow: hidden !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
        }
        body::-webkit-scrollbar, html::-webkit-scrollbar { display: none !important; }

        body {
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; -webkit-app-region: drag; user-select: none;
        }

        .pet-container {
          position: relative; width: 150px; height: 190px;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        }

        /* ===== 角色徽标 ===== */
        .badge {
          position: absolute; top: 2px; left: 50%; transform: translateX(-50%);
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          color: #fff; padding: 1px 7px; border-radius: 8px;
          background: rgba(0,0,0,0.35); backdrop-filter: blur(2px);
          white-space: nowrap; z-index: 5; transition: all .3s;
        }
        .badge .stars { color: #FFD75E; margin-right: 3px; }

        /* ===== 角色属性小条 ===== */
        .stats {
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          width: 92%; display: none; flex-direction: column; gap: 2px;
          z-index: 5; pointer-events: none;
        }
        .pet-container:hover .stats { display: flex; }
        .stat-row { display: flex; align-items: center; gap: 4px; font-size: 9px; color: #ddd; }
        .stat-row .k { width: 28px; text-align: right; opacity: .8; }
        .stat-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.18); border-radius: 2px; overflow: hidden; }
        .stat-fill { height: 100%; border-radius: 2px; background: #58D68D; transition: width .5s; }
        .stat-row .v { width: 22px; font-size: 8px; color: #fff; }

        /* ===== 桌宠主体（SVG 角色） ===== */
        .pet-body {
          position: relative; width: 120px; height: 120px;
          animation: float 3s ease-in-out infinite;
          filter: drop-shadow(0 6px 16px rgba(0,0,0,0.35));
        }
        .pet-svg { width: 100%; height: 100%; }

        /* 帧动画：idle 微动（呼吸/摆尾） */
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes idleBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes thinkPulse { 0%,100% { transform: rotate(-4deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-4px); } }
        @keyframes alertShake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-4px); } 40%,80% { transform: translateX(4px); } }
        @keyframes bubblePop { 0% { opacity: 0; transform: translateX(-50%) translateY(12px) scale(.9); } 12% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 82% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.95); } }

        .pet-body.mood-thinking { animation: thinkPulse 0.8s ease-in-out infinite; }
        .pet-body.mood-red { animation: alertShake 0.5s linear infinite; }
        .eye { transform-origin: center; animation: blink 4s infinite; }

        /* ===== 气泡 ===== */
        .bubble {
          position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
          max-width: 134px; background: rgba(255,255,255,0.96); color: #2E86C1;
          padding: 6px 10px; border-radius: 10px; font-size: 12px; line-height: 1.35;
          box-shadow: 0 4px 14px rgba(0,0,0,0.22); white-space: normal;
          z-index: 6; display: none; pointer-events: none;
        }
        .bubble.show { display: block; animation: bubblePop 3s ease-in-out forwards; }
        .bubble.tail::after {
          content: ''; position: absolute; bottom: -5px; left: 50%; margin-left: -6px;
          border: 6px solid transparent; border-top-color: rgba(255,255,255,0.96); border-bottom: 0;
        }

        /* ===== 状态光环 ===== */
        .status-indicator {
          position: absolute; bottom: 6px; right: 8px; width: 14px; height: 14px;
          border-radius: 50%; background: #58D68D;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          animation: pulse 2s ease-in-out infinite; z-index: 5;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      </style>
    </head>
    <body>
      <div class="pet-container">
        <div class="badge" id="badge"><span class="stars" id="rarityStars">★</span><span id="petName">小鉴</span></div>
        <div class="stats" id="stats"></div>
        <div class="status-indicator" id="indicator"></div>
        <div class="pet-body mood-green" id="petBody">
          <svg class="pet-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <!-- 身体 -->
            <ellipse id="bodyShape" cx="60" cy="78" rx="40" ry="34" fill="#4A90D9"/>
            <!-- 肚皮 -->
            <ellipse cx="60" cy="86" rx="26" ry="20" fill="#EAF2FB"/>
            <!-- 耳朵 -->
            <path id="earL" d="M32 52 L26 24 L50 40 Z" fill="#3A7BC8"/>
            <path id="earR" d="M88 52 L94 24 L70 40 Z" fill="#3A7BC8"/>
            <!-- 眼睛（眨眼动画） -->
            <ellipse class="eye" id="eyeL" cx="48" cy="64" rx="5" ry="6" fill="#1C2733"/>
            <ellipse class="eye" id="eyeR" cx="72" cy="64" rx="5" ry="6" fill="#1C2733"/>
            <!-- 腮红 -->
            <circle cx="40" cy="76" r="4" fill="#F5A8B8" opacity="0.6"/>
            <circle cx="80" cy="76" r="4" fill="#F5A8B8" opacity="0.6"/>
            <!-- 嘴 -->
            <path id="mouth" d="M56 78 Q60 82 64 78" stroke="#1C2733" stroke-width="2" fill="none" stroke-linecap="round"/>
            <!-- 尾巴 -->
            <path id="tail" d="M96 88 Q118 84 110 66" stroke="#4A90D9" stroke-width="8" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="bubble" id="bubble"></div>
      </div>
      <script>
        console.log('[桌面桌宠] 页面加载完成');

        document.body.addEventListener('click', () => {
          if (window.electronAPI?.openMainWindow) window.electronAPI.openMainWindow();
        });

        if (window.electronAPI?.onReminder) {
          window.electronAPI.onReminder((message) => { showBubble(message); });
        }

        function showBubble(text) {
          const bubble = document.getElementById('bubble');
          if (!text) return;
          bubble.textContent = text;
          bubble.classList.remove('show');
          void bubble.offsetWidth; // 重启动画
          bubble.classList.add('show');
        }
        window.__showBubble = showBubble;

        if (window.electronAPI?.onPetBubble) {
          window.electronAPI.onPetBubble((text) => showBubble(text));
        }

        const MOOD_COLORS = {
          green: '#58D68D',
          yellow: '#F7DC6F',
          red: '#E74C3C',
          thinking: '#5DADE2'
        };
        const MOOD_BODY = {
          green: '#4A90D9',
          yellow: '#F0C75E',
          red: '#E08B7E',
          thinking: '#7FB8E8'
        };

        function applyMood(state) {
          const body = document.getElementById('petBody');
          const indicator = document.getElementById('indicator');
          body.className = 'pet-body mood-' + state;
          indicator.style.background = MOOD_COLORS[state] || MOOD_COLORS.green;
          const bodyColor = MOOD_BODY[state] || MOOD_BODY.green;
          const shapes = ['bodyShape', 'earL', 'earR', 'tail'];
          shapes.forEach((id) => { const el = document.getElementById(id); if (el) el.setAttribute('fill', bodyColor); });
        }

        if (window.electronAPI?.onPetStateChange) {
          window.electronAPI.onPetStateChange((state) => {
            console.log('[桌面桌宠] 状态变化:', state);
            applyMood(state);
          });
        }

        if (window.electronAPI?.onPetCharacter) {
          window.electronAPI.onPetCharacter((character) => {
            if (!character) return;
            console.log('[桌面桌宠] 角色信息:', character);
            document.getElementById('petName').textContent = character.name;
            document.getElementById('rarityStars').textContent = character.rarityStars || '★';
            const statLabels = { VIGILANCE:'警觉', WISDOM:'智慧', PATIENCE:'耐心', EXECUTION:'执行', CHAOS:'混沌' };
            const statsBox = document.getElementById('stats');
            statsBox.innerHTML = '';
            for (const [k, v] of Object.entries(character.stats || {})) {
              const row = document.createElement('div');
              row.className = 'stat-row';
              row.innerHTML = '<span class="k">' + (statLabels[k] || k) + '</span>' +
                '<div class="stat-bar"><div class="stat-fill" style="width:' + v + '%"></div></div>' +
                '<span class="v">' + v + '</span>';
              statsBox.appendChild(row);
            }
          });
        }

        if (window.electronAPI?.getPetState) {
          window.electronAPI.getPetState().then(state => {
            console.log('[桌面桌宠] 初始状态:', state);
            if (state) applyMood(state);
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

  /** 设置桌宠角色信息（P2：companion 系统产出） */
  setCharacter(character: PetCharacterInfo) {
    this.send('pet-character', character)
  }

  /** 弹出治理气泡播报（P1：petPlugin driver 调用） */
  showBubble(text: string) {
    this.send('pet-bubble', text)
  }

  send(channel: string, data: any) {
    this.petWindow?.webContents.send(channel, data)
  }

  isDestroyed(): boolean {
    return this.petWindow?.isDestroyed() ?? true
  }
}
