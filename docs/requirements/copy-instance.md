# Copy Instance Feature

## Requirement Description

允许用户从已有实例快速创建新实例，继承原实例的所有参数配置。

## User Scenario

用户在管理多个项目时，往往需要基于相似配置创建新实例。当前流程需要手动填写所有参数，效率较低。

## Acceptance Criteria

1. **触发方式**
   - 移动端：长按实例 Tab（500ms）
   - 桌面端：右键点击实例 Tab

2. **预填内容**
   - 工作目录 (cwd)
   - 实例名称：自动添加 `-copy` 后缀
   - Settings 文件：从 `claudeArgs` 中解析 `--settings` 参数
   - Claude 参数：除 `--settings` 外的其他参数

3. **创建后行为**
   - 自动轮询获取新实例（最多 10 次，间隔 1s）
   - 创建成功后自动切换到新实例
   - 显示 toast 提示：「已创建并切换到 {name}」

4. **向后兼容**
   - CLI 直接启动的实例无 `claudeArgs` 字段，复制时忽略该字段

## Notes

- 实现方案：后端注册实例时新增 `claudeArgs` 字段存储创建参数
- 名称冲突：允许重名，不做唯一性检查