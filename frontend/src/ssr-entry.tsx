import React from 'react';
import { StaticRouter } from 'react-router-dom/server';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import azureTheme from './styles/theme';

// SSR SEO data - placeholder for future BFF integration
function getSEODataForPath(_url: string) {
  return {
    title: '一鉴到底 - AI Agent行为安全平台',
    description: '基于多Agent协同的AI行为安全平台，从内容检测到行为检测，全方位守护AI Agent安全',
    keywords: 'AI Agent,行为安全,行为检测,内容检测,多Agent,合规审计',
  };
}

interface SSRResult {
  html: string;
  seoData: {
    title: string;
    description: string;
    keywords: string;
    canonical?: string;
    ogTags?: string;
  };
}

export async function render(url: string): Promise<SSRResult> {
  const seoData = getSEODataForPath(url);

  const appElement = React.createElement(
    StaticRouter,
    { location: url },
    React.createElement(
      ConfigProvider,
      { theme: azureTheme, locale: zhCN },
      React.createElement(AntApp, null, React.createElement(App))
    )
  );

  let renderedHTML = '';
  try {
    const { renderToString } = await import('react-dom/server');
    renderedHTML = renderToString(appElement);
  } catch (e) {
    console.error('[SSR] renderToString error:', e);
    renderedHTML = '<div id="root" data-server-rendered="true">Loading...</div>';
  }

  return {
    html: renderedHTML,
    seoData,
  };
}
