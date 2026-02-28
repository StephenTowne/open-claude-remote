<!-- auto-doc: 文件增删时更新 -->
# backend/src/utils/ - 通用工具函数

- ansi-filter.ts: AlternateScreenFilter 类，检测 PTY 输出中的 alternate screen buffer 切换序列 (1049h/l)，过滤交互式 UI 内容避免 web 端显示错位
- network.ts: isPrivateIp() RFC 1918 私有地址判断 (10.x/172.16-31.x/192.168.x) + detectLanIp() 自动检测首个局域网 IPv4 地址
