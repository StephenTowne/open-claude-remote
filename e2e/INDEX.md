<!-- auto-doc: 文件增删时更新 -->
# e2e/ - Playwright 端到端测试基座与场景用例

## fixtures/
- global-setup.ts: 启动前清理占用端口、执行 pnpm build、拉起后端进程并写入 .server-state.json 供测试共享
- global-teardown.ts: 读取 .server-state.json 后按进程树优雅终止并兜底 SIGKILL，最后清理状态文件
- server-fixture.ts: 扩展 Playwright fixture，提供 serverUrl/authToken 与 authenticate() 登录助手并注入 WS seq 跟踪

## helpers/
- screenshot-helper.ts: 封装终端/整页截图断言与手动截图工具，统一 toHaveScreenshot 容差配置
- selectors.ts: 统一维护认证页、控制台、审批卡与连接横幅选择器常量，避免测试内硬编码
- wait-helpers.ts: 提供连接状态、审批卡、终端渲染与 WS seq 增量等待工具，替代固定 sleep

## tests/
- 01-auth.spec.ts: 认证页首屏、空 token 禁用、错误提示与成功登录跳转的核心认证流程回归
- 02-console-view.spec.ts: 控制台基础可用性验证，覆盖状态栏、终端渲染、输入区与基线截图
- 03-send-command.spec.ts: 发送命令链路验证，基于 WS seq 变化确认终端输出并校验 Enter/发送后输入清空
- 04-approval-flow.spec.ts: 工具审批流程验证，覆盖审批卡出现、Approve/Reject 处理与状态恢复
- 05-reconnect.spec.ts: WebSocket 中断与恢复场景验证，覆盖断线提示、自动重连与刷新后重认证
- 06-full-journey.spec.ts: 串行贯穿主旅程（认证→命令→审批→断线重连）的端到端集成回归
