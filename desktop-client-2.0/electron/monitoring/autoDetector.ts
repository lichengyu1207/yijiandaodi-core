/**
 * 自动化检测管理模块
 * 集成 code-detector + content-moderator skill，提供增强的安全检测能力
 */

import { SecurityKnowledgeBase, detectSecurityRisks } from '../securityKnowledgeBase'

// ============================================================================
// 类型定义
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ContentType = 'code' | 'text' | 'mixed'
export type Language = 'python' | 'javascript' | 'typescript' | 'bash' | 'html' | 'unknown'

export interface AutoDetectionResult {
  safe: boolean
  risk_level: RiskLevel
  content_type: ContentType
  detected_language?: Language
  warnings: string[]
  risks: Array<{
    type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive' | 'dangerous_pattern' | 'code_injection'
    matched: string
    risk: RiskLevel
    location?: string
  }>
  estimated_resources?: {
    memory_mb: number
    cpu_seconds: number
    disk_mb: number
  }
  sanitized_content?: string
  sensitivity_level?: 'public' | 'internal' | 'confidential'
}

export interface CodeAnalysisResult {
  safe: boolean
  risk_level: RiskLevel
  warnings: string[]
  estimated_resources: {
    memory_mb: number
    cpu_seconds: number
    disk_mb: number
  }
}

// ============================================================================
// 危险模式定义（来自 code-detector skill）
// ============================================================================

const DANGEROUS_PATTERNS = [
  { pattern: /import\s+os\.system/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '系统命令注入 (import os.system)' },
  { pattern: /import\s+subprocess/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '子进程逃逸 (import subprocess)' },
  { pattern: /eval\s*\(/g, type: 'code_injection', risk: 'high' as RiskLevel, desc: '动态代码执行 (eval)' },
  { pattern: /exec\s*\(/g, type: 'code_injection', risk: 'high' as RiskLevel, desc: '动态代码执行 (exec)' },
  { pattern: /__import__/g, type: 'code_injection', risk: 'high' as RiskLevel, desc: '动态导入 (__import__)' },
  { pattern: /open\s*\([\'"]\/etc/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '系统文件读取 (/etc)' },
  { pattern: /open\s*\([\'"]\/proc/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '进程信息泄露 (/proc)' },
  { pattern: /rm\s+-rf\s+\//g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '破坏性删除 (rm -rf /)' },
  { pattern: /chmod\s+777/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '权限提升 (chmod 777)' },
  { pattern: /\.env\s*[\'"]/g, type: 'dangerous_pattern', risk: 'high' as RiskLevel, desc: '敏感文件访问 (.env)' },
  { pattern: /socket\.socket/g, type: 'dangerous_pattern', risk: 'medium' as RiskLevel, desc: '网络连接 (socket)' },
]

// ============================================================================
// 敏感关键词定义（来自 content-moderator skill）
// ============================================================================

const SENSITIVITY_KEYWORDS = {
  confidential: [
    'password', 'passwd', 'secret', 'api_key', 'apikey', 'token',
    'private_key', 'credential', 'auth_token', 'access_token',
    'session_id', 'ssn', 'credit_card', 'card_number',
    'bank_account', '身份证', '密码', '秘钥', '银行卡', 'api_secret'
  ],
  internal: [
    'internal', '内部', 'employee', '员工', 'salary', '薪资',
    'org_chart', '组织架构', 'meeting', '会议记录',
    'deployment', '部署配置', 'infra', '基础设施'
  ]
}

// ============================================================================
// 自动检测器类
// ============================================================================

export class AutoDetector {
  private securityKB: SecurityKnowledgeBase | null = null

  constructor(securityKB?: SecurityKnowledgeBase) {
    this.securityKB = securityKB || null
  }

  /**
   * 设置安全知识库
   */
  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
  }

  /**
   * 综合检测入口
   */
  detect(content: string, options?: { language?: Language }): AutoDetectionResult {
    const result: AutoDetectionResult = {
      safe: true,
      risk_level: 'low',
      content_type: this.detectContentType(content),
      detected_language: options?.language || this.detectLanguage(content),
      warnings: [],
      risks: []
    }

    // 1. 代码安全检测（如果是代码内容）
    if (result.content_type === 'code' || result.content_type === 'mixed') {
      const codeAnalysis = this.analyzeCode(content, result.detected_language)
      result.warnings.push(...codeAnalysis.warnings)
      result.estimated_resources = codeAnalysis.estimated_resources

      // 如果代码检测发现高风险，更新结果
      if (codeAnalysis.risk_level === 'high' || codeAnalysis.risk_level === 'critical') {
        result.safe = false
        result.risk_level = codeAnalysis.risk_level
      }
    }

    // 2. 使用安全知识库检测（SQL注入、XSS、API Key等）
    if (this.securityKB) {
      const kbRisks = detectSecurityRisks(content, this.securityKB)
      for (const risk of kbRisks) {
        result.risks.push({
          type: risk.type,
          matched: risk.matched,
          risk: risk.risk
        })
      }

      // 如果发现高风险，更新结果
      const highRisks = kbRisks.filter(r => r.risk === 'high')
      if (highRisks.length > 0) {
        result.safe = false
        result.risk_level = 'high'
      }
    }

    // 3. 危险模式检测
    const dangerousPatternRisks = this.detectDangerousPatterns(content)
    result.risks.push(...dangerousPatternRisks)

    if (dangerousPatternRisks.some(r => r.risk === 'high')) {
      result.safe = false
      result.risk_level = 'high'
    }

    // 4. 敏感信息分级
    result.sensitivity_level = this.classifySensitivity(content)

    // 5. 内容净化（可选）
    if (options?.language === 'html' || result.content_type === 'text') {
      result.sanitized_content = this.sanitizeContent(content)
    }

    return result
  }

  /**
   * 代码分析（集成 code-detector 能力）
   */
  analyzeCode(code: string, language?: Language): CodeAnalysisResult {
    const result: CodeAnalysisResult = {
      safe: true,
      risk_level: 'low',
      warnings: [],
      estimated_resources: {
        memory_mb: 16,
        cpu_seconds: 5,
        disk_mb: 1
      }
    }

    // 语言白名单检查
    const allowedLanguages: Language[] = ['python', 'javascript', 'typescript', 'bash', 'html']
    if (language && !allowedLanguages.includes(language)) {
      result.safe = false
      result.risk_level = 'critical'
      result.warnings.push(`不支持的语言类型: ${language}`)
      return result
    }

    // 危险模式匹配
    const dangerousRisks = this.detectDangerousPatterns(code)
    for (const risk of dangerousRisks) {
      result.warnings.push(`${risk.type}: ${risk.matched}`)
      if (risk.risk === 'high') {
        result.safe = false
        result.risk_level = 'high'
      }
    }

    // 复杂度评估
    const lineCount = code.split('\n').length
    const importCount = (code.match(/^import\s+/gm) || []).length + (code.match(/^from\s+/gm) || []).length

    if (lineCount > 500) {
      result.warnings.push(`代码行数过多: ${lineCount} 行`)
      result.risk_level = result.risk_level === 'low' ? 'medium' : result.risk_level
    }

    if (importCount > 20) {
      result.warnings.push(`导入模块过多: ${importCount} 个`)
      result.risk_level = result.risk_level === 'low' ? 'medium' : result.risk_level
    }

    // 资源需求预估
    result.estimated_resources = {
      memory_mb: Math.min(512, Math.max(16, lineCount / 10)),
      cpu_seconds: Math.min(300, Math.max(5, lineCount / 50)),
      disk_mb: Math.min(256, Math.max(1, code.length / 1024))
    }

    return result
  }

  /**
   * 检测危险模式
   */
  private detectDangerousPatterns(content: string): AutoDetectionResult['risks'] {
    const risks: AutoDetectionResult['risks'] = []

    for (const { pattern, type, risk, desc } of DANGEROUS_PATTERNS) {
      const matches = content.match(pattern)
      if (matches) {
        for (const matched of matches) {
          risks.push({
            type,
            matched: desc,
            risk,
            location: `位置 ${content.indexOf(matched)}`
          })
        }
      }
    }

    return risks
  }

  /**
   * 内容净化（集成 content-moderator 能力）
   */
  private sanitizeContent(content: string): string {
    // 移除危险HTML标签
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select', 'meta', 'link', 'style', 'base', 'applet']
    let sanitized = content

    for (const tag of dangerousTags) {
      const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi')
      const closeTagRegex = new RegExp(`</${tag}>`, 'gi')
      sanitized = sanitized.replace(openTagRegex, '')
      sanitized = sanitized.replace(closeTagRegex, '')
    }

    // 移除事件处理器
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')

    // 清除控制字符
    sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')

    return sanitized.trim()
  }

  /**
   * 敏感信息分级（集成 content-moderator 能力）
   */
  private classifySensitivity(content: string): 'public' | 'internal' | 'confidential' {
    const lowerContent = content.toLowerCase()

    // 检查 confidential 级别关键词
    for (const keyword of SENSITIVITY_KEYWORDS.confidential) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return 'confidential'
      }
    }

    // 检查 internal 级别关键词
    for (const keyword of SENSITIVITY_KEYWORDS.internal) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return 'internal'
      }
    }

    return 'public'
  }

  /**
   * 检测内容类型
   */
  private detectContentType(content: string): ContentType {
    const codeIndicators = [
      /function\s*\(/,
      /const\s+\w+\s*=/,
      /import\s+\w+/,
      /class\s+\w+/,
      /def\s+\w+/,
      /print\s*\(/,
      /console\.log/,
      /<\?php/,
      /public\s+class/,
    ]

    const isCode = codeIndicators.some(pattern => pattern.test(content))

    if (isCode) {
      // 检查是否包含大量自然语言
      const wordCount = content.split(/\s+/).length
      const codeSymbolCount = (content.match(/[{}();=]/g) || []).length

      if (codeSymbolCount > wordCount * 0.1) {
        return 'code'
      }
      return 'mixed'
    }

    return 'text'
  }

  /**
   * 检测编程语言
   */
  private detectLanguage(content: string): Language {
    if (/def\s+\w+\s*\(/.test(content) || /import\s+\w+/.test(content)) {
      return 'python'
    }
    if (/const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+\s*\(/.test(content)) {
      return 'javascript'
    }
    if (/interface\s+\w+|type\s+\w+\s*=|:\s*\w+\[\]/.test(content)) {
      return 'typescript'
    }
    if (/^#\!\/bin\/bash|^#!/.test(content) || /\b(ifeq|endif|define)\b/.test(content)) {
      return 'bash'
    }
    if (/<[a-z]+[^>]*>/i.test(content)) {
      return 'html'
    }
    return 'unknown'
  }
}

// 导出单例实例
export const autoDetector = new AutoDetector()