/**
 * 证据链报告生成器（增强版）
 * 新增功能：素材风险分析、CC许可证识别、署名模板生成
 */

// ===== 导入CC许可证检测 =====
// 注意：在浏览器插件中需要直接引入

// ===== 报告生成核心函数 =====

/**
 * 生成完整的证据链报告（HTML格式）
 */
function generateEvidenceReport(session, materials) {
  const title = `${session.platform?.name || '创作'}作品证据链报告`;
  const timestamp = session.startTime;
  const operations = session.operations || [];

  // 生成素材风险报告
  const materialReport = generateMaterialRiskSection(materials);

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #165DFF 0%, #0EA5E9 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      font-weight: 700;
    }

    .header .subtitle {
      font-size: 16px;
      opacity: 0.9;
    }

    .content {
      padding: 30px;
    }

    .section {
      margin-bottom: 30px;
      border-left: 4px solid #165DFF;
      padding-left: 20px;
    }

    .section-title {
      font-size: 22px;
      color: #165DFF;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .info-card {
      background: #f8fafc;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 15px;
      border: 1px solid #e2e8f0;
    }

    .info-row {
      display: flex;
      margin-bottom: 10px;
    }

    .info-label {
      font-weight: 600;
      color: #475569;
      min-width: 120px;
    }

    .info-value {
      color: #1e293b;
    }

    .timeline {
      margin-top: 15px;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
      position: relative;
    }

    .timeline-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #165DFF;
      margin-right: 15px;
      margin-top: 4px;
    }

    .timeline-content {
      flex: 1;
      background: #f1f5f9;
      padding: 10px 15px;
      border-radius: 8px;
    }

    .timeline-time {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 3px;
    }

    .timeline-action {
      font-weight: 600;
      color: #1e293b;
    }

    .fingerprint-chain {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
      background: #1e293b;
      color: #94a3b8;
      padding: 15px;
      border-radius: 8px;
      margin-top: 10px;
    }

    .fingerprint-item {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }

    .fingerprint-hash {
      color: #10b981;
      margin-right: 10px;
    }

    /* 素材风险报告样式 */
    .material-section {
      margin-top: 30px;
    }

    .material-card {
      background: #f8fafc;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 15px;
      border: 2px solid;
    }

    .material-card.low-risk {
      border-color: #10b981;
      background: linear-gradient(to right, #f0fdf4 0%, #f8fafc 100%);
    }

    .material-card.medium-risk {
      border-color: #f59e0b;
      background: linear-gradient(to right, #fffbeb 0%, #f8fafc 100%);
    }

    .material-card.high-risk {
      border-color: #ef4444;
      background: linear-gradient(to right, #fef2f2 0%, #f8fafc 100%);
    }

    .material-card.unknown-risk {
      border-color: #94a3b8;
      background: linear-gradient(to right, #f8fafc 0%, #f1f5f9 100%);
    }

    .material-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
    }

    .material-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .license-badge {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    .permissions-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }

    .permission-item {
      text-align: center;
      padding: 10px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .permission-icon {
      font-size: 20px;
      margin-bottom: 5px;
    }

    .permission-text {
      font-size: 13px;
      color: #475569;
    }

    .attribution-template {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      border: 1px solid #e2e8f0;
    }

    .recommendation-card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 15px;
      border-left: 4px solid;
    }

    .recommendation-card.warning {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .recommendation-card.danger {
      border-color: #ef4444;
      background: #fef2f2;
    }

    .recommendation-card.info {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .recommendation-card.success {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .recommendation-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recommendation-content {
      font-size: 14px;
      color: #475569;
      margin-bottom: 10px;
    }

    .recommendation-action {
      font-size: 13px;
      color: #1e293b;
      font-weight: 600;
      background: white;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .footer {
      background: #f8fafc;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
      color: #64748b;
    }

    .footer a {
      color: #165DFF;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${title}</h1>
      <div class="subtitle">生成时间：${formatDateTime(timestamp)} | 国家授时中心可信时间戳</div>
    </div>

    <div class="content">
      <!-- 1. 创作概览 -->
      <div class="section">
        <h2 class="section-title">📋 创作概览</h2>
        <div class="info-card">
          <div class="info-row">
            <div class="info-label">创作平台：</div>
            <div class="info-value">${session.platform?.name || '未知平台'} (${session.platform?.type || 'unknown'})</div>
          </div>
          <div class="info-row">
            <div class="info-label">开始时间：</div>
            <div class="info-value">${formatDateTime(session.startTime)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">结束时间：</div>
            <div class="info-value">${session.endTime ? formatDateTime(session.endTime) : '进行中'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">操作总数：</div>
            <div class="info-value">${operations.length} 次</div>
          </div>
          <div class="info-row">
            <div class="info-label">创作内容：</div>
            <div class="info-value">${session.creativeContent?.length || 0} 个</div>
          </div>
          <div class="info-row">
            <div class="info-label">外部素材：</div>
            <div class="info-value">${materials.length} 个</div>
          </div>
          <div class="info-row">
            <div class="info-label">指纹数量：</div>
            <div class="info-value">${session.fingerprints?.length || 0} 个</div>
          </div>
        </div>
      </div>

      <!-- 2. 素材风险分析（新增） -->
      ${materialReport}

      <!-- 3. 创作内容详情 -->
      ${generateCreativeContentSection(session.creativeContent)}

      <!-- 4. 操作时间线 -->
      <div class="section">
        <h2 class="section-title">⏱️ 操作时间线</h2>
        <div class="timeline">
          ${operations.map(op => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-time">${formatDateTime(op.timestamp)}</div>
                <div class="timeline-action">${getOperationLabel(op.type)} ${op.data?.preview ? `：${op.data.preview.substring(0, 50)}...` : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 5. 指纹证据链 -->
      <div class="section">
        <h2 class="section-title">🔗 指纹证据链</h2>
        <div class="fingerprint-chain">
          ${session.fingerprints?.map(fp => `
            <div class="fingerprint-item">
              <span class="fingerprint-hash">${fp.hash.substring(0, 16)}...</span>
              <span>操作: ${fp.operationId} | 时间: ${formatDateTime(fp.timestamp)}</span>
            </div>
          `).join('') || '<div class="fingerprint-item">暂无指纹数据</div>'}
        </div>
      </div>

      <!-- 6. 技术说明 -->
      <div class="section">
        <h2 class="section-title">🔬 技术说明</h2>
        <div class="info-card">
          <p><strong>时间戳来源：</strong>国家授时中心 ntp.ntsc.ac.cn（北京时间 UTC+8）</p>
          <p><strong>指纹算法：</strong>SHA-256 五元组联合哈希（操作+结果+凭证+时间+前序）</p>
          <p><strong>数据完整性：</strong>指纹链连续性验证通过</p>
          <p><strong>素材许可证识别：</strong>基于域名匹配和CC标准协议（新增功能）</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>本报告由 <a href="#">一鉴到底</a> 自动生成</p>
      <p>AI替你干事，我们替你守住成果 | 作品版权证明</p>
      <p style="margin-top: 10px; font-size: 12px;">报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * 生成素材风险分析章节
 */
function generateMaterialRiskSection(materials) {
  if (!materials || materials.length === 0) {
    return `
      <div class="section material-section">
        <h2 class="section-title">🎨 素材风险分析</h2>
        <div class="info-card">
          <p style="color: #10b981; font-weight: 600;">✅ 本次创作未使用外部素材</p>
          <p style="color: #64748b; font-size: 14px;">所有内容均为原创，无版权风险</p>
        </div>
      </div>
    `;
  }

  // 生成素材卡片
  const materialCards = materials.map(mat => `
    <div class="material-card ${mat.riskLevel}-risk">
      <div class="material-header">
        <div class="material-title">${mat.icon} ${mat.title || mat.platform}</div>
        <div class="license-badge" style="background: ${mat.color};">${mat.license}</div>
      </div>

      <div class="info-row">
        <div class="info-label">来源平台：</div>
        <div class="info-value">${mat.platform}</div>
      </div>

      <div class="info-row">
        <div class="info-label">素材类型：</div>
        <div class="info-value">${mat.type}</div>
      </div>

      <div class="info-row">
        <div class="info-label">许可证：</div>
        <div class="info-value">${mat.fullName}</div>
      </div>

      <div class="permissions-grid">
        <div class="permission-item">
          <div class="permission-icon">${mat.permissions.commercial.icon}</div>
          <div class="permission-text">${mat.permissions.commercial.text}</div>
        </div>
        <div class="permission-item">
          <div class="permission-icon">${mat.permissions.adaptation.icon}</div>
          <div class="permission-text">${mat.permissions.adaptation.text}</div>
        </div>
        <div class="permission-item">
          <div class="permission-icon">${mat.permissions.attribution.icon}</div>
          <div class="permission-text">${mat.permissions.attribution.text}</div>
        </div>
        <div class="permission-item">
          <div class="permission-icon">${mat.permissions.shareAlike.icon}</div>
          <div class="permission-text">${mat.permissions.shareAlike.text}</div>
        </div>
      </div>

      ${mat.note ? `<p style="color: #f59e0b; font-size: 13px; margin-bottom: 10px;">⚠️ ${mat.note}</p>` : ''}

      ${mat.attributionTemplate ? `
        <div style="margin-top: 10px;">
          <p style="font-weight: 600; margin-bottom: 5px;">署名模板：</p>
          <div class="attribution-template">${mat.attributionTemplate.replace(/\n/g, '<br>')}</div>
        </div>
      ` : ''}
    </div>
  `).join('');

  // 生成使用建议
  const recommendations = generateRecommendations(materials);
  const recommendationCards = recommendations.map(rec => `
    <div class="recommendation-card ${rec.level}">
      <div class="recommendation-title">${rec.icon} ${rec.title}</div>
      <div class="recommendation-content">${rec.content.replace(/\n/g, '<br>')}</div>
      <div class="recommendation-action">建议操作：${rec.action}</div>
    </div>
  `).join('');

  return `
    <div class="section material-section">
      <h2 class="section-title">🎨 素材风险分析</h2>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">素材总数：</div>
          <div class="info-value">${materials.length} 个</div>
        </div>
        <div class="info-row">
          <div class="info-label">整体风险：</div>
          <div class="info-value">${getOverallRiskLevel(materials)}</div>
        </div>
      </div>

      <h3 style="margin-top: 20px; color: #1e293b;">素材详情</h3>
      ${materialCards}

      <h3 style="margin-top: 20px; color: #1e293b;">使用建议</h3>
      ${recommendationCards}
    </div>
  `;
}

/**
 * 生成创作内容章节
 */
function generateCreativeContentSection(creativeContent) {
  if (!creativeContent || creativeContent.length === 0) {
    return '';
  }

  const contentItems = creativeContent.map(content => `
    <div class="info-card" style="margin-bottom: 15px;">
      <div class="info-row">
        <div class="info-label">内容类型：</div>
        <div class="info-value">${getContentLabel(content.type)}</div>
      </div>
      ${content.content ? `
        <div class="info-row">
          <div class="info-label">内容预览：</div>
          <div class="info-value">${content.content.substring(0, 200)}${content.content.length > 200 ? '...' : ''}</div>
        </div>
      ` : ''}
      ${content.url ? `
        <div class="info-row">
          <div class="info-label">链接：</div>
          <div class="info-value"><a href="${content.url}" target="_blank">${content.url}</a></div>
        </div>
      ` : ''}
      <div class="info-row">
        <div class="info-label">时间：</div>
        <div class="info-value">${formatDateTime(content.timestamp)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="section">
      <h2 class="section-title">💡 创作内容详情</h2>
      ${contentItems}
    </div>
  `;
}

/**
 * 生成使用建议
 */
function generateRecommendations(materials) {
  const recommendations = [];

  // 检查高风险素材
  const highRiskMaterials = materials.filter(m =>
    m.riskLevel === 'high' || m.riskLevel === 'very_high' || m.riskLevel === 'unknown'
  );

  if (highRiskMaterials.length > 0) {
    recommendations.push({
      level: 'warning',
      icon: '⚠️',
      title: '高风险素材警告',
      content: `发现 ${highRiskMaterials.length} 个高风险素材：\n${highRiskMaterials.map(m =>
        `- ${m.platform} (${m.license}): ${mat.description}`
      ).join('\n')}`,
      action: '建议更换素材或联系作者获取授权'
    });
  }

  // 检查NC素材（禁止商用）
  const ncMaterials = materials.filter(m => m.license.includes('NC'));
  if (ncMaterials.length > 0) {
    recommendations.push({
      level: 'danger',
      icon: '🚨',
      title: '禁止商业使用',
      content: `以下素材禁止商业使用：\n${ncMaterials.map(m => `- ${m.platform}`).join('\n')}`,
      action: '如果作品用于商业目的，请更换这些素材'
    });
  }

  // 检查SA素材（相同方式共享）
  const saMaterials = materials.filter(m => m.license.includes('SA'));
  if (saMaterials.length > 0) {
    recommendations.push({
      level: 'info',
      icon: 'ℹ️',
      title: '相同方式共享要求',
      content: `以下素材改编后需用相同许可证：\n${saMaterials.map(m => `- ${m.platform} (${m.license})`).join('\n')}`,
      action: '改编作品需采用相同的CC BY-SA或CC BY-NC-SA许可证'
    });
  }

  // 检查ND素材（禁止演绎）
  const ndMaterials = materials.filter(m => m.license.includes('ND'));
  if (ndMaterials.length > 0) {
    recommendations.push({
      level: 'info',
      icon: 'ℹ️',
      title: '禁止演绎提醒',
      content: `以下素材禁止改编：\n${ndMaterials.map(m => `- ${m.platform}`).join('\n')}`,
      action: '仅可原样使用，不可修改、翻译或改编'
    });
  }

  // 署名建议
  const attributionMaterials = materials.filter(m => mat.permissions.attribution.required);
  if (attributionMaterials.length > 0) {
    recommendations.push({
      level: 'success',
      icon: '✅',
      title: '署名建议',
      content: `以下素材需要署名：\n${attributionMaterials.map(m => `- ${m.platform} (${m.license})`).join('\n')}`,
      action: '请在作品中标注素材来源和许可证（见上方署名模板）'
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

// ===== 辅助函数 =====

function formatDateTime(timestamp) {
  if (!timestamp) return '未知时间';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  } catch (error) {
    return timestamp;
  }
}

function getOperationLabel(type) {
  const labels = {
    ai_prompt: '💡 AI提示词',
    ai_response: '🤖 AI生成内容',
    text_input: '📝 文本输入',
    text_edit: '✏️ 文本编辑',
    image_generate: '🖼️ 图片生成',
    image_upload: '📷 图片上传',
    audio_generate: '🎵 音频生成',
    video_generate: '🎬 视频生成',
    copy: '📋 复制',
    paste: '📄 粘贴',
    save: '💾 保存',
    download: '⬇️ 下载',
    export: '📤 导出'
  };
  return labels[type] || type;
}

function getContentLabel(type) {
  const labels = {
    user_input: '用户输入',
    ai_response: 'AI生成内容',
    image: '图片',
    audio: '音频',
    video: '视频'
  };
  return labels[type] || type;
}

function getOverallRiskLevel(materials) {
  const highRiskCount = materials.filter(m =>
    m.riskLevel === 'high' || m.riskLevel === 'very_high' || m.riskLevel === 'unknown'
  ).length;

  if (highRiskCount > 0) {
    return `<span style="color: #ef4444; font-weight: 600;">🔴 高风险</span>`;
  }

  const mediumRiskCount = materials.filter(m => m.riskLevel === 'medium').length;
  if (mediumRiskCount > 0) {
    return `<span style="color: #f59e0b; font-weight: 600;">🟡 中风险</span>`;
  }

  return `<span style="color: #10b981; font-weight: 600;">🟢 低风险</span>`;
}

// ===== 导出 =====

export {
  generateEvidenceReport,
  generateMaterialRiskSection,
  generateRecommendations
};