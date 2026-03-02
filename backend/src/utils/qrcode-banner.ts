import qrcode from 'qrcode-terminal';

/**
 * 在终端打印 ASCII 二维码（同步调用）
 * @param url 包含 token 的完整 URL
 */
export function printQRCode(url: string): void {
  qrcode.generate(url, { small: true }, (qrString: string) => {
    process.stderr.write('\n║  扫码连接:\n');
    qrString.split('\n').forEach((line) => {
      if (line.trim()) {
        process.stderr.write(`║  ${line}\n`);
      }
    });
  });
}