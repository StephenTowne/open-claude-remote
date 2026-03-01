import type { QuestionOption } from './ws-protocol.js';

/**
 * 自由文本输入选项的标签列表（不区分大小写）
 * 选择这些选项后会显示文本输入框
 */
const FREE_TEXT_LABELS = ['other', '其他', '输入文字', 'chat about this'] as const;

/**
 * 检查选项标签是否为自由文本输入类型
 * @param label 选项标签
 * @returns 是否为自由文本输入选项
 */
export function isFreeTextLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return FREE_TEXT_LABELS.includes(normalized as typeof FREE_TEXT_LABELS[number]);
}

/**
 * 检查选项是否为自由文本输入类型
 * @param option 选项对象
 * @returns 是否为自由文本输入选项
 */
export function isFreeTextOption(option: QuestionOption): boolean {
  return isFreeTextLabel(option.label);
}