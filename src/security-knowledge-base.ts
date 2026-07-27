/**
 * 可配置的安全知识库
 * 支持自定义规则、文件加载、URL 加载
 */

import { SecurityKnowledgeBaseConfig, CustomRule, RiskResult } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class SecurityKnowledgeBase {
  private config: SecurityKnowledgeBaseConfig;
  private rules: {
    sqli: string[];
    xss: string[];
    passwords: string[];
    apiKeys: string[];
    sensitive: string[];
    custom: CustomRule[];
  };

  constructor(config: SecurityKnowledgeBaseConfig = {}) {
    this.config = config;
    this.rules = {
      sqli: [],
      xss: [],
      passwords: [],
      apiKeys: [],
      sensitive: [],
      custom: []
    };
    
    this.initialize();
  }

  /**
   * 初始化知识库
   */
  private async initialize(): Promise<void> {
    // 1. 加载内置规则
    this.loadBuiltinRules();

    // 2. 加载用户自定义规则
    if (this.config.sqli) {
      this.rules.sqli.push(...this.config.sqli);
    }
    if (this.config.xss) {
      this.rules.xss.push(...this.config.xss);
    }
    if (this.config.passwords) {
      this.rules.passwords.push(...this.config.passwords);
    }
    if (this.config.apiKeys) {
      this.rules.apiKeys.push(...this.config.apiKeys);
    }
    if (this.config.sensitive) {
      this.rules.sensitive.push(...this.config.sensitive);
    }
    if (this.config.custom) {
      this.rules.custom.push(...this.config.custom);
    }

    // 3. 从文件加载
    if (this.config.loadFromFile) {
      await this.loadFromFile(this.config.loadFromFile);
    }

    // 4. 从 URL 加载
    if (this.config.loadFromUrl) {
      await this.loadFromUrl(this.config.loadFromUrl);
    }

    console.log('[安全知识库] 初始化完成');
    this.logStats();
  }

  /**
   * 加载内置规则
   */
  private loadBuiltinRules(): void {
    // API Key 模式
    this.rules.apiKeys = [
      'sk-',           // OpenAI
      'sk-proj-',      // OpenAI Project
      'AIza',          // Google
      'ghp_',          // GitHub Personal
      'gho_',          // GitHub OAuth
      'github_pat_',   // GitHub PAT
      'glpat-',        // GitLab
      'AKIA',          // AWS
      'ASIA',          // AWS
      'eyJ',           // JWT Token
    ];

    // 敏感关键词
    this.rules.sensitive = [
      'password', 'passwd', 'pwd', 'secret', 'api_key', 'apikey',
      'access_key', 'accesskey', 'secret_key', 'secretkey', 'token',
      'auth', 'credential', 'private_key', 'privatekey',
      '密码', '密钥', '凭证', '私钥', '令牌'
    ];
  }

  /**
   * 从文件加载规则
   */
  private async loadFromFile(files: NonNullable<SecurityKnowledgeBaseConfig['loadFromFile']>): Promise<void> {
    const loadFile = async (filePath: string): Promise<string[]> => {
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`[安全知识库] 文件不存在: ${filePath}`);
          return [];
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));

        console.log(`[安全知识库] 从文件加载 ${filePath}: ${lines.length} 条规则`);
        return lines;
      } catch (error) {
        console.error(`[安全知识库] 加载文件失败 ${filePath}:`, error);
        return [];
      }
    };

    if (files.sqli) {
      const rules = await loadFile(files.sqli);
      this.rules.sqli.push(...rules);
    }

    if (files.xss) {
      const rules = await loadFile(files.xss);
      this.rules.xss.push(...rules);
    }

    if (files.passwords) {
      const rules = await loadFile(files.passwords);
      this.rules.passwords.push(...rules);
    }

    if (files.sensitive) {
      const rules = await loadFile(files.sensitive);
      this.rules.sensitive.push(...rules);
    }
  }

  /**
   * 从 URL 加载规则
   */
  private async loadFromUrl(urls: NonNullable<SecurityKnowledgeBaseConfig['loadFromUrl']>): Promise<void> {
    const fetch = require('node-fetch');

    for (const [key, url] of Object.entries(urls)) {
      try {
        const response = await fetch(url);
        const content = await response.text();
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));

        // 根据键名决定加载到哪个规则集
        if (key === 'sqli') {
          this.rules.sqli.push(...lines);
        } else if (key === 'xss') {
          this.rules.xss.push(...lines);
        } else if (key === 'passwords') {
          this.rules.passwords.push(...lines);
        } else if (key === 'sensitive') {
          this.rules.sensitive.push(...lines);
        }

        console.log(`[安全知识库] 从 URL 加载 ${key}: ${lines.length} 条规则`);
      } catch (error) {
        console.error(`[安全知识库] 加载 URL 失败 ${url}:`, error);
      }
    }
  }

  /**
   * 检测内容
   */
  detect(content: string): RiskResult[] {
    const risks: RiskResult[] = [];

    // 1. 检测 API Key
    this.rules.apiKeys.forEach(pattern => {
      if (content.includes(pattern)) {
        risks.push({
          type: 'apikey',
          matched: pattern,
          risk: 'high',
          description: `检测到 API Key 模式: ${pattern}`
        });
      }
    });

    // 2. 检测敏感关键词
    this.rules.sensitive.forEach(keyword => {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(content)) {
        risks.push({
          type: 'sensitive',
          matched: keyword,
          risk: 'medium',
          description: `检测到敏感关键词: ${keyword}`
        });
      }
    });

    // 3. 检测 SQL 注入
    this.rules.sqli.forEach(pattern => {
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        risks.push({
          type: 'sqli',
          matched: pattern,
          risk: 'high',
          description: `检测到 SQL 注入模式: ${pattern}`
        });
      }
    });

    // 4. 检测 XSS
    this.rules.xss.forEach(pattern => {
      if (content.includes(pattern)) {
        risks.push({
          type: 'xss',
          matched: pattern,
          risk: 'high',
          description: `检测到 XSS 模式: ${pattern}`
        });
      }
    });

    // 5. 检测密码
    this.rules.passwords.forEach(password => {
      if (content.includes(password)) {
        risks.push({
          type: 'password',
          matched: password,
          risk: 'high',
          description: `检测到常见密码: ${password}`
        });
      }
    });

    // 6. 检测自定义规则
    this.rules.custom.forEach(rule => {
      rule.patterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(content)) {
          risks.push({
            type: 'custom',
            matched: pattern,
            risk: rule.risk_level,
            description: rule.description || `检测到自定义规则: ${rule.name}`
          });
        }
      });
    });

    return risks;
  }

  /**
   * 添加自定义规则
   */
  addCustomRule(rule: CustomRule): void {
    this.rules.custom.push(rule);
    console.log(`[安全知识库] 添加自定义规则: ${rule.name}`);
  }

  /**
   * 获取规则统计
   */
  getStats(): { [key: string]: number } {
    return {
      sqli: this.rules.sqli.length,
      xss: this.rules.xss.length,
      passwords: this.rules.passwords.length,
      apiKeys: this.rules.apiKeys.length,
      sensitive: this.rules.sensitive.length,
      custom: this.rules.custom.length,
      total: this.rules.sqli.length + this.rules.xss.length + 
             this.rules.passwords.length + this.rules.apiKeys.length + 
             this.rules.sensitive.length + this.rules.custom.length
    };
  }

  /**
   * 日志统计
   */
  private logStats(): void {
    const stats = this.getStats();
    console.log('[安全知识库] 规则统计:');
    console.log(`  - SQL 注入: ${stats.sqli} 条`);
    console.log(`  - XSS: ${stats.xss} 条`);
    console.log(`  - 密码: ${stats.passwords} 条`);
    console.log(`  - API Key: ${stats.apiKeys} 条`);
    console.log(`  - 敏感词: ${stats.sensitive} 条`);
    console.log(`  - 自定义: ${stats.custom} 条`);
    console.log(`  总计: ${stats.total} 条规则`);
  }

  /**
   * 导出规则（用于备份或分享）
   */
  exportRules(): SecurityKnowledgeBaseConfig {
    return {
      sqli: this.rules.sqli,
      xss: this.rules.xss,
      passwords: this.rules.passwords,
      apiKeys: this.rules.apiKeys,
      sensitive: this.rules.sensitive,
      custom: this.rules.custom
    };
  }

  /**
   * 重置规则
   */
  reset(): void {
    this.rules = {
      sqli: [],
      xss: [],
      passwords: [],
      apiKeys: [],
      sensitive: [],
      custom: []
    };
    this.loadBuiltinRules();
    console.log('[安全知识库] 规则已重置');
  }
}