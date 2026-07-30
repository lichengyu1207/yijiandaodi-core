export interface InputGuardResult {
  passed: boolean;
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  blocked: boolean;
  sanitized?: string;
  riskScore: number;
}

export interface InputGuardConfig {
  maxLength?: number;
  enablePromptInjection?: boolean;
  enableSensitiveWords?: boolean;
  enableMaliciousCmd?: boolean;
  customSensitiveWords?: string[];
}

const PROMPT_INJECTION_PATTERNS = [
  /忽略(?:以上|之前|所有)(?:的)?(?:指令|规则|要求|提示|prompt)/gi,
  /你(?:现在|从此|不再)是/i,
  /(?:system|系统)(?:指令|提示|消息)/i,
  /(?:override|覆盖|绕过|bypass|ignore)/gi,
  /(?:JAILBREAK|DAN|Developer Mode|EVIL MODE)/gi,
  /<script[^>]*>.*?<\/script>/gis,
];

const MALICIOUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,
  /(?:format|格式化)\s+[a-z]:\\/i,
  /(?:del|delete)\s+\/[sfq]/i,
  /curl.*\|\s*(?:bash|sh|python|perl)/i,
  /wget.*\|\s*(?:bash|sh)/i,
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/sd/i,
  /:(){ :|:& };:/i,
  /chmod\s+(?:777|4777)/i,
  /chown\s+.*root/i,
  /\/etc\/(passwd|shadow)/i,
];

const SENSITIVE_WORD_CATEGORIES = {
  political: ['敏感政治词1', '敏感政治词2'],
  violent: ['暴力', '杀', '炸', '恐吓'],
  porn: ['色情', '成人', '淫秽'],
  illegal: ['赌博', '毒品', '洗钱'],
};

export function guardInput(input: string, config?: InputGuardConfig): InputGuardResult {
  const cfg = { maxLength: 50000, enablePromptInjection: true, enableSensitiveWords: true, enableMaliciousCmd: true, ...config };
  const warnings: string[] = [];
  let riskScore = 0;
  let blocked = false;
  let level: InputGuardResult['level'] = 'safe';

  if (input.length > cfg.maxLength) {
    blocked = true;
    level = 'critical';
    riskScore += 40;
    warnings.push(`输入内容超长（${input.length}/${cfg.maxLength}字符）`);
  }

  if (cfg.enablePromptInjection) {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        riskScore += 25;
        level = riskScore > 60 ? 'high' : riskScore > 30 ? 'medium' : 'low';
        warnings.push('检测到可疑指令模式');
        break;
      }
    }
  }

  if (cfg.enableSensitiveWords) {
    const customWords = cfg.customSensitiveWords || [];
    const allWords = [...Object.values(SENSITIVE_WORD_CATEGORIES).flat(), ...customWords];
    const found = allWords.filter(word => input.includes(word));
    if (found.length > 0) {
      riskScore += Math.min(found.length * 10, 30);
      level = riskScore > 60 ? 'high' : riskScore > 30 ? 'medium' : 'low';
      warnings.push(`包含 ${found.length} 个敏感词汇`);
    }
  }

  if (cfg.enableMaliciousCmd) {
    for (const pattern of MALICIOUS_COMMAND_PATTERNS) {
      if (pattern.test(input)) {
        blocked = true;
        level = 'critical';
        riskScore += 50;
        warnings.push('检测到危险操作指令');
        break;
      }
    }
  }

  if (/[<>"']/.test(input) || /<(?:iframe|script|object|embed|meta|link|style|img|svg)/i.test(input)) {
    riskScore += 20;
    level = riskScore > 60 ? 'high' : 'medium';
    warnings.push('检测到可疑HTML标签');
  }

  return {
    passed: !blocked && riskScore < 70,
    level,
    warnings,
    blocked,
    riskScore: Math.min(riskScore, 100),
    sanitized: riskScore > 20 && !blocked ? sanitizeInput(input) : undefined,
  };
}

function sanitizeInput(input: string): string {
  return input.replace(/[<>\"&]/g, char => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
  })[char]);
}

// ====== 开源引擎增强层 ======

// textfilter 兼容中文敏感词库（内嵌精简版）
const TEXTFILTER_WORDS: Record<string, string[]> = {
  political: ['敏感政治词示例1', '敏感政治词示例2'], // 实际部署时替换为完整词库
  violent: ['暴力', '杀', '炸', '恐吓', '袭击', '伤害', '殴打'],
  porn: ['色情', '成人', '淫秽', '裸体', '情色', '黄片'],
  illegal: ['赌博', '毒品', '洗钱', '诈骗', '传销', '走私', '假币'],
  discrimination: ['种族歧视', '性别歧视', '地域黑', '人身攻击'],
};

export function guardInputEnhanced(input: string, config?: InputGuardConfig): InputGuardResult {
  // 先走原有基础检测
  const baseResult = guardInput(input, config);

  // 增强级：textfilter 分词匹配
  if (config?.enableSensitiveWords !== false) {
    const customWords = config?.customSensitiveWords || [];
    const allCategories = { ...TEXTFILTER_WORDS };

    const foundWords: Array<{ word: string; category: string }> = [];

    for (const [category, words] of Object.entries(allCategories)) {
      for (const word of [...words, ...customWords]) {
        if (input.includes(word)) {
          foundWords.push({ word, category });
          baseResult.riskScore += Math.min(8, 15); // 每个命中加8-15分
        }
      }
    }

    if (foundWords.length > 0) {
      const categories = [...new Set(foundWords.map(w => w.category))];
      baseResult.warnings.push(
        `textfilter 检测到 ${foundWords.length} 个敏感词（${categories.join('、')}类别）`
      );

      if (baseResult.riskScore > 60 && !baseResult.blocked) {
        baseResult.level = baseResult.riskScore > 80 ? 'high' : 'medium';
      }
    }
  }

  return baseResult;
}
