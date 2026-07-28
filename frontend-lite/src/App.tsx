/**
 * 网页端精简版路由
 * 
 * 核心页面：
 * - 首页（品牌介绍）
 * - 下载（桌面端下载）
 * - 文档（API 文档）
 * - 登录（用户登录/注册）
 * 
 * 所有功能页面已迁移至桌面端「常态化巡检」模块
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// 核心页面
import BrandHome from './pages/BrandHome'
import Download from './pages/Download'
import Docs from './pages/Docs'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 品牌首页 */}
        <Route path="/" element={<BrandHome />} />
        
        {/* 下载页 */}
        <Route path="/download" element={<Download />} />
        
        {/* API 文档 */}
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/*" element={<Docs />} />
        
        {/* 登录/注册 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        
        {/* 其他路由重定向到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}