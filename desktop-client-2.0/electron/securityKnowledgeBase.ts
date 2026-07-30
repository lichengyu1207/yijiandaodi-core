/**
 * 安全知识库集成模块
 * 从AboutSecurity项目中提取的安全字典和Payload
 */

import * as fs from 'fs';
import * as path from 'path';

// 安全知识库配置
export interface SecurityKnowledgeBase {
  sqli: string[];        // SQL注入Payload
  xss: string[];         // XSS Payload
  passwords: string[];   // 常见密码字典
  apiKeys: string[];     // API Key模式
  sensitive: string[];   // 敏感关键词
}

// 知识库路径配置
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../../security-knowledge-base/AboutSecurity-master');

/**
 * 加载字典文件
 */
function loadDictionary(filePath: string): string[] {
  try {
    const fullPath = path.join(KNOWLEDGE_BASE_PATH, filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[安全知识库] 文件不存在: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    
    console.log(`[安全知识库] 加载 ${filePath}: ${lines.length} 条`);
    return lines;
  } catch (error) {
    console.error(`[安全知识库] 加载失败 ${filePath}:`, error);
    return [];
  }
}

/**
 * 初始化安全知识库
 */
export function initSecurityKnowledgeBase(): SecurityKnowledgeBase {
  console.log('[安全知识库] 开始加载...');
  
  const knowledgeBase: SecurityKnowledgeBase = {
    // SQL注入Payload（来自AboutSecurity）
    sqli: loadDictionary('Payload/sqli/payload.txt'),
    
    // XSS Payload（JavaScript事件）
    xss: loadDictionary('Payload/xss/js-event.txt'),
    
    // 常见密码字典
    passwords: loadDictionary('Dic/auth/password/pass-admin.txt'),
    
    // API Key模式（自定义）
    apiKeys: [
      'sk-',                    // OpenAI API Key
      'sk-proj-',               // OpenAI Project Key
      'AIza',                   // Google API Key
      'ghp_',                   // GitHub Personal Access Token
      'gho_',                   // GitHub OAuth Token
      'github_pat_',            // GitHub Fine-grained Token
      'glpat-',                 // GitLab Personal Access Token
      'AKIA',                   // AWS Access Key ID
      'ASIA',                   // AWS Session Token
      'eyJ',                    // JWT Token
    ],
    
    // 敏感关键词（自定义 + AboutSecurity）
    sensitive: [
      'password',
      'passwd',
      'pwd',
      'secret',
      'api_key',
      'apikey',
      'access_key',
      'accesskey',
      'secret_key',
      'secretkey',
      'token',
      'auth',
      'credential',
      'private_key',
      'privatekey',
      // 数据库连接
      'database',
      'db_password',
      'db_user',
      'mysql',
      'postgresql',
      'mongodb',
      // 云服务
      'aws_access_key',
      'aws_secret_key',
      'azure_key',
      'gcp_key',
    ]
  };
  
  // 合并SQL注入关键词
  const sqliKeywords = [
    'select', 'insert', 'update', 'delete', 'drop', 'union',
    'or 1=1', 'or \'1\'=\'1\'', '--', '/*', '*/',
    'xp_cmdshell', 'exec', 'execute',
  ];
  knowledgeBase.sensitive.push(...sqliKeywords);
  
  console.log('[安全知识库] 加载完成！');
  console.log(`  - SQL注入Payload: ${knowledgeBase.sqli.length} 条`);
  console.log(`  - XSS Payload: ${knowledgeBase.xss.length} 条`);
  console.log(`  - 密码字典: ${knowledgeBase.passwords.length} 条`);
  console.log(`  - API Key模式: ${knowledgeBase.apiKeys.length} 条`);
  console.log(`  - 敏感关键词: ${knowledgeBase.sensitive.length} 条`);
  
  return knowledgeBase;
}

/**
 * 检测文本中的安全风险
 */
export function detectSecurityRisks(
  text: string,
  knowledgeBase: SecurityKnowledgeBase
): {
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
  matched: string;
  risk: 'high' | 'medium' | 'low';
}[] {
  const risks: Array<{
    type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
    matched: string;
    risk: 'high' | 'medium' | 'low';
  }> = [];
  
  const lowerText = text.toLowerCase();
  
  // 检测SQL注入
  for (const pattern of knowledgeBase.sqli) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({
        type: 'sqli',
        matched: pattern,
        risk: 'high'
      });
    }
  }
  
  // 检测XSS
  for (const pattern of knowledgeBase.xss) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({
        type: 'xss',
        matched: pattern,
        risk: 'high'
      });
    }
  }
  
  // 检测API Key
  for (const pattern of knowledgeBase.apiKeys) {
    if (text.includes(pattern)) {
      risks.push({
        type: 'apikey',
        matched: pattern,
        risk: 'high'
      });
    }
  }
  
  // 检测密码
  for (const pattern of knowledgeBase.passwords) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({
        type: 'password',
        matched: pattern,
        risk: 'medium'
      });
    }
  }
  
  // 检测敏感关键词
  for (const pattern of knowledgeBase.sensitive) {
    if (lowerText.includes(pattern.toLowerCase())) {
      risks.push({
        type: 'sensitive',
        matched: pattern,
        risk: 'medium'
      });
    }
  }
  
  return risks;
}