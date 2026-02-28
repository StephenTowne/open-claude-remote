# 🔴 核心铁律（每次交互必须遵守）
1. **中文优先**：所有回复、解释、注释、问题必须以中文为第一语言输出，无论用户用何种语言提问
2. **TDD测试驱动**：先更新或添加测试，再实现代码
3. **最小测试**：只运行相关的单个测试文件，禁止运行整个测试套件
4. **更新文档索引**：文件有新增/删除/重命名，执行 `/auto-doc`
5. **更新README**: 用户可见行为发生变更，更新 `README.md` 对应章节

# 🚫 禁止行为
* ❌ `git clean`（任何参数，尤其是 -fdx）：后果不可逆，严禁执行
* ❌ 不要一次性运行整个测试套件（`pnpm test` 只在最终验证时使用）
* ❌ 不要在未读代码的情况下提出修改建议
* ❌ 不要引入 package.json 中未声明的依赖
* ❌ 不要跳过日志直接处理错误

# 运行环境（Environment）
* **pnpm workspace monorepo**，三个包：`shared/`、`backend/`、`frontend/`
* 所有命令从**项目根目录**执行，通过 `pnpm --filter` 指定包：
  - 后端测试：`cd backend && pnpm test -- tests/unit/xxx/xxx.test.ts`
  - 前端测试：`cd frontend && pnpm test -- tests/components/xxx.test.tsx`
  - 构建 shared：`pnpm --filter @claude-remote/shared build`
  - 构建全量：`pnpm build`（顺序：shared → frontend → backend）
  - 开发模式：`pnpm dev`（concurrently 启动前后端）
* 测试框架：**vitest**（后端 node 环境，前端 jsdom 环境）
* 类型检查：`cd backend && npx tsc --noEmit` / `cd frontend && npx tsc --noEmit`
* Node >= 20，TypeScript，ESM（`"type": "module"`）

# 架构原则（Arch style）
**单一服务原则**：前端 `vite build` 后由后端 Express 静态文件服务
**核心架构**：PTY 代理层 — PC Terminal ↔ PTY (node-pty) ↔ Claude Code CLI
**职责划分**：
1. **API 层** (`backend/src/api/`)：参数验证、HTTP 响应、路由挂载
2. **Session Controller** (`backend/src/session/`)：核心协调器，连接 PTY ↔ WS ↔ Terminal ↔ Hook
3. **PTY 层** (`backend/src/pty/`)：进程管理、输出缓冲，不关心上层协议
4. **WS 层** (`backend/src/ws/`)：WebSocket 连接管理、消息路由，不关心 PTY 细节
5. **Auth 层** (`backend/src/auth/`)：Token 验证、Session Cookie、速率限制

**前后端共享类型**：`shared/src/ws-protocol.ts` 是 WebSocket 消息协议的唯一真相源，修改后必须重新 `pnpm --filter @claude-remote/shared build`

# 代码规范（Code style）
* 依赖管理：新增依赖前先检查对应 package.json 确认是否已有
* 日志驱动：必须通过 `logger`（pino）打印关键处理环节，错误日志要尽可能详细
* 日志输出：`logs/app.log`（INFO+）+ `logs/error.log`（ERROR），测试环境自动静默
* PTY 数据流：原始 ANSI 字符串，**不做解析或转义**，直接透传给 xterm.js
* WebSocket 消息：严格遵循 `shared/src/ws-protocol.ts` 定义的类型，所有消息必须包含 `type` 字段
* 审批流程：Hook 通知 → 生成 ApprovalRequest（UUID）→ WS 广播 → 手机响应 → PTY 写入按键（`y` 或 `\x1b`）
* 日志目录：统一写入项目根目录 `logs/`（`app.log`、`error.log`、`app.pid`），E2E 测试写入 `logs/e2e/`

# 精准检索策略（Precision Search）
* 检索路径：先读 `ARCHITECTURE.md` 了解整体结构 → 定位模块目录 → 精准读取
* 避免使用 Explore agent 盲目扫描
* 关键目录速查：
  - 后端：`backend/src/` → `api/`, `auth/`, `hooks/`, `logger/`, `pty/`, `session/`, `terminal/`, `utils/`, `ws/`
  - 前端：`frontend/src/` → `pages/`, `components/`, `hooks/`, `services/`, `stores/`, `types/`, `styles/`
  - 共享：`shared/src/` → `ws-protocol.ts`, `constants.ts`

# 项目上下文（场景触发，按需加载）
* 涉及跨模块/新模块开发 → 先读 `ARCHITECTURE.md`
* 涉及需求理解 → 先读 `docs/requirements/PRD.md`
* 涉及架构决策 → 先读 `docs/adrs/` 下对应文档
* 涉及 WebSocket 消息变更 → 先读 `shared/src/ws-protocol.ts`
* 涉及编写测试 → 先读 `docs/rules/test_rules.md`
* 涉及打印日志 → 先读 `docs/rules/log_rules.md`

# 输出约束
* 遇到不确定的产品需求、架构决策时，**必须先询问而非自行决定**，直到信息清楚无歧义

# Token 效率（Token Efficiency）
* 计划已明确文件和行号时，直接用 offset/limit 精确读取，禁止读全文
* 最大化并行工具调用：无依赖的读取/搜索必须放在同一轮
* 写测试前，先 grep 确认目标函数签名，避免试错重跑
* 不确定是否需要读某文件时，先不读，需要时再读

# ✅ 任务完成检查清单
- [ ] 测试通过（`cd backend && pnpm test -- <具体测试文件>`）
- [ ] 类型检查通过（`npx tsc --noEmit`）
- [ ] 日志已添加（关键环节 + 错误处理通过 `logger`）
- [ ] 无新依赖 / 新依赖已加入对应 package.json
- [ ] 修改了 `shared/` → 已重新 build
- [ ] 文件有新增/删除/重命名 → 执行 `/auto-doc`
- [ ] 用户可见行为变更（操作方式、快捷键、配置项、启动/构建流程、对外 API）→ 更新 `README.md` 对应章节