<!-- auto-doc: 文件增删时更新 -->
# backend/src/logger/ - 日志配置

- logger.ts: pino 日志工厂，dev 模式 pino-pretty → stderr + 文件双写，production 纯 JSON 文件，test 环境 silent
