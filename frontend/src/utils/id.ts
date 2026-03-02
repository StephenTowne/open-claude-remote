/** 生成唯一 ID，兼容不支持 crypto.randomUUID 的环境 */
export function generateId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
