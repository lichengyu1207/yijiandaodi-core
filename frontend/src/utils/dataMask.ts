export interface MaskResult {
  original: string;
  masked: string;
  maskCount: number;
  details: MaskDetail[];
}

export interface MaskDetail {
  type: SensitiveType;
  value: string;
  maskedValue: string;
  position: number;
}

export type SensitiveType =
  | 'phone'
  | 'id_card'
  | 'bank_card'
  | 'email'
  | 'name'
  | 'address'
  | 'company'
  | 'id_number'
  | 'license'
  | 'password'
  | 'api_key'
  | 'ip_address';

const MASK_RULES: Record<SensitiveType, { pattern: RegExp; maskFn: (match: string) => string }> = {
  phone: {
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    maskFn: (m) => m.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
  },
  id_card: {
    pattern: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g,
    maskFn: (m) => m.replace(/(.{6}).*(.{4})/, '$1********$2'),
  },
  bank_card: {
    pattern: /(?:62|98)\d{14,17}\b/g,
    maskFn: (m) => m.replace(/(.{4})\d+(.{4})/, '$1 **** **** $2'),
  },
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    maskFn: (m) => {
      const [local, domain] = m.split('@');
      const maskedLocal = local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
      return `${maskedLocal}@${domain}`;
    },
  },
  name: {
    pattern: /(?:姓名|用户名|真实姓名)[：:]\s*([\u4e00-\u9fa5]{2,4})/g,
    maskFn: (m) => m.replace(/[\u4e00-\u9fa5]/g, (c, i, str) => {
      const chars = str.match(/[\u4e00-\u9fa5]/g) || [];
      return i < Math.ceil(chars.length / 2) ? '*' : c;
    }),
  },
  address: {
    pattern: /(?:地址|住址)[：:]\s*.+/g,
    maskFn: (m) => m.substring(0, 10) + '******',
  },
  company: {
    pattern: /(?:公司|单位|企业)[名：:]\s*.+/g,
    maskFn: (m) => m.substring(0, 6) + '******',
  },
  id_number: {
    pattern: /(?:统一社会信用代码|纳税人识别号)[：:]\s*[A-Z0-9]{18}/g,
    maskFn: (m) => m.replace(/([A-Z0-9]{6}).*([A-Z0-9]{4})/, '$1********$2'),
  },
  license: {
    pattern: /(?:营业执照|许可证号)[：:]\s*\S+/g,
    maskFn: (m) => m.substring(0, 8) + '******',
  },
  password: {
    pattern: /(?:密码|pwd|password)[：:]\s*\S+/gi,
    maskFn: () => '******',
  },
  api_key: {
    pattern: /(?:api[_-]?key|apikey|access[_-]?token|secret)[：:]\s*\S+/gi,
    maskFn: () => '******',
  },
  ip_address: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    maskFn: (m) => m.replace(/\.\d+\.\d+$/, '.***.***'),
  },
};

export function maskSensitiveData(text: string, enabledTypes?: SensitiveType[]): MaskResult {
  const types = enabledTypes || Object.keys(MASK_RULES) as SensitiveType[];
  let maskedText = text;
  const details: MaskDetail[] = [];
  let totalMasked = 0;

  for (const type of types) {
    const rule = MASK_RULES[type];
    if (!rule) continue;

    const matches = [...maskedText.matchAll(rule.pattern)];
    for (const match of matches) {
      if (match.index === undefined) continue;
      const maskedValue = rule.maskFn(match[0]);
      if (maskedValue !== match[0]) {
        details.push({
          type,
          value: match[0],
          maskedValue,
          position: match.index,
        });
        totalMasked++;
        maskedText = maskedText.replace(match[0], maskedValue);
      }
    }
  }

  return {
    original: text,
    masked: maskedText,
    maskCount: totalMasked,
    details,
  };
}

export function getMaskStats(result: MaskResult): { [key: string]: number } {
  const stats: Record<string, number> = {};
  for (const detail of result.details) {
    stats[detail.type] = (stats[detail.type] || 0) + 1;
  }
  return stats;
}

// ====== Presidio 脱敏适配器 ======

export interface PresidioConfig {
  enabled: boolean;
  language?: string;  // 'zh' | 'en'
  entities?: string[];
  fallbackToRegex?: boolean;
}

// Presidio 实体类型映射（当 Presidio 可用时使用）
const PRESIDIO_ENTITY_MAP: Record<string, SensitiveType> = {
  PERSON: 'name',
  PHONE_NUMBER: 'phone',
  EMAIL_ADDRESS: 'email',
  IBAN_CODE: 'bank_card',
  CREDIT_CARD: 'bank_card',
  IP_ADDRESS: 'ip_address',
  LOCATION: 'address',
  DATE_TIME: 'address',
  ORGANIZATION: 'company',
};

// Presidio NLP 引擎实例（懒加载）
let presidioAnalyzer: any = null;

/**
 * 加载 Presidio 分析器（异步）
 * 注意：Presidio 需要 Node.js 环境，浏览器端需要使用 WASM 版本或后端代理
 * 此处提供接口定义，实际实现取决于部署方式
 */
export async function loadPresidioAnalyzer(config?: PresidioConfig): Promise<boolean> {
  try {
    // 尝试动态导入 Presidio（如果可用）
    const presidioModule = await import('@microsoft/presidio-analyzer-nodejs-bundle').catch(() => null);
    if (!presidioModule) {
      console.warn('[Presidio] 未安装，将使用正则降级方案');
      return false;
    }

    presidioAnalyzer = new presidioModule.AnalyzerEngine();
    await presidioAnalyzer.init({
      languages: [config?.language || 'en'],
    });
    return true;
  } catch (err) {
    console.warn('[Presidio] 加载失败:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * 使用 Presidio 进行高级脱敏（如果已加载）
 * 如果未加载则自动降级到正则实现
 */
export async function maskWithPresidio(text: string, config?: PresidioConfig): Promise<MaskResult> {
  if (!config?.enabled || !presidioAnalyzer) {
    // 降级到正则实现
    return maskSensitiveData(text, config?.entities as SensitiveType[]);
  }

  try {
    const results = await presidioAnalyzer.analyze(text, {
      language: config.language || 'en',
      entities: config.entities || ['PERSON', 'PHONE_NUMBER', 'EMAIL_ADDRESS', 'IBAN_CODE', 'CREDIT_CARD', 'IP_ADDRESS'],
      correlation_id: undefined,
      score_threshold: 0.3,
      return_decision_process: false,
    });

    let maskedText = text;
    const details: MaskDetail[] = [];
    let offset = 0; // 替换导致的偏移量

    // 按位置排序，从后往前替换避免位置偏移问题
    const sortedResults = results.sort((a: any, b: any) => b.start - a.start);

    for (const entity of sortedResults) {
      const entityType = PRESIDIO_ENTITY_MAP[entity.entity_type] || 'name';
      const originalText = entity.content || text.substring(entity.start, entity.end);

      const maskedValue = applyMaskByType(entityType, originalText);

      details.push({
        type: entityType,
        value: originalText,
        maskedValue,
        position: entity.start,
      });

      maskedText = maskedText.substring(0, entity.start + offset)
        + maskedValue
        + maskedText.substring(entity.end + offset);

      offset += (maskedValue.length - originalText.length);
    }

    return {
      original: text,
      masked: maskedText,
      maskCount: details.length,
      details,
    };
  } catch (err) {
    console.warn('[Presidio] 分析失败，降级到正则:', err);
    return maskSensitiveData(text);
  }
}

function applyMaskByType(type: SensitiveType, value: string): string {
  switch (type) {
    case 'phone': return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    case 'email': {
      const [local, domain] = value.split('@');
      const maskedLocal = local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
      return `${maskedLocal}@${domain}`;
    }
    case 'name': return value.substring(0, 1) + '*'.repeat(Math.max(1, value.length - 1));
    case 'bank_card': return value.replace(/(.{4})\d+(.{4})/, '$1 **** **** $2');
    default: return '*'.repeat(value.length);
  }
}
