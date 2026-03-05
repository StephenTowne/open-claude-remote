import { CSSProperties } from 'react';

/**
 * 单行 textarea 基础样式 - 水平滚动处理长文本
 *
 * 由于 textarea 不支持 CSS text-overflow: ellipsis（可编辑元素的限制），
 * 使用水平滚动让用户可以查看完整内容。
 *
 * 这是移动端标准交互模式（iOS/Android 原生输入框行为）。
 */
export const singleLineTextareaStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  fontSize: 14,
  resize: 'none',
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'nowrap',
  lineHeight: '20px',
  boxSizing: 'border-box',
} as const;

/**
 * 合并单行 textarea 样式，支持覆盖默认值
 *
 * @param overrides - 要覆盖的样式属性
 * @returns 合并后的样式对象
 *
 * @example
 * // 基础用法
 * <textarea style={mergeTextareaStyle()} />
 *
 * // 覆盖特定属性
 * <textarea style={mergeTextareaStyle({ borderRadius: 8, height: 48 })} />
 */
export function mergeTextareaStyle(overrides?: CSSProperties): CSSProperties {
  return { ...singleLineTextareaStyle, ...overrides };
}