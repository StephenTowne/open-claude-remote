# 🔴 核心铁律（每次交互必须遵守）
1. **中文优先**：所有回复、解释、注释、问题必须以中文为第一语言输出，无论用户用何种语言提问
2. **移动优先**：整个前端是 Web APP，所有 UI/交互/布局必须以移动端为第一设计目标。桌面端仅作兼容，不得以桌面体验反推移动端设计
3. **TDD测试驱动**：先更新或添加测试，再实现代码
4. **最小测试**：只运行相关的单个测试文件，禁止运行整个测试套件
5. **Skill 必须等待完成**：调用 Skill 工具后，**必须等待 Skill 返回完整结果后再继续**。Skill 是异步子代理，调用后不得假设已完成、不得跳过结果、不得在 Skill 返回前输出后续内容或调用其他工具。违反此规则 = 任务执行无效

# ⛔ 每个编码任务完成后，必须执行 `/finish-task`
> 涉及代码变更的任务，完成后必须执行 `/finish-task`（auto-doc + README + 需求文档检查）。违反此规则 = 任务未完成。

# 🚫 禁止行为
* ❌ `git clean`（任何参数，尤其是 -fdx）：后果不可逆，严禁执行
* ❌ 不要一次性运行整个测试套件（`pnpm test` 只在最终验证时使用）
* ❌ 不要引入 package.json 中未声明的依赖
* ❌ 不要跳过日志直接处理错误
* ❌ 不要在 Skill 执行完成前继续操作：Skill 调用后必须等待其返回结果，禁止提前输出回复、调用其他工具或假设 Skill 已完成

# 🔒 安全红线（绝对不可违反）
* ❌ **禁止向外部网络发送数据**：不得引入任何遥测(telemetry)、analytics、外部上报、webhook 回调等将数据发往外部服务器的逻辑
* ❌ **禁止引入外部网络调用**：不得添加对外部 API/服务的 HTTP 请求（fetch/axios/got 等），除非用户明确要求且确认目标地址
* ❌ **禁止降低现有认证/鉴权机制**：不得移除、绕过或弱化 Auth 层的 Token 验证、Session Cookie、速率限制等安全措施
* ❌ **禁止开放文件系统访问**：不得添加任意文件读写接口（如 `express.static('/')` 或未限制路径的文件操作 API）

# 运行环境（Environment）
* **单 package.json**，目录：`backend/src/`（后端）、`frontend/src/`（前端）、`shared/`（共享类型/常量）
* 共享模块通过 `#shared` 路径别名引用（Node.js subpath imports）
* 所有命令从**项目根目录**执行：
  - Unit 测试：`pnpm test:unit`（**开发时优先 `pnpm test:unit`**:快速、内存低）
  - Integration 测试：`pnpm test:integration`（启动完整服务器）
  - 后端测试：`pnpm test:backend`
  - 前端测试：`pnpm test:frontend`
  - 全量测试：`pnpm test`（仅 CI 使用，本地开发避免）
  - 构建全量：`pnpm build`（tsc + tsc-alias → vite build frontend）
  - 开发模式：`pnpm dev`（concurrently 启动前后端）
* 测试框架：**vitest**（backend: node, frontend: happy-dom）
* 类型检查：`npx tsc --noEmit`（后端+shared）/ `cd frontend && npx tsc --noEmit`（前端）

# 架构原则（Arch style）
**单一服务原则**：前端 `vite build` 后由后端 Express 静态文件服务
**移动优先**：Web 前端设计以移动端为主要交互场景，核心操作均在移动端完成
**核心架构**：PTY 代理层 — PC Terminal ↔ PTY (node-pty) ↔ Claude Code CLI
**职责划分**：
1. **API 层** (`backend/src/api/`)：参数验证、HTTP 响应、路由挂载
2. **Session Controller** (`backend/src/session/`)：核心协调器，连接 PTY ↔ WS ↔ Terminal ↔ Hook
3. **PTY 层** (`backend/src/pty/`)：进程管理、输出缓冲，不关心上层协议
4. **WS 层** (`backend/src/ws/`)：WebSocket 连接管理、消息路由，不关心 PTY 细节
5. **Auth 层** (`backend/src/auth/`)：Token 验证、Session Cookie、速率限制

**前后端共享类型**：`shared/ws-protocol.ts` 是 WebSocket 消息协议的唯一真相源（通过 `#shared` 路径别名引用，无需单独构建）

# 代码规范（Code style）
* 依赖管理：新增依赖前先检查对应 package.json 确认是否已有
* 日志驱动：必须通过 `logger`（pino）打印关键处理环节，错误日志要尽可能详细
* PTY 数据流：原始 ANSI 字符串，**不做解析或转义**，直接透传给 xterm.js
* WebSocket 消息：严格遵循 `shared/ws-protocol.ts` 定义的类型，所有消息必须包含 `type` 字段
* 审批流程：Hook 通知 → 生成 ApprovalRequest（UUID）→ WS 广播 → 手机响应 → PTY 写入按键（`y` 或 `\x1b`）
* 日志目录：`~/.claude-remote/logs/`（`app.log`、`error.log`、`app.pid`），可通过 `LOG_DIR` 环境变量覆盖；E2E 测试写入 `logs/e2e/`
* 国际化：README、产品页面、CLI help、服务报错信息等 **产品用户可见的内容一律使用英文**

# 精准检索策略（Precision Search）
* 检索路径：先读 `ARCHITECTURE.md` 了解整体结构 → 定位模块目录 → 精准读取
* 避免使用 Explore agent 盲目扫描
* 关键目录速查：
  - 后端：`backend/src/` → `api/`, `auth/`, `hooks/`, `logger/`, `pty/`, `session/`, `terminal/`, `utils/`, `ws/`
  - 前端：`frontend/src/` → `pages/`, `components/`, `hooks/`, `services/`, `stores/`, `types/`, `styles/`
  - 共享：`shared/` → `ws-protocol.ts`, `constants.ts`, `instance.ts`, `defaults.ts`

# 项目上下文（场景触发，按需加载）
* 涉及跨模块/新模块开发 → 先读 `ARCHITECTURE.md`
* 涉及需求理解 → 先读 `docs/requirements/PRD.md`
* 涉及架构决策 → 先读 `docs/adrs/` 下对应文档
* 涉及 WebSocket 消息变更 → 先读 `shared/ws-protocol.ts`
* 涉及编写测试 → 先读 `docs/rules/test_rules.md`
* 涉及打印日志 → 先读 `docs/rules/log_rules.md`
* 涉及移动端输入/键盘 → 先读 `docs/rules/mobile_keyboard_rules.md`

# Token 效率（Token Efficiency）
* 计划已明确文件和行号时，直接用 offset/limit 精确读取，禁止读全文
* 最大化并行工具调用：无依赖的读取/搜索必须放在同一轮
* 写测试前，先 grep 确认目标函数签名，避免试错重跑
* 不确定是否需要读某文件时，先不读，需要时再读

# 已知陷阱
* **pnpm 陷阱**：
  - symlink 结构导致 glob 解析失败 → 用 `require.resolve()` / `createRequire` 定位 node_modules 内文件
  - node-pty prebuilds 可能丢失 execute 权限 → 已有 `postinstall` 脚本修复，新增 native 依赖时注意
  - vitest 并发可耗尽系统资源 → 已配置资源限制，勿修改并发配置

# 输出约束
* 遇到不确定的产品需求、架构决策时，**必须先询问而非自行决定**，直到信息清楚无歧义
* **有计划就要执行**：禁止给出计划后停下等用户确认，除非涉及破坏性操作（删除、重命名、架构变更）。正常的代码编写、测试、修复直接执行
* **需求复述确认**：涉及多模块或行为变更的请求，先用1-2句话复述理解，确认后再动手。简单bug修复、单文件改动除外

# ✅ 任务完成检查清单
- [ ] 测试通过（`pnpm test:unit -- <具体测试文件>`）
- [ ] 类型检查通过（`npx tsc --noEmit`）
- [ ] 日志已添加（关键环节 + 错误处理通过 `logger`）
- [ ] 无新依赖 / 新依赖已加入对应 package.json
- [ ] 修改了 `shared/` → 无需单独 build（通过 `#shared` 路径别名直接引用源码）
- [ ] 前端变更 → 移动端优先验收：触控友好（min 44px 点击区域）、无横向溢出、响应式布局正常
- [ ] ⛔ 执行 `/finish-task`