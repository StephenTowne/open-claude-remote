---
name: finish-task
description: >
  Task completion gate — mandatory final step after every coding task.
  Runs three checks: (1) /auto-doc for structural changes, (2) user-visible behavior → README.md,
  (3) new requirements → docs/requirements/.
  Use when: user says "finish", "done", "完成", "收尾", "/finish", or a coding task is complete.
  Do NOT use for: pure conversation (no code changes), planning-only sessions, code review without edits.
metadata:
  author: zhihui.tzh
  version: 1.1.0
---

# ⛔ EXECUTION MANDATE — READ THIS FIRST

You are NOT just reading this document. You MUST EXECUTE every step below.
"Executing" means: running the actual bash commands, reading actual files, making actual edits.

❌ FORBIDDEN — The following behaviors mean TASK FAILURE:
- Outputting "skill 已启动" or "正在执行" without running actual commands
- Summarizing what the steps would do instead of doing them
- Skipping to the output format without executing checks
- Calling `/auto-doc` without waiting for it to complete

✅ REQUIRED — You must:
1. Actually run each bash command shown below
2. Actually read files when instructed
3. Actually make edits when needed
4. Output the final summary ONLY after all 3 steps are complete

---

# Task Completion Gate

每个编码任务的强制收尾步骤。按顺序执行三项检查：

1. 执行 `/auto-doc`（由 auto-doc 自行检测是否有结构变更）
2. 用户可见行为变更 → 更新 `README.md`
3. 新增/变更需求 → 写入 `docs/requirements/`

---

## Step 1: 执行 `/auto-doc`

⚠️ **你必须调用 Skill 工具执行 `/auto-doc`，并等待其返回完整结果后再继续 Step 2。不得跳过此步骤。**

直接执行 `/auto-doc`。auto-doc 会自行检测源码文件的新增、删除或重命名，并决定是否需要更新文档。

无需在此步骤中手动运行 git 命令检测 — auto-doc 内部已包含完整的检测逻辑。

---

## Step 2: 用户可见行为检查 → `README.md`

⚠️ **你必须实际运行以下 git 命令，并根据输出做出判定。不得跳过命令直接输出结论。**

以**对话上下文**为主要依据（Claude 刚完成任务，清楚改了什么），git 为辅助验证：

```bash
git diff --stat HEAD          # 未提交的变更
git log --oneline -3          # 本次任务的近期提交
```

评估以下方面是否发生**用户可见**的变更：
- 用户操作流程或 UI 交互方式改变
- 快捷键或手势变更
- 配置项或环境变量新增/变更
- 启动/构建/部署流程变更
- CLI 命令或参数变更

注意：以下**不属于**用户可见变更：
- 新增/修改内部 API 端点（用户不直接调用）
- 代码重构（行为未变）
- 内部数据结构调整
- 测试文件变更

**判定：**
- **有用户可见变更** → 读取受影响的 README.md 章节，更新内容，向用户展示改动
- **无用户可见变更** → 输出 "✅ README: 无用户可见变更"

---

## Step 3: 需求检查 → `docs/requirements/`

⚠️ **你必须基于 Step 2 的实际 git 输出和对话上下文做出判定。不得在未执行 Step 2 的情况下输出结论。**

### 核心定义

**需求 = 用户可见或配置可见的产品能力变更**

### 判定清单

满足以下**任意一项**即需要写入 `docs/requirements/`：

| 判定项 | 说明 | 示例 |
|--------|------|------|
| 新增功能点 | 新增产品功能 | 新增通知渠道 |
| 功能范围扩展 | 从单一扩展到多个 | 单渠道 → 多渠道列表 |
| 用户可见行为变更 | 操作流程或 UI 变化 | 新增配置页面 |
| 新增配置项 | 环境变量、配置字段 | 新增 `THEME` 变量 |
| 支持新场景 | 新的使用方式 | 支持暗黑模式 |

### 明确排除

以下情况**不需要**写入 `docs/requirements/`：

| 排除项 | 说明 |
|--------|------|
| 纯代码重构 | 行为不变 |
| Bug 修复 | 修复已有功能错误 |
| 内部 API 变更 | 用户不直接接触 |
| 测试变更 | 测试文件的新增/修改 |
| 性能优化 | 无功能变更 |

### 架构 vs 需求 判断技巧

问自己：**"用户能感知到这个变化吗？"** 或 **"配置项变了吗？"**

- 能感知/变了 → 需求
- 不能感知/没变（仅开发者内部） → 架构更新（非需求）

**判定：**
- **有新增/变更需求** → 在 `docs/requirements/` 中写入或更新 `.md` 文件。包含：需求描述、验收标准、架构备注（如适用）。排除实现方案。
- **无新需求** → 输出 "✅ requirements: 无新需求"

---

## ⛔ 输出门禁

只有当以下条件全部满足时，才能输出最终汇总：
- [ ] Step 1: 已实际调用 `/auto-doc` 并收到返回结果
- [ ] Step 2: 已实际运行 `git diff --stat HEAD` 和 `git log --oneline -3`
- [ ] Step 3: 已基于实际 git 输出做出需求判定

如果你还没有执行这些步骤，停下来，回去执行它们。

---

## 输出格式

三项检查完成后输出汇总：

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 / ✅ 无需更新
  2. README:       ✅ 已更新 [section] / ✅ 无需更新
  3. requirements: ✅ 已写入 [filename] / ✅ 无需更新
```

---

## 示例

### 示例 1: 新增 API 端点（内部接口）

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 — 新增 backend/src/api/health.ts
  2. README:       ✅ 无需更新
  3. requirements: ✅ 无需更新
```

### 示例 2: Bug 修复，无结构变更

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 无需更新
  2. README:       ✅ 无需更新
  3. requirements: ✅ 无需更新
```

### 示例 3: 新功能含需求（新增环境变量 + UI 变更）

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 — 新增 frontend/src/components/DarkMode.tsx
  2. README:       ✅ 已更新 — Configuration 章节（新增 THEME 环境变量）
  3. requirements: ✅ 已写入 — docs/requirements/dark-mode.md
```

### 示例 4: 功能范围扩展（单渠道 → 多渠道通知）

原有「钉钉通知」扩展为「多渠道通知列表」，用户可见配置从单一字段变为列表管理。

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 — 新增 shared/notification-types.ts
  2. README:       ✅ 已更新 — Configuration 章节（通知配置说明）
  3. requirements: ✅ 已写入 — docs/requirements/notification-channels.md
  （判定依据：功能范围扩展 — 从单渠道扩展为多渠道列表，命中判定清单第2项）
```

### 示例 5: 纯代码重构（行为不变）

重构 PTY 输出处理逻辑，提取公共函数，用户无感知。

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 无需更新
  2. README:       ✅ 无需更新
  3. requirements: ✅ 无需更新
  （判定依据：命中排除项「纯代码重构」— 行为不变，用户无感知）
```

---

## 故障排查

### git diff 无输出但确实修改了文件
原因：变更已在任务中提交。
解决：用 `git log --oneline -5` 找到任务提交，再用 `git diff HEAD~N..HEAD` 查看。

### 不确定更新 README 的哪个章节
原因：多个章节可能受影响。
解决：在 README.md 中搜索与变更功能相关的关键词，更新所有相关章节。

### requirements/ 文件命名不确定
原因：新需求无法映射到现有文件。
解决：用 kebab-case 命名，匹配功能名（如 `dark-mode.md`）。先查看 `docs/requirements/` 下现有文件命名惯例。
