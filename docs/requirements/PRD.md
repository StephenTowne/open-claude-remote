# Product Requirements Document

**Product Name:** Claude Code Remote
**Status:** Draft
**Author:** Tom
**Date Created:** 2026-02-27
**Last Updated:** 2026-02-27
**Version:** 1.0

---

## Executive Summary

**One-liner:** 在同一办公网络内，通过手机 Web 端远程控制 PC 上运行的 Claude Code CLI，实现离开工位后的无缝编程体验。

**Overview:**

Claude Code 是一款强大的 CLI 编程助手，但它被绑定在本地终端上。开发者离开工位（如去会议室、茶水间、午休等），就完全失去了与正在运行的 Claude Code 会话的交互能力。

Claude Code Remote 解决这个问题：它在 PC 和 Claude Code CLI 之间架设一个轻量级的代理层，开发者可以通过手机浏览器在同一办公网络内远程查看 Claude Code 的输出、发送指令、批准操作。回到 PC 后，终端上的一切状态完整保留，无缝衔接继续使用 CLI。

核心原则是**安全第一**——整个系统仅在局域网内运行，不暴露到公网，所有通信加密，需要认证才能访问。

**Quick Facts:**
- **Target Users:** 个人开发者（自用）
- **Problem Solved:** 离开 PC 后无法继续与 Claude Code 交互
- **Key Metric:** 远程操作端到端延迟 < 200ms
- **Target Launch:** MVP 2 周内

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals & Objectives](#goals--objectives)
3. [User Personas](#user-personas)
4. [User Stories & Requirements](#user-stories--requirements)
5. [Success Metrics](#success-metrics)
6. [Scope](#scope)
7. [Technical Considerations](#technical-considerations)
8. [Design & UX Requirements](#design--ux-requirements)
9. [Timeline & Milestones](#timeline--milestones)
10. [Risks & Mitigation](#risks--mitigation)
11. [Dependencies & Assumptions](#dependencies--assumptions)
12. [Open Questions](#open-questions)
13. [AI Agent Briefs](#ai-agent-briefs)

---

## Problem Statement

### The Problem

Claude Code 是终端应用，用户必须坐在 PC 前才能与之交互。一旦离开工位，正在运行的任务无法监控，需要用户确认的操作（如工具调用审批）会阻塞等待，整个开发流程被中断。

### Current State

- 开发者离开工位后，Claude Code 会话处于"盲区"——不知道它在做什么，不知道是否在等待确认
- 回到工位后需要回溯大量输出来理解上下文，浪费时间
- 部分开发者尝试用 SSH + tmux 远程连接，但手机终端体验极差：字体小、不支持触摸优化、操作繁琐
- 没有现成的方案能提供**手机友好**的 Claude Code 远程控制体验

### Impact

**User Impact:**
- 每次离开工位 15-30 分钟，Claude Code 可能因等待确认而白白阻塞
- 一天内多次离开工位，累计浪费 1-2 小时的 AI 编程时间
- 被迫在"离开工位"和"继续编程"之间做选择

**Business Impact:**
- Claude Code 的使用效率未被充分发挥（付费订阅的 ROI 降低）

### Why Now?

- Claude Code 已成为日常核心开发工具，使用频率极高
- 远程/混合办公趋势下，开发者不再固定在单一工位
- Claude Code 的任务执行时间越来越长（复杂任务可能持续数十分钟），监控需求更加强烈

---

## Goals & Objectives

### Business Goals

1. **最大化 Claude Code 利用率：** 消除因离开工位导致的任务阻塞，让 Claude Code 全时段高效运转
2. **提升开发体验：** 让开发者在任何位置（办公网络内）都能与 Claude Code 保持连接
3. **零安全妥协：** 绝不为便利性牺牲安全性，系统不暴露到公网

### User Goals

1. **随时监控：** 在手机上实时看到 Claude Code 的输出
2. **随时操作：** 在手机上发送指令、批准/拒绝工具调用
3. **无缝切换：** 回到 PC 后，终端状态完整保留，零感知切换

### Non-Goals

- 不替代 PC 端的 Claude Code CLI 体验
- 不提供完整的终端模拟器
- 不支持办公网络外的访问
- 不做代码编辑功能（仅做 Claude Code 交互控制）

---

## User Personas

### Primary Persona: 全栈开发者 Tom

**Demographics:**
- 角色：全栈开发者
- Tech savviness: 高
- 使用场景：办公室、会议室、家庭办公

**Behaviors:**
- 日常高度依赖 Claude Code 进行开发，一天内启动多次长任务
- 频繁在工位和会议室之间切换
- 习惯用手机处理消息和快速事务
- 对安全性极度敏感，不接受任何暴露到公网的方案

**Needs & Motivations:**
- 需要在离开工位时继续监控和控制 Claude Code
- 希望回到 PC 时完全无缝衔接，不需要任何额外操作
- 要求操作延迟足够低，体验丝滑

**Pain Points:**
- Claude Code 经常在等待工具调用确认时阻塞，自己却在会议室里
- 用手机 SSH + tmux 远程操作终端体验极差
- 回到工位后需要花时间理解 Claude Code 在自己离开后做了什么

**Quote:** _"我只是去开个会，回来发现 Claude Code 已经等了我 20 分钟的确认。"_

---

## User Stories & Requirements

### Epic 1: 远程查看

#### Must-Have Stories (P0)

##### Story 1: 实时查看 Claude Code 输出

**User Story:**
```
As a 开发者,
I want to 在手机浏览器上实时看到 Claude Code 的终端输出,
So that 我能随时了解任务进展.
```

**Acceptance Criteria:**
- [ ] Given Claude Code 正在运行, when 我在手机上打开 Web 页面, then 我能看到当前完整的会话输出（包括历史）
- [ ] Given Claude Code 产生新输出, when 我在手机上查看, then 新内容在 200ms 内出现
- [ ] Given 输出内容很长, when 我在手机上浏览, then 支持流畅滚动并自动滚动到最新输出
- [ ] Given 我回到 PC, when 我查看终端, then 终端状态与我离开时完全一致，无任何副作用

**Priority:** Must Have (P0)
**Effort:** M

---

##### Story 2: 查看 Claude Code 当前状态

**User Story:**
```
As a 开发者,
I want to 在手机上一眼看到 Claude Code 的当前状态（空闲/运行中/等待确认）,
So that 我快速判断是否需要介入操作.
```

**Acceptance Criteria:**
- [ ] Given Claude Code 正在执行任务, when 我打开 Web 页面, then 我看到"运行中"状态及当前执行的摘要
- [ ] Given Claude Code 等待用户确认, when 我打开 Web 页面, then 我看到醒目的"等待确认"提示及待确认的具体内容
- [ ] Given Claude Code 空闲, when 我打开 Web 页面, then 我看到"空闲"状态

**Priority:** Must Have (P0)
**Effort:** S

---

### Epic 2: 远程控制

#### Must-Have Stories (P0)

##### Story 3: 发送文本指令

**User Story:**
```
As a 开发者,
I want to 在手机上向 Claude Code 发送文本指令,
So that 我能远程启动或继续任务.
```

**Acceptance Criteria:**
- [ ] Given 我在手机 Web 页面上, when 我在输入框输入文本并发送, then 文本作为用户输入传送给 Claude Code
- [ ] Given 我发送了指令, when Claude Code 处理并响应, then 响应在手机上实时展示
- [ ] Given 我在手机上发送了指令, when 我回到 PC 终端, then 我看到完整的交互历史（我发的指令 + Claude 的响应）

**Priority:** Must Have (P0)
**Effort:** M

---

##### Story 4: 审批/拒绝工具调用

**User Story:**
```
As a 开发者,
I want to 在手机上批准或拒绝 Claude Code 的工具调用请求（如文件写入、命令执行）,
So that 我不在工位时 Claude Code 也不会因等待确认而阻塞.
```

**Acceptance Criteria:**
- [ ] Given Claude Code 请求工具调用确认, when 我在手机上查看, then 我看到工具名称、参数、影响范围的清晰描述
- [ ] Given 我看到工具调用请求, when 我点击"批准", then Claude Code 立即继续执行
- [ ] Given 我看到工具调用请求, when 我点击"拒绝", then Claude Code 收到拒绝并做出相应处理
- [ ] Given 我在手机上做出审批决定, when 我回到 PC 终端, then 终端显示审批结果及后续执行

**Priority:** Must Have (P0)
**Effort:** L

---

### Epic 3: 安全认证

#### Must-Have Stories (P0)

##### Story 5: 访问认证

**User Story:**
```
As a 开发者,
I want to Web 端必须经过认证才能访问,
So that 同一网络内的其他人无法未经授权操作我的 Claude Code.
```

**Acceptance Criteria:**
- [ ] Given 我首次访问 Web 页面, when 页面加载, then 需要输入预设的认证凭据（如 token/密码）
- [ ] Given 未认证的访问者, when 尝试访问任何 API 或页面, then 返回 401 且不泄露任何信息
- [ ] Given 认证成功, when 后续访问, then 会话在合理时间内（如 24 小时）保持有效，无需重复认证
- [ ] Given 认证 token, when 存储, then 使用安全的方式存储（如 HttpOnly Cookie），不暴露在 URL 或 localStorage 中

**Priority:** Must Have (P0)
**Effort:** M

---

##### Story 6: 网络隔离

**User Story:**
```
As a 开发者,
I want to 系统仅在局域网内可访问，不暴露到公网,
So that 不存在被外部攻击的可能性.
```

**Acceptance Criteria:**
- [ ] Given 服务启动时, when 绑定监听地址, then 默认仅绑定到局域网 IP（非 0.0.0.0）
- [ ] Given 系统运行时, when 外部网络尝试访问, then 无法连接
- [ ] Given 配置文件, when 用户查看, then 有明确的监听地址配置项及安全说明

**Priority:** Must Have (P0)
**Effort:** S

---

### Epic 4: PC 端无缝衔接

#### Must-Have Stories (P0)

##### Story 7: PC 终端状态同步

**User Story:**
```
As a 开发者,
I want to 回到 PC 后终端完全保留原始状态,
So that 我可以无感知地继续在 CLI 中操作.
```

**Acceptance Criteria:**
- [ ] Given 我在手机上进行了远程操作, when 我回到 PC 终端, then 终端输出完整显示所有交互历史
- [ ] Given Claude Code 正在运行, when 我在 PC 和手机上同时查看, then 两端看到的内容实时一致
- [ ] Given 我从手机切回 PC, when 我在 PC 终端输入, then Claude Code 立即响应，无需任何重新连接操作

**Priority:** Must Have (P0)
**Effort:** M

---

#### Should-Have Stories (P1)

##### Story 8: 推送通知

**User Story:**
```
As a 开发者,
I want to 当 Claude Code 需要我确认操作时收到手机通知,
So that 我不需要一直盯着手机 Web 页面.
```

**Acceptance Criteria:**
- [ ] Given Claude Code 请求工具调用确认, when 我未在 Web 页面上, then 我的手机浏览器收到 Web Push 通知
- [ ] Given 我收到通知, when 我点击通知, then 直接跳转到待确认的操作页面
- [ ] Given 我不想收到通知, when 我关闭通知权限, then 系统正常运行但不推送

**Priority:** Should Have (P1)
**Effort:** M

---

### Functional Requirements

| Req ID | Description | Priority | Status |
|--------|-------------|----------|--------|
| FR-001 | 实时双向通信（WebSocket）传输 Claude Code 输入/输出 | Must Have | Open |
| FR-002 | 手机 Web 端渲染终端输出（支持 ANSI 颜色/格式） | Must Have | Open |
| FR-003 | 手机 Web 端输入框发送用户指令 | Must Have | Open |
| FR-004 | 工具调用审批 UI（批准/拒绝按钮 + 详情展示） | Must Have | Open |
| FR-005 | 会话状态指示器（空闲/运行/等待确认） | Must Have | Open |
| FR-006 | Token-based 认证机制 | Must Have | Open |
| FR-007 | Web Push 通知（等待确认时触发） | Should Have | Open |
| FR-008 | 连接断开自动重连 | Must Have | Open |

### Non-Functional Requirements

| Req ID | Category | Description | Target |
|--------|----------|-------------|--------|
| NFR-001 | Performance | 端到端操作延迟（局域网内） | < 200ms |
| NFR-002 | Performance | WebSocket 消息传输延迟 | < 50ms |
| NFR-003 | Security | 所有通信加密 | TLS (HTTPS/WSS) |
| NFR-004 | Security | 认证 Token 安全存储 | HttpOnly Cookie |
| NFR-005 | Security | 监听地址限制 | 仅局域网 IP |
| NFR-006 | Availability | 代理层崩溃后自动恢复 | 自动重启 |
| NFR-007 | Compatibility | 手机浏览器兼容 | Safari(iOS 15+), Chrome(Android 10+) |
| NFR-008 | Security | 暴力破解防护 | 速率限制：5次/分钟 |

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### Primary Metric (North Star)

**Metric:** 远程操作成功率
**Definition:** 通过手机 Web 端发送的指令/审批被 Claude Code 成功接收并执行的百分比
**Current Baseline:** 0%（功能不存在）
**Target:** > 99.5%
**Why This Metric:** 直接衡量核心价值——远程控制是否可靠工作

#### Secondary Metrics

| Metric | Current | Target | Timeframe |
|--------|---------|--------|-----------|
| 端到端操作延迟 p95 | N/A | < 200ms | MVP |
| 手机→PC 状态一致性 | N/A | 100% | MVP |
| 每日远程操作次数 | 0 | > 5 次/天 | 发布后 1 周 |
| 因等待确认的阻塞时间 | ~60 min/天 | < 5 min/天 | 发布后 1 周 |

### Measurement Framework

**Framework Used:** HEART (个人工具产品)

**Happiness:**
- 自评体验分数 > 4/5（丝滑度）

**Engagement:**
- 每日远程操作次数 > 5

**Adoption:**
- 开发日中使用远程控制功能的天数占比 > 80%

**Retention:**
- 连续使用 > 2 周不弃用

**Task Success:**
- 远程指令成功执行率 > 99.5%
- 远程审批成功率 > 99.9%

---

## Scope

### In Scope

**Phase 1 (MVP):**
- 代理层服务（在 PC 和 Claude Code CLI 之间）
- 手机 Web 端：查看输出、发送指令、审批操作
- Token-based 认证
- 局域网内 WebSocket 实时通信
- HTTPS/WSS 加密通信
- 基础连接断开自动重连

**Phase 2 (Post-MVP):**
- Web Push 通知
- 多会话管理（同时控制多个 Claude Code 实例）
- 操作历史查看
- 快捷操作（常用指令模板）

### Out of Scope

**Explicitly Excluded:**
- **多租户支持：** 仅个人使用，不需要用户管理系统
- **移动端原生 App：** 仅使用手机浏览器 Web 方式
- **Claude Code 二次开发：** 不修改 Claude Code 本身，仅做外层代理
- **公网访问：** 绝不支持从外部网络访问
- **代码编辑器功能：** 不提供文件浏览/编辑 UI
- **语音控制：** 不做语音输入功能

### Future Considerations

- iPad/平板端优化布局
- 自定义快捷指令面板
- 操作审计日志
- 多设备同时在线

---

## Technical Considerations

### High-Level Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
│  手机浏览器   │◄────►│  Proxy Server    │◄────►│  Claude Code │
│  (Web Client) │ WSS  │  (代理层)         │ PTY  │  CLI (原生)   │
└──────────────┘      └──────────────────┘      └──────────────┘
                              │
                         局域网 Only
                         TLS 加密
                         Token 认证
```

**核心思路：** 代理层通过 PTY（伪终端）启动和控制 Claude Code CLI，同时通过 WebSocket 向手机 Web 端转发输入/输出。PC 终端与 Web 端看到的是同一个 Claude Code 进程。

### Technology Stack

**Frontend (手机 Web 端):**
- React / 轻量级框架
- xterm.js 或类似库（终端渲染）
- WebSocket 客户端
- PWA（可选，为了更好的移动体验）

**Backend (代理层 / Proxy Server):**
- Node.js 或 Python
- WebSocket Server
- node-pty 或 Python pty（伪终端管理）
- HTTPS Server (自签名证书或 mkcert)

**Infrastructure:**
- 运行在开发者 PC 上，无需云服务
- 自签名 TLS 证书（局域网内使用）

### API Requirements

**WebSocket 消息协议：**

| Message Type | Direction | Payload |
|-------------|-----------|---------|
| `terminal_output` | Server → Client | `{ data: string }` |
| `user_input` | Client → Server | `{ data: string }` |
| `status_update` | Server → Client | `{ status: "idle" \| "running" \| "waiting_approval", detail?: string }` |
| `approval_request` | Server → Client | `{ id: string, tool: string, params: object, description: string }` |
| `approval_response` | Client → Server | `{ id: string, approved: boolean }` |
| `heartbeat` | Bidirectional | `{ timestamp: number }` |

**REST API (辅助)：**

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| POST | `/api/auth` | No | 认证获取 session |
| GET | `/api/status` | Yes | 获取 Claude Code 当前状态 |
| GET | `/api/health` | No | 健康检查（不泄露敏感信息） |

### Security Requirements

- **Authentication:** Token-based（启动时生成随机 token，通过 CLI 输出展示给用户）
- **Authorization:** 单用户模式，认证即授权
- **Data Encryption:** TLS 1.2+（HTTPS + WSS），自签名证书
- **Network Isolation:** 默认仅绑定局域网 IP，不绑定 0.0.0.0
- **Rate Limiting:** 认证接口 5 次/分钟，防暴力破解
- **Token Security:** HttpOnly + Secure + SameSite Cookie
- **No Persistent Storage:** 不在服务端存储任何敏感数据到磁盘
- **CORS:** 严格限制 Origin

### Performance Requirements

- **WebSocket 延迟：** < 50ms（局域网内）
- **端到端操作延迟：** < 200ms（从手机发送到 Claude Code 响应）
- **内存占用：** 代理层 < 100MB
- **CPU 占用：** 空闲时 < 1%

---

## Design & UX Requirements

### User Experience Principles

1. **极简主义：** 手机端只做最必要的事——查看输出、发送指令、审批操作
2. **终端原生感：** 输出渲染应该与 PC 终端视觉一致（等宽字体、ANSI 颜色）
3. **状态一目了然：** 当前状态（运行中/等待确认/空闲）用色彩编码，一眼可辨
4. **触摸友好：** 按钮、操作区域足够大，适合拇指操作
5. **安全感：** 认证流程简洁但严肃，让用户感到控制权在自己手中

### User Flows

**Primary Flow: 远程监控与操作**
1. 开发者离开工位，Claude Code 正在运行
2. 打开手机浏览器，访问局域网地址（如 `https://192.168.1.100:3000`）
3. 输入 token 认证
4. 看到 Claude Code 实时输出及当前状态
5. Claude Code 请求工具调用确认 → 看到弹出的审批卡片
6. 点击"批准"或"拒绝"
7. Claude Code 继续运行
8. 回到 PC，终端一切照旧

**Alternative Flows:**
- 网络断开 → 自动重连 + 重连后同步最新状态
- 认证失败 → 显示错误，不泄露信息，限制重试频率

### Key Screens

| ID | Screen Name | Entry Point | Primary Action | Notes |
|----|-------------|-------------|---------------|-------|
| S01 | 认证页 | 直接访问 URL | 输入 Token | 极简设计，仅一个输入框 + 确认按钮 |
| S02 | 主控制台 | 认证成功后 | 查看输出 + 输入指令 | 全屏终端 + 底部输入栏 + 顶部状态栏 |
| S03 | 审批卡片 | 收到审批请求时浮出 | 批准/拒绝 | 覆盖层，展示工具名 + 参数 + 描述 |

### Interaction Patterns

- 终端输出区域：自动滚动到底部，手动滚动时暂停自动滚动，点击"回到最新"恢复
- 输入框：底部固定，点击即可输入，支持回车发送
- 审批卡片：底部滑出，带"批准"（绿色）和"拒绝"（红色）按钮
- 状态指示：顶部固定，颜色编码（绿=空闲，蓝=运行中，橙=等待确认）

### Accessibility

| Requirement | Target |
|-------------|--------|
| 键盘导航 | 支持（PC 端访问时） |
| 色彩对比度 | ≥ 4.5:1 |
| Focus 指示器 | 可见 |
| 触摸目标尺寸 | ≥ 44x44pt |

### Responsive Breakpoints

| Breakpoint | Range | Layout |
|------------|-------|--------|
| Mobile (主要) | 320px – 767px | 单列全屏终端，底部输入栏 |
| Tablet | 768px – 1023px | 同 Mobile，更大的终端区域 |
| Desktop | 1024px+ | 不作为主要使用场景，但可用 |

---

## Timeline & Milestones

**Target Launch Date:** 2 周内完成 MVP

### Phases

| Phase | Deliverables | Duration |
|-------|-------------|----------|
| **Phase 1: 核心代理层** | PTY 管理 + WebSocket Server + 基础认证 | 3-4 天 |
| **Phase 2: 手机 Web 端** | 终端渲染 + 输入 + 状态展示 | 3-4 天 |
| **Phase 3: 审批功能** | 工具调用拦截 + 审批 UI | 2-3 天 |
| **Phase 4: 安全加固** | TLS + 速率限制 + 安全测试 | 2-3 天 |
| **Phase 5: 打磨** | 自动重连 + 体验优化 + 边缘场景 | 2 天 |

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|------------|---------------------|
| Claude Code CLI 无法通过 PTY 正常控制 | High | Medium | 调研 Claude Code 的 stdin/stdout 行为；备选方案：使用 `--headless` 模式或 SDK |
| 自签名证书在手机浏览器上信任困难 | Medium | High | 使用 mkcert 生成本地 CA 证书，在手机上安装 CA |
| WebSocket 连接不稳定导致消息丢失 | Medium | Low | 消息序号 + 重连后补发机制 |
| 终端输出渲染在手机上性能不佳 | Medium | Medium | 限制渲染缓冲区大小；虚拟滚动 |
| 同网段其他设备发现并尝试攻击 | High | Low | 强 Token + 速率限制 + 仅绑定特定 IP |

### Contingency Plans

**If Claude Code 无法通过 PTY 控制：**
- 调研 Claude Code 是否有 headless/API 模式
- 考虑通过 tmux 或 script 命令间接控制
- 最终备选：直接对接 Claude API 而非控制 Claude Code CLI

---

## Dependencies & Assumptions

### Dependencies

**External:**
- [ ] Claude Code CLI 可通过 PTY 正常交互（stdin/stdout/stderr）
- [ ] 手机浏览器支持 WebSocket + Web Push + 自签名证书信任

### Assumptions

- 用户的办公网络允许设备间直接通信（无 AP 隔离）
- PC 和手机在同一子网或可路由网段
- 用户愿意在手机上安装自签名 CA 证书（一次性操作）
- Claude Code CLI 的输出可以被 PTY 正确捕获和转发

---

## Open Questions

- [ ] **Claude Code 是否支持 headless 模式？**
  - **Context:** 如果 Claude Code 有 headless/API 模式，代理层架构可以简化
  - **Options:** PTY 控制 vs headless 模式 vs 直接对接 Claude API
  - **Owner:** Tom
  - **Deadline:** 开发前

- [ ] **自签名证书在 iOS Safari 上的信任流程是否足够简单？**
  - **Context:** 如果信任过程过于复杂，可能影响使用体验
  - **Options:** mkcert 本地 CA vs HTTP（牺牲安全）vs 其他方案
  - **Owner:** Tom
  - **Deadline:** Phase 1

- [ ] **是否需要支持同时从 PC 终端和手机 Web 端输入？**
  - **Context:** 如果两端同时输入可能产生冲突
  - **Options:** 互斥输入（一端输入时另一端只读）vs 允许并发输入
  - **Owner:** Tom
  - **Deadline:** Phase 2

---

## AI Agent Briefs

> **Purpose:** This section is structured for machine consumption by downstream AI agents.

---

### Architecture Design Brief

*Consumed by: architecture design agents*

**Feature Name:** Claude Code Remote

**Core Domain Entities:**

| Entity | Description |
|--------|-------------|
| Session | 一个 Claude Code CLI 进程的完整会话，包含 PTY 句柄和状态 |
| ProxyServer | 代理层服务器，管理 PTY 和 WebSocket 连接 |
| WebClient | 手机 Web 端的连接实例 |
| ApprovalRequest | Claude Code 发起的工具调用确认请求 |
| AuthToken | 用于身份验证的随机 Token |

**External Integrations:**

| Service | Direction | Purpose |
|---------|-----------|---------|
| Claude Code CLI | bidirectional | 通过 PTY 进行 stdin/stdout 交互，控制 Claude Code 进程 |
| 手机浏览器 | bidirectional | 通过 WebSocket 传输终端输出/用户输入/审批请求 |

**Authentication Model:** 启动时生成随机 Token，用户通过 Web 页面输入 Token，服务端验证后签发 HttpOnly Session Cookie

**Authorization Model:** 单用户模式，认证即完全授权，无角色区分

**Data Flow Summary:**

代理层通过 PTY 启动 Claude Code CLI 进程，捕获其 stdout/stderr 输出。输出通过 WebSocket 实时推送到手机 Web 端。Web 端用户输入通过 WebSocket 发送到代理层，代理层写入 PTY stdin 传递给 Claude Code。对于工具调用审批，代理层识别 Claude Code 的审批请求，封装为结构化消息推送给 Web 端，Web 端用户决策后回传，代理层模拟用户输入完成审批。PC 终端始终挂载在同一个 PTY 上，因此所有状态自然同步。

**Non-Functional Requirements for Architecture:**

| Concern | Requirement | Source |
|---------|-------------|--------|
| Latency | 端到端操作延迟 < 200ms, WebSocket 消息 < 50ms | NFR-001, NFR-002 |
| Security | TLS 加密所有通信, Token 认证, 局域网隔离 | NFR-003, NFR-004, NFR-005 |
| Resilience | 代理层崩溃自动恢复, WebSocket 断开自动重连 | NFR-006, FR-008 |
| Compatibility | iOS Safari 15+, Android Chrome 10+ | NFR-007 |

**Hard Constraints for Architecture:**
- 必须运行在开发者 PC 上，不依赖任何云服务
- 不修改 Claude Code CLI 本身
- 仅局域网可访问，绝不暴露到公网
- 不持久化存储用户数据到磁盘（除 TLS 证书外）

**Open Architectural Questions:**
- [ ] Claude Code CLI 是通过 PTY 控制还是通过 headless/SDK 模式？
- [ ] PC 终端和 Web 端是否共享同一个 PTY？还是 Web 端通过代理层间接与 CLI 交互？
- [ ] 审批请求是通过解析终端输出识别，还是 Claude Code 有结构化的事件钩子？

---

### System Design Constraints

*Consumed by: system design agents*

**Data Entities and Relationships:**

```
Session
  - id: string, primary key (UUID)
  - pty: PTY handle (runtime, not persisted)
  - status: enum("idle", "running", "waiting_approval")
  - created_at: timestamp
  - token: string (random, generated at startup)

ApprovalRequest
  - id: string (UUID)
  - session_id: FK → Session.id
  - tool_name: string
  - tool_params: JSON
  - description: string
  - status: enum("pending", "approved", "rejected")
  - created_at: timestamp

WebSocketConnection
  - id: string
  - session_id: FK → Session.id
  - authenticated: boolean
  - connected_at: timestamp

Relationships:
  - Session has many ApprovalRequest
  - Session has many WebSocketConnection
```

**Required API Surface:**

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| POST | `/api/auth` | No | 提交 Token 获取 Session Cookie |
| GET | `/api/status` | Yes | 返回 Claude Code 当前状态 |
| GET | `/api/health` | No | 健康检查（不泄露敏感信息） |
| WS | `/ws` | Yes (Cookie) | WebSocket 连接，双向通信 |

**Performance Budgets:**

| Metric | Budget |
|--------|--------|
| WebSocket 消息延迟 p50 | < 10ms |
| WebSocket 消息延迟 p95 | < 50ms |
| 端到端操作延迟 p95 | < 200ms |
| 代理层内存占用 | < 100MB |
| 代理层 CPU 空闲时 | < 1% |

**Scalability Targets:**

| Dimension | Target |
|-----------|--------|
| 并发 WebSocket 连接 | 1-3（单用户，可能手机 + PC 浏览器） |
| 同时管理的 Session | 1（MVP），未来可扩展到多个 |
| 终端输出缓冲区大小 | 最近 10,000 行 |

**Deployment Constraints:**

| Component | Specification |
|-----------|--------------|
| 运行环境 | 开发者 PC（macOS/Linux） |
| 依赖 | Node.js 或 Python，无外部数据库 |
| 证书 | 自签名 TLS（mkcert） |
| 端口 | 可配置，默认 3000 |
| 启动方式 | CLI 命令一键启动 |

**Compliance and Data Handling:**

| Concern | Requirement |
|---------|-------------|
| 敏感数据 | 不持久化存储任何终端输出或用户输入 |
| Token 安全 | 启动时生成，仅通过 CLI stdout 显示一次 |
| Session | 仅在内存中，进程退出即清除 |
| TLS 证书 | 存储在用户指定目录，权限 600 |
| 审计日志 | 不记录终端内容，仅记录连接/断开/认证事件 |

---

### UI/UX Design Requirements

*Consumed by: UI/UX design agents*

**Primary User Flows:**

1. **认证流程** (Actor: 开发者)
   1. 打开手机浏览器，输入 PC 局域网地址
   2. 看到认证页面，输入 Token
   3. 系统验证 Token，成功后跳转到主控制台
   4. Terminal state: 进入主控制台，可以看到 Claude Code 输出

2. **远程监控与操作** (Actor: 开发者)
   1. 在主控制台看到 Claude Code 实时输出
   2. 顶部状态栏显示当前状态（运行中）
   3. 在底部输入框输入指令并发送
   4. Claude Code 响应，输出实时展示
   5. Terminal state: 持续交互

3. **审批工具调用** (Actor: 开发者)
   1. Claude Code 请求工具调用确认
   2. 状态变为"等待确认"，审批卡片从底部滑出
   3. 查看工具名称、参数、描述
   4. 点击"批准"或"拒绝"
   5. Terminal state: Claude Code 继续运行或处理拒绝

**Error and Edge Case Flows:**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| 连接丢失 | 网络中断 | 显示"连接中断"横幅 + 自动重连动画，重连后同步最新状态 |
| Token 错误 | 输入错误的 Token | 显示"认证失败"，输入框清空，5 次后锁定 1 分钟 |
| Claude Code 进程退出 | CLI 主动退出或崩溃 | 显示"会话已结束"提示，提供重新启动选项 |
| 长时间无操作 | Session 过期 | 轻量提示"请重新认证"，点击即跳转认证页 |

**Screen Inventory:**

| ID | Screen Name | Entry Point | Primary Action | Notes |
|----|-------------|-------------|---------------|-------|
| S01 | 认证页 | 直接访问 URL | 输入 Token 并认证 | 深色背景，单个输入框居中，Logo + 产品名 |
| S02 | 主控制台 | 认证成功 | 查看输出 / 输入指令 | 全屏终端区域，底部固定输入栏，顶部状态条 |
| S03 | 审批卡片 | 收到审批请求 | 批准/拒绝 | 半屏覆盖层，从底部滑出 |

**Key Interaction Patterns:**
- 终端自动滚动：新输出时自动滚动到底部；用户手动上滑时暂停自动滚动，出现"回到最新"浮动按钮
- 输入框：固定在底部，软键盘弹出时输入框上移，不被遮挡
- 审批卡片：半透明遮罩 + 底部卡片，支持上滑关闭（等同拒绝）
- 状态指示：顶部颜色条，绿色脉冲=空闲，蓝色流动=运行中，橙色闪烁=等待确认

**Accessibility Requirements:**

| Requirement | Target |
|-------------|--------|
| WCAG compliance | Level AA (2.1) |
| 触摸目标 | ≥ 44x44pt |
| 色彩对比度（文本） | ≥ 4.5:1 |
| Focus 指示器 | 2px solid outline |
| 动画 | 遵循 prefers-reduced-motion |

**Design System References:**

| Item | Value |
|------|-------|
| 设计风格 | 深色主题（终端风格），极简 |
| 字体 | 等宽字体（JetBrains Mono / SF Mono / 系统等宽） |
| 组件库 | 轻量级自建，或 shadcn/ui |
| 核心组件 | Terminal Viewer, Input Bar, Status Badge, Approval Card |
| 色彩系统 | 深色背景 (#0d1117), 绿色(空闲), 蓝色(运行), 橙色(等待), 红色(错误) |

**Responsive Breakpoints:**

| Breakpoint | Range | Layout Notes |
|------------|-------|-------------|
| Mobile | 320px – 767px | 单列；全屏终端；底部输入栏固定；状态条顶部固定 |
| Tablet | 768px – 1023px | 同 Mobile，终端区域更大 |
| Desktop | 1024px+ | 同 Tablet，非主要使用场景但应可用 |

**Platform-Specific Considerations:**

| Platform | Requirement |
|----------|-------------|
| iOS Safari | 安全区域适配（刘海/底部 Home Indicator）；软键盘弹出时正确处理布局 |
| Android Chrome | 返回按键处理；沉浸式状态栏 |
| Web 通用 | Service Worker 注册（PWA 可选）；离线时显示友好提示 |
