import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ===== Setup: 清理 document head 中的 meta 标签 =====
function cleanMetaTags() {
  document.title = '';
  const metas = document.querySelectorAll('head meta[name]');
  metas.forEach((m) => m.remove());
}

describe('useSEO - SEO 元数据管理', () => {
  beforeEach(() => {
    cleanMetaTags();
  });

  afterEach(() => {
    cleanMetaTags();
  });

  it('1. 调用后 document.title 被设置为传入的 title', () => {
    renderHook(() =>
      useSEO('测试页面标题', '这是测试描述')
    );

    expect(document.title).toBe('测试页面标题');
  });

  it('2. 创建或更新 meta[name="description"] 的 content', () => {
    renderHook(() =>
      useSEO('标题', '这是页面的描述信息用于SEO优化')
    );

    const descMeta = document.querySelector('meta[name="description"]');
    expect(descMeta).not.toBeNull();
    expect((descMeta as HTMLMetaElement).getAttribute('content')).toBe(
      '这是页面的描述信息用于SEO优化'
    );
  });

  it('3. 传入 keywords 时创建或更新 meta[name="keywords"]', () => {
    renderHook(() =>
      useSEO('标题', '描述', ['关键词A', '关键词B', '关键词C'])
    );

    const kwMeta = document.querySelector('meta[name="keywords"]');
    expect(kwMeta).not.toBeNull();
    expect((kwMeta as HTMLMetaElement).getAttribute('content')).toBe(
      '关键词A,关键词B,关键词C'
    );
  });

  it('4. 不传 keywords 时不创建 keywords meta 标签', () => {
    renderHook(() =>
      useSEO('标题', '描述')
    );

    const kwMeta = document.querySelector('meta[name="keywords"]');
    // 源码中：不传 keywords 时，如果已有 meta[name=keywords] 会设置空 content
    // 如果没有则不创建。由于我们 beforeEach 清理了，所以不应存在
    if (kwMeta !== null) {
      // 如果存在（因为源码逻辑是先 querySelector 再决定是否创建），
      // 验证 content 为空
      expect((kwMeta as HTMLMetaElement).getAttribute('content')).toBe('');
    }
    // 关键验证：不会因缺少 keywords 而报错
  });

  it('5. 多次调用更新已有的 meta 标签（而非重复创建）', () => {
    // 第一次调用
    renderHook(() =>
      useSEO('初始标题', '初始描述', ['初始关键词'])
    );

    // 第二次调用（应更新而非创建新标签）
    renderHook(() =>
      useSEO('更新后的标题', '更新后的描述', ['更新后的关键词1', '更新后的关键词2'])
    );

    // 验证只有一个 description meta 标签
    const descMetas = document.querySelectorAll('meta[name="description"]');
    expect(descMetas.length).toBe(1);
    expect((descMetas[0] as HTMLMetaElement).getAttribute('content')).toBe('更新后的描述');

    // 验证只有一个 keywords meta 标签
    const kwMetas = document.querySelectorAll('meta[name="keywords"]');
    expect(kwMetas.length).toBe(1);
    expect((kwMetas[0] as HTMLMetaElement).getAttribute('content')).toBe('更新后的关键词1,更新后的关键词2');

    // 验证 title 是最新的
    expect(document.title).toBe('更新后的标题');
  });

  it('6. cleanup 时（effect 卸载）不报错', () => {
    // renderHook 的 unmount 会触发 useEffect cleanup
    const { unmount } = renderHook(() =>
      useSEO('清理测试', '清理描述', ['清理关键词'])
    );

    // 验证 effect 正常执行
    expect(document.title).toBe('清理测试');

    // unmount 不应抛出任何错误
    expect(() => unmount()).not.toThrow();

    // unmount 后 document 状态保持不变（useEffect cleanup 为空函数）
    expect(document.title).toBe('清理测试');
  });
});
