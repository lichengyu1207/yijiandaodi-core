/**
 * 优化的安全知识库
 * 使用 Trie 树和正则表达式缓存提升性能
 */

import { SecurityKnowledgeBaseConfig, CustomRule, RiskResult } from './types';
import * as fs from 'fs';

/**
 * Trie 树节点
 */
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
  risk: 'high' | 'medium' | 'low' = 'medium';
}

/**
 * 优化的安全知识库
 * - 使用 Trie 树快速匹配前缀（如 API Key）
 * - 使用正则表达式缓存
 * - 批量检测优化
 */
export class OptimizedSecurityKnowledgeBase {
  private config: SecurityKnowledgeBaseConfig;
  private trieRoot: TrieNode;
  private regexCache: Map<string, RegExp> = new Map();
  private customRules: CustomRule[] = [];

  constructor(config: SecurityKnowledgeBaseConfig = {}) {
    this.config = config;
    this.trieRoot = new TrieNode();
    this.initialize();
  }

  /**
   * 初始化知识库
   */
  private async initialize(): Promise<void> {
    // 1. 加载内置规则
    this.loadBuiltinRules();

    // 2. 构建索引
    this.buildIndexes();

    // 3. 加载用户自定义规则
    if (this.config.custom) {
      this.customRules = this.config.custom;
      this.buildCustomRuleCache();
    }

    console.log('[优化知识库] 初始化完成');
  }

  /**
   * 加载内置规则
   */
  private loadBuiltinRules(): void {
    // API Key 前缀（使用 Trie 树）
    const apiKeyPrefixes = [
      'sk-', 'sk-proj-', 'AIza', 'ghp_', 'gho_', 
      'github_pat_', 'glpat-', 'AKIA', 'ASIA', 'eyJ'
    ];

    apiKeyPrefixes.forEach(prefix => {
      this.insertToTrie(prefix, 'high');
    });

    // 添加配置中的规则
    if (this.config.apiKeys) {
      this.config.apiKeys.forEach(key => {
        this.insertToTrie(key, 'high');
      });
    }

    if (this.config.sensitive) {
      this.config.sensitive.forEach(keyword => {
        this.insertToTrie(keyword, 'medium');
      });
    }
  }

  /**
   * 构建索引
   */
  private buildIndexes(): void {
    // 预编译正则表达式
    const sensitiveKeywords = [
      'password', 'passwd', 'pwd', 'secret', 'api_key', 'apikey',
      'access_key', 'accesskey', 'secret_key', 'secretkey', 'token',
      'auth', 'credential', 'private_key', 'privatekey',
      '密码', '密钥', '凭证', '私钥', '令牌'
    ];

    sensitiveKeywords.forEach(keyword => {
      this.regexCache.set(`sensitive_${keyword}`, new RegExp(keyword, 'i'));
    });
  }

  /**
   * 构建自定义规则缓存
   */
  private buildCustomRuleCache(): void {
    this.customRules.forEach((rule, index) => {
      rule.patterns.forEach((pattern, pIndex) => {
        this.regexCache.set(
          `custom_${index}_${pIndex}`,
          new RegExp(pattern, 'gi')
        );
      });
    });
  }

  /**
   * 插入到 Trie 树
   */
  private insertToTrie(word: string, risk: 'high' | 'medium' | 'low'): void {
    let node = this.trieRoot;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    node.risk = risk;
  }

  /**
   * Trie 树搜索（快速前缀匹配）
   */
  private searchTrie(text: string): { matched: string; risk: 'high' | 'medium' | 'low' }[] {
    const results: { matched: string; risk: 'high' | 'medium' | 'low' }[] = [];

    // 从每个位置开始搜索
    for (let i = 0; i < text.length; i++) {
      let node = this.trieRoot;
      let matched = '';

      for (let j = i; j < text.length; j++) {
        const char = text[j];
        if (!node.children.has(char)) {
          break;
        }
        matched += char;
        node = node.children.get(char)!;

        if (node.isEnd) {
          results.push({ matched, risk: node.risk });
        }
      }
    }

    return results;
  }

  /**
   * 优化的检测方法
   */
  detect(content: string): RiskResult[] {
    const risks: RiskResult[] = [];

    // 1. Trie 树快速前缀匹配
    const trieResults = this.searchTrie(content);
    trieResults.forEach(result => {
      risks.push({
        type: 'apikey',
        matched: result.matched,
        risk: result.risk,
        description: `检测到敏感模式: ${result.matched}`
      });
    });

    // 2. 使用缓存的正则表达式（敏感关键词）
    this.regexCache.forEach((regex, key) => {
      if (key.startsWith('sensitive_') && regex.test(content)) {
        const keyword = key.replace('sensitive_', '');
        risks.push({
          type: 'sensitive',
          matched: keyword,
          risk: 'medium',
          description: `检测到敏感关键词: ${keyword}`
        });
      }
    });

    // 3. 自定义规则检测（使用缓存）
    this.customRules.forEach((rule, ruleIndex) => {
      rule.patterns.forEach((pattern, patternIndex) => {
        const regex = this.regexCache.get(`custom_${ruleIndex}_${patternIndex}`);
        if (regex && regex.test(content)) {
          risks.push({
            type: 'custom',
            matched: pattern,
            risk: rule.risk_level,
            description: rule.description || `检测到自定义规则: ${rule.name}`
          });
        }
      });
    });

    return this.removeDuplicates(risks);
  }

  /**
   * 移除重复结果
   */
  private removeDuplicates(risks: RiskResult[]): RiskResult[] {
    const seen = new Set<string>();
    return risks.filter(risk => {
      const key = `${risk.type}_${risk.matched}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 批量检测（优化性能）
   */
  detectBatch(contents: string[]): RiskResult[][] {
    return contents.map(content => this.detect(content));
  }

  /**
   * 添加自定义规则
   */
  addCustomRule(rule: CustomRule): void {
    this.customRules.push(rule);
    
    // 更新缓存
    const ruleIndex = this.customRules.length - 1;
    rule.patterns.forEach((pattern, pIndex) => {
      this.regexCache.set(
        `custom_${ruleIndex}_${pIndex}`,
        new RegExp(pattern, 'gi')
      );
    });

    console.log(`[优化知识库] 添加自定义规则: ${rule.name}`);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): { [key: string]: any } {
    return {
      trieNodes: this.countTrieNodes(this.trieRoot),
      regexCacheSize: this.regexCache.size,
      customRules: this.customRules.length
    };
  }

  /**
   * 统计 Trie 树节点数
   */
  private countTrieNodes(node: TrieNode): number {
    let count = 1;
    node.children.forEach(child => {
      count += this.countTrieNodes(child);
    });
    return count;
  }
}