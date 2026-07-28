import { describe, it, expect, vi } from 'vitest';
import {
  getInferenceStatus,
  disposeAllPipelines,
  classifyText,
  extractEntities,
  zeroShotClassify,
} from '@/utils/browserInference';

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  env: { allowLocalModels: true, useBrowserCache: true },
}));

describe('browserInference', () => {
  describe('getInferenceStatus', () => {
    it('初始状态: loading=true, progress=0, modelLoaded=false, modelName=\'\', error=null', () => {
      const status = getInferenceStatus();
      expect(status.loading).toBe(true);
      expect(status.progress).toBe(0);
      expect(status.modelLoaded).toBe(false);
      expect(status.modelName).toBe('');
      expect(status.error).toBeNull();
    });

    it('返回类型包含所有字段', () => {
      const status = getInferenceStatus();
      expect(status).toHaveProperty('loading');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('modelLoaded');
      expect(status).toHaveProperty('modelName');
      expect(status).toHaveProperty('error');
      expect(Object.keys(status)).toEqual(['loading', 'progress', 'modelLoaded', 'modelName', 'error']);
    });

    it('loading 在没有任何 pipeline 时为 true', () => {
      const status = getInferenceStatus();
      expect(status.loading).toBe(true);
    });

    it('多次调用结果一致', () => {
      const s1 = getInferenceStatus();
      const s2 = getInferenceStatus();
      expect(s1).toEqual(s2);
    });
  });

  describe('disposeAllPipelines', () => {
    it('无模型时调用不报错', () => {
      expect(() => disposeAllPipelines()).not.toThrow();
    });

    it('返回 undefined', () => {
      const result = disposeAllPipelines();
      expect(result).toBeUndefined();
    });
  });

  describe('模型未加载时的错误测试', () => {
    it('classifyText 未加载时抛出 "分类模型未加载"', async () => {
      await expect(classifyText('hello')).rejects.toThrow('分类模型未加载');
    });

    it('extractEntities 未加载时抛出 "NER模型未加载"', async () => {
      await expect(extractEntities('hello')).rejects.toThrow('NER模型未加载');
    });

    it('zeroShotClassify 未加载时抛出 "零样本模型未加载"', async () => {
      await expect(zeroShotClassify('text', ['a', 'b'])).rejects.toThrow('零样本模型未加载');
    });
  });
});
