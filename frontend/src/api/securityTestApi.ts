import request from '@/utils/request';

export interface TestCaseItem {
  id: number;
  name: string;
  category: string;
  description: string;
  input_payload: string;
  expected_risk_level: string;
  expected_action: string;
  expected_pattern: string;
  severity: string;
  tags: string[];
  status: string;
}

export interface VulnerabilityItem {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  detected_input: string;
  matched_pattern: string;
  fix_description: string;
  created_at: string;
}

export interface TestResult {
  case_id: number;
  name: string;
  status: 'pass' | 'fail' | 'error';
  expected: string;
  actual: string;
  risk_level: string;
  matched_rules: any[];
  duration_ms: number;
}

export interface TestReport {
  run_id: string;
  started_at: string;
  completed_at: string;
  total_cases: number;
  passed: number;
  failed: number;
  skipped: number;
  score: number;
  results: TestResult[];
  summary: {
    by_category: Record<string, any>;
    by_severity: Record<string, any>;
    vulnerabilities_found: number;
    recommendations: string[];
  };
}

export const securityTestApi = {
  getTestCases: (params?: { category?: string; status?: string }) =>
    request.get('/security/test-cases/', { params }),

  createTestCase: (data: Partial<TestCaseItem>) =>
    request.post('/security/test-cases/', data),

  updateTestCase: (id: number, data: Partial<TestCaseItem>) =>
    request.put(`/security/test-cases/${id}/`, data),

  deleteTestCase: (id: number) =>
    request.delete(`/security/test-cases/${id}/`),

  runAllTests: (category?: string) =>
    request.post('/security/engine/run_all/', { category: category || 'all' }),

  quickCheck: (content: string) =>
    request.post('/security/engine/run_quick/', { content }),

  getVulnerabilities: (params?: { status?: string; severity?: string }) =>
    request.get('/security/vulnerabilities/', { params }),

  updateVulnerability: (id: number, data: Partial<VulnerabilityItem>) =>
    request.patch(`/security/vulnerabilities/${id}/`, data),

  getVulnStatistics: () =>
    request.get('/security/vulnerabilities/statistics/'),
};
