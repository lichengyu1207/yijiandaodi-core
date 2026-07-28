/**
 * 合并的 API 层批量测试文件
 * 覆盖 src/api/ 下所有尚未测试的 API 模块
 *
 * 已有独立测试的文件（跳过）:
 *   - executionApi.ts
 *   - auth.ts
 *   - workflowApi.ts
 *   - deepseekApi.ts
 *
 * 生成时间: 2026-06-05
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// 通用 Mock: @/utils/request (用于大部分 API)
// ============================================================
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
import request from '@/utils/request';
const mockedGet = vi.mocked(request.get);
const mockedPost = vi.mocked(request.post);
const mockedPut = vi.mocked(request.put);
const mockedPatch = vi.mocked(request.patch);
const mockedDelete = vi.mocked(request.delete);

// ============================================================
// 通用 Mock: axios (用于独立 axios 实例的 API)
// 策略: 所有 axios.create() 调用返回同一个共享的 mock 实例，
//       这样所有独立 axios 实例的 API 都可以通过同一组 mocked 方法验证。
// 注意: vi.mock 工厂函数会被提升(hoist)到文件顶部，
//       所以引用的变量必须用 vi.hoisted() 声明
// ============================================================
const { mockAxiosCreate, mockAxiosPostFn, sharedAxiosInstance } = vi.hoisted(() => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    mockAxiosCreate: vi.fn(() => instance), // 每次都返回同一个实例
    mockAxiosPostFn: vi.fn(),
    sharedAxiosInstance: instance,
  };
});

vi.mock('axios', () => ({
  default: {
    create: mockAxiosCreate,
    post: mockAxiosPostFn,
  },
}));
import axios from 'axios';
const mockedAxiosPost = vi.mocked(axios.post);
// 所有使用独立 axios 实例的 API 都通过这组方法验证
const axiosMockGet = sharedAxiosInstance.get;
const axiosMockPost = sharedAxiosInstance.post;
const axiosMockPut = sharedAxiosInstance.put;
const axiosMockDelete = sharedAxiosInstance.delete;


// ============================================================
// 1. cScenarioApi (C端场景 - 学术检查 / 企业审计)
// ============================================================
describe('cScenarioApi', () => {
  let api: typeof import('@/api/cScenarioApi').cScenarioApi;
  beforeAll(async () => {
    const mod = await import('@/api/cScenarioApi');
    api = mod.cScenarioApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('导出 cScenarioApi 对象且包含 academic 和 enterpriseAudit 子模块', () => {
      expect(api).toBeDefined();
      expect(typeof api.academic).toBe('object');
      expect(typeof api.enterpriseAudit).toBe('object');
    });
    it('academic 子模块包含 list/detail/check/stats/exportPdf 方法', () => {
      expect(typeof api.academic.list).toBe('function');
      expect(typeof api.academic.detail).toBe('function');
      expect(typeof api.academic.check).toBe('function');
      expect(typeof api.academic.stats).toBe('function');
      expect(typeof api.academic.exportPdf).toBe('function');
    });
    it('enterpriseAudit 子模块包含 list/detail/runAudit/stats 方法', () => {
      expect(typeof api.enterpriseAudit.list).toBe('function');
      expect(typeof api.enterpriseAudit.detail).toBe('function');
      expect(typeof api.enterpriseAudit.runAudit).toBe('function');
      expect(typeof api.enterpriseAudit.stats).toBe('function');
    });
  });

  describe('academic.list', () => {
    it('调用 GET "/api/c-scenario/academic/" 并传递 params', async () => {
      mockedGet.mockResolvedValue({ data: [] });
      await api.academic.list({ page: 1 });
      expect(mockedGet).toHaveBeenCalledWith('/api/c-scenario/academic/', { params: { page: 1 } });
    });
  });

  describe('academic.check', () => {
    it('调用 POST "/api/c-scenario/academic/check/" 并传递 data', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.academic.check({ title: 'test' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/c-scenario/academic/check/', { title: 'test' });
    });
  });

  describe('enterpriseAudit.runAudit', () => {
    it('调用 POST "/api/c-scenario/enterprise-audit/run_audit/" 并传递 data', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.enterpriseAudit.runAudit({ audit_name: 'test' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/c-scenario/enterprise-audit/run_audit/', { audit_name: 'test' });
    });
  });
});


// ============================================================
// 2. chapterDetectApi (章节检测)
// ============================================================
describe('chapterDetectApi', () => {
  let api: typeof import('@/api/chapterDetectApi').chapterDetectApi;
  beforeAll(async () => {
    const mod = await import('@/api/chapterDetectApi');
    api = mod.chapterDetectApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 list/detail/detect/stats/exportPdf 方法', () => {
      expect(typeof api.list).toBe('function');
      expect(typeof api.detail).toBe('function');
      expect(typeof api.detect).toBe('function');
      expect(typeof api.stats).toBe('function');
      expect(typeof api.exportPdf).toBe('function');
    });
  });

  describe('list', () => {
    it('调用 GET "/api/chapter-detect/paper-submission/"', async () => {
      mockedGet.mockResolvedValue({ data: [] });
      await api.list();
      expect(mockedGet).toHaveBeenCalledWith('/api/chapter-detect/paper-submission/', { params: undefined });
    });
  });

  describe('detect', () => {
    it('调用 POST "/api/chapter-detect/paper-submission/detect/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.detect({ original_text: 'hello' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/chapter-detect/paper-submission/detect/', { original_text: 'hello' });
    });
  });
});


// ============================================================
// 3. tippingApi (打赏/赞助) - default export
// ============================================================
describe('tippingApi', () => {
  let api: typeof import('@/api/tippingApi').default;
  beforeAll(async () => {
    api = (await import('@/api/tippingApi')).default;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('tip 子模块包含 send/reply/myTips/creatorStats/leaderboard/feedTips 方法', () => {
      expect(api.tip).toBeDefined();
      expect(typeof api.tip.send).toBe('function');
      expect(typeof api.tip.reply).toBe('function');
      expect(typeof api.tip.myTips).toBe('function');
      expect(typeof api.tip.creatorStats).toBe('function');
      expect(typeof api.tip.leaderboard).toBe('function');
      expect(typeof api.tip.feedTips).toBe('function');
    });
  });

  describe('tip.send', () => {
    it('调用 POST "/api/tipping/tip-donation/send_tip/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.tip.send({ creator_id: 'u1', amount: 10 } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/tipping/tip-donation/send_tip/', { creator_id: 'u1', amount: 10 });
    });
  });

  describe('tip.myTips', () => {
    it('调用 GET "/api/tipping/tip-donation/my_tips/"', async () => {
      mockedGet.mockResolvedValue({ tips: [] });
      await api.tip.myTips();
      expect(mockedGet).toHaveBeenCalledWith('/api/tipping/tip-donation/my_tips/');
    });
  });
});


// ============================================================
// 4. recommendationApi (推荐系统) - 独立 axios 实例 recApi
// ============================================================
describe('recommendationApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('getRecommendations/getHotSkills/getNewForYou/getSimilarSkills/getDetectorEngines/trackBehavior/trackSkillClick 存在', async () => {
      const mod = await import('@/api/recommendationApi');
      expect(typeof mod.getRecommendations).toBe('function');
      expect(typeof mod.getHotSkills).toBe('function');
      expect(typeof mod.getNewForYou).toBe('function');
      expect(typeof mod.getSimilarSkills).toBe('function');
      expect(typeof mod.getDetectorEngines).toBe('function');
      expect(typeof mod.trackBehavior).toBe('function');
      expect(typeof mod.trackSkillClick).toBe('function');
    });
  });

  describe('getRecommendations', () => {
    it('通过 recApi 调用 GET "/recommendations/"', async () => {
      const { getRecommendations } = await import('@/api/recommendationApi');
      axiosMockGet.mockResolvedValue({ success: true, data: { recommendations: [] } });
      await getRecommendations(20, 'auto');
      expect(axiosMockGet).toHaveBeenCalledWith('/recommendations/', { params: { limit: 20, strategy: 'auto' } });
    });
  });

  describe('trackBehavior', () => {
    it('通过 recApi 调用 POST "/track/"', async () => {
      const { trackBehavior } = await import('@/api/recommendationApi');
      axiosMockPost.mockResolvedValue({ success: true });
      await trackBehavior([{ target_type: 'skill', target_id: 1, action: 'click' }], 'sess-1');
      expect(axiosMockPost).toHaveBeenCalledWith('/track/', { logs: [{ target_type: 'skill', target_id: 1, action: 'click' }], session_id: 'sess-1' });
    });
  });
});


// ============================================================
// 5. resumeApi (简历优化) - default export
// ============================================================
describe('resumeApi', () => {
  let api: typeof import('@/api/resumeApi').default;
  beforeAll(async () => {
    api = (await import('@/api/resumeApi')).default;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('resume 子模块包含 list/retrieve/analyze/stats 方法', () => {
      expect(typeof api.resume.list).toBe('function');
      expect(typeof api.resume.retrieve).toBe('function');
      expect(typeof api.resume.analyze).toBe('function');
      expect(typeof api.resume.stats).toBe('function');
    });
  });

  describe('resume.analyze', () => {
    it('调用 POST "/api/resume/resume-analysis/analyze/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.resume.analyze({ resume_text: 'my resume' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/resume/resume-analysis/analyze/', { resume_text: 'my resume' });
    });
  });

  describe('resume.stats', () => {
    it('调用 GET "/api/resume/resume-analysis/stats/"', async () => {
      mockedGet.mockResolvedValue({});
      await api.resume.stats();
      expect(mockedGet).toHaveBeenCalledWith('/api/resume/resume-analysis/stats/');
    });
  });
});


// ============================================================
// 6. grammarlyApi (语法检查) - default export
// ============================================================
describe('grammarlyApi', () => {
  let api: typeof import('@/api/grammarlyApi').default;
  beforeAll(async () => {
    api = (await import('@/api/grammarlyApi')).default;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('grammar 子模块包含 list/retrieve/check/stats 方法', () => {
      expect(typeof api.grammar.list).toBe('function');
      expect(typeof api.grammar.retrieve).toBe('function');
      expect(typeof api.grammar.check).toBe('function');
      expect(typeof api.grammar.stats).toBe('function');
    });
  });

  describe('grammar.check', () => {
    it('调用 POST "/api/grammarly/grammar-check/check/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.grammar.check({ original_text: 'Hello world' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/grammarly/grammar-check/check/', { original_text: 'Hello world' });
    });
  });
});


// ============================================================
// 7. copyscapeApi (抄袭检测) - default export
// ============================================================
describe('copyscapeApi', () => {
  let api: typeof import('@/api/copyscapeApi').default;
  beforeAll(async () => {
    api = (await import('@/api/copyscapeApi')).default;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('plagiarism 子模块包含 list/retrieve/scan/stats 方法', () => {
      expect(typeof api.plagiarism.list).toBe('function');
      expect(typeof api.plagiarism.retrieve).toBe('function');
      expect(typeof api.plagiarism.scan).toBe('function');
      expect(typeof api.plagiarism.stats).toBe('function');
    });
  });

  describe('plagiarism.scan', () => {
    it('调用 POST "/api/copyscape/plagiarism-scan/scan/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.plagiarism.scan({ original_text: 'some text' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/copyscape/plagiarism-scan/scan/', { original_text: 'some text' });
    });
  });
});


// ============================================================
// 8. dataClassificationApi (数据分类)
// ============================================================
describe('dataClassificationApi (dcApi)', () => {
  let api: typeof import('@/api/dataClassificationApi').dcApi;
  beforeAll(async () => {
    const mod = await import('@/api/dataClassificationApi');
    api = mod.dcApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 getLevels/getCategories/getCategoryTree/getFieldTags/getByPiiType/batchTagFields 等方法', () => {
      expect(typeof api.getLevels).toBe('function');
      expect(typeof api.getCategories).toBe('function');
      expect(typeof api.getCategoryTree).toBe('function');
      expect(typeof api.getFieldTags).toBe('function');
      expect(typeof api.getByPiiType).toBe('function');
      expect(typeof api.batchTagFields).toBe('function');
      expect(typeof api.getClassificationRecords).toBe('function');
      expect(typeof api.classifyObject).toBe('function');
      expect(typeof api.getRecordStats).toBe('function');
      expect(typeof api.getExportApprovals).toBe('function');
      expect(typeof api.createExportApproval).toBe('function');
      expect(typeof api.approveExport).toBe('function');
      expect(typeof api.rejectExport).toBe('function');
      expect(typeof api.getActiveDPOs).toBe('function');
      expect(typeof api.getDashboard).toBe('function');
    });
  });

  describe('getLevels', () => {
    it('调用 GET "/levels/" 且 baseURL 为 "/api/data-classification"', async () => {
      mockedGet.mockResolvedValue([]);
      await api.getLevels();
      expect(mockedGet).toHaveBeenCalledWith('/levels/', { baseURL: '/api/data-classification' });
    });
  });

  describe('classifyObject', () => {
    it('调用 POST "/records/classify-object/" 且 baseURL 正确', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.classifyObject({ object_type: 'article', object_id: 1, level_code: 'L1' });
      expect(mockedPost).toHaveBeenCalledWith(
        '/records/classify-object/',
        { object_type: 'article', object_id: 1, level_code: 'L1' },
        { baseURL: '/api/data-classification' }
      );
    });
  });
});


// ============================================================
// 9. antiFraudApi (反欺诈)
// ============================================================
describe('antiFraudApi', () => {
  let api: typeof import('@/api/antiFraudApi').antiFraudApi;
  beforeAll(async () => {
    const mod = await import('@/api/antiFraudApi');
    api = mod.antiFraudApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('devices/events/rules/profiles 四个子模块存在', () => {
      expect(typeof api.devices).toBe('object');
      expect(typeof api.events).toBe('object');
      expect(typeof api.rules).toBe('object');
      expect(typeof api.profiles).toBe('object');
    });
    it('devices 包含 list/collect', () => {
      expect(typeof api.devices.list).toBe('function');
      expect(typeof api.devices.collect).toBe('function');
    });
    it('events 包含 list/report/myEvents/dashboardStats/takeAction', () => {
      expect(typeof api.events.list).toBe('function');
      expect(typeof api.events.report).toBe('function');
      expect(typeof api.events.myEvents).toBe('function');
      expect(typeof api.events.dashboardStats).toBe('function');
      expect(typeof api.events.takeAction).toBe('function');
    });
    it('rules 包含 list/activeRules/toggle', () => {
      expect(typeof api.rules.list).toBe('function');
      expect(typeof api.rules.activeRules).toBe('function');
      expect(typeof api.rules.toggle).toBe('function');
    });
    it('profiles 包含 list/highRiskUsers', () => {
      expect(typeof api.profiles.list).toBe('function');
      expect(typeof api.profiles.highRiskUsers).toBe('function');
    });
  });

  describe('devices.collect', () => {
    it('调用 POST "/api/anti-fraud/device-fingerprint/collect/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.devices.collect({ fingerprint_data: { fp: 'abc' } } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/anti-fraud/device-fingerprint/collect/', { fingerprint_data: { fp: 'abc' } });
    });
  });

  describe('events.report', () => {
    it('调用 POST "/api/anti-fraud/risk-event/report/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.events.report({ event_type: 'login' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/anti-fraud/risk-event/report/', { event_type: 'login' });
    });
  });
});


// ============================================================
// 10. dualEngineApi (双引擎检测)
// ============================================================
describe('dualEngineApi', () => {
  let api: typeof import('@/api/dualEngineApi').dualEngineApi;
  beforeAll(async () => {
    const mod = await import('@/api/dualEngineApi');
    api = mod.dualEngineApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 list/detail/scan/stats/exportReport 方法', () => {
      expect(typeof api.list).toBe('function');
      expect(typeof api.detail).toBe('function');
      expect(typeof api.scan).toBe('function');
      expect(typeof api.stats).toBe('function');
      expect(typeof api.exportReport).toBe('function');
    });
  });

  describe('scan', () => {
    it('调用 POST "/api/dual-engine/dual-engine-scan/scan/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.scan({ original_text: 'text' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/dual-engine/dual-engine-scan/scan/', { original_text: 'text' });
    });
  });

  describe('exportReport', () => {
    it('调用 POST "/api/dual-engine/dual-engine-scan/{id}/export-report/"', async () => {
      mockedPost.mockResolvedValue({});
      await api.exportReport('123', 'pdf');
      expect(mockedPost).toHaveBeenCalledWith('/api/dual-engine/dual-engine-scan/123/export-report/', { format: 'pdf' });
    });
  });
});


// ============================================================
// 11. unifiedScanApi (统一扫描)
// ============================================================
describe('unifiedScanApi', () => {
  let api: typeof import('@/api/unifiedScanApi').unifiedScanApi;
  beforeAll(async () => {
    const mod = await import('@/api/unifiedScanApi');
    api = mod.unifiedScanApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 list/detail/scan/stats/complianceRules 方法', () => {
      expect(typeof api.list).toBe('function');
      expect(typeof api.detail).toBe('function');
      expect(typeof api.scan).toBe('function');
      expect(typeof api.stats).toBe('function');
      expect(typeof api.complianceRules).toBe('function');
    });
  });

  describe('list', () => {
    it('调用 GET "/api/unified-scan/"', async () => {
      mockedGet.mockResolvedValue({ results: [] });
      await api.list({ page: 1 });
      expect(mockedGet).toHaveBeenCalledWith('/api/unified-scan/', { params: { page: 1 } });
    });
  });

  describe('scan', () => {
    it('调用 POST "/api/unified-scan/scan/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.scan({ original_content: 'data' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/unified-scan/scan/', { original_content: 'data' });
    });
  });
});


// ============================================================
// 12. techApi (技术溯源 / Deepfake)
// ============================================================
describe('techApi', () => {
  let api: typeof import('@/api/techApi').techApi;
  beforeAll(async () => {
    const mod = await import('@/api/techApi');
    api = mod.techApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('provenance/deepfake 两个子模块存在', () => {
      expect(typeof api.provenance).toBe('object');
      expect(typeof api.deepfake).toBe('object');
    });
    it('provenance 包含 list/detail/analyze/stats', () => {
      expect(typeof api.provenance.list).toBe('function');
      expect(typeof api.provenance.detail).toBe('function');
      expect(typeof api.provenance.analyze).toBe('function');
      expect(typeof api.provenance.stats).toBe('function');
    });
    it('deepfake 包含 list/detail/detect/stats', () => {
      expect(typeof api.deepfake.list).toBe('function');
      expect(typeof api.deepfake.detail).toBe('function');
      expect(typeof api.deepfake.detect).toBe('function');
      expect(typeof api.deepfake.stats).toBe('function');
    });
  });

  describe('provenance.analyze', () => {
    it('调用 POST "/api/tech/provenance/analyze/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.provenance.analyze({ original_content: 'data' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/tech/provenance/analyze/', { original_content: 'data' });
    });
  });

  describe('deepfake.detect', () => {
    it('调用 POST "/api/tech/deepfake/detect/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.deepfake.detect({ file_name: 'video.mp4' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/tech/deepfake/detect/', { file_name: 'video.mp4' });
    });
  });
});


// ============================================================
// 13. bScenarioApi (B端场景 - 医疗/法律/财务/设计)
// ============================================================
describe('bScenarioApi', () => {
  let api: typeof import('@/api/bScenarioApi').bScenarioApi;
  beforeAll(async () => {
    const mod = await import('@/api/bScenarioApi');
    api = mod.bScenarioApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('medical/legal/financial/design 四个子模块存在', () => {
      expect(typeof api.medical).toBe('object');
      expect(typeof api.legal).toBe('object');
      expect(typeof api.financial).toBe('object');
      expect(typeof api.design).toBe('object');
    });
    it('每个子模块都包含 list/detail/detect/stats', () => {
      ['medical', 'legal', 'financial', 'design'].forEach((key) => {
        const sub = api[key as keyof typeof api];
        expect(typeof sub.list).toBe('function');
        expect(typeof sub.detail).toBe('function');
        expect(typeof sub.detect).toBe('function');
        expect(typeof sub.stats).toBe('function');
      });
    });
  });

  describe('medical.detect', () => {
    it('调用 POST "/api/b-scenario/medical/detect/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.medical.detect({ report_type: 'lab' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/b-scenario/medical/detect/', { report_type: 'lab' });
    });
  });

  describe('legal.detect', () => {
    it('调用 POST "/api/b-scenario/legal/detect/"', async () => {
      mockedPost.mockResolvedValue({ id: '1' });
      await api.legal.detect({ doc_type: 'contract' } as any);
      expect(mockedPost).toHaveBeenCalledWith('/api/b-scenario/legal/detect/', { doc_type: 'contract' });
    });
  });
});


// ============================================================
// 14. packageApi (套餐/审计服务)
// ============================================================
describe('packageApi', () => {
  let api: typeof import('@/api/packageApi').packageApi;
  beforeAll(async () => {
    const mod = await import('@/api/packageApi');
    api = mod.packageApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 getPackages/getFeaturedPackages/getTierOverview/purchasePackage 等方法', () => {
      expect(typeof api.getPackages).toBe('function');
      expect(typeof api.getFeaturedPackages).toBe('function');
      expect(typeof api.getTierOverview).toBe('function');
      expect(typeof api.purchasePackage).toBe('function');
      expect(typeof api.getAuditServices).toBe('function');
      expect(typeof api.getPricingMatrix).toBe('function');
      expect(typeof api.submitAuditInquiry).toBe('function');
      expect(typeof api.getAuditContracts).toBe('function');
      expect(typeof api.getAuditStats).toBe('function');
    });
  });

  describe('purchasePackage', () => {
    it('调用 POST "/scenario-packages/{id}/purchase/" 且 baseURL 正确', async () => {
      mockedPost.mockResolvedValue({ order_no: 'ORD001' });
      await api.purchasePackage(5, 3);
      expect(mockedPost).toHaveBeenCalledWith(
        '/scenario-packages/5/purchase/',
        { selected_b_id: 3 },
        { baseURL: '/api/packages' }
      );
    });
  });

  describe('submitAuditInquiry', () => {
    it('调用 POST "/audit-services/submit-inquiry/"', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.submitAuditInquiry({
        service_id: 1,
        company_name: 'TestCo',
        contact_person: 'John',
        contact_phone: '123456',
        contact_email: 'john@test.com',
      });
      expect(mockedPost).toHaveBeenCalledWith(
        '/audit-services/submit-inquiry/',
        expect.objectContaining({ service_id: 1, company_name: 'TestCo', contact_person: 'John' }),
        { baseURL: '/api/packages' }
      );
    });
  });
});


// ============================================================
// 15. paymentApi (支付/配额/商城/统计) - 多个独立 axios 实例
// ============================================================
describe('paymentApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('支付相关函数存在', async () => {
      const mod = await import('@/api/paymentApi');
      expect(typeof mod.getTopHotSkills).toBe('function');
      expect(typeof mod.refreshHotness).toBe('function');
      expect(typeof mod.getUserQuota).toBe('function');
      expect(typeof mod.useQuota).toBe('function');
      expect(typeof mod.createOrder).toBe('function');
      expect(typeof mod.getFirstOrderPromo).toBe('function');
      expect(typeof mod.claimFirstOrderCoupon).toBe('function');
      expect(typeof mod.applyFirstOrderDiscount).toBe('function');
      expect(typeof mod.mockPay).toBe('function');
      expect(typeof mod.getMyOrders).toBe('function');
      expect(typeof mod.getMembershipPlans).toBe('function');
      expect(typeof mod.getDigitalProducts).toBe('function');
      expect(typeof mod.submitFeedback).toBe('function');
      expect(typeof mod.getMyFeedbacks).toBe('function');
      expect(typeof mod.getRevenueDetail).toBe('function');
      expect(typeof mod.submitBusinessInquiry).toBe('function');
      expect(typeof mod.getCourses).toBe('function');
    });
  });

  describe('getUserQuota', () => {
    it('通过 payApi 调用 GET "/quota/"', async () => {
      const { getUserQuota } = await import('@/api/paymentApi');
      axiosMockGet.mockResolvedValue({ success: true, data: {} });
      await getUserQuota();
      expect(axiosMockGet).toHaveBeenCalledWith('/quota/');
    });
  });

  describe('createOrder', () => {
    it('通过 payApi 调用 POST "/create-order/"', async () => {
      const { createOrder } = await import('@/api/paymentApi');
      axiosMockPost.mockResolvedValue({ success: true, data: { order_no: 'O1' } });
      await createOrder('vip_monthly', 'SAVE10');
      expect(axiosMockPost).toHaveBeenCalledWith('/create-order/', { order_type: 'vip_monthly', coupon_code: 'SAVE10' });
    });
  });

  describe('mockPay', () => {
    it('通过 payApi 调用 POST "/mock-pay/"', async () => {
      const { mockPay } = await import('@/api/paymentApi');
      axiosMockPost.mockResolvedValue({ success: true });
      await mockPay('O123');
      expect(axiosMockPost).toHaveBeenCalledWith('/mock-pay/', { order_no: 'O123' });
    });
  });

  describe('getDigitalProducts (mallApi)', () => {
    it('通过 mallApi 调用 GET "/mall-products/hot-products/"', async () => {
      const { getDigitalProducts } = await import('@/api/paymentApi');
      axiosMockGet.mockResolvedValue([]);
      await getDigitalProducts({ category: 'tool' });
      expect(axiosMockGet).toHaveBeenCalledWith('/mall-products/hot-products/', { params: { category: 'tool' } });
    });
  });

  describe('getRevenueDetail (statsApi)', () => {
    it('通过 statsApi 调用 GET "/revenue-detail/"', async () => {
      const { getRevenueDetail } = await import('@/api/paymentApi');
      axiosMockGet.mockResolvedValue({});
      await getRevenueDetail();
      expect(axiosMockGet).toHaveBeenCalledWith('/revenue-detail/');
    });
  });
});


// ============================================================
// 16. frontApi (前台内容) - 独立 axios 实例 frontApi
// ============================================================
describe('frontApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('所有导出函数存在', async () => {
      const mod = await import('@/api/frontApi');
      expect(typeof mod.getCategories).toBe('function');
      expect(typeof mod.getArticles).toBe('function');
      expect(typeof mod.getArticleDetail).toBe('function');
      expect(typeof mod.getHotArticles).toBe('function');
      expect(typeof mod.likeArticle).toBe('function');
      expect(typeof mod.favoriteArticle).toBe('function');
      expect(typeof mod.getTags).toBe('function');
      expect(typeof mod.getAuthors).toBe('function');
      expect(typeof mod.getArticleComments).toBe('function');
      expect(typeof mod.addArticleComment).toBe('function');
      expect(typeof mod.followAuthor).toBe('function');
      expect(typeof mod.getFollowStatus).toBe('function');
      expect(typeof mod.getLikeStatus).toBe('function');
    });
  });

  describe('getCategories', () => {
    it('通过 frontApi 调用 GET "/categories/"', async () => {
      const { getCategories } = await import('@/api/frontApi');
      axiosMockGet.mockResolvedValue([]);
      await getCategories();
      expect(axiosMockGet).toHaveBeenCalledWith('/categories/');
    });
  });

  describe('likeArticle', () => {
    it('通过 frontApi 调用 POST "/articles/{id}/like/"', async () => {
      const { likeArticle } = await import('@/api/frontApi');
      axiosMockPost.mockResolvedValue({});
      await likeArticle(42);
      expect(axiosMockPost).toHaveBeenCalledWith('/articles/42/like/');
    });
  });
});


// ============================================================
// 17. content (CMS 内容管理)
// ============================================================
describe('contentApi', () => {
  let api: typeof import('@/api/content').contentApi;
  beforeAll(async () => {
    const mod = await import('@/api/content');
    api = mod.contentApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 CRUD + 批量操作方法', () => {
      expect(typeof api.getArticles).toBe('function');
      expect(typeof api.getArticle).toBe('function');
      expect(typeof api.createArticle).toBe('function');
      expect(typeof api.updateArticle).toBe('function');
      expect(typeof api.deleteArticle).toBe('function');
      expect(typeof api.uploadImage).toBe('function');
      expect(typeof api.getCategories).toBe('function');
      expect(typeof api.createCategory).toBe('function');
      expect(typeof api.updateCategory).toBe('function');
      expect(typeof api.deleteCategory).toBe('function');
      expect(typeof api.batchPublish).toBe('function');
      expect(typeof api.batchUnpublish).toBe('function');
      expect(typeof api.batchDelete).toBe('function');
      expect(typeof api.getAuthors).toBe('function');
    });
  });

  describe('createArticle', () => {
    it('调用 POST "/content/articles/"', async () => {
      mockedPost.mockResolvedValue({ id: 1, title: 'Test' });
      await api.createArticle({ title: 'Test', content: '<p>Hi</p>' });
      expect(mockedPost).toHaveBeenCalledWith('/content/articles/', { title: 'Test', content: '<p>Hi</p>' });
    });
  });

  describe('updateArticle', () => {
    it('调用 PUT "/content/articles/{id}/"', async () => {
      mockedPut.mockResolvedValue({ id: 1 });
      await api.updateArticle(1, { title: 'Updated' });
      expect(mockedPut).toHaveBeenCalledWith('/content/articles/1/', { title: 'Updated' });
    });
  });

  describe('deleteArticle', () => {
    it('调用 DELETE "/content/articles/{id}/"', async () => {
      mockedDelete.mockResolvedValue(undefined);
      await api.deleteArticle(5);
      expect(mockedDelete).toHaveBeenCalledWith('/content/articles/5/');
    });
  });
});


// ============================================================
// 18. bannerApi (Banner 管理) - 独立 axios 实例 bannerApi
// ============================================================
describe('bannerApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('所有函数存在', async () => {
      const mod = await import('@/api/bannerApi');
      expect(typeof mod.getPublicBanners).toBe('function');
      expect(typeof mod.getAdminBannerList).toBe('function');
      expect(typeof mod.createBanner).toBe('function');
      expect(typeof mod.updateBanner).toBe('function');
      expect(typeof mod.deleteBanner).toBe('function');
    });
  });

  describe('getPublicBanners', () => {
    it('通过 bannerApi 调用 GET "/public/"', async () => {
      const { getPublicBanners } = await import('@/api/bannerApi');
      axiosMockGet.mockResolvedValue([]);
      await getPublicBanners();
      expect(axiosMockGet).toHaveBeenCalledWith('/public/');
    });
  });

  describe('deleteBanner', () => {
    it('通过 bannerApi 调用 DELETE "/{id}/"', async () => {
      const { deleteBanner } = await import('@/api/bannerApi');
      axiosMockDelete.mockResolvedValue({});
      await deleteBanner(7);
      expect(axiosMockDelete).toHaveBeenCalledWith('/7/');
    });
  });
});


// ============================================================
// 19. skillConfigApi (技能配置) - 独立 axios 实例 skillApi
// ============================================================
describe('skillConfigApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('所有公开和管理函数存在', async () => {
      const mod = await import('@/api/skillConfigApi');
      expect(typeof mod.getPublicSkillList).toBe('function');
      expect(typeof mod.searchSkills).toBe('function');
      expect(typeof mod.getSkillCategories).toBe('function');
      expect(typeof mod.getSkillStats).toBe('function');
      expect(typeof mod.getSkillDetail).toBe('function');
      expect(typeof mod.batchImportSkills).toBe('function');
      expect(typeof mod.getAdminSkillList).toBe('function');
      expect(typeof mod.createSkill).toBe('function');
      expect(typeof mod.updateSkill).toBe('function');
      expect(typeof mod.deleteSkill).toBe('function');
      expect(typeof mod.toggleSkillStatus).toBe('function');
      expect(typeof mod.batchToggleSkills).toBe('function');
      expect(typeof mod.batchDeleteSkills).toBe('function');
    });
  });

  describe('searchSkills', () => {
    it('通过 skillApi 调用 GET "/public-search/"', async () => {
      const { searchSkills } = await import('@/api/skillConfigApi');
      axiosMockGet.mockResolvedValue({ results: [] });
      await searchSkills({ q: 'ai', tier: 'free' });
      expect(axiosMockGet).toHaveBeenCalledWith('/public-search/', { params: { q: 'ai', tier: 'free', page: 1 } });
    });
  });

  describe('deleteSkill', () => {
    it('通过 skillApi 调用 DELETE "/admin/{id}/"', async () => {
      const { deleteSkill } = await import('@/api/skillConfigApi');
      axiosMockDelete.mockResolvedValue({});
      await deleteSkill(99);
      expect(axiosMockDelete).toHaveBeenCalledWith('/admin/99/');
    });
  });

  describe('batchImportSkills (raw axios)', () => {
    it('直接使用 axios.post 调用批量导入', async () => {
      const { batchImportSkills } = await import('@/api/skillConfigApi');
      mockedAxiosPost.mockResolvedValue({ success: true });
      await batchImportSkills([{ name: 'test' }], true);
      expect(mockedAxiosPost).toHaveBeenCalledWith(
        '/api/skill-config/batch-import/',
        { skills: [{ name: 'test' }], overwrite: true },
        expect.objectContaining({})
      );
    });
  });
});


// ============================================================
// 20. logCenterApi (日志中心 + 系统管理 + 功能卡 + identify)
// ============================================================
describe('logCenterApi & related', () => {
  let logApi: typeof import('@/api/logCenterApi').logCenterApi;
  let sysApi: typeof import('@/api/logCenterApi').systemManageApi;
  let fcApi: typeof import('@/api/logCenterApi').functionCardApi;
  let identApi: typeof import('@/api/logCenterApi').identifyApi;
  beforeAll(async () => {
    const mod = await import('@/api/logCenterApi');
    logApi = mod.logCenterApi;
    sysApi = mod.systemManageApi;
    fcApi = mod.functionCardApi;
    identApi = mod.identifyApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('logCenterApi 接口完整性', () => {
    it('包含日志查询和导出方法', () => {
      expect(typeof logApi.getLoginLogs).toBe('function');
      expect(typeof logApi.exportLoginLogs).toBe('function');
      expect(typeof logApi.getOperationLogs).toBe('function');
      expect(typeof logApi.exportOperationLogs).toBe('function');
      expect(typeof logApi.getPermissionIntercepts).toBe('function');
      expect(typeof logApi.exportPermissionIntercepts).toBe('function');
    });
  });

  describe('logCenterApi.getLoginLogs', () => {
    it('调用 GET "/log-center/login-logs/"', async () => {
      mockedGet.mockResolvedValue({ results: [] });
      await logApi.getLoginLogs({ page: 1 });
      expect(mockedGet).toHaveBeenCalledWith('/log-center/login-logs/', { params: { page: 1 } });
    });
  });

  describe('systemManageApi 接口完整性', () => {
    it('包含用户管理和安全配置方法', () => {
      expect(typeof sysApi.getFrontendUsers).toBe('function');
      expect(typeof sysApi.banUser).toBe('function');
      expect(typeof sysApi.unbanUser).toBe('function');
      expect(typeof sysApi.resetUserInfo).toBe('function');
      expect(typeof sysApi.getUserBrowseRecords).toBe('function');
      expect(typeof sysApi.getFrontendUserStats).toBe('function');
      expect(typeof sysApi.getSecurityConfigs).toBe('function');
      expect(typeof sysApi.updateSecurityConfig).toBe('function');
      expect(typeof sysApi.refreshCache).toBe('function');
      expect(typeof sysApi.cleanupLogs).toBe('function');
    });
  });

  describe('systemManageApi.banUser', () => {
    it('调用 POST 封禁用户', async () => {
      mockedPost.mockResolvedValue({});
      await sysApi.banUser(5, 'spam account');
      expect(mockedPost).toHaveBeenCalledWith('/system-manage/frontend-users/5/ban/', { reason: 'spam account' });
    });
  });

  describe('systemManageApi.updateSecurityConfig', () => {
    it('调用 PUT 更新安全配置', async () => {
      mockedPut.mockResolvedValue({});
      await sysApi.updateSecurityConfig('max_login_attempts', '5');
      expect(mockedPut).toHaveBeenCalledWith(
        '/system-manage/security-configs/update-config/',
        { config_key: 'max_login_attempts', config_value: '5' }
      );
    });
  });

  describe('functionCardApi 接口完整性', () => {
    it('包含功能卡和知识库方法', () => {
      expect(typeof fcApi.getFunctionCards).toBe('function');
      expect(typeof fcApi.createFunctionCard).toBe('function');
      expect(typeof fcApi.updateFunctionCard).toBe('function');
      expect(typeof fcApi.deleteFunctionCard).toBe('function');
      expect(typeof fcApi.toggleCardStatus).toBe('function');
      expect(typeof fcApi.getKnowledgeBases).toBe('function');
      expect(typeof fcApi.getPublicCards).toBe('function');
    });
  });

  describe('identifyApi 接口完整性', () => {
    it('包含 Agent/RAG/风控 复合接口', () => {
      expect(typeof identApi.agentChat).toBe('function');
      expect(typeof identApi.checkContent).toBe('function');
      expect(typeof identApi.quickCheckContent).toBe('function');
      expect(typeof identApi.ragAsk).toBe('function');
      expect(typeof identApi.ragSearch).toBe('function');
    });
  });

  describe('identifyApi.agentChat', () => {
    it('调用 POST Agent 聊天接口', async () => {
      mockedPost.mockResolvedValue({ reply: 'hello' });
      await identApi.agentChat('agent-01', '你好');
      expect(mockedPost).toHaveBeenCalledWith('/api/agent/public/chat/', { agent_code: 'agent-01', message: '你好' });
    });
  });
});


// ============================================================
// 21. enterpriseApi (企业管理)
// ============================================================
describe('enterpriseApi', () => {
  let api: typeof import('@/api/enterpriseApi').enterpriseApi;
  beforeAll(async () => {
    const mod = await import('@/api/enterpriseApi');
    api = mod.enterpriseApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含企业信息/成员/API密钥/充值/版权等全部方法', () => {
      expect(typeof api.getMyEnterprise).toBe('function');
      expect(typeof api.getDashboard).toBe('function');
      expect(typeof api.createEnterprise).toBe('function');
      expect(typeof api.listMembers).toBe('function');
      expect(typeof api.addMember).toBe('function');
      expect(typeof api.removeMember).toBe('function');
      expect(typeof api.updateMemberRole).toBe('function');
      expect(typeof api.listApiKeys).toBe('function');
      expect(typeof api.createApiKey).toBe('function');
      expect(typeof api.revokeApiKey).toBe('function');
      expect(typeof api.submitRecharge).toBe('function');
      expect(typeof api.getRechargeHistory).toBe('function');
      expect(typeof api.getUsageLogs).toBe('function');
      expect(typeof api.listAllEnterprises).toBe('function');
      expect(typeof api.approveRecharge).toBe('function');
      expect(typeof api.rejectRecharge).toBe('function');
      expect(typeof api.listCopyrights).toBe('function');
      expect(typeof api.createCopyright).toBe('function');
      expect(typeof api.submitCopyright).toBe('function');
    });
  });

  describe('getMyEnterprise', () => {
    it('调用 GET "/api/enterprise/my-enterprise"', async () => {
      mockedGet.mockResolvedValue({ id: 1, name: 'TestCorp' });
      await api.getMyEnterprise();
      expect(mockedGet).toHaveBeenCalledWith('/api/enterprise/my-enterprise');
    });
  });

  describe('createEnterprise', () => {
    it('调用 POST "/api/enterprise/create"', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.createEnterprise({ name: 'NewCorp' });
      expect(mockedPost).toHaveBeenCalledWith('/api/enterprise/create', { name: 'NewCorp' });
    });
  });

  describe('revokeApiKey', () => {
    it('调用 POST "/api/enterprise/keys/revoke"', async () => {
      mockedPost.mockResolvedValue({});
      await api.revokeApiKey({ key_id: 5 });
      expect(mockedPost).toHaveBeenCalledWith('/api/enterprise/keys/revoke', { key_id: 5 });
    });
  });
});


// ============================================================
// 22. statsApi (统计分析) - 独立 axios 实例 statsApi
// ============================================================
describe('statsApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('所有统计函数存在', async () => {
      const mod = await import('@/api/statsApi');
      expect(typeof mod.getStatsOverview).toBe('function');
      expect(typeof mod.getStatsSkills).toBe('function');
      expect(typeof mod.getStatsAreas).toBe('function');
      expect(typeof mod.getStatsRevenue).toBe('function');
      expect(typeof mod.refreshStats).toBe('function');
    });
  });

  describe('getStatsOverview', () => {
    it('通过 statsApi 调用 GET "/overview/"', async () => {
      const { getStatsOverview } = await import('@/api/statsApi');
      axiosMockGet.mockResolvedValue({ success: true, data: {} });
      await getStatsOverview(14);
      expect(axiosMockGet).toHaveBeenCalledWith('/overview/', { params: { days: 14 } });
    });
  });

  describe('refreshStats', () => {
    it('通过 statsApi 调用 POST "/refresh-stats/"', async () => {
      const { refreshStats } = await import('@/api/statsApi');
      axiosMockPost.mockResolvedValue({});
      await refreshStats('2026-06-01');
      expect(axiosMockPost).toHaveBeenCalledWith('/refresh-stats/', { target_date: '2026-06-01' });
    });
  });
});


// ============================================================
// 23. affiliateApi (推广联盟) - 独立 axios 实例 affApi
// ============================================================
describe('affiliateApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('所有联盟函数存在', async () => {
      const mod = await import('@/api/affiliateApi');
      expect(typeof mod.getAffiliateDashboard).toBe('function');
      expect(typeof mod.generateInviteLink).toBe('function');
      expect(typeof mod.getInvitedUsers).toBe('function');
      expect(typeof mod.getCommissions).toBe('function');
      expect(typeof mod.requestWithdrawal).toBe('function');
      expect(typeof mod.getWithdrawals).toBe('function');
      expect(typeof mod.getMembershipPlans).toBe('function');
    });
  });

  describe('getAffiliateDashboard', () => {
    it('通过 affApi 调用 GET "/affiliate/dashboard/"', async () => {
      const { getAffiliateDashboard } = await import('@/api/affiliateApi');
      axiosMockGet.mockResolvedValue({ success: true, data: {} });
      await getAffiliateDashboard();
      expect(axiosMockGet).toHaveBeenCalledWith('/affiliate/dashboard/');
    });
  });

  describe('requestWithdrawal', () => {
    it('通过 affApi 调用 POST "/affiliate/withdraw/"', async () => {
      const { requestWithdrawal } = await import('@/api/affiliateApi');
      axiosMockPost.mockResolvedValue({});
      await requestWithdrawal(100, 'ICBC', '622202', '张三');
      expect(axiosMockPost).toHaveBeenCalledWith('/affiliate/withdraw/', {
        amount: 100,
        bank_name: 'ICBC',
        account_no: '622202',
        account_holder: '张三',
      });
    });
  });
});


// ============================================================
// 24. promoCardApi (推广卡片) - 独立 axios 实例 promoApi
// ============================================================
describe('promoCardApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('getFeedPromoCards 和 trackPromoClick 存在', async () => {
      const mod = await import('@/api/promoCardApi');
      expect(typeof mod.getFeedPromoCards).toBe('function');
      expect(typeof mod.trackPromoClick).toBe('function');
    });
  });

  describe('getFeedPromoCards', () => {
    it('通过 promoApi 调用 GET "/promo-card/feed-cards/"', async () => {
      const { getFeedPromoCards } = await import('@/api/promoCardApi');
      axiosMockGet.mockResolvedValue([]);
      await getFeedPromoCards('feed_top', 5);
      expect(axiosMockGet).toHaveBeenCalledWith('/promo-card/feed-cards/', { params: { position: 'feed_top', limit: 5 } });
    });
  });

  describe('trackPromoClick', () => {
    it('通过 promoApi 调用 POST "/promo-card/track-click/"', async () => {
      const { trackPromoClick } = await import('@/api/promoCardApi');
      axiosMockPost.mockResolvedValue({});
      await trackPromoClick(42);
      expect(axiosMockPost).toHaveBeenCalledWith('/promo-card/track-click/', { card_id: 42 });
    });
  });
});


// ============================================================
// 25. mallApi (商城)
// ============================================================
describe('mallApi', () => {
  let api: typeof import('@/api/mallApi').mallApi;
  beforeAll(async () => {
    const mod = await import('@/api/mallApi');
    api = mod.mallApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含商品/订单/支付/提现/模板 全部方法', () => {
      expect(typeof api.getProducts).toBe('function');
      expect(typeof api.getProductDetail).toBe('function');
      expect(typeof api.createProduct).toBe('function');
      expect(typeof api.updateProduct).toBe('function');
      expect(typeof api.deleteProduct).toBe('function');
      expect(typeof api.getMyProducts).toBe('function');
      expect(typeof api.getHotProducts).toBe('function');
      expect(typeof api.getCategories).toBe('function');
      expect(typeof api.toggleProductStatus).toBe('function');
      expect(typeof api.getOrders).toBe('function');
      expect(typeof api.getOrderDetail).toBe('function');
      expect(typeof api.createOrder).toBe('function');
      expect(typeof api.cancelOrder).toBe('function');
      expect(typeof api.getMyOrders).toBe('function');
      expect(typeof api.getOrderStats).toBe('function');
      expect(typeof api.createPayment).toBe('function');
      expect(typeof api.paymentCallback).toBe('function');
      expect(typeof api.getMyPayments).toBe('function');
      expect(typeof api.applyWithdrawal).toBe('function');
      expect(typeof api.getMyWithdrawals).toBe('function');
      expect(typeof api.getAdminWithdrawals).toBe('function');
      expect(typeof api.handleWithdrawal).toBe('function');
      expect(typeof api.getTemplates).toBe('function');
      expect(typeof api.getTemplateDetail).toBe('function');
      expect(typeof api.getTrendingTemplates).toBe('function');
      expect(typeof api.useTemplate).toBe('function');
    });
  });

  describe('createProduct', () => {
    it('调用 POST "/mall/mall-products/"', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.createProduct({ title: 'Product A', price: 99 } as any);
      expect(mockedPost).toHaveBeenCalledWith('/mall/mall-products/', { title: 'Product A', price: 99 });
    });
  });

  describe('deleteProduct', () => {
    it('调用 DELETE "/mall/mall-products/{id}/"', async () => {
      mockedDelete.mockResolvedValue(undefined);
      await api.deleteProduct(10);
      expect(mockedDelete).toHaveBeenCalledWith('/mall/mall-products/10/');
    });
  });

  describe('handleWithdrawal', () => {
    it('调用 POST "/mall/mall-withdrawals/handle/"', async () => {
      mockedPost.mockResolvedValue({});
      await api.handleWithdrawal({ withdrawal_id: 5, action: 'approve', remark: 'OK' });
      expect(mockedPost).toHaveBeenCalledWith('/mall/mall-withdrawals/handle/', { withdrawal_id: 5, action: 'approve', remark: 'OK' });
    });
  });
});


// ============================================================
// 26. systemApi (系统管理 - 隐私协议/IM/自动回复/语音)
// ============================================================
describe('systemApi', () => {
  let api: typeof import('@/api/systemApi').systemApi;
  beforeAll(async () => {
    const mod = await import('@/api/systemApi');
    api = mod.systemApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('隐私协议相关方法完整', () => {
      expect(typeof api.getActiveAgreements).toBe('function');
      expect(typeof api.getAgreements).toBe('function');
      expect(typeof api.createAgreement).toBe('function');
      expect(typeof api.updateAgreement).toBe('function');
      expect(typeof api.deleteAgreement).toBe('function');
      expect(typeof api.submitConsent).toBe('function');
      expect(typeof api.checkConsent).toBe('function');
      expect(typeof api.getConsentRecords).toBe('function');
    });
    it('IM 相关方法完整', () => {
      expect(typeof api.sendIMMessage).toBe('function');
      expect(typeof api.getIMHistory).toBe('function');
      expect(typeof api.getIMSessions).toBe('function');
      expect(typeof api.getAdminIMMessages).toBe('function');
      expect(typeof api.markIMRead).toBe('function');
    });
    it('自动回复和语音方法完整', () => {
      expect(typeof api.getAutoReplies).toBe('function');
      expect(typeof api.createAutoReply).toBe('function');
      expect(typeof api.updateAutoReply).toBe('function');
      expect(typeof api.deleteAutoReply).toBe('function');
      expect(typeof api.getVoiceConfig).toBe('function');
      expect(typeof api.updateVoiceConfig).toBe('function');
    });
  });

  describe('submitConsent', () => {
    it('调用 POST 提交用户同意', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.submitConsent({ user_id: 1, username: 'test', agreement_type: 'privacy', agreement_version: 'v1', status: 'agreed' });
      expect(mockedPost).toHaveBeenCalledWith('/system/privacy/consent/', {
        user_id: 1, username: 'test', agreement_type: 'privacy', agreement_version: 'v1', status: 'agreed',
      });
    });
  });

  describe('deleteAutoReply', () => {
    it('调用 DELETE 删除自动回复规则', async () => {
      mockedDelete.mockResolvedValue(undefined);
      await api.deleteAutoReply(3);
      expect(mockedDelete).toHaveBeenCalledWith('/system/auto-replies/3/');
    });
  });
});


// ============================================================
// 27. securityTestApi (安全测试引擎)
// ============================================================
describe('securityTestApi', () => {
  let api: typeof import('@/api/securityTestApi').securityTestApi;
  beforeAll(async () => {
    const mod = await import('@/api/securityTestApi');
    api = mod.securityTestApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含测试用例/漏洞管理/运行引擎方法', () => {
      expect(typeof api.getTestCases).toBe('function');
      expect(typeof api.createTestCase).toBe('function');
      expect(typeof api.updateTestCase).toBe('function');
      expect(typeof api.deleteTestCase).toBe('function');
      expect(typeof api.runAllTests).toBe('function');
      expect(typeof api.quickCheck).toBe('function');
      expect(typeof api.getVulnerabilities).toBe('function');
      expect(typeof api.updateVulnerability).toBe('function');
      expect(typeof api.getVulnStatistics).toBe('function');
    });
  });

  describe('runAllTests', () => {
    it('调用 POST "/security/engine/run_all/"', async () => {
      mockedPost.mockResolvedValue({ run_id: 'r1' });
      await api.runAllTests('xss');
      expect(mockedPost).toHaveBeenCalledWith('/security/engine/run_all/', { category: 'xss' });
    });
  });

  describe('quickCheck', () => {
    it('调用 POST "/security/engine/run_quick/"', async () => {
      mockedPost.mockResolvedValue({ is_safe: true });
      await api.quickCheck('<script>alert(1)</script>');
      expect(mockedPost).toHaveBeenCalledWith('/security/engine/run_quick/', { content: '<script>alert(1)</script>' });
    });
  });

  describe('updateVulnerability', () => {
    it('调用 PATCH 更新漏洞', async () => {
      mockedPatch.mockResolvedValue({ id: 1 });
      await api.updateVulnerability(1, { status: 'fixed' } as any);
      expect(mockedPatch).toHaveBeenCalledWith('/security/vulnerabilities/1/', { status: 'fixed' });
    });
  });
});


// ============================================================
// 28. securityCenterApi (安全中心)
// ============================================================
describe('securityCenterApi', () => {
  let api: typeof import('@/api/securityCenterApi').securityCenterApi;
  beforeAll(async () => {
    const mod = await import('@/api/securityCenterApi');
    api = mod.securityCenterApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含仪表盘/日志/告警/报告方法', () => {
      expect(typeof api.getDashboardSummary).toBe('function');
      expect(typeof api.getScoreHistory).toBe('function');
      expect(typeof api.getUnifiedLogs).toBe('function');
      expect(typeof api.getAlerts).toBe('function');
      expect(typeof api.getAlertDetail).toBe('function');
      expect(typeof api.acknowledgeAlert).toBe('function');
      expect(typeof api.resolveAlert).toBe('function');
      expect(typeof api.batchResolveAlerts).toBe('function');
      expect(typeof api.getAlertStatistics).toBe('function');
      expect(typeof api.getReports).toBe('function');
      expect(typeof api.generateReport).toBe('function');
      expect(typeof api.exportReport).toBe('function');
    });
  });

  describe('resolveAlert', () => {
    it('调用 POST 解决告警并传入 note', async () => {
      mockedPost.mockResolvedValue({});
      await api.resolveAlert(5, '已修复');
      expect(mockedPost).toHaveBeenCalledWith('/security-center/alerts/5/resolve/', { note: '已修复' });
    });
  });

  describe('batchResolveAlerts', () => {
    it('调用 POST 批量解决告警', async () => {
      mockedPost.mockResolvedValue({});
      await api.batchResolveAlerts([1, 2, 3], '批量处理');
      expect(mockedPost).toHaveBeenCalledWith('/security-center/alerts/batch_resolve/', { ids: [1, 2, 3], note: '批量处理' });
    });
  });
});


// ============================================================
// 29. securityApi (安全规则/风控日志/检测) - 独立 axios 实例
// ============================================================
describe('securityApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('安全规则 CRUD + 统计方法存在', async () => {
      const mod = await import('@/api/securityApi');
      expect(typeof mod.getSecurityRules).toBe('function');
      expect(typeof mod.getSecurityRule).toBe('function');
      expect(typeof mod.createSecurityRule).toBe('function');
      expect(typeof mod.updateSecurityRule).toBe('function');
      expect(typeof mod.deleteSecurityRule).toBe('function');
      expect(typeof mod.toggleSecurityRule).toBe('function');
      expect(typeof mod.getSecurityStatistics).toBe('function');
    });
    it('风控日志和检测方法存在', async () => {
      const mod = await import('@/api/securityApi');
      expect(typeof mod.getRiskLogs).toBe('function');
      expect(typeof mod.getRiskLogSummary).toBe('function');
      expect(typeof mod.checkContentSecurity).toBe('function');
      expect(typeof mod.checkToolPermission).toBe('function');
    });
  });

  describe('createSecurityRule', () => {
    it('通过 securityApi 调用 POST "/rules/"', async () => {
      const { createSecurityRule } = await import('@/api/securityApi');
      axiosMockPost.mockResolvedValue({ id: 1 });
      await createSecurityRule({ name: 'No XSS', rule_type: 'regex', pattern: '<script' } as any);
      expect(axiosMockPost).toHaveBeenCalledWith('/rules/', { name: 'No XSS', rule_type: 'regex', pattern: '<script' });
    });
  });

  describe('checkContentSecurity', () => {
    it('通过 securityApi 调用 POST "/check/check_content/"', async () => {
      const { checkContentSecurity } = await import('@/api/securityApi');
      axiosMockPost.mockResolvedValue({ is_safe: true });
      await checkContentSecurity({ content: 'safe text' } as any);
      expect(axiosMockPost).toHaveBeenCalledWith('/check/check_content/', { content: 'safe text' });
    });
  });
});


// ============================================================
// 30. riskControlApi (多则规则风控)
// ============================================================
describe('riskControlApi', () => {
  let api: typeof import('@/api/riskControlApi').riskControlApi;
  beforeAll(async () => {
    const mod = await import('@/api/riskControlApi');
    api = mod.riskControlApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('规则 CRUD + 测试 + 审计日志 + 检测方法完整', () => {
      expect(typeof api.getRules).toBe('function');
      expect(typeof api.getRuleDetail).toBe('function');
      expect(typeof api.createRule).toBe('function');
      expect(typeof api.updateRule).toBe('function');
      expect(typeof api.deleteRule).toBe('function');
      expect(typeof api.getCategories).toBe('function');
      expect(typeof api.getStatistics).toBe('function');
      expect(typeof api.testRule).toBe('function');
      expect(typeof api.testRawPattern).toBe('function');
      expect(typeof api.batchToggle).toBe('function');
      expect(typeof api.batchDelete).toBe('function');
      expect(typeof api.batchImport).toBe('function');
      expect(typeof api.exportRules).toBe('function');
      expect(typeof api.getAuditLogs).toBe('function');
      expect(typeof api.deleteAuditLog).toBe('function');
      expect(typeof api.getAuditStatistics).toBe('function');
      expect(typeof api.checkContent).toBe('function');
      expect(typeof api.quickCheck).toBe('function');
    });
  });

  describe('testRule', () => {
    it('调用 POST "/risk-control/rules/{id}/test/"', async () => {
      mockedPost.mockResolvedValue({ valid: true, matched: false });
      await api.testRule(5, 'test input string');
      expect(mockedPost).toHaveBeenCalledWith('/risk-control/rules/5/test/', { text: 'test input string' });
    });
  });

  describe('checkContent', () => {
    it('调用 POST "/risk-control/check/check/"', async () => {
      mockedPost.mockResolvedValue({ is_safe: true });
      await api.checkContent('bad word');
      expect(mockedPost).toHaveBeenCalledWith('/risk-control/check/check/', { content: 'bad word', source: 'web' });
    });
  });

  describe('batchImport', () => {
    it('调用 POST "/risk-control/rules/batch_import/"', async () => {
      mockedPost.mockResolvedValue({ imported: 3 });
      await api.batchImport([{ name: 'rule1' }] as any, true);
      expect(mockedPost).toHaveBeenCalledWith('/risk-control/rules/batch_import/', { rules: [{ name: 'rule1' }], overwrite: true });
    });
  });
});


// ============================================================
// 31. rbacApi (RBAC 权限管理)
// ============================================================
describe('rbacApi', () => {
  let api: typeof import('@/api/rbacApi').rbacApi;
  beforeAll(async () => {
    const mod = await import('@/api/rbacApi');
    api = mod.rbacApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('角色管理方法完整', () => {
      expect(typeof api.getRoles).toBe('function');
      expect(typeof api.getRoleDetail).toBe('function');
      expect(typeof api.createRole).toBe('function');
      expect(typeof api.updateRole).toBe('function');
      expect(typeof api.deleteRole).toBe('function');
      expect(typeof api.assignPermissions).toBe('function');
    });
    it('权限管理方法完整', () => {
      expect(typeof api.getPermissions).toBe('function');
      expect(typeof api.getPermissionTree).toBe('function');
      expect(typeof api.createPermission).toBe('function');
      expect(typeof api.updatePermission).toBe('function');
      expect(typeof api.deletePermission).toBe('function');
    });
    it('菜单管理方法完整', () => {
      expect(typeof api.getMenus).toBe('function');
      expect(typeof api.getMenuTree).toBe('function');
      expect(typeof api.getUserMenus).toBe('function');
      expect(typeof api.createMenu).toBe('function');
      expect(typeof api.updateMenu).toBe('function');
      expect(typeof api.deleteMenu).toBe('function');
    });
    it('用户管理方法完整', () => {
      expect(typeof api.getUserManageList).toBe('function');
      expect(typeof api.getUserManageDetail).toBe('function');
      expect(typeof api.createUser).toBe('function');
      expect(typeof api.updateUser).toBe('function');
      expect(typeof api.deleteUser).toBe('function');
      expect(typeof api.resetPassword).toBe('function');
      expect(typeof api.assignRoles).toBe('function');
    });
    it('日志方法完整', () => {
      expect(typeof api.getOperationLogs).toBe('function');
      expect(typeof api.getAuditLogs).toBe('function');
    });
  });

  describe('assignPermissions', () => {
    it('调用 POST 分配权限', async () => {
      mockedPost.mockResolvedValue({});
      await api.assignPermissions(3, [1, 2, 5]);
      expect(mockedPost).toHaveBeenCalledWith('/rbac/roles/3/assign_permissions/', { permission_ids: [1, 2, 5] });
    });
  });

  describe('resetPassword', () => {
    it('调用 POST 重置密码', async () => {
      mockedPost.mockResolvedValue({ message: 'ok' });
      await api.resetPassword(7, 'newPass123');
      expect(mockedPost).toHaveBeenCalledWith('/rbac/users-manage/7/reset_password/', { new_password: 'newPass123' });
    });
  });
});


// ============================================================
// 32. ragAuditApi (RAG 操作审计)
// ============================================================
describe('ragAuditApi', () => {
  let api: typeof import('@/api/ragAuditApi').ragAuditApi;
  beforeAll(async () => {
    const mod = await import('@/api/ragAuditApi');
    api = mod.ragAuditApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('包含 getLogs 和 getStatistics', () => {
      expect(typeof api.getLogs).toBe('function');
      expect(typeof api.getStatistics).toBe('function');
    });
  });

  describe('getLogs', () => {
    it('调用 GET "/rag/operation-logs/"', async () => {
      mockedGet.mockResolvedValue({ results: [] });
      await api.getLogs({ action: 'upload', page: 1 });
      expect(mockedGet).toHaveBeenCalledWith('/rag/operation-logs/', { params: { action: 'upload', page: 1 } });
    });
  });
});


// ============================================================
// 33. ragApi (RAG 知识库) - 独立 axios 实例 ragApi
// ============================================================
describe('ragApi', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('知识库分类/文档/检索问答/日志 函数完整', async () => {
      const mod = await import('@/api/ragApi');
      expect(typeof mod.getKBCategories).toBe('function');
      expect(typeof mod.getKBStatistics).toBe('function');
      expect(typeof mod.getDocuments).toBe('function');
      expect(typeof mod.uploadDocument).toBe('function');
      expect(typeof mod.getDocumentDetail).toBe('function');
      expect(typeof mod.getDocumentChunks).toBe('function');
      expect(typeof mod.deleteDocument).toBe('function');
      expect(typeof mod.searchKnowledgeBase).toBe('function');
      expect(typeof mod.askQuestion).toBe('function');
      expect(typeof mod.getRetrievalLogs).toBe('function');
    });
  });

  describe('askQuestion', () => {
    it('通过 ragApi 调用 POST "/search/ask/"', async () => {
      const { askQuestion } = await import('@/api/ragApi');
      axiosMockPost.mockResolvedValue({ answer: 'hello' });
      await askQuestion({ question: '什么是RAG?' });
      expect(axiosMockPost).toHaveBeenCalledWith('/search/ask/', { question: '什么是RAG?' });
    });
  });

  describe('deleteDocument', () => {
    it('通过 ragApi 调用 DELETE 删除文档', async () => {
      const { deleteDocument } = await import('@/api/ragApi');
      axiosMockDelete.mockResolvedValue({});
      await deleteDocument(10);
      expect(axiosMockDelete).toHaveBeenCalledWith('/documents/10/delete_with_chunks/');
    });
  });
});


// ============================================================
// 34. agentApi (Agent 配置与聊天)
// ============================================================
describe('agentApi', () => {
  let api: typeof import('@/api/agentApi').agentApi;
  beforeAll(async () => {
    const mod = await import('@/api/agentApi');
    api = mod.agentApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('配置管理/聊天/验证记录 方法完整', () => {
      expect(typeof api.getConfigs).toBe('function');
      expect(typeof api.getConfigDetail).toBe('function');
      expect(typeof api.updateConfig).toBe('function');
      expect(typeof api.batchUpdateConfigs).toBe('function');
      expect(typeof api.getPublicConfigs).toBe('function');
      expect(typeof api.sendMessage).toBe('function');
      expect(typeof api.getVerificationRecords).toBe('function');
      expect(typeof api.triggerVerification).toBe('function');
    });
  });

  describe('sendMessage', () => {
    it('调用 POST "/agent/public/chat/"', async () => {
      mockedPost.mockResolvedValue({ reply: 'hi', session_id: 's1' });
      await api.sendMessage({ agent_code: 'chatbot', message: '你好' });
      expect(mockedPost).toHaveBeenCalledWith('/agent/public/chat/', { agent_code: 'chatbot', message: '你好' });
    });
  });

  describe('triggerVerification', () => {
    it('调用 POST "/agent/verification/" 触发验证', async () => {
      mockedPost.mockResolvedValue({ id: 1 });
      await api.triggerVerification(100, 'fact-checker');
      expect(mockedPost).toHaveBeenCalledWith('/agent/verification/', { article_id: 100, agent_code: 'fact-checker' });
    });
  });
});


// ============================================================
// 35. data (数据概览/导出/分析/配置)
// ============================================================
describe('dataApi', () => {
  let api: typeof import('@/api/data').dataApi;
  beforeAll(async () => {
    const mod = await import('@/api/data');
    api = mod.dataApi;
  });
  beforeEach(() => { vi.clearAllMocks(); });

  describe('接口完整性', () => {
    it('数据概览/导出/分析/配置/个人资料 方法完整', () => {
      expect(typeof api.getOverview).toBe('function');
      expect(typeof api.exportData).toBe('function');
      expect(typeof api.getExportHistory).toBe('function');
      expect(typeof api.getAnalysis).toBe('function');
      expect(typeof api.getConfigs).toBe('function');
      expect(typeof api.updateConfigs).toBe('function');
      expect(typeof api.updateProfile).toBe('function');
    });
  });

  describe('exportData', () => {
    it('调用 POST "/data/export/"', async () => {
      mockedPost.mockResolvedValue({ id: 1, export_type: 'articles' });
      await api.exportData('articles');
      expect(mockedPost).toHaveBeenCalledWith('/data/export/', { export_type: 'articles' });
    });
  });

  describe('updateConfigs', () => {
    it('调用 PUT "/data/config/"', async () => {
      mockedPut.mockResolvedValue([{ key: 'k1', value: 'v1' }]);
      await api.updateConfigs([{ key: 'site_name', value: 'MySite' }]);
      expect(mockedPut).toHaveBeenCalledWith('/data/config/', { items: [{ key: 'site_name', value: 'MySite' }] });
    });
  });
});
