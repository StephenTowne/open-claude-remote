import qrcode from 'qrcode-terminal';

/**
 * Generate QR code as array of lines (synchronous)
 * @param url Full URL containing token
 * @returns Array of QR code lines (without border characters)
 */
export function generateQRCodeLines(url: string): string[] {
  let lines: string[] = [];
  qrcode.generate(url, { small: true }, (qrString: string) => {
    lines = qrString.split('\n').filter((line) => line.trim());
  });
  return lines;
}