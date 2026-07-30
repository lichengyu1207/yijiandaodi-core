/**
 * 报告生成API
 * 
 * 三份报告交付：
 * 1. 创作时间线报告 - 记录创作过程、时间戳证据链
 * 2. 素材风险报告 - 图片AI生成概率、版权风险评估
 * 3. 账号资产报告 - 校验历史、安全积分、行为图谱
 */

import request from '../utils/request';

// 生成报告
export const generateReport = (data: {
  report_type: 'timeline' | 'material_risk' | 'account_asset' | 'full';
  start_date?: string;
  end_date?: string;
}) => {
  return request.post('/api/report/generate/', data);
};

// 快速生成三合一报告
export const quickGenerateReport = () => {
  return request.post('/api/report/quick_report/');
};

// 获取报告列表
export const getReportList = (params?: {
  report_type?: string;
  status?: string;
}) => {
  return request.get('/api/report/', { params });
};

// 获取报告详情
export const getReportDetail = (id: string) => {
  return request.get(`/api/report/${id}/`);
};

// 下载报告文件
export const downloadReport = (id: string) => {
  return `/api/report/download/${id}/`;
};

// 获取账号资产
export const getAccountAsset = () => {
  return request.get('/api/report/asset/');
};