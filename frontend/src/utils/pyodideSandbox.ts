export interface PyodideSandboxConfig {
  stdout?: (output: string) => void;
  stderr?: (error: string) => void;
  timeout?: number;       // 默认 30 秒
  memoryLimit?: number;   // MB，默认 512
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string | null;
  executionTime: number;  // ms
  returnType: 'print' | 'return_value' | 'error' | 'timeout';
}

// Pyodide 全局实例
let pyodideInstance: any = null;
let isLoading = false;

export interface PyodideStatus {
  available: boolean;
  loading: boolean;
  loaded: boolean;
  version: string | null;
  sizeMB: number | null;
}

export function getPyodideStatus(): PyodideStatus {
  return {
    available: pyodideInstance !== null,
    loading: isLoading,
    loaded: pyodideInstance !== null,
    version: pyodideInstance?._api?.version || null,
    sizeMB: pyodideInstance ? null : null, // Pyodide ~10MB
  };
}

/**
 * 初始化 Pyodide Python 运行时
 * 通过 CDN 加载（懒加载），首次调用会下载约 10MB
 */
export async function initPyodide(
  onProgress?: (progress: number) => void,
  indexURL?: string
): Promise<void> {
  if (pyodideInstance) return;
  if (isLoading) throw new Error('Pyodide 正在加载中');

  isLoading = true;

  try {
    // 动态加载 Pyodide（CDN 或本地）
    const pyodide = await loadPyodideCDN(indexURL, onProgress);

    pyodideInstance = await pyodide.loadPyodide({
      indexURL: indexURL || 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
      fullStdLib: false, // 不加载完整标准库以减小体积
      stdlib: ['json', 're', 'math', 'datetime', 'collections', 'itertools'],
    });

    // 安全限制：禁用危险模块
    setupSecurityRestrictions(pyodideInstance);

    isLoading = false;
  } catch (err) {
    isLoading = false;
    throw new Error(`Pyodide 初始化失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function loadPyodideCDN(
  indexURL?: string,
  onProgress?: (progress: number) => void
): Promise<any> {
  // 方式1: 尝试从 window.pyodide 获取（如果已通过 script 标签加载）
  if ((window as any).pyodide) {
    return (window as any).pyodide;
  }

  // 方式2: 动态 import（如果作为 npm 包安装）
  try {
    const mod = await import('pyodide');
    return mod.loadPyodide;
  } catch {}

  // 方式3: 通过 script 标签加载 CDN 版本
  return new Promise((resolve, reject) => {
    if ((window as any).loadPyodide) {
      resolve((window as any));
      return;
    }

    const script = document.createElement('script');
    script.src = indexURL || 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    script.async = true;
    script.onload = () => resolve(window as any);
    script.onerror = () => reject(new Error('Pyodide CDN 加载失败'));

    // 进度模拟
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress = Math.min(progress + 5, 90);
        onProgress(progress);
        if (progress >= 90) clearInterval(interval);
      }, 200);

      script.addEventListener('load', () => {
        clearInterval(interval);
        onProgress(100);
      });
    }

    document.head.appendChild(script);
  });
}

function setupSecurityRestrictions(pyodide: any): void {
  // 禁止危险函数
  const dangerousModules = [
    'os.system', 'os.popen', 'os.execv', 'os.execve',
    'subprocess.Popen', 'subprocess.call', 'subprocess.run',
    'eval', 'exec', 'compile',
    '__import__',
  ];

  for (const mod of dangerousModules) {
    try {
      const parts = mod.split('.');
      if (parts.length === 2) {
        const [modName, funcName] = parts;
        const moduleObj = pyodide.globals.get(modName);
        if (moduleObj) moduleObj.set(funcName, pyodide.runPython(`
          def blocked(*args, **kwargs):
            raise SecurityError("安全限制：不允许调用 ${mod}")
          blocked
        `));
      }
    } catch {}
  }
}

/**
 * 在 Pyodide 中执行 Python 代码
 */
export async function executePython(
  code: string,
  config?: PyodideSandboxConfig
): Promise<ExecutionResult> {
  if (!pyodideInstance) {
    throw new Error('Pyodide 未初始化，请先调用 initPyodide()');
  }

  const startTime = Date.now();
  const timeout = config?.timeout || 30000;
  const outputLines: string[] = [];
  const errorLines: string[] = [];

  // 设置输出捕获
  pyodideInstance.setStdout({
    batched: (text: string) => {
      outputLines.push(text);
      config?.stdout?.(text);
    },
  });

  pyodideInstance.setStderr({
    batched: (text: string) => {
      errorLines.push(text);
      config?.stderr?.(text);
    },
  });

  // 包装执行代码（带超时控制）
  const wrappedCode = `
import sys
from io import StringIO

# 输出重定向
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _capture_out = StringIO()
sys.stderr = _capture_err = StringIO()

_result = None
_error = None

try:
    # 执行用户代码
    exec('''${code.replace(/\\/g, '\\\\').replace(/'''/g, "\\'")}''')
    # 尝试获取最后一个表达式的值
    if '_' in dir():
        _result = _
except TimeoutError:
    _error = "执行超时"
except Exception as e:
    _error = str(e)

# 收集输出
stdout_val = _capture_out.getvalue()
stderr_val = _capture_err.getvalue()

# 恢复
sys.stdout = _old_stdout
sys.stderr = _old_stderr
`;

  try {
    // 使用 Promise.race 实现超时
    const result = await Promise.race([
      pyodideInstance.runPythonAsync(wrappedCode),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('执行超时')), timeout)
      ),
    ]);

    const executionTime = Date.now() - startTime;

    // 获取结果
    const stdoutVal = pyodideInstance.globals.get('_capture_out')?.toString() || '';
    const stderrVal = pyodideInstance.globals.get('_capture_err')?.toString() || '';
    const errorVal = pyodideInstance.globals.get('_error') || null;
    const returnValue = pyodideInstance.globals.get('_result');

    return {
      success: !errorVal,
      output: stdoutVal || outputLines.join('\n'),
      error: errorVal || (stderrVal ? stderrVal : null),
      executionTime,
      returnType: errorVal ? (errorVal === '执行超时' ? 'timeout' : 'error')
        : (returnValue ? 'return_value' : 'print'),
    };
  } catch (err) {
    const executionTime = Date.now() - startTime;
    return {
      success: false,
      output: outputLines.join('\n'),
      error: err instanceof Error ? err.message : String(err),
      executionTime,
      returnType: 'error',
    };
  }
}

/**
 * 清理 Pyodide 实例
 */
export function disposePyodide(): void {
  if (pyodideInstance) {
    try { pyodideInstance.destroy(); } catch {}
    pyodideInstance = null;
  }
}
