"use strict";var D=Object.defineProperty;var $=(s,e,t)=>e in s?D(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t;var a=(s,e,t)=>$(s,typeof e!="symbol"?e+"":e,t);const r=require("electron"),d=require("path"),h=require("fs"),f=require("child_process"),P=require("util");function A(s){const e=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(s){for(const t in s)if(t!=="default"){const o=Object.getOwnPropertyDescriptor(s,t);Object.defineProperty(e,t,o.get?o:{enumerable:!0,get:()=>s[t]})}}return e.default=s,Object.freeze(e)}const W=A(d),I=A(h);class _{constructor(){a(this,"mainWindow",null);a(this,"isQuitting",!1)}create(){return this.mainWindow=new r.BrowserWindow({width:1200,height:800,minWidth:800,minHeight:600,webPreferences:{preload:d.join(__dirname,"../preload.js"),contextIsolation:!0,nodeIntegration:!1},titleBarStyle:"hiddenInset",trafficLightPosition:{x:16,y:16},icon:d.join(__dirname,"../../public/logo.png"),show:!1,backgroundColor:"#F5F7FA"}),this.mainWindow.once("ready-to-show",()=>{var t;(t=this.mainWindow)==null||t.show()}),!r.app.isPackaged?(this.mainWindow.loadURL("http://localhost:5173"),this.mainWindow.webContents.openDevTools()):this.mainWindow.loadFile(d.join(__dirname,"../../dist/index.html")),this.mainWindow.on("close",t=>{var o;this.isQuitting||(t.preventDefault(),(o=this.mainWindow)==null||o.hide(),r.Notification.isSupported()&&new r.Notification({title:"一鉴到底",body:"应用已在后台运行，点击托盘图标可重新打开",silent:!0}).show())}),this.mainWindow}getWindow(){return this.mainWindow}show(){this.mainWindow&&(this.mainWindow.isMinimized()&&this.mainWindow.restore(),this.mainWindow.show(),this.mainWindow.focus())}setQuitting(e){this.isQuitting=e}send(e,t){var o;(o=this.mainWindow)==null||o.webContents.send(e,t)}}class R{constructor(){a(this,"petWindow",null);a(this,"currentState","green")}create(){console.log("[小鉴桌宠] 开始创建桌面悬浮窗口...");const{width:e,height:t}={width:140,height:170},{width:o,height:n}=r.screen.getPrimaryDisplay().workAreaSize;console.log(`[小鉴桌宠] 屏幕尺寸: ${o}x${n}`),console.log(`[小鉴桌宠] 窗口位置: (${o-e-50}, ${n-t-100})`),this.petWindow=new r.BrowserWindow({width:e,height:t,x:o-e-50,y:n-t-100,frame:!1,transparent:!0,alwaysOnTop:!0,resizable:!1,skipTaskbar:!0,focusable:!0,hasShadow:!1,webPreferences:{preload:d.join(__dirname,"../preload.js"),contextIsolation:!0,nodeIntegration:!1}});const i=this.generatePetHTML();return this.petWindow.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(i)),this.petWindow.on("closed",()=>{console.log("[小鉴桌宠] 窗口已关闭"),this.petWindow=null}),this.petWindow.webContents.on("did-finish-load",()=>{var c,p;console.log("[小鉴桌宠] 页面加载完成，准备显示窗口");try{(c=this.petWindow)==null||c.show(),(p=this.petWindow)==null||p.focus(),console.log("[小鉴桌宠] ✅ 窗口已显示并聚焦")}catch(w){console.error("[小鉴桌宠] ❌ 显示窗口失败:",w)}}),this.petWindow.webContents.on("did-fail-load",(c,p,w)=>{console.error("[小鉴桌宠] ❌ 加载失败:",p,w)}),this.petWindow.setIgnoreMouseEvents(!1),console.log("[小鉴桌宠] 立即显示窗口..."),this.petWindow.show(),console.log("[小鉴桌宠] ✅ 桌面悬浮窗口创建完成"),this.petWindow}generatePetHTML(){return`
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
      <\/script>
    </body>
    </html>
  `}getWindow(){return this.petWindow}getState(){return this.currentState}setState(e){this.currentState=e}send(e,t){var o;(o=this.petWindow)==null||o.webContents.send(e,t)}isDestroyed(){var e;return((e=this.petWindow)==null?void 0:e.isDestroyed())??!0}}const j=W.join(__dirname,"../../security-knowledge-base/AboutSecurity-master");function S(s){try{const e=W.join(j,s);if(!I.existsSync(e))return console.warn(`[安全知识库] 文件不存在: ${s}`),[];const o=I.readFileSync(e,"utf-8").split(`
`).map(n=>n.trim()).filter(n=>n.length>0&&!n.startsWith("#"));return console.log(`[安全知识库] 加载 ${s}: ${o.length} 条`),o}catch(e){return console.error(`[安全知识库] 加载失败 ${s}:`,e),[]}}function F(){console.log("[安全知识库] 开始加载...");const s={sqli:S("Payload/sqli/payload.txt"),xss:S("Payload/xss/js-event.txt"),passwords:S("Dic/auth/password/pass-admin.txt"),apiKeys:["sk-","sk-proj-","AIza","ghp_","gho_","github_pat_","glpat-","AKIA","ASIA","eyJ"],sensitive:["password","passwd","pwd","secret","api_key","apikey","access_key","accesskey","secret_key","secretkey","token","auth","credential","private_key","privatekey","database","db_password","db_user","mysql","postgresql","mongodb","aws_access_key","aws_secret_key","azure_key","gcp_key"]},e=["select","insert","update","delete","drop","union","or 1=1","or '1'='1'","--","/*","*/","xp_cmdshell","exec","execute"];return s.sensitive.push(...e),console.log("[安全知识库] 加载完成！"),console.log(`  - SQL注入Payload: ${s.sqli.length} 条`),console.log(`  - XSS Payload: ${s.xss.length} 条`),console.log(`  - 密码字典: ${s.passwords.length} 条`),console.log(`  - API Key模式: ${s.apiKeys.length} 条`),console.log(`  - 敏感关键词: ${s.sensitive.length} 条`),s}function C(s,e){const t=[],o=s.toLowerCase();for(const n of e.sqli)o.includes(n.toLowerCase())&&t.push({type:"sqli",matched:n,risk:"high"});for(const n of e.xss)o.includes(n.toLowerCase())&&t.push({type:"xss",matched:n,risk:"high"});for(const n of e.apiKeys)s.includes(n)&&t.push({type:"apikey",matched:n,risk:"high"});for(const n of e.passwords)o.includes(n.toLowerCase())&&t.push({type:"password",matched:n,risk:"medium"});for(const n of e.sensitive)o.includes(n.toLowerCase())&&t.push({type:"sensitive",matched:n,risk:"medium"});return t}class q{constructor(e){a(this,"fileWatcher",null);a(this,"securityKB",null);a(this,"config");a(this,"onRiskDetected");a(this,"onPetStateChange");a(this,"onSaveRecord");this.config=e||{watchPaths:[d.join(r.app.getPath("home"),"Documents"),d.join(r.app.getPath("home"),"Desktop")]}}setSecurityKnowledgeBase(e){this.securityKB=e}setRiskDetectedCallback(e){this.onRiskDetected=e}setPetStateChangeCallback(e){this.onPetStateChange=e}setSaveRecordCallback(e){this.onSaveRecord=e}start(){if(this.fileWatcher){console.log("[文件监控] 已在运行");return}console.log("[文件监控] 启动..."),this.config.watchPaths.forEach(e=>{h.existsSync(e)&&(this.fileWatcher=h.watch(e,{recursive:!0},(t,o)=>{if(o){console.log(`[文件监控] ${t}: ${o}`);const n=d.join(e,o);h.existsSync(n)&&h.statSync(n).isFile()&&this.triggerDetection(n)}}))})}stop(){this.fileWatcher&&(this.fileWatcher.close(),this.fileWatcher=null)}async triggerDetection(e){try{if(!this.securityKB){console.warn("[文件检测] 安全知识库未初始化");return}const t=h.readFileSync(e,"utf-8"),o=C(t,this.securityKB);if(o.length>0){const n=o.filter(c=>c.risk==="high"),i=o.filter(c=>c.risk==="medium");if(console.log("[文件] 发现安全风险:",{file:e,total:o.length,high:n.length,medium:i.length,types:[...new Set(o.map(c=>c.type))]}),this.onSaveRecord){console.log("[文件监控] 准备保存记录...");const c={id:`file-${Date.now()}`,type:"file_op",title:`文件安全检测: ${d.basename(e)}`,content:`文件 ${d.basename(e)} 中发现${o.length}个安全风险`,source:"文件监控",status:"flagged",risk_level:n.length>0?"high":"medium",risk_score:n.length>0?80:50,should_block:n.length>0,context:`文件路径: ${e}
风险类型: ${[...new Set(o.map(p=>p.type))].join(", ")}
风险详情:
${o.slice(0,5).map(p=>`- ${p.type}: ${p.matched}`).join(`
`)}`,explanation:`检测到${n.length}个高风险, ${i.length}个中风险`};try{await this.onSaveRecord(c),console.log("[文件监控] ✅ 记录保存成功:",c.id)}catch(p){console.error("[文件监控] ❌ 记录保存失败:",p)}}else console.warn("[文件监控] ⚠️ onSaveRecord 回调未设置");this.onPetStateChange&&this.onPetStateChange("red",`文件检测到${n.length}个高风险, ${i.length}个中风险`),this.onRiskDetected&&this.onRiskDetected(o,e)}else console.log("[文件监控] 文件检测通过:",d.basename(e)),this.onPetStateChange&&(this.onPetStateChange("yellow","文件检测中"),setTimeout(()=>{this.onPetStateChange&&this.onPetStateChange("green","文件安全")},1e3))}catch(t){console.error("[文件检测] 失败:",t.message)}}}class O{constructor(){a(this,"clipboardWatcher",null);a(this,"lastClipboardContent","");a(this,"securityKB",null);a(this,"onRiskDetected");a(this,"onPetStateChange");a(this,"onSaveRecord")}setSecurityKnowledgeBase(e){this.securityKB=e}setRiskDetectedCallback(e){this.onRiskDetected=e}setPetStateChangeCallback(e){this.onPetStateChange=e}setSaveRecordCallback(e){this.onSaveRecord=e}start(){if(this.clipboardWatcher){console.log("[剪贴板监控] 已在运行");return}console.log("[剪贴板监控] 启动..."),this.clipboardWatcher=setInterval(()=>{try{const e=r.clipboard.readText();e&&e!==this.lastClipboardContent&&(this.lastClipboardContent=e,console.log("[剪贴板] 检测到新内容"),this.triggerDetection(e))}catch(e){console.error("[剪贴板监控] 错误:",e.message)}},500)}stop(){this.clipboardWatcher&&(clearInterval(this.clipboardWatcher),this.clipboardWatcher=null,console.log("[剪贴板监控] 已停止"))}async triggerDetection(e){try{if(!this.securityKB){console.warn("[剪贴板检测] 安全知识库未初始化");return}const t=C(e,this.securityKB);if(t.length>0){const o=t.filter(i=>i.risk==="high"),n=t.filter(i=>i.risk==="medium");if(console.log("[剪贴板] 发现安全风险:",{total:t.length,high:o.length,medium:n.length,types:[...new Set(t.map(i=>i.type))]}),this.onSaveRecord){console.log("[剪贴板监控] 准备保存记录...");const i={id:`clipboard-${Date.now()}`,type:"ai_dialog",title:"剪贴板安全检测",content:`剪贴板中发现${t.length}个安全风险`,source:"剪贴板监控",status:"flagged",risk_level:o.length>0?"high":"medium",risk_score:o.length>0?80:50,should_block:o.length>0,context:`风险类型: ${[...new Set(t.map(c=>c.type))].join(", ")}
风险详情:
${t.slice(0,5).map(c=>`- ${c.type}: ${c.matched}`).join(`
`)}`,explanation:`检测到${o.length}个高风险, ${n.length}个中风险`};try{await this.onSaveRecord(i),console.log("[剪贴板监控] ✅ 记录保存成功:",i.id)}catch(c){console.error("[剪贴板监控] ❌ 记录保存失败:",c)}}else console.warn("[剪贴板监控] ⚠️ onSaveRecord 回调未设置");this.onPetStateChange&&this.onPetStateChange("red",`检测到${o.length}个高风险, ${n.length}个中风险`),this.onRiskDetected&&this.onRiskDetected(t,e)}else console.log("[剪贴板监控] 内容检测通过")}catch(t){console.error("[剪贴板检测] 失败:",t.message)}}}const L=P.promisify(f.exec),K=["Cursor","Code","chrome","firefox","edge","GitHub CLI","postman"];class T{constructor(){a(this,"monitoringInterval",null);a(this,"detectedProcesses",new Map);a(this,"onAIAgentDetected")}setAIAgentDetectedCallback(e){this.onAIAgentDetected=e}start(){if(this.monitoringInterval){console.log("[进程监控] 已在运行");return}console.log("[进程监控] 启动..."),this.monitoringInterval=setInterval(()=>{this.checkProcesses()},5e3),this.checkProcesses()}stop(){this.monitoringInterval&&(clearInterval(this.monitoringInterval),this.monitoringInterval=null,console.log("[进程监控] 已停止"))}async checkProcesses(){try{const{stdout:e}=await L("tasklist /fo csv /nh");this.parseProcessList(e).forEach(o=>{this.isAIAgentProcess(o.name)&&(o.isAIAgent=!0,this.detectedProcesses.set(o.name,o),console.log(`[进程监控] 检测到 AI Agent: ${o.name} (PID: ${o.pid})`),this.onAIAgentDetected&&this.onAIAgentDetected(o))})}catch(e){console.error("[进程监控] 检查进程失败:",e.message)}}parseProcessList(e){const t=e.split(`
`).filter(n=>n.trim()),o=[];return t.forEach(n=>{try{const i=n.match(/"([^"]+)"/g);if(i&&i.length>=2){const c=i[0].replace(/"/g,""),p=parseInt(i[1].replace(/"/g,""));o.push({name:c,pid:p,memory:0,cpu:0,isAIAgent:!1,timestamp:new Date().toISOString()})}}catch{}}),o}isAIAgentProcess(e){return K.some(t=>e.toLowerCase().includes(t.toLowerCase()))}getDetectedAIAgents(){return Array.from(this.detectedProcesses.values())}clearDetectedProcesses(){this.detectedProcesses.clear()}}const B=P.promisify(f.exec),E=["api.openai.com","api.anthropic.com","generativelanguage.googleapis.com","api.perplexity.ai","api.claude.ai","api.github.com"];class H{constructor(){a(this,"monitoringInterval",null);a(this,"detectedConnections",new Map);a(this,"onAIAPIRequestDetected")}setAIAPIRequestDetectedCallback(e){this.onAIAPIRequestDetected=e}start(){if(this.monitoringInterval){console.log("[网络监控] 已在运行");return}console.log("[网络监控] 启动..."),this.monitoringInterval=setInterval(()=>{this.checkNetworkConnections()},1e4),this.checkNetworkConnections()}stop(){this.monitoringInterval&&(clearInterval(this.monitoringInterval),this.monitoringInterval=null,console.log("[网络监控] 已停止"))}async checkNetworkConnections(){try{const{stdout:e}=await B("netstat -ano");this.parseNetworkConnections(e).forEach(o=>{const n=this.detectAIAPI(o.foreignAddress);n&&(o.isAIAPI=!0,o.domain=n,this.detectedConnections.set(o.foreignAddress,o),console.log(`[网络监控] 检测到 AI API 连接: ${n} (${o.foreignAddress})`),this.onAIAPIRequestDetected&&this.onAIAPIRequestDetected(o))})}catch(e){console.error("[网络监控] 检查网络连接失败:",e.message)}}parseNetworkConnections(e){const t=e.split(`
`).filter(n=>n.trim()),o=[];return t.forEach(n=>{try{const i=n.trim().split(/\s+/);i.length>=5&&o.push({protocol:i[0],localAddress:i[1],foreignAddress:i[2],state:i[3],pid:parseInt(i[4]),isAIAPI:!1,timestamp:new Date().toISOString()})}catch{}}),o}detectAIAPI(e){for(const t of E)if(e.includes(t)||e.includes(this.getIPPattern(t)))return t;return null}getIPPattern(e){return e.split(".")[0]}getDetectedAIAPIConnections(){return Array.from(this.detectedConnections.values())}clearDetectedConnections(){this.detectedConnections.clear()}}class N{constructor(){a(this,"tray",null);a(this,"onShowMainWindow");a(this,"onQuit")}create(){const e=r.nativeImage.createFromPath(d.join(__dirname,"../../public/logo.png"));this.tray=new r.Tray(e.resize({width:16,height:16}));const t=r.Menu.buildFromTemplate([{label:"打开主界面",click:()=>{this.onShowMainWindow&&this.onShowMainWindow()}},{label:"后台运行中",enabled:!1,icon:r.nativeImage.createFromPath(d.join(__dirname,"../../public/logo.png")).resize({width:12,height:12})},{type:"separator"},{label:"开机自启动",type:"checkbox",checked:r.app.getLoginItemSettings().openAtLogin,click:o=>{r.app.setLoginItemSettings({openAtLogin:o.checked,openAsHidden:!0})}},{type:"separator"},{label:"退出",click:()=>{this.onQuit&&this.onQuit()}}]);return this.tray.setToolTip("一鉴到底 - 后台运行中"),this.tray.setContextMenu(t),this.tray.on("click",()=>{this.onShowMainWindow&&this.onShowMainWindow()}),this.tray.on("double-click",()=>{this.onShowMainWindow&&this.onShowMainWindow()}),this.tray}setShowMainWindowCallback(e){this.onShowMainWindow=e}setQuitCallback(e){this.onQuit=e}updateIcon(e){if(!this.tray)return;const t={green:"logo-green.png",yellow:"logo-yellow.png",red:"logo-red.png"},o=d.join(__dirname,`../../public/${t[e]}`);if(require("fs").existsSync(o)){const i=r.nativeImage.createFromPath(o);this.tray.setImage(i.resize({width:16,height:16}))}}getTray(){return this.tray}}class Q{constructor(){a(this,"apiProcess",null)}start(){var t,o;if(!r.app.isPackaged){const n="C:\\MsSafeData\\Desktop\\yijiandaodi\\sandbox_api.py";console.log("启动后台服务:",n),this.apiProcess=f.spawn("python",[n],{cwd:"C:\\MsSafeData\\Desktop\\yijiandaodi",stdio:"pipe"}),(t=this.apiProcess.stdout)==null||t.on("data",i=>{console.log(`[API] ${i}`)}),(o=this.apiProcess.stderr)==null||o.on("data",i=>{console.error(`[API Error] ${i}`)}),this.apiProcess.on("close",i=>{console.log(`API 服务退出: ${i}`)})}else{const n=d.join(d.dirname(__dirname),"backend"),i=d.join(n,"python","python.exe");this.apiProcess=f.spawn(i,["sandbox_api.py"],{cwd:n,stdio:"pipe",detached:!0}),this.apiProcess.unref()}}stop(){this.apiProcess&&(console.log("停止后台服务..."),this.apiProcess.kill(),this.apiProcess=null)}isRunning(){return this.apiProcess!==null}}class z{constructor(){a(this,"dataPath");a(this,"operationsFile");this.dataPath=d.join(r.app.getPath("userData"),"data"),this.operationsFile=d.join(this.dataPath,"operations.json"),h.existsSync(this.dataPath)||h.mkdirSync(this.dataPath,{recursive:!0})}async saveOperation(e){try{console.log("[StorageService] 开始保存记录:",e.id),console.log("[StorageService] 存储路径:",this.operationsFile);let t=[];if(h.existsSync(this.operationsFile)){const n=h.readFileSync(this.operationsFile,"utf-8");t=JSON.parse(n),console.log("[StorageService] 当前记录数:",t.length)}else console.log("[StorageService] 文件不存在，将创建新文件");const o={...e,timestamp:e.timestamp||new Date().toISOString(),audit_hash:e.audit_hash||`hash-${Date.now()}-${Math.random().toString(36).substring(7)}`};return t.push(o),console.log("[StorageService] 新增记录:",o.id),t.length>100&&(t=t.slice(-100),console.log("[StorageService] 保留最近100条记录")),h.writeFileSync(this.operationsFile,JSON.stringify(t,null,2)),console.log("[StorageService] ✅ 保存成功:",e.title),console.log("[StorageService] 总记录数:",t.length),{success:!0,count:t.length}}catch(t){return console.error("[StorageService] ❌ 保存失败:",t),{success:!1,error:String(t)}}}async getOperations(){try{if(h.existsSync(this.operationsFile)){const e=h.readFileSync(this.operationsFile,"utf-8");return JSON.parse(e)}return[]}catch(e){return console.error("读取操作记录失败:",e),[]}}async clearOperations(){try{return h.writeFileSync(this.operationsFile,"[]"),{success:!0}}catch(e){return{success:!1,error:String(e)}}}async exportData(e){try{if(!h.existsSync(this.operationsFile))return{success:!1,error:"无数据可导出"};const t=h.readFileSync(this.operationsFile,"utf-8"),o=JSON.parse(t),n=d.join(r.app.getPath("downloads"),`yijiandaodi-export-${Date.now()}.${e}`);if(e==="json")h.writeFileSync(n,t);else{const i=o.map(c=>`${c.timestamp} [${c.type}] ${c.content}`).join(`
`);h.writeFileSync(n,i)}return{success:!0,path:n}}catch(t){return{success:!1,error:String(t)}}}getDataPath(){return this.dataPath}}class X{constructor(e,t,o,n){a(this,"storageService");a(this,"fileMonitor");a(this,"clipboardMonitor");a(this,"getPetState");this.storageService=e,this.fileMonitor=t,this.clipboardMonitor=o,this.getPetState=n}registerAll(){this.registerStorageHandlers(),this.registerMonitoringHandlers(),this.registerPetHandlers()}registerStorageHandlers(){r.ipcMain.handle("get-operations",async()=>await this.storageService.getOperations()),r.ipcMain.handle("save-operation",async(e,t)=>await this.storageService.saveOperation(t)),r.ipcMain.handle("clear-operations",async()=>await this.storageService.clearOperations()),r.ipcMain.handle("export-data",async(e,t)=>await this.storageService.exportData(t)),r.ipcMain.handle("get-storage-path",async()=>this.storageService.getDataPath())}registerMonitoringHandlers(){r.ipcMain.handle("start-monitoring",async()=>{try{return this.fileMonitor.start(),this.clipboardMonitor.start(),{success:!0}}catch(e){return{success:!1,error:e.message}}}),r.ipcMain.handle("stop-monitoring",async()=>{try{return this.fileMonitor.stop(),this.clipboardMonitor.stop(),{success:!0}}catch(e){return{success:!1,error:e.message}}})}registerPetHandlers(){r.ipcMain.handle("get-pet-state",async()=>this.getPetState()),r.ipcMain.handle("confirm-risk",async(e,t)=>(console.log(`[风险] 用户确认: ${t}`),{success:!0}))}}class Y{constructor(){a(this,"services",new Map)}register(e,t){this.services.set(e,t)}resolve(e){const t=this.services.get(e);if(!t)throw new Error(`Service '${e}' not found in DI container`);return t}has(e){return this.services.has(e)}clear(){this.services.clear()}}const l=new Y,J=r.app.requestSingleInstanceLock();J?r.app.on("second-instance",()=>{l.resolve("mainWindow").show()}):r.app.quit();function U(s){const e=l.resolve("mainWindow");l.resolve("petWindow");const t=r.dialog.showMessageBoxSync(e.getWindow(),{type:"warning",title:"风险警告",message:`发现${s.risk_level}风险！`,detail:s.description||"检测到潜在的安全风险",buttons:["允许","拒绝","查看详情"],defaultId:1,cancelId:1});t===0?(console.log("[风险] 用户允许操作"),m("green")):t===1?(console.log("[风险] 用户拒绝操作"),m("green")):t===2&&(console.log("[风险] 查看详情:",s),m("green"))}function m(s,e){const t=l.resolve("mainWindow"),o=l.resolve("petWindow"),n=l.resolve("trayService");o.setState(s),console.log(`[小鉴] 状态更新: ${s}${e?` - ${e}`:""}`),t.send("pet-state-change",s),o.send("pet-state-change",s),n.updateIcon(s)}function G(){console.log("[系统] 初始化安全知识库...");const s=F();l.register("securityKB",s);const e=new _,t=new R;l.register("mainWindow",e),l.register("petWindow",t);const o=new q,n=new O;o.setSecurityKnowledgeBase(s),n.setSecurityKnowledgeBase(s),l.register("fileMonitor",o),l.register("clipboardMonitor",n);const i=new z,c=new N,p=new Q;l.register("storageService",i),l.register("trayService",c),l.register("apiService",p);const w=(g,y)=>{const x=g.filter(u=>u.risk==="high"),M=g.slice(0,10).map(u=>{switch(u.type){case"sqli":return`SQL注入: ${u.matched}`;case"xss":return`XSS攻击: ${u.matched}`;case"apikey":return`API Key: ${u.matched}`;case"password":return`常见密码: ${u.matched}`;case"sensitive":return`敏感信息: ${u.matched}`;default:return`未知类型: ${u.matched}`}});U({risk_level:x.length>0?"high":"medium",description:`${y}中发现${g.length}个安全风险:
${M.join(`
`)}`})};o.setRiskDetectedCallback((g,y)=>w(g,`文件 ${y}`)),n.setRiskDetectedCallback(g=>w(g,"剪贴板")),o.setPetStateChangeCallback(m),n.setPetStateChangeCallback(m),o.setSaveRecordCallback(g=>i.saveOperation(g)),n.setSaveRecordCallback(g=>i.saveOperation(g));const v=new T;v.setAIAgentDetectedCallback(g=>{console.log("[AI Agent] 检测到:",g.name),m("yellow",`检测到 ${g.name}`)}),l.register("processMonitor",v);const k=new H;k.setAIAPIRequestDetectedCallback(g=>{console.log("[AI API] 调用:",g.domain),m("yellow",`API 调用: ${g.domain}`)}),l.register("networkMonitor",k),c.setShowMainWindowCallback(()=>e.show()),c.setQuitCallback(()=>{b(),r.app.quit()}),new X(i,o,n,()=>t.getState()).registerAll()}function V(){const s=l.resolve("mainWindow"),e=l.resolve("petWindow"),t=l.resolve("trayService"),o=l.resolve("apiService"),n=l.resolve("fileMonitor"),i=l.resolve("clipboardMonitor"),c=l.resolve("processMonitor"),p=l.resolve("networkMonitor");o.start(),s.create(),t.create();try{e.create(),console.log("[系统] ✅ 桌宠窗口创建成功")}catch(w){console.error("[系统] ❌ 桌宠窗口创建失败:",w)}n.start(),i.start(),c.start(),p.start(),console.log("[一鉴到底] 所有监控服务已启动"),console.log("一鉴到底已启动"),console.log("关闭窗口后应用会继续在后台运行")}function b(){const s=l.resolve("apiService"),e=l.resolve("fileMonitor"),t=l.resolve("clipboardMonitor"),o=l.resolve("processMonitor"),n=l.resolve("networkMonitor");s.stop(),e.stop(),t.stop(),o.stop(),n.stop()}r.app.whenReady().then(()=>{G(),V()});r.app.on("window-all-closed",s=>{s.preventDefault()});r.app.on("activate",()=>{const s=l.resolve("mainWindow");s.getWindow()||s.create()});r.app.on("before-quit",()=>{l.resolve("mainWindow").setQuitting(!0)});r.app.on("will-quit",()=>{b()});r.app.on("quit",()=>{b()});
