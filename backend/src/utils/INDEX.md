<!-- auto-doc: 文件增删时更新 -->
# backend/src/utils/ - 通用工具函数

- network.ts: isPrivateIp() RFC 1918 私有地址判断 (10.x/172.16-31.x/192.168.x) + detectLanIp() 自动检测首个局域网 IPv4 地址
- pid-file.ts: writePidFile() 写入进程 PID 并自动创建父目录，removePidFile() 清理 PID 文件并忽略 ENOENT
