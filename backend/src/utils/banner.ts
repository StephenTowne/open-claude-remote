/**
 * Banner 打印模块
 *
 * 从 index.ts 提取出来，供 CLI 和 daemon 共用。
 */
import { generateQRCodeLines } from './qrcode-banner.js';
import { getCurrentVersion } from '../update.js';

/** 网络地址信息 */
export interface AddressInfo {
  url: string;
  type: 'wlan' | 'vpn' | 'wired' | 'other' | 'private' | 'public';
  interface: string;
}

export interface BannerOptions {
  /** 首选 URL（用于大 QR 码） */
  url: string;
  /** 所有可用地址列表 */
  urls?: AddressInfo[];
  token: string;
  instanceName: string;
  logDir: string;
  pid: number;
  instanceId?: string;      // 实例 ID（截取前 8 位显示）
  warnings?: string[];      // 警告消息数组
  showExitHint?: boolean;   // 是否显示退出提示（默认 true）
}

/**
 * 获取地址类型的显示标签
 */
function getTypeLabel(type: AddressInfo['type']): string {
  switch (type) {
    case 'wlan': return '📶';
    case 'vpn': return '🔒';
    case 'wired': return '🔌';
    default: return '🌐';
  }
}

/**
 * 将 banner 打印到 stderr（CLI 使用）
 */
export function printBanner(options: BannerOptions): void {
  const { url, token, instanceName, logDir, pid, instanceId, urls = [], warnings = [], showExitHint = true } = options;
  const qrUrl = `${url}?token=${token}`;
  const qrLines = generateQRCodeLines(qrUrl);

  let version = '';
  try { version = getCurrentVersion(); } catch { /* ignore */ }

  // Format instance line with optional ID
  const shortId = instanceId ? instanceId.substring(0, 8) : null;
  const instanceLine = shortId
    ? `Instance:  ${instanceName} (${shortId})`
    : `Instance:  ${instanceName}`;

  const leftLines: string[] = [];
  leftLines.push(instanceLine);

  // Display all available URLs with their types
  if (urls.length > 0) {
    leftLines.push('URLs:');
    // Find the max length for alignment
    const maxUrlLen = Math.max(...urls.map(u => u.url.length));
    for (const addr of urls) {
      const icon = getTypeLabel(addr.type);
      const paddedUrl = addr.url.padEnd(maxUrlLen);
      leftLines.push(`  ${icon} ${paddedUrl} (${addr.interface})`);
    }
  } else {
    leftLines.push(`URL:       ${url}`);
  }

  leftLines.push(`PID:       ${pid}`);
  leftLines.push(`Logs:      ${logDir}`);
  leftLines.push('');
  leftLines.push('Commands:');
  leftLines.push(`  attach:  claude-remote attach ${instanceName}`);
  leftLines.push('  list:    claude-remote list');
  leftLines.push('  status:  claude-remote status');
  leftLines.push('  stop:    claude-remote stop');
  leftLines.push('  update:  claude-remote update');

  const qrLabel = 'Scan QR to connect';
  const rightLines: string[] = [...qrLines, ''];
  const targetHeight = Math.max(leftLines.length, rightLines.length + 1);
  while (rightLines.length < targetHeight - 1) {
    rightLines.push('');
  }
  rightLines.push(qrLabel);

  const qrWidth = Math.max(qrLines[0]?.length || 0, qrLabel.length);
  const leftWidth = Math.max(...leftLines.map(l => l.length), 35);
  const totalWidth = leftWidth + qrWidth + 6;

  const topBorder    = '╔' + '═'.repeat(totalWidth - 2) + '╗';
  const title        = version ? `Claude Code Remote v${version}` : 'Claude Code Remote';
  const titleLine    = '║' + title.padStart(Math.floor((totalWidth - 2 + title.length) / 2)).padEnd(totalWidth - 2) + '║';
  const sepLine      = '╠' + '═'.repeat(leftWidth + 1) + '╤' + '═'.repeat(qrWidth + 2) + '╣';
  const midSep       = '╠' + '═'.repeat(leftWidth + 1) + '╧' + '═'.repeat(qrWidth + 2) + '╣';
  const tokenLine    = '║ ' + `Token: ${token}`.padEnd(totalWidth - 4) + ' ║';
  const bottomBorder = '╚' + '═'.repeat(totalWidth - 2) + '╝';

  process.stderr.write('\n');
  process.stderr.write(topBorder + '\n');
  process.stderr.write(titleLine + '\n');
  process.stderr.write(sepLine + '\n');

  const maxLines = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxLines; i++) {
    const left = (leftLines[i] || '').padEnd(leftWidth);
    let right: string;
    if (i < qrLines.length && rightLines[i]) {
      right = ` ${rightLines[i]} `.padEnd(qrWidth + 2);
    } else if (rightLines[i]) {
      const centered = rightLines[i].padStart(Math.floor((qrWidth + rightLines[i].length) / 2)).padEnd(qrWidth);
      right = ` ${centered} `;
    } else {
      right = ' '.repeat(qrWidth + 2);
    }
    process.stderr.write(`║ ${left}│${right}║\n`);
  }

  process.stderr.write(midSep + '\n');
  process.stderr.write(tokenLine + '\n');

  // Warning section
  if (warnings.length > 0) {
    const warningSep = '╠' + '═'.repeat(totalWidth - 2) + '╣';
    process.stderr.write(warningSep + '\n');
    for (const warning of warnings) {
      const warningLine = '║ ' + `⚠️  ${warning}`.padEnd(totalWidth - 4) + ' ║';
      process.stderr.write(warningLine + '\n');
    }
  }

  // Exit hint
  if (showExitHint) {
    const exitSep = '╠' + '═'.repeat(totalWidth - 2) + '╣';
    process.stderr.write(exitSep + '\n');
    const exitLine = '║ ' + '💡 Press Ctrl+C twice to exit'.padEnd(totalWidth - 4) + ' ║';
    process.stderr.write(exitLine + '\n');
  }

  process.stderr.write(bottomBorder + '\n');
  process.stderr.write('\n');
}
