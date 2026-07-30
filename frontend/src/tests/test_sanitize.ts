import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '@/utils/sanitize';

describe('sanitizeHTML', () => {
  it('移除 <script> 标签及其内容', () => {
    expect(sanitizeHTML('<script>alert("x")</script>')).toBe('');
  });

  it('移除 <iframe> 标签及其内容', () => {
    // 源码正则 /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi 会移除整个标签（含内容）
    expect(sanitizeHTML('<iframe src="evil">content</iframe>')).toBe('');
  });

  it('移除危险标签: object, embed, style, link, base, meta', () => {
    const input = '<object></object><embed/><style>body{}</style><link/><base/><meta/>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('<style');
    expect(result).not.toContain('<link');
    expect(result).not.toContain('<base');
    expect(result).not.toContain('<meta');
  });

  it('移除事件处理器 onclick', () => {
    const result = sanitizeHTML('<div onclick="alert(1)">click</div>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('click');
  });

  it('移除 javascript: 协议', () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('移除 vbscript: 协议', () => {
    const result = sanitizeHTML('<a href="vbscript:MsgBox">link</a>');
    expect(result).not.toContain('vbscript:');
  });

  it('移除 data:text/html 协议', () => {
    const result = sanitizeHTML('<a href="data:text/html,<h1>hi</h1>">link</a>');
    expect(result).not.toContain('data:text/html');
  });

  it('保留安全的 HTML 内容 - p 标签', () => {
    expect(sanitizeHTML('<p>Hello</p>')).toBe('<p>Hello</p>');
  });

  it('保留安全的 HTML 内容 - div 标签带 class', () => {
    expect(sanitizeHTML('<div class="x">text</div>')).toBe('<div class="x">text</div>');
  });

  it('空字符串输入返回空字符串', () => {
    expect(sanitizeHTML('')).toBe('');
  });

  it('null 输入返回空字符串', () => {
    expect(sanitizeHTML(null as unknown as string)).toBe('');
  });

  it('undefined 输入返回空字符串', () => {
    expect(sanitizeHTML(undefined as unknown as string)).toBe('');
  });
});
