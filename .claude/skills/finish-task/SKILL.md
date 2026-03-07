---
name: finish-task
description: >
  Task completion gate — mandatory final step after every coding task.
  Runs three checks: (1) /auto-doc for structural changes, (2) user-visible behavior → README.md,
  (3) requirements tracking → docs/requirements/ (including tech architecture changes).
  Use when: user says "finish", "done", "完成", "收尾", "/finish", "/finish-task",
  or a coding task with file changes is complete.
  Do NOT use for: pure conversation (no code changes), planning-only sessions,
  code review without edits, reading/exploring code.
---

# ⛔ EXECUTION MANDATE

你必须实际执行以下每个步骤（运行 bash 命令、读取文件、编辑文件）。
禁止：仅输出"已完成"而未运行命令、跳过步骤直接输出汇总、调用 /auto-doc 后不等待返回。
只有三个步骤全部实际执行后，才能输出最终汇总。

---

# Task Completion Gate

每个编码任务的强制收尾步骤。按顺序执行三项检查：

1. 执行 `/auto-doc`（由 auto-doc 自行检测是否有结构变更）
2. 用户可见行为变更 → 更新 `README.md`
3. 需求/架构变更 → 写入 `docs/requirements/`

---

## Step 1: 执行 `/auto-doc`

⚠️ **必须调用 Skill 工具执行 `/auto-doc`，等待返回完整结果后再继续 Step 2。**

直接执行 `/auto-doc`。auto-doc 会自行检测源码文件的新增、删除或重命名，并决定是否需要更新文档。
无需手动运行 git 命令检测 — auto-doc 内部已包含完整的检测逻辑。

---

## Step 2: 用户可见行为检查 → `README.md`

⚠️ **必须实际运行以下 git 命令，根据输出做出判定。**

以对话上下文为主要依据，git 为辅助验证：

```bash
git diff --stat HEAD
git log --oneline -3
```

**属于用户可见变更**：操作流程/UI 交互改变、快捷键/手势变更、配置项/环境变量新增变更、启动/构建/部署流程变更、CLI 命令/参数变更

**不属于用户可见变更**：内部 API 端点、代码重构（行为未变）、内部数据结构调整、测试文件变更

**判定**：有变更 → 读取并更新 README.md 相关章节 | 无变更 → "✅ 无需更新"

---

## Step 3: 需求/架构检查 → `docs/requirements/`

⚠️ **必须基于 Step 2 的 git 输出和对话上下文做出判定。**

### 二问决策流

```
Q1: 是否引入/修改了用户可见行为或配置项？
    YES → 写入 docs/requirements/*.md
    NO  → Q2

Q2: 是否改变了架构模式？（数据流方向、模块分层、通信协议、状态管理方式）
    YES → 写入 docs/requirements/tech-*.md
    NO  → 无需文档更新
```

**Q1 判定要点**：新增功能点、功能范围扩展、用户可见行为变更、新增配置项、支持新场景

**Q2 判定要点**：数据流方向改变、模块分层调整（拆分/合并/新抽象层）、通信协议变更、状态管理方式改变

**明确排除（Q1=NO 且 Q2=NO）**：提取函数/重命名、Bug 修复、补测试、性能优化（不改数据流）、同模块内文件移动

> 当判定需要写文档时，先读取 `references/requirement-criteria.md` 获取完整标准和模板。

**判定**：
- Q1=YES → 在 `docs/requirements/` 写入或更新 `.md`，包含需求描述、验收标准
- Q2=YES → 在 `docs/requirements/tech-*.md` 写入，包含变更描述、影响范围、架构决策
- 均为 NO → "✅ 无需更新"

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

### 示例: Bug 修复，无结构变更

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 无需更新
  2. README:       ✅ 无需更新
  3. requirements: ✅ 无需更新
```

### 示例: 新功能（新增环境变量 + UI 变更）

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 — 新增 frontend/src/components/DarkMode.tsx
  2. README:       ✅ 已更新 — Configuration 章节（新增 THEME 环境变量）
  3. requirements: ✅ 已写入 — docs/requirements/dark-mode.md
     （判定依据：Q1=YES — 新增配置项 + 用户可见 UI 变更）
```

### 示例: 纯代码重构（提取函数，行为不变）

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 无需更新
  2. README:       ✅ 无需更新
  3. requirements: ✅ 无需更新
     （判定依据：Q1=NO, Q2=NO — 同模块内代码整理，无架构模式变更）
```

### 示例: 架构重构（tech 文档）

将 session 模块拆分为 session + instance 两个独立模块，改变了会话管理的数据流。

```
📋 /finish 完成检查:
  1. auto-doc:     ✅ 已执行 — 新增 backend/src/instance/ 目录
  2. README:       ✅ 无需更新（用户无感知）
  3. requirements: ✅ 已写入 — docs/requirements/tech-instance-isolation.md
     （判定依据：Q1=NO, Q2=YES — 模块分层调整，会话管理从单层拆为双层）
```

---

## 故障排查

### git diff 无输出但确实修改了文件
变更已在任务中提交。用 `git log --oneline -5` 找到任务提交，再用 `git diff HEAD~N..HEAD` 查看。

### 不确定更新 README 的哪个章节
在 README.md 中搜索与变更功能相关的关键词，更新所有相关章节。

### requirements/ 文件命名不确定
用 kebab-case 命名，匹配功能名（如 `dark-mode.md`）。技术变更加 `tech-` 前缀（如 `tech-instance-isolation.md`）。先查看 `docs/requirements/` 下现有文件命名惯例。
