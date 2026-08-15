/**
 * HTTP 客户端使用示例
 */

import { HttpClient, LogLevel } from './http'

// ============================================
// 1. 基础使用
// ============================================

// 创建 HTTP 客户端
const httpClient = new HttpClient({
  baseURL: 'http://localhost:9092',
  timeout: 30000,
  logging: {
    enabled: true,
    level: LogLevel.INFO,
    logRequestBody: true,
    logResponseBody: true,
    logHeaders: false,
    maxBodyLength: 500,
    storage: {
      enabled: true,
      maxSize: 500,
      persistToLocalStorage: true
    },
    performance: {
      warnThreshold: 2000,
      errorThreshold: 5000
    }
  }
})

// ============================================
// 2. 发起请求
// ============================================

// GET 请求
async function getUsers() {
  try {
    const response = await httpClient.get('/api/v1/users', {
      params: { page: 1, limit: 10 }
    })
    
    console.log('用户列表:', response.data)
    console.log('状态码:', response.status)
    
  } catch (error: any) {
    console.error('请求失败:', error.message)
    console.error('错误类型:', error.type)
  }
}

// POST 请求
async function createUser(userData: any) {
  try {
    const response = await httpClient.post('/api/v1/users', userData)
    
    console.log('创建成功:', response.data)
    
  } catch (error: any) {
    console.error('创建失败:', error.message)
  }
}

// PUT 请求
async function updateUser(userId: string, userData: any) {
  try {
    const response = await httpClient.put(`/api/v1/users/${userId}`, userData)
    
    console.log('更新成功:', response.data)
    
  } catch (error: any) {
    console.error('更新失败:', error.message)
  }
}

// DELETE 请求
async function deleteUser(userId: string) {
  try {
    const response = await httpClient.delete(`/api/v1/users/${userId}`)
    
    console.log('删除成功:', response.status)
    
  } catch (error: any) {
    console.error('删除失败:', error.message)
  }
}

// ============================================
// 3. 查看日志和统计
// ============================================

// 获取请求日志
function viewLogs() {
  const logs = httpClient.getRequestLogs()
  console.log('所有请求日志:', logs)
}

// 查找特定请求的日志
function findRequestLogs() {
  const logs = httpClient.getRequestLogs({
    method: 'GET',
    minDuration: 1000  // 查找耗时超过1秒的请求
  })
  
  console.log('慢请求日志:', logs)
}

// 查看统计信息
function viewStatistics() {
  const stats = httpClient.getRequestStatistics()
  
  console.log('总请求数:', stats.totalRequests)
  console.log('成功请求:', stats.successRequests)
  console.log('失败请求:', stats.failedRequests)
  console.log('平均耗时:', stats.avgDuration)
  console.log('最大耗时:', stats.maxDuration)
  console.log('最小耗时:', stats.minDuration)
  console.log('平均响应大小:', stats.avgResponseSize)
}

// 清除日志
function clearLogs() {
  httpClient.clearRequestLogs()
  console.log('日志已清除')
}

// ============================================
// 4. 完整示例
// ============================================

async function main() {
  console.log('=== HTTP 客户端示例 ===')
  
  // 发起请求
  await getUsers()
  
  // 创建用户
  await createUser({
    name: '张三',
    email: 'zhangsan@example.com'
  })
  
  // 查看统计
  viewStatistics()
  
  // 查看日志
  viewLogs()
  
  // 清除日志
  clearLogs()
}

// 运行示例
if (require.main === module) {
  main().catch(console.error)
}

export {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  viewLogs,
  findRequestLogs,
  viewStatistics,
  clearLogs
}