import * as vscode from 'vscode';
import axios from 'axios';

// 配置接口
interface InterceptorConfig {
    apiEndpoint: string;
    autoBlock: boolean;
    showNotification: boolean;
    agents: string[];
}

// 风险分析结果
interface AnalysisResult {
    success: boolean;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    risk_score: number;
    risk_tags: string[];
    decision: 'allow' | 'block' | 'ask_user';
    recommendation: string;
}

// 拦截器状态
let interceptorEnabled = true;
let statusBar: vscode.StatusBarItem;

/**
 * 插件激活
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('一鉴到底 - AI 安全拦截器已激活');

    // 创建状态栏
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(shield) 一鉴到底';
    statusBar.tooltip = '一鉴到底 - AI 安全拦截器 (运行中)';
    statusBar.command = 'yijiandaodi.showStatus';
    statusBar.show();

    // 注册命令
    const toggleCmd = vscode.commands.registerCommand('yijiandaodi.toggleInterceptor', toggleInterceptor);
    const checkCmd = vscode.commands.registerCommand('yijiandaodi.checkCurrentFile', checkCurrentFile);
    const statusCmd = vscode.commands.registerCommand('yijiandaodi.showStatus', showStatus);

    context.subscriptions.push(toggleCmd, checkCmd, statusCmd, statusBar);

    // 监听文本变化（AI 生成代码）
    const textChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (!interceptorEnabled) return;

        // 检查是否是 AI Agent 的修改
        const isAIAgent = await detectAIAgent(event);
        if (!isAIAgent) return;

        // 获取修改的内容
        const changes = event.contentChanges;
        if (changes.length === 0) return;

        // 检测风险
        const content = changes.map(c => c.text).join('\n');
        await analyzeAndIntercept(content, event.document.fileName);
    });

    context.subscriptions.push(textChangeListener);

    // 监听文件保存
    const saveListener = vscode.workspace.onWillSaveTextDocument(async (event) => {
        if (!interceptorEnabled) return;

        const content = event.document.getText();
        await analyzeAndIntercept(content, event.document.fileName);
    });

    context.subscriptions.push(saveListener);

    // 监听终端命令
    const terminalListener = vscode.window.onDidOpenTerminal((terminal) => {
        // 监听终端输入
        // 注意：VS Code API 不直接支持监听终端输入，需要其他方式
    });

    context.subscriptions.push(terminalListener);

    // 显示激活通知
    vscode.window.showInformationMessage('✓ 一鉴到底 AI 安全拦截器已启动');
}

/**
 * 检测是否是 AI Agent 的操作
 */
async function detectAIAgent(event: vscode.TextDocumentChangeEvent): Promise<boolean> {
    const config = getConfig();
    
    // 检查文档来源
    const document = event.document;
    
    // 方法 1: 检查文档 URI
    const uriString = document.uri.toString();
    if (uriString.includes('cursor') || 
        uriString.includes('copilot') || 
        uriString.includes('trae')) {
        return true;
    }
    
    // 方法 2: 检查变更特征（大量新增文本通常来自 AI）
    const changes = event.contentChanges;
    if (changes.length > 0) {
        const totalAdded = changes.reduce((sum, c) => sum + c.text.length, 0);
        const totalDeleted = changes.reduce((sum, c) => sum + c.rangeLength, 0);
        
        // 如果一次新增超过 100 字符，可能是 AI 生成
        if (totalAdded > 100 && totalDeleted < 50) {
            return true;
        }
    }
    
    return false;
}

/**
 * 分析内容并拦截风险操作
 */
async function analyzeAndIntercept(content: string, fileName: string): Promise<void> {
    const config = getConfig();
    
    try {
        // 调用一鉴到底 API
        const response = await axios.post(`${config.apiEndpoint}/api/v1/skills/code-detector/analyze`, {
            code: content,
            file_path: fileName
        }, {
            timeout: 5000
        });

        const result: AnalysisResult = response.data.result || response.data;

        if (!result.success) {
            return;
        }

        // 根据风险等级处理
        if (result.risk_level === 'critical' && config.autoBlock) {
            // 严重风险 - 自动拦截
            await showBlockNotification(result, fileName);
        } else if (result.risk_level === 'high') {
            // 高风险 - 询问用户
            await showAskUserDialog(result, fileName);
        } else if (result.risk_level === 'medium' && config.showNotification) {
            // 中风险 - 显示警告
            showWarningNotification(result, fileName);
        }

    } catch (error: any) {
        console.error('分析失败:', error);
        
        // 如果 API 不可用，使用本地规则检测
        const localResult = await localAnalyze(content, fileName);
        if (localResult.risk_level !== 'low') {
            await showBlockNotification(localResult, fileName);
        }
    }
}

/**
 * 本地规则分析（当 API 不可用时）
 */
async function localAnalyze(content: string, fileName: string): Promise<AnalysisResult> {
    const riskTags: string[] = [];
    let riskScore = 0;

    // 检测硬编码密钥
    const secretPatterns = [
        /sk-[a-zA-Z0-9]{20,}/g,
        /sk-proj-[a-zA-Z0-9]{20,}/g,
        /trae_[a-zA-Z0-9]{32}/g,
        /api[_-]?key\s*=\s*["'][^"']{20,}["']/g,
    ];

    for (const pattern of secretPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            riskTags.push(`硬编码密钥 (${matches.length} 个)`);
            riskScore += 50 * matches.length;
        }
    }

    // 检测危险函数
    const dangerousFunctions = ['eval', 'exec', 'os.system', 'subprocess.call'];
    for (const func of dangerousFunctions) {
        if (content.includes(func)) {
            riskTags.push(`危险函数: ${func}`);
            riskScore += 20;
        }
    }

    // 检测敏感文件
    const sensitiveFiles = ['.env', 'config.py', 'settings.py', '.pem', '.key'];
    for (const file of sensitiveFiles) {
        if (fileName.includes(file)) {
            riskTags.push('敏感文件');
            riskScore += 30;
            break;
        }
    }

    return {
        success: true,
        risk_level: riskScore >= 80 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low',
        risk_score: Math.min(riskScore, 100),
        risk_tags: riskTags,
        decision: riskScore >= 80 ? 'block' : riskScore >= 50 ? 'ask_user' : 'allow',
        recommendation: riskTags.length > 0 ? `检测到风险: ${riskTags.join(', ')}` : '无风险'
    };
}

/**
 * 显示拦截通知
 */
async function showBlockNotification(result: AnalysisResult, fileName: string): Promise<void> {
    const action = await vscode.window.showErrorMessage(
        `🚫 一鉴到底拦截了风险操作\n\n文件: ${fileName}\n风险: ${result.risk_level} (${result.risk_score} 分)\n原因: ${result.risk_tags.join(', ')}\n\n${result.recommendation}`,
        '查看详情',
        '强制放行',
        '忽略'
    );

    if (action === '查看详情') {
        // 打开审计详情
        vscode.commands.executeCommand('yijiandaodi.showStatus');
    } else if (action === '强制放行') {
        // 记录用户决策
        recordDecision(fileName, 'force_allow', result);
    }
}

/**
 * 显示询问用户对话框
 */
async function showAskUserDialog(result: AnalysisResult, fileName: string): Promise<void> {
    const action = await vscode.window.showWarningMessage(
        `⚠️ 一鉴到底检测到风险操作\n\n文件: ${fileName}\n风险: ${result.risk_level}\n原因: ${result.risk_tags.join(', ')}`,
        '拦截',
        '放行',
        '忽略'
    );

    if (action === '拦截') {
        recordDecision(fileName, 'block', result);
        vscode.window.showInformationMessage('已拦截该操作');
    } else if (action === '放行') {
        recordDecision(fileName, 'allow', result);
        vscode.window.showInformationMessage('已放行该操作');
    }
}

/**
 * 显示警告通知
 */
function showWarningNotification(result: AnalysisResult, fileName: string): void {
    vscode.window.showWarningMessage(
        `⚠️ 一鉴到底警告: ${fileName} 存在风险 (${result.risk_tags.join(', ')})`
    );
}

/**
 * 记录用户决策
 */
async function recordDecision(fileName: string, decision: string, result: AnalysisResult): Promise<void> {
    const config = getConfig();
    
    try {
        await axios.post(`${config.apiEndpoint}/api/v1/sandbox/logs`, {
            file_name: fileName,
            decision: decision,
            risk_level: result.risk_level,
            risk_score: result.risk_score,
            risk_tags: result.risk_tags
        });
    } catch (error) {
        console.error('记录决策失败:', error);
    }
}

/**
 * 切换拦截器
 */
function toggleInterceptor(): void {
    interceptorEnabled = !interceptorEnabled;
    
    if (interceptorEnabled) {
        statusBar.text = '$(shield) 一鉴到底';
        statusBar.tooltip = '一鉴到底 - AI 安全拦截器 (运行中)';
        vscode.window.showInformationMessage('✓ 一鉴到底拦截器已开启');
    } else {
        statusBar.text = '$(shield-off) 一鉴到底';
        statusBar.tooltip = '一鉴到底 - AI 安全拦截器 (已暂停)';
        vscode.window.showWarningMessage('⚠️ 一鉴到底拦截器已暂停');
    }
}

/**
 * 检测当前文件
 */
async function checkCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('没有打开的文件');
        return;
    }

    const content = editor.document.getText();
    const fileName = editor.document.fileName;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "一鉴到底正在检测...",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 50 });
        
        await analyzeAndIntercept(content, fileName);
        
        progress.report({ increment: 100 });
        
        return true;
    });
}

/**
 * 显示状态
 */
function showStatus(): void {
    const config = getConfig();
    
    const panel = vscode.window.createWebviewPanel(
        'yijiandaodiStatus',
        '一鉴到底 - 状态',
        vscode.ViewColumn.One,
        {}
    );

    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>一鉴到底 - 状态</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
                background: #1e1e1e;
                color: #cccccc;
            }
            .status-card {
                background: #252526;
                border: 1px solid #454545;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            .status-title {
                font-size: 18px;
                font-weight: 600;
            }
            .status-badge {
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
            }
            .status-running {
                background: #3fb95020;
                color: #3fb950;
            }
            .status-stopped {
                background: #f8514920;
                color: #f85149;
            }
            .config-item {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #333;
            }
            .config-label {
                color: #8b8b8b;
            }
            .config-value {
                font-weight: 500;
            }
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 10px;
            }
            .btn-primary {
                background: #0078d4;
                color: white;
            }
            .btn-secondary {
                background: #333;
                color: #cccccc;
            }
        </style>
    </head>
    <body>
        <div class="status-card">
            <div class="status-header">
                <div class="status-title">拦截器状态</div>
                <span class="status-badge ${interceptorEnabled ? 'status-running' : 'status-stopped'}">
                    ${interceptorEnabled ? '运行中' : '已暂停'}
                </span>
            </div>
            <div class="config-item">
                <span class="config-label">API 端点</span>
                <span class="config-value">${config.apiEndpoint}</span>
            </div>
            <div class="config-item">
                <span class="config-label">自动拦截</span>
                <span class="config-value">${config.autoBlock ? '开启' : '关闭'}</span>
            </div>
            <div class="config-item">
                <span class="config-label">监控 Agent</span>
                <span class="config-value">${config.agents.join(', ')}</span>
            </div>
            <div class="config-item">
                <span class="config-label">显示通知</span>
                <span class="config-value">${config.showNotification ? '开启' : '关闭'}</span>
            </div>
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="toggle()">开启/关闭拦截器</button>
                <button class="btn btn-secondary" onclick="check()">检测当前文件</button>
            </div>
        </div>
        <div class="status-card">
            <div class="status-header">
                <div class="status-title">风险规则</div>
            </div>
            <ul>
                <li>硬编码密钥检测 (OpenAI, Trae CN, 等 20+ 平台)</li>
                <li>敏感文件监控 (.env, config.py, 等)</li>
                <li>危险函数检测 (eval, exec, os.system)</li>
                <li>生产环境配置修改告警</li>
            </ul>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            function toggle() {
                vscode.postMessage({ command: 'toggle' });
            }
            function check() {
                vscode.postMessage({ command: 'check' });
            }
        </script>
    </body>
    </html>
    `;

    // 处理消息
    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message.command === 'toggle') {
                toggleInterceptor();
            } else if (message.command === 'check') {
                checkCurrentFile();
            }
        },
        undefined,
        []
    );
}

/**
 * 获取配置
 */
function getConfig(): InterceptorConfig {
    const config = vscode.workspace.getConfiguration('yijiandaodi');
    
    return {
        apiEndpoint: config.get('apiEndpoint', 'http://localhost:9092'),
        autoBlock: config.get('autoBlock', true),
        showNotification: config.get('showNotification', true),
        agents: config.get('agents', ['cursor', 'copilot', 'trae', 'claude', 'chatgpt'])
    };
}

/**
 * 插件停用
 */
export function deactivate() {
    console.log('一鉴到底 - AI 安全拦截器已停用');
    if (statusBar) {
        statusBar.dispose();
    }
}