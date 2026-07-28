/**
 * CC许可证检测服务
 * 功能：自动识别素材来源和许可证类型，生成风险报告
 */

// ===== CC许可证配置 =====

const CC_LICENSES = {
  CC0: {
    name: 'CC0',
    fullName: 'CC0 1.0 Universal',
    allowCommercial: true,
    allowAdaptation: true,
    requireAttribution: false,
    requireShareAlike: false,
    riskLevel: 'low',
    description: '完全自由使用，无需署名',
    icon: '🔓',
    color: '#10b981'
  },
  CC_BY: {
    name: 'CC BY',
    fullName: 'CC BY 4.0',
    allowCommercial: true,
    allowAdaptation: true,
    requireAttribution: true,
    requireShareAlike: false,
    riskLevel: 'low',
    description: '需要署名',
    icon: '✍️',
    color: '#3b82f6'
  },
  CC_BY_SA: {
    name: 'CC BY-SA',
    fullName: 'CC BY-SA 4.0',
    allowCommercial: true,
    allowAdaptation: true,
    requireAttribution: true,
    requireShareAlike: true,
    riskLevel: 'medium',
    description: '署名+相同方式共享',
    icon: '🔄',
    color: '#f59e0b'
  },
  CC_BY_ND: {
    name: 'CC BY-ND',
    fullName: 'CC BY-ND 4.0',
    allowCommercial: true,
    allowAdaptation: false,
    requireAttribution: true,
    requireShareAlike: false,
    riskLevel: 'medium',
    description: '署名+禁止演绎',
    icon: '🚫',
    color: '#f59e0b'
  },
  CC_BY_NC: {
    name: 'CC BY-NC',
    fullName: 'CC BY-NC 4.0',
    allowCommercial: false,
    allowAdaptation: true,
    requireAttribution: true,
    requireShareAlike: false,
    riskLevel: 'high',
    description: '署名+非商业使用',
    icon: '💰',
    color: '#ef4444'
  },
  CC_BY_NC_SA: {
    name: 'CC BY-NC-SA',
    fullName: 'CC BY-NC-SA 4.0',
    allowCommercial: false,
    allowAdaptation: true,
    requireAttribution: true,
    requireShareAlike: true,
    riskLevel: 'high',
    description: '署名+非商业+相同方式共享',
    icon: '💰🔄',
    color: '#ef4444'
  },
  CC_BY_NC_ND: {
    name: 'CC BY-NC-ND',
    fullName: 'CC BY-NC-ND 4.0',
    allowCommercial: false,
    allowAdaptation: false,
    requireAttribution: true,
    requireShareAlike: false,
    riskLevel: 'very_high',
    description: '署名+非商业+禁止演绎',
    icon: '🔒',
    color: '#ef4444'
  },
  UNKNOWN: {
    name: '未标注',
    fullName: '许可证未明确标注',
    allowCommercial: false,
    allowAdaptation: false,
    requireAttribution: true,
    requireShareAlike: false,
    riskLevel: 'unknown',
    description: '许可证未知，建议联系作者',
    icon: '⚠️',
    color: '#94a3b8'
  }
};

// ===== 素材平台许可证映射 =====

const PLATFORM_LICENSE_MAP = {
  // 图片素材平台
  'unsplash.com': {
    license: 'CC0',
    platform: 'Unsplash',
    type: 'image',
    description: '高质量免费图片'
  },
  'pexels.com': {
    license: 'CC0',
    platform: 'Pexels',
    type: 'image',
    description: '免费图片和视频'
  },
  'pixabay.com': {
    license: 'CC0',
    platform: 'Pixabay',
    type: 'image',
    description: '免费图片、矢量、视频'
  },
  'freepik.com': {
    license: 'CC_BY',
    platform: 'Freepik',
    type: 'image',
    description: '矢量图和PSD文件'
  },

  // 知识平台
  'wikipedia.org': {
    license: 'CC_BY_SA',
    platform: 'Wikipedia',
    type: 'text',
    description: '百科知识内容'
  },
  'wikimedia.org': {
    license: 'CC_BY_SA',
    platform: 'Wikimedia',
    type: 'mixed',
    description: '多媒体资源'
  },

  // 音频素材平台
  'freesound.org': {
    license: 'CC_BY',
    platform: 'Freesound',
    type: 'audio',
    description: '免费音效素材'
  },
  'mixkit.co': {
    license: 'CC0',
    platform: 'Mixkit',
    type: 'video',
    description: '免费视频素材'
  },

  // 设计平台
  'behance.net': {
    license: 'UNKNOWN',
    platform: 'Behance',
    type: 'design',
    description: '设计师作品展示',
    note: '需查看具体作品标注'
  },
  'dribbble.com': {
    license: 'UNKNOWN',
    platform: 'Dribbble',
    type: 'design',
    description: '设计师作品',
    note: '需查看具体作品标注'
  },

  // AI生成平台（特殊标注）
  'midjourney.com': {
    license: 'UNKNOWN',
    platform: 'Midjourney',
    type: 'ai_image',
    description: 'AI生成图片',
    note: 'AI生成内容版权未定'
  },
  'stability.ai': {
    license: 'UNKNOWN',
    platform: 'Stable Diffusion',
    type: 'ai_image',
    description: 'AI生成图片',
    note: 'AI生成内容版权未定'
  }
};

// ===== 核心功能类 =====

class CCLicenseDetector {
  constructor() {
    this.detectedMaterials = [];
    this.riskReport = null;
  }

  /**
   * 检测素材来源和许可证
   */
  detectLicense(url) {
    try {
      const hostname = this.extractHostname(url);

      // 查找平台匹配
      for (const [domain, config] of Object.entries(PLATFORM_LICENSE_MAP)) {
        if (hostname.includes(domain)) {
          const licenseInfo = CC_LICENSES[config.license];
          return {
            url: url,
            hostname: hostname,
            platform: config.platform,
            license: config.license,
            licenseInfo: licenseInfo,
            type: config.type,
            description: config.description,
            note: config.note || null,
            detectedAt: new Date().toISOString()
          };
        }
      }

      // 未匹配平台，返回未知
      return {
        url: url,
        hostname: hostname,
        platform: '未知平台',
        license: 'UNKNOWN',
        licenseInfo: CC_LICENSES.UNKNOWN,
        type: 'unknown',
        description: '素材来源未识别',
        note: '建议联系原作者确认版权',
        detectedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[一鉴到底] 许可证检测失败:', error);
      return null;
    }
  }

  /**
   * 提取域名
   */
  extractHostname(url) {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).hostname;
      }
      // 处理相对路径或其他格式
      return url.split('/')[0];
    } catch (error) {
      return url;
    }
  }

  /**
   * 添加素材到检测列表
   */
  addMaterial(material) {
    const detectedMaterial = this.detectLicense(material.url);

    if (detectedMaterial) {
      detectedMaterial.context = material.context || null; // 使用上下文
      detectedMaterial.author = material.author || null; // 作者
      detectedMaterial.title = material.title || null; // 标题
      this.detectedMaterials.push(detectedMaterial);

      console.log('[一鉴到底] 素材已检测:', detectedMaterial.platform, detectedMaterial.license);

      return detectedMaterial;
    }

    return null;
  }

  /**
   * 生成素材风险报告
   */
  generateRiskReport() {
    const materials = this.detectedMaterials;

    if (materials.length === 0) {
      return {
        summary: '本次创作未使用外部素材',
        materials: [],
        riskLevel: 'none'
      };
    }

    // 统计风险等级
    const riskStats = {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0,
      unknown: 0
    };

    materials.forEach(material => {
      riskStats[material.licenseInfo.riskLevel]++;
    });

    // 确定整体风险等级
    let overallRisk = 'low';
    if (riskStats.very_high > 0 || riskStats.unknown > 0) {
      overallRisk = 'very_high';
    } else if (riskStats.high > 0) {
      overallRisk = 'high';
    } else if (riskStats.medium > 0) {
      overallRisk = 'medium';
    }

    // 生成报告内容
    const report = {
      summary: `共使用${materials.length}个外部素材`,
      riskLevel: overallRisk,
      riskStats: riskStats,
      materials: materials.map(material => this.generateMaterialReport(material)),
      recommendations: this.generateRecommendations(materials, overallRisk)
    };

    this.riskReport = report;
    return report;
  }

  /**
   * 生成单个素材报告
   */
  generateMaterialReport(material) {
    const licenseInfo = material.licenseInfo;

    return {
      title: material.title || `素材${this.detectedMaterials.indexOf(material) + 1}`,
      url: material.url,
      platform: material.platform,
      license: licenseInfo.name,
      fullName: licenseInfo.fullName,
      icon: licenseInfo.icon,
      color: licenseInfo.color,
      riskLevel: licenseInfo.riskLevel,

      permissions: {
        commercial: {
          allowed: licenseInfo.allowCommercial,
          icon: licenseInfo.allowCommercial ? '✅' : '❌',
          text: licenseInfo.allowCommercial ? '允许商用' : '禁止商用'
        },
        adaptation: {
          allowed: licenseInfo.allowAdaptation,
          icon: licenseInfo.allowAdaptation ? '✅' : '❌',
          text: licenseInfo.allowAdaptation ? '允许改编' : '禁止改编'
        },
        attribution: {
          required: licenseInfo.requireAttribution,
          icon: licenseInfo.requireAttribution ? '✅' : '❌',
          text: licenseInfo.requireAttribution ? '必须署名' : '无需署名'
        },
        shareAlike: {
          required: licenseInfo.requireShareAlike,
          icon: licenseInfo.requireShareAlike ? '✅' : '❌',
          text: licenseInfo.requireShareAlike ? '改编需相同许可' : '无此要求'
        }
      },

      description: licenseInfo.description,
      note: material.note,

      attributionTemplate: this.generateAttributionTemplate(material)
    };
  }

  /**
   * 生成署名模板
   */
  generateAttributionTemplate(material) {
    const licenseInfo = material.licenseInfo;

    if (!licenseInfo.requireAttribution) {
      return null;
    }

    const author = material.author || '原作者';
    const platform = material.platform;

    let template = `来源：${author} @ ${platform}\n`;
    template += `许可证：${licenseInfo.fullName}\n`;
    template += `链接：${material.url}\n`;

    if (licenseInfo.requireShareAlike) {
      template += `\n注意：改编作品需采用相同许可证\n`;
    }

    return template;
  }

  /**
   * 生成使用建议
   */
  generateRecommendations(materials, overallRisk) {
    const recommendations = [];

    // 高风险素材警告
    const highRiskMaterials = materials.filter(m =>
      m.licenseInfo.riskLevel === 'high' ||
      m.licenseInfo.riskLevel === 'very_high' ||
      m.licenseInfo.riskLevel === 'unknown'
    );

    if (highRiskMaterials.length > 0) {
      recommendations.push({
        level: 'warning',
        icon: '⚠️',
        title: '高风险素材警告',
        content: `发现${highRiskMaterials.length}个高风险素材，建议：\n${highRiskMaterials.map(m =>
          `- ${m.platform}(${m.license})：${m.licenseInfo.description}`
        ).join('\n')}`,
        action: '建议更换素材或联系作者获取授权'
      });
    }

    // NC素材商用警告
    const ncMaterials = materials.filter(m => m.license.includes('NC'));
    if (ncMaterials.length > 0) {
      recommendations.push({
        level: 'danger',
        icon: '🚨',
        title: '禁止商业使用',
        content: `以下素材禁止商业使用：\n${ncMaterials.map(m =>
          `- ${m.platform}`
        ).join('\n')}`,
        action: '如果您的作品用于商业目的，请更换这些素材'
      });
    }

    // SA素材提醒
    const saMaterials = materials.filter(m => m.license.includes('SA'));
    if (saMaterials.length > 0) {
      recommendations.push({
        level: 'info',
        icon: 'ℹ️',
        title: '相同方式共享要求',
        content: `以下素材改编后需用相同许可证：\n${saMaterials.map(m =>
          `- ${m.platform}(${m.license})`
        ).join('\n')}`,
        action: '改编作品需采用相同的CC BY-SA或CC BY-NC-SA许可证'
      });
    }

    // ND素材提醒
    const ndMaterials = materials.filter(m => m.license.includes('ND'));
    if (ndMaterials.length > 0) {
      recommendations.push({
        level: 'info',
        icon: 'ℹ️',
        title: '禁止演绎提醒',
        content: `以下素材禁止改编：\n${ndMaterials.map(m =>
          `- ${m.platform}`
        ).join('\n')}`,
        action: '仅可原样使用，不可修改、翻译或改编'
      });
    }

    // 署名建议
    const attributionMaterials = materials.filter(m => m.licenseInfo.requireAttribution);
    if (attributionMaterials.length > 0) {
      recommendations.push({
        level: 'success',
        icon: '✅',
        title: '署名建议',
        content: `以下素材需要署名：\n${attributionMaterials.map(m =>
          `- ${m.platform}(${m.license})`
        ).join('\n')}`,
        action: '请在作品中标注素材来源和许可证'
      });
    }

    // 默认建议
    if (recommendations.length === 0) {
      recommendations.push({
        level: 'success',
        icon: '✅',
        title: '素材使用合规',
        content: '所有素材许可证清晰，风险可控',
        action: '请遵守各素材的许可证要求'
      });
    }

    return recommendations;
  }

  /**
   * 清空检测列表
   */
  clear() {
    this.detectedMaterials = [];
    this.riskReport = null;
  }
}

// ===== 导出 =====

const ccLicenseDetector = new CCLicenseDetector();

export {
  CC_LICENSES,
  PLATFORM_LICENSE_MAP,
  CCLicenseDetector,
  ccLicenseDetector
};