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

# Task Completion Gate

每个编码任务的强制收尾步骤。按顺序执行三项检查：

1. 执行 `/auto-doc`（由 auto-doc 自行检测是否有结构变更）
2. 用户可见行为变更 → 更新 `README.md`
3. 新增/变更需求 → 写入 `docs/requirements/`

---

## Step 1: 执行 `/auto-doc`

直接执行 `/auto-doc`。auto-doc 会自行检测源码文件的新增、删除或重命名，并决定是否需要更新文档。

无需在此步骤中手动运行 git 命令检测 — auto-doc 内部已包含完整的检测逻辑。

---

## Step 2: 用户可见行为检查 → `README.md`

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

回顾对话上下文：
- 是否有新功能被请求并确认？
- 是否讨论并达成了新的产品需求？
- 是否修改或扩展了现有需求？

**判定：**
- **有新增/变更需求** → 在 `docs/requirements/` 中写入或更新 `.md` 文件。包含：需求描述、验收标准、架构备注（如适用）。排除实现方案。
- **无新需求** → 输出 "✅ requirements: 无新需求"

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
