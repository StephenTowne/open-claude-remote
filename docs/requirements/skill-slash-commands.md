# Skill 自动转换为 Slash Command

## 需求描述

将项目中的 Skill（定义在 `.claude/skills/` 目录下的 `SKILL.md` 文件）自动转换为 Slash Command，供用户在终端中使用。

## 验收标准

1. **自动扫描**：启动时自动扫描全局 `~/.claude/skills/` 和项目级 `<cwd>/.claude/skills/` 目录
2. **Slash Command 转换**：将每个 Skill 转换为一个 slash command（如 `/finish-task`）
3. **智能合并**：
   - 新增 Skill 自动添加到 commands 列表
   - 删除 Skill 自动从 commands 列表移除
   - 保留用户对现有 Skill 的修改（enabled、autoSend、desc）
4. **优先级**：项目级 Skill 覆盖同名全局 Skill
5. **API 返回**：前端通过 `/api/config` 获取配置时自动包含 Skill commands

## 架构备注

### 核心模块

- `backend/src/skills/skill-scanner.ts`：扫描 Skill 目录，解析 YAML frontmatter
- `backend/src/skills/skill-commands.ts`：将 Skill 转换为 ConfigurableCommand
- `backend/src/skills/skill-command-merger.ts`：智能合并现有 commands 和新 Skill commands

### 数据流

```
GET /api/config
  → scanSkills(cwd)
  → convertSkillsToCommands()
  → mergeSkillCommands()
  → 返回包含 Skill commands 的配置
```

### 边界情况处理

- Skill 目录不存在 → 返回空数组
- SKILL.md 缺少 name 字段 → 记录 warn 日志，跳过
- 同名 Skill（全局+项目） → 项目级优先覆盖
- 与系统默认命令同名 → 系统默认命令不受影响