/**
 * Token 持久化存储（sessionStorage）
 *
 * 安全考虑：
 * - 使用 sessionStorage 而非 localStorage，页面关闭后自动清除
 * - 降低 XSS 攻击的持久化风险
 * - 仅用于同一会话内的跨实例认证
 */

const TOKEN_STORAGE_KEY = 'claude_remote_token';

/**
 * 保存 token 到 sessionStorage
 */
export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * 从 sessionStorage 读取 token
 * @returns token 字符串，如果不存在则返回 null
 */
export function loadToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * 清除 sessionStorage 中的 token
 */
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}