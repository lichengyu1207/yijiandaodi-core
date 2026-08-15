/**
 * 本地模式配置 - 允许跳过认证使用本地功能
 */

export const LOCAL_MODE = {
  enabled: true,
  // 本地测试用户（仅在本地模式下使用）
  testUser: {
    id: 0,
    username: 'local_user',
    email: 'local@test.local',
    role: 'local'
  }
}

/**
 * 检查是否允许跳过认证
 */
export function canSkipAuth(): boolean {
  return LOCAL_MODE.enabled
}

/**
 * 获取本地测试用户
 */
export function getLocalUser() {
  return LOCAL_MODE.testUser
}