/**
 * 通知渠道配置类型定义
 * 支持多渠道通知配置（钉钉、邮件、Slack、企业微信等）
 */

/** 支持的通知渠道类型 */
export type NotificationChannelType = 'dingtalk' | 'email' | 'slack' | 'wechat_work';

/** 钉钉渠道配置 */
export interface DingtalkConfig {
  webhookUrl: string;
  enabled?: boolean; // 是否启用，默认 true
}

/** 企业微信（Server酱³）渠道配置 */
export interface WechatWorkConfig {
  apiUrl: string;
  enabled?: boolean; // 是否启用，默认 true
}

/** 所有通知渠道配置（存储格式） */
export interface NotificationConfigs {
  dingtalk?: DingtalkConfig;
  wechat_work?: WechatWorkConfig;
  // 预留其他渠道: email?: EmailConfig; slack?: SlackConfig;
}

/** 安全的通知渠道状态（API 返回，不包含敏感信息） */
export interface SafeNotificationChannelStatus {
  configured: boolean;
  /** 是否启用，undefined 表示默认启用 */
  enabled?: boolean;
}

/** 安全的通知渠道状态集合（API 返回） */
export interface SafeNotificationConfigs {
  dingtalk?: SafeNotificationChannelStatus;
  /** 预留：邮件通知状态 */
  email?: SafeNotificationChannelStatus;
  /** 预留：Slack 通知状态 */
  slack?: SafeNotificationChannelStatus;
  /** 预留：企业微信通知状态 */
  wechat_work?: SafeNotificationChannelStatus;
}

/** 渠道元数据项 */
export interface NotificationChannelMeta {
  displayName: string;
  icon: string;
  description: string;
  helpUrl?: string;
  implemented: boolean;
}

/** 通知渠道元数据集合 */
export type NotificationChannelMetas = {
  [K in NotificationChannelType]?: NotificationChannelMeta;
};

/** 渠道元数据定义 */
export const NOTIFICATION_CHANNELS: NotificationChannelMetas = {
  dingtalk: {
    displayName: 'DingTalk',
    icon: 'dingtalk',
    description: 'Send notifications to DingTalk group via robot webhook',
    helpUrl: 'https://open.dingtalk.com/document/robots/custom-robot-access',
    implemented: true,
  },
  email: {
    displayName: 'Email',
    icon: 'email',
    description: 'Send notifications via email',
    implemented: false,
  },
  slack: {
    displayName: 'Slack',
    icon: 'slack',
    description: 'Send notifications to Slack channel via webhook',
    implemented: false,
  },
  wechat_work: {
    displayName: 'WeChat',
    icon: 'wechat-work',
    description: 'Send notifications to WeChat via Server酱³',
    helpUrl: 'https://sct.ftqq.com/sendkey',
    implemented: true,
  },
} as const;

/**
 * 将旧版 dingtalk 配置迁移到新版 notifications 结构
 * @param oldConfig 旧版配置（包含 dingtalk 字段）
 * @returns 新版配置（包含 notifications 字段）
 */
export function migrateNotificationConfig(oldConfig: { dingtalk?: DingtalkConfig }): { notifications?: NotificationConfigs } {
  if (!oldConfig.dingtalk) {
    return {};
  }
  return {
    notifications: {
      dingtalk: oldConfig.dingtalk,
    },
  };
}

/**
 * 合并通知配置（新版优先，回退到旧版）
 * @param notifications 新版通知配置
 * @param oldDingtalk 旧版钉钉配置
 * @returns 合并后的配置
 */
export function mergeNotificationConfigs(
  notifications?: NotificationConfigs,
  oldDingtalk?: DingtalkConfig
): NotificationConfigs {
  const result: NotificationConfigs = {};

  // 钉钉配置：优先使用新版，回退到旧版
  if (notifications?.dingtalk) {
    result.dingtalk = notifications.dingtalk;
  } else if (oldDingtalk?.webhookUrl) {
    result.dingtalk = oldDingtalk;
  }

  // 企业微信配置：直接透传
  if (notifications?.wechat_work) {
    result.wechat_work = notifications.wechat_work;
  }

  return result;
}

/**
 * 检查通知渠道是否已配置
 * @param configs 通知配置
 * @returns 各渠道配置状态（包含 enabled 状态）
 */
export function getNotificationStatus(configs?: NotificationConfigs): SafeNotificationConfigs {
  const result: SafeNotificationConfigs = {};

  if (configs?.dingtalk) {
    result.dingtalk = {
      configured: !!configs.dingtalk.webhookUrl,
      enabled: configs.dingtalk.enabled,
    };
  }

  if (configs?.wechat_work) {
    result.wechat_work = {
      configured: !!configs.wechat_work.apiUrl,
      enabled: configs.wechat_work.enabled,
    };
  }

  return result;
}

/**
 * 钉钉 Webhook URL 格式验证
 */
export const DINGTALK_WEBHOOK_PATTERN = /^https:\/\/oapi\.dingtalk\.com\/robot\/send\?access_token=/;

/**
 * 验证钉钉配置是否合法
 * @param config 钉钉配置
 * @returns 是否合法
 */
export function validateDingtalkConfig(config?: DingtalkConfig): boolean {
  if (!config) return false;
  return DINGTALK_WEBHOOK_PATTERN.test(config.webhookUrl);
}

/**
 * Server酱³ API URL 格式验证
 * URL 格式: https://<uid>.push.ft07.com/send/<sendkey>.send
 */
export const WECHAT_WORK_API_URL_PATTERN = /^https:\/\/[a-zA-Z0-9-]+\.push\.ft07\.com\/send\/[a-zA-Z0-9]+\.send$/;

/**
 * 验证企业微信配置是否合法
 * @param config 企业微信配置
 * @returns 是否合法
 */
export function validateWechatWorkConfig(config?: WechatWorkConfig): boolean {
  if (!config) return false;
  return WECHAT_WORK_API_URL_PATTERN.test(config.apiUrl);
}
