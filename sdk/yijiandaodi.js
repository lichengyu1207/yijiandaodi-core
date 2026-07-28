/**
 * 一鉴到底 SDK - JavaScript 版本
 * 用于在 AI Agent 中集成安全校验能力
 */

class YiJianDaoDiSDK {
  /**
   * 初始化 SDK
   * @param {string} apiUrl - API 地址，默认 localhost:9090
   */
  constructor(apiUrl = 'http://localhost:9090') {
    this.apiUrl = apiUrl;
    this.verifyEndpoint = `${apiUrl}/verify`;
    this.healthEndpoint = `${apiUrl}/health`;
  }

  /**
   * 校验操作是否安全
   * @param {Object} options - 校验参数
   * @param {string} options.operation - 操作内容
   * @param {string} [options.context=''] - 上下文
   * @param {string} [options.agent='Unknown AI Agent'] - Agent 名称
   * @param {string} [options.userId='default'] - 用户标识
   * @returns {Promise<Object>} 校验结果
   */
  async verify({ operation, context = '', agent = 'Unknown AI Agent', userId = 'default' }) {
    const payload = { operation, context, agent, user_id: userId };

    try {
      const response = await fetch(this.verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error.message,
        risk_level: 'unknown',
        should_block: false
      };
    }
  }

  /**
   * 检查 API 服务是否健康
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await fetch(this.healthEndpoint);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 执行前钩子
   * @param {string} operation - 操作内容
   * @param {string} [context=''] - 上下文
   * @param {string} [agent=''] - Agent 名称
   * @returns {Promise<boolean>} true 表示可执行，false 表示应拦截
   */
  async beforeExecute(operation, context = '', agent = '') {
    const result = await this.verify({ operation, context, agent });

    if (result.success && result.should_block) {
      console.log('\n⚠️  一鉴到底巡检提醒');
      console.log(`操作: ${operation}`);
      console.log(`风险等级: ${result.risk_level}`);
      console.log(`原因: ${result.explanation}`);
      console.log(`建议: ${result.recommendation}`);
      return false;
    }

    return true;
  }
}

/**
 * 快捷校验函数
 * @param {string} operation - 操作内容
 * @param {string} [context=''] - 上下文
 * @param {string} [agent=''] - Agent 名称
 * @returns {Promise<Object>} 校验结果
 */
async function verifyOperation(operation, context = '', agent = '') {
  const sdk = new YiJianDaoDiSDK();
  return sdk.verify({ operation, context, agent });
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YiJianDaoDiSDK, verifyOperation };
}

// 示例用法
/*
const sdk = new YiJianDaoDiSDK();

// 示例 1: 在 AI Agent 执行前校验
async function runAI() {
  const canExecute = await sdk.beforeExecute(
    'git push origin main',
    '推送代码到生产环境',
    'Cursor AI'
  );
  
  if (!canExecute) {
    console.log('操作被拦截');
    return;
  }
  
  // 执行 git push
  console.log('执行 git push...');
}

// 示例 2: 直接获取校验结果
async function check() {
  const result = await sdk.verify({
    operation: 'npm install',
    context: '安装依赖包',
    agent: 'Claude Code'
  });
  
  console.log(result);
}

runAI();
*/