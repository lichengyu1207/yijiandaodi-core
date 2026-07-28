import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import AdminLayout from '@/layouts/AdminLayout';
import Dashboard from '@/pages/Dashboard';
import ContentArticles from '@/pages/ContentArticles';
import Categories from '@/pages/Categories';
import Users from '@/pages/Users';
import Security from '@/pages/Security';
import DataManage from '@/pages/DataManage';
import Analysis from '@/pages/Analysis';
import Settings from '@/pages/Settings';
import Roles from '@/pages/Roles';
import Menus from '@/pages/Menus';
import OperationLogs from '@/pages/OperationLogs';
import AuditLogs from '@/pages/AuditLogs';
import AgentConfig from '@/pages/AgentConfig';
import SecurityConfig from '@/pages/SecurityConfig';
import SecurityLogs from '@/pages/SecurityLogs';
import KnowledgeBase from '@/pages/KnowledgeBase';
import RAGSearch from '@/pages/RAGSearch';
import RAGOperationLogs from '@/pages/RAGOperationLogs';
import SecurityTest from '@/pages/SecurityTest';
import RiskControl from '@/pages/RiskControl';
import RiskControlAudit from '@/pages/RiskControlAudit';
import SecurityCenter from '@/pages/SecurityCenter';
import SystemSettings from '@/pages/SystemSettings';
import LoginLogs from '@/pages/LogCenter/LoginLogs';
import PermissionInterceptLogs from '@/pages/LogCenter/PermissionInterceptLogs';
import FrontendUserManage from '@/pages/SystemSettings/FrontendUserManage';
import SystemSecurityConfig from '@/pages/SystemSettings/SecurityConfig';
import FunctionCardManage from '@/pages/SystemSettings/FunctionCardManage';
import FrontLayout from '@/layouts/FrontLayout';
import Home from '@/pages/Home';
import BrandHome from '@/pages/BrandHome';
import XiaLiaPage from '@/pages/XiaLiaPage';
import EnterpriseAdmin from '@/pages/EnterpriseAdmin';
import APIDocsCenter from '@/pages/APIDocsCenter';
import Detail from '@/pages/Detail';
import MallIndex from '@/pages/Mall/index';
import ProductList from '@/pages/Mall/ProductList';
import ProductDetail from '@/pages/Mall/ProductDetail';
import Cart from '@/pages/Mall/Cart';
import Orders from '@/pages/Mall/Orders';
import UserCenter from '@/pages/Mall/UserCenter';
import MyReports from '@/pages/MyReports';
import OrderCenter from '@/pages/OrderCenter';
import AuthGuard from '@/components/AuthGuard';
import PrivateDomainSOP from '@/pages/PrivateDomainSOP';
import Pricing from '@/pages/Pricing';
import EnterpriseServices from '@/pages/EnterpriseServices';
import Courses from '@/pages/Courses';
import About from '@/pages/About';
import DeveloperPortal from '@/pages/DeveloperPortal';
import DataClassification from '@/pages/DataClassification';
import PackagesAndAudit from '@/pages/PackagesAndAudit';
import BScenarios from '@/pages/BScenarios';
import TechProvenance from '@/pages/TechProvenance';
import TechDeepfake from '@/pages/TechDeepfake';
import CAcademicIntegrity from '@/pages/CAcademicIntegrity';
import CEnterpriseAudit from '@/pages/CEnterpriseAudit';
import UnifiedScan from '@/pages/UnifiedScan';
import DualEngine from '@/pages/DualEngine';
import Originality from '@/pages/Originality';
import AntiFraud from '@/pages/AntiFraud';
import ChapterDetect from '@/pages/ChapterDetect';
import WorkflowList from '@/pages/WorkflowEditor';
import WorkflowEditor from '@/components/WorkflowEditor';
import AIChatCenter from '@/pages/Home/components/AIChatCenter';
import Grammarly from '@/pages/Grammarly';
import SupportPage from '@/pages/SupportPage';
import Copyscape from '@/pages/Copyscape';
import ResumeOptimizer from '@/pages/ResumeOptimizer';
import AgentSkillDetail from '@/pages/AgentSkillDetail';
import YijiandaodiSkill from '@/pages/YijiandaodiSkill';
import PlatformCapabilitiesCenter from '@/pages/PlatformCapabilitiesCenter';
import ArticleEditor from '@/components/ArticleEditor';
import CreatorApplicationPage from '@/pages/CreatorApplication';
import CreatorReviewPage from '@/pages/CreatorReview';
import DeveloperApplicationPage from '@/pages/DeveloperApplication';
import DeveloperReviewPage from '@/pages/DeveloperReview';
// 行为监控仪表盘
import BehaviorMonitorDashboard from '@/pages/BehaviorMonitor';
// 可信时间戳页面
import TrustedTimestampPage from '@/pages/TrustedTimestamp';
const LazyExecutionCenter = React.lazy(() => import('@/pages/ExecutionCenter'));

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: <Login />,
    },
    {
      path: '/',
      element: <FrontLayout />,
      children: [
        {
          index: true,
          element: <BrandHome />,
        },
        {
          path: 'cases/:id',
          element: <Detail />,
        },
        {
          path: 'category/:id',
          element: <Home />,
        },
        {
          path: 'search',
          element: <Home />,
        },
        {
          path: 'mall',
          element: <MallIndex />,
        },
        {
          path: 'mall/products',
          element: <ProductList />,
        },
        {
          path: 'mall/product/:id',
          element: <ProductDetail />,
        },
        {
          path: 'mall/cart',
          element: <Cart />,
        },
        {
          path: 'mall/orders',
          element: <Orders />,
        },
        {
          path: 'mall/user-center',
          element: <UserCenter />,
        },
        {
          path: 'enterprise',
          element: <EnterpriseAdmin />,
        },
        {
          path: 'api-docs',
          element: <APIDocsCenter />,
        },
        {
          path: 'behavior-monitor',
          element: <BehaviorMonitorDashboard />,
        },
        {
          path: 'my-reports',
          element: <MyReports />,
        },
        {
          path: 'trusted-timestamp',
          element: <TrustedTimestampPage />,
        },
        {
          path: 'order-center',
          element: <OrderCenter />,
        },
        {
          path: 'private-domain-sop',
          element: <PrivateDomainSOP />,
        },
        {
          path: 'pricing',
          element: <Pricing />,
        },
        {
          path: 'apply-creator',
          element: <CreatorApplicationPage />,
        },
        {
          path: 'apply-developer',
          element: <DeveloperApplicationPage />,
        },
        {
          path: 'enterprise-services',
          element: <EnterpriseServices />,
        },
        {
          path: 'courses',
          element: <Courses />,
        },
        {
          path: 'about',
          element: <About />,
        },
        {
          path: 'developer',
          element: <DeveloperPortal />,
        },
        {
          path: 'data-classification',
          element: <DataClassification />,
        },
        {
          path: 'packages',
          element: <PackagesAndAudit />,
        },
        {
          path: 'b-scenarios',
          element: <BScenarios />,
        },
        {
          path: 'tech/provenance',
          element: <TechProvenance />,
        },
        {
          path: 'tech/deepfake',
          element: <TechDeepfake />,
        },
        {
          path: 'c-scenario/academic',
          element: <CAcademicIntegrity />,
        },
        {
          path: 'c-scenario/enterprise-audit',
          element: <CEnterpriseAudit />,
        },
        {
          path: 'unified-scan',
          element: <UnifiedScan />,
        },
        {
          path: 'dual-engine',
          element: <DualEngine />,
        },
        {
          path: 'originality',
          element: <Originality />,
        },
        {
          path: 'anti-fraud',
          element: <AntiFraud />,
        },
        {
          path: 'chapter-detect',
          element: <ChapterDetect />,
        },
        {
          path: 'workflow',
          element: <WorkflowList />,
        },
        {
          path: 'workflow/editor',
          element: <WorkflowEditor />,
        },
        {
          path: 'agent',
          element: <AIChatCenter />,
        },
        {
          path: 'detect',
          element: <AIChatCenter />,
        },
        {
          path: 'execution-center',
          element: <Home />,
        },
        {
          path: 'xialia',
          element: <XiaLiaPage />,
        },
        {
          path: 'xialia/:agentId',
          element: <AgentSkillDetail />,
        },
        {
          path: 'grammar',
          element: <Grammarly />,
        },
        {
          path: 'support/:userId',
          element: <SupportPage />,
        },
        {
          path: 'copyscape',
          element: <Copyscape />,
        },
        {
          path: 'resume-optimizer',
          element: <ResumeOptimizer />,
        },
        {
          path: 'yijiandaodi-skill',
          element: <YijiandaodiSkill />,
        },
        {
          path: 'platform-capabilities',
          element: <PlatformCapabilitiesCenter />,
        },
      ],
    },
    {
      path: '/admin',
      element: (
        <AuthGuard>
          <AdminLayout />
        </AuthGuard>
      ),
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: 'content',
          element: <ContentArticles />,
        },
        {
          path: 'content/articles',
          element: <ContentArticles />,
        },
        {
          path: 'content/categories',
          element: <Categories />,
        },
        {
          path: 'users',
          element: <Users />,
        },
        {
          path: 'security',
          element: <Security />,
        },
        {
          path: 'data',
          element: <DataManage />,
        },
        {
          path: 'analysis',
          element: <Analysis />,
        },
        {
          path: 'settings',
          element: <Settings />,
        },
        {
          path: 'roles',
          element: <Roles />,
        },
        {
          path: 'menus',
          element: <Menus />,
        },
        {
          path: 'operation-logs',
          element: <OperationLogs />,
        },
        {
          path: 'audit-logs',
          element: <AuditLogs />,
        },
        {
          path: 'agent-config',
          element: <AgentConfig />,
        },
        {
          path: 'security-config',
          element: <SystemSecurityConfig />,
        },
        {
          path: 'enterprise-admin',
          element: <EnterpriseAdmin />,
        },
        {
          path: 'security-logs',
          element: <SecurityLogs />,
        },
        {
          path: 'knowledge-base',
          element: <KnowledgeBase />,
        },
        {
          path: 'rag-search',
          element: <RAGSearch />,
        },
        {
          path: 'rag-operation-logs',
          element: <RAGOperationLogs />,
        },
        {
          path: 'security-test',
          element: <SecurityTest />,
        },
        {
          path: 'risk-control',
          element: <RiskControl />,
        },
        {
          path: 'risk-control-audit',
          element: <RiskControlAudit />,
        },
        {
          path: 'security-center',
          element: <SecurityCenter />,
        },
        {
          path: 'system-settings',
          element: <SystemSettings />,
        },
        {
          path: 'login-logs',
          element: <LoginLogs />,
        },
        {
          path: 'permission-intercept-logs',
          element: <PermissionInterceptLogs />,
        },
        {
          path: 'frontend-user-manage',
          element: <FrontendUserManage />,
        },
        {
          path: 'system-security-config',
          element: <SecurityConfig />,
        },
        {
          path: 'data-classification',
          element: <DataClassification />,
        },
        /* ===== 创作者专属路由 ===== */
        {
          path: 'creator-stats',
          element: <MyReports />,  // 复用 MyReports 页面展示创作者数据
        },
        {
          path: 'publish-article',
          element: <ArticleEditor />,  // 文章发布编辑器
        },
        {
          path: 'tipping-records',
          element: <MyReports />,  // 复用 MyReports 展示打赏记录
        },
        /* ===== 管理员审核路由 ===== */
        {
          path: 'creator-review',
          element: <CreatorReviewPage />,  // 创作者申请审核
        },
        {
          path: 'dev-review',
          element: <DeveloperReviewPage />,  // 开发者申请审核
        },
        /* ===== 开发者专属路由 ===== */
        {
          path: 'api-keys',
          element: <DeveloperPortal />,  // 复用开发者门户
        },
        {
          path: 'api-stats',
          element: <MyReports />,  // API使用统计
        },
        {
          path: 'api-docs',
          element: <APIDocsCenter />,
        },
        {
          path: '*',
          element: <Navigate to="/admin" replace />,
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ],
  {
    future: {
      // @ts-expect-error react-router-dom v6 future config
      v7_startTransition: true,
    },
  }
);

export default router;
