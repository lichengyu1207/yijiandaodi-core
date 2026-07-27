/**
 * 安全知识库
 * 提供SQL注入、XSS、密码、API Key等敏感信息检测
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SecurityKnowledgeBase {
  sqli: string[];        // SQL注入Payload
  xss: string[];         // XSS Payload
  passwords: string[];   // 常见密码字典
  apiKeys: string[];     // API Key模式
  sensitive: string[];   // 敏感关键词
}

/**
 * 加载字典文件（如果存在）
 */
function loadDictionary(basePath: string, filePath: string): string[] {
  try {
    const fullPath = path.join(basePath, filePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));

    return lines;
  } catch (error) {
    return [];
  }
}

/**
 * 初始化安全知识库
 * @param customPath 自定义知识库路径（可选）
 */
export function initSecurityKnowledgeBase(customPath?: string): SecurityKnowledgeBase {
  const knowledgeBase: SecurityKnowledgeBase = {
    // SQL注入Payload
    sqli: customPath ? loadDictionary(customPath, 'Payload/sqli/payload.txt') : [],

    // XSS Payload
    xss: customPath ? loadDictionary(customPath, 'Payload/xss/js-event.txt') : [],

    // 常见密码字典
    passwords: customPath ? loadDictionary(customPath, 'Dic/auth/password/pass-admin.txt') : [],

    // API Key模式
    apiKeys: [
      'sk-',                    // OpenAI
      'sk-proj-',               // OpenAI Project
      'AIza',                   // Google
      'ghp_',                   // GitHub Personal Token
      'gho_',                   // GitHub OAuth
      'github_pat_',            // GitHub Fine-grained
      'glpat-',                 // GitLab
      'AKIA',                   // AWS Access Key
      'ASIA',                   // AWS Session
      'eyJ',                    // JWT
    ],

    // 敏感关键词
    sensitive: [
      'password', 'passwd', 'pwd', 'secret',
      'api_key', 'apikey', 'access_key', 'accesskey',
      'secret_key', 'secretkey', 'token', 'auth',
      'credential', 'private_key', 'privatekey',
      'database', 'db_password', 'db_user',
      'mysql', 'postgresql', 'mongodb',
      'aws_access_key', 'aws_secret_key',
      'azure_key', 'gcp_key',
      // SQL注入关键词
      'select', 'insert', 'update', 'delete', 'drop',
      'union', 'or 1=1', '--', '/*', '*/',
      'xp_cmdshell', 'exec', 'execute',
    ]
  };

  console.log('[安全知识库] 初始化完成');
  console.log(`  - SQL注入: ${knowledgeBase.sqli.length} 条`);
  console.log(`  - XSS: ${knowledgeBase.xss.length} 条`);
  console.log(`  - 密码: ${knowledgeBase.passwords.length} 条`);
  console.log(`  - API Key: ${knowledgeBase.apiKeys.length} 条`);
  console.log(`  - 敏感词: ${knowledgeBase.sensitive.length} 条`);

  return knowledgeBase;
}

/**
 * 检测文本中的安全风险
 */
export function detectSecurityRisks(
  text: string,
  knowledgeBase: SecurityKnowledgeBase
): Array<{
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
  matched: string;
  risk: 'high' | 'medium' | 'low';
}> {
  const risks: Array<{
    type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
    matched: string;
    risk: 'high' | 'medium' | 'low';
  }> = [];

  const lowerText = text.toLowerCase();

  // 检测SQL注入
  for (const pattern of knowledgeBase.sqli) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({ type: 'sqli', matched: pattern, risk: 'high' });
    }
  }

  // 检测XSS
  for (const pattern of knowledgeBase.xss) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({ type: 'xss', matched: pattern, risk: 'high' });
    }
  }

  // 检测API Key
  for (const pattern of knowledgeBase.apiKeys) {
    if (text.includes(pattern)) {
      risks.push({ type: 'apikey', matched: pattern, risk: 'high' });
    }
  }

  // 检测密码
  for (const pattern of knowledgeBase.passwords) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({ type: 'password', matched: pattern, risk: 'medium' });
    }
  }

  // 检测敏感关键词
  for (const pattern of knowledgeBase.sensitive) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({ type: 'sensitive', matched: pattern, risk: 'medium' });
    }
  }

  return risks;
}