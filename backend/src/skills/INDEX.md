<!-- auto-doc: 文件增删时更新 -->
# backend/src/skills/ - Skill 扫描与 Command 转换

- index.ts: 模块统一导出，聚合 skill-scanner、skill-commands、skill-command-merger 三个子模块
- skill-scanner.ts: scanSkills() 扫描全局 ~/.claude/skills/ 和项目级 .claude/skills/ 目录，parseSkillFrontmatter() 解析 SKILL.md YAML frontmatter 提取 name/description
- skill-commands.ts: convertSkillsToCommands() 将 SkillInfo[] 转换为 ConfigurableCommand[]，isSkillCommand() 判断命令是否为 Skill command（非系统默认命令）
- skill-command-merger.ts: mergeSkillCommands() 智能合并现有 commands 和新扫描的 Skill commands，保留用户修改（enabled/autoSend/desc），移除已删除 Skill