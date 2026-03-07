<!-- auto-doc: 文件增删时更新 -->
# backend/src/utils/ - 通用工具函数

- ansi-filter.ts: AlternateScreenFilter 类，检测 PTY 输出中的 alternate screen buffer 切换序列 (1049h/l)，过滤交互式 UI 内容避免 web 端显示错位
- file-lock.ts: mkdir-based 文件锁，withFileLock (同步/Atomics.wait 阻塞重试) + withFileLockAsync (异步/setTimeout 重试)，支持僵尸锁过期清理，用于多实例并发保护共享文件读写
- ip-monitor.ts: IpMonitor 类，轮询检测 IP 变化，采用稳定性阈值策略（连续 N 次检测到相同新 IP 才触发回调），避免短暂网络波动误报
- network.ts: isPrivateIp() RFC 1918 私有地址判断 (10.x/172.16-31.x/192.168.x) + detectLanIp() 自动检测首个局域网 IPv4 地址
- banner.ts: printBanner() 将启动信息框（实例名/URL/PID/命令/QR码/Token）打印到 stderr，从 index.ts 提取的独立模块供 CLI 和 daemon 复用
- qrcode-banner.ts: printQRCode() 在终端打印 ASCII 二维码，用于首次启动时扫码连接
