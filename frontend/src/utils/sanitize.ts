/**
 * HTML 内容净化 - 防止 XSS
 * 用于 dangerouslySetInnerHTML 前的输入清洗
 */
const DANGEROUS_TAGS = /<(script|iframe|object|embed|form|input|textarea|button|select|meta|link|style|base|applet|svg|math)[^>]*>/gi;
const EVENT_HANDLERS = /\bon\w+\s*=\s*['"][^'"]*['"]/gi;
const DANGEROUS_ATTRS = /(javascript|vbscript|data|blob)\s*:/gi;
const CSS_DANGEROUS = /(expression|-moz-binding|behavior|url\s*\()/gi;

export const sanitizeHTML = (html: string): string => {
  if (!html || typeof html !== 'string') return '';

  // 移除危险标签
  let cleaned = html.replace(DANGEROUS_TAGS, '');

  // 移除事件处理器属性
  cleaned = cleaned.replace(EVENT_HANDLERS, '');

  // 移除危险协议
  cleaned = cleaned.replace(DANGEROUS_ATTRS, '');

  // 移除危险CSS
  cleaned = cleaned.replace(CSS_DANGEROUS, '');

  // 移除控制字符和空字节
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // 防止实体编码绕过
  cleaned = cleaned.replace(/&#[xX]?[0-9a-fA-F]+;?/g, '');

  return cleaned.trim();
};

/** 安全地设置 innerHTML */
export const setSafeHTML = (html: string) => ({ __html: sanitizeHTML(html) });
