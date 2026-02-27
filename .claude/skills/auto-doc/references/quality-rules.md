# 描述质量规范 + 审查流程细则

## INDEX.md 描述质量规范

### 禁止

- 文件名的中文翻译（❌ `user_service.py: 用户服务`）
- 目录层级的重复（❌ `order_repository.py: 订单 Repository`）

### 描述必须包含以下至少一项

1. **区分性机制/技术手段** — `auth_service.py: JWT签发+刷新，集成OAuth2 provider`
2. **关键接口/入参** — `deps.py: get_current_user() + get_db_session() 依赖注入`
3. **调用时机/触发条件** — `event_handlers.py: Service层commit后异步触发，失败不阻塞主流程`
4. **内部复杂度提示** — `billing_service.py: 计费规则引擎+折扣叠加+退款冲正，依赖order状态机 [1200L]`
5. 超过 500L 的文件必须列出 2-3 个核心公开方法/类名

### 验证方法（"遮住文件名"测试）

遮住文件名只看描述，能否猜出是哪个文件？能 = 描述有效；不能 = 描述需要改进。

---

## 新增文件描述生成流程

为新文件生成描述时，按以下步骤操作：

1. 读取文件头部（前 50 行），提取多行 docstring
2. 扫描主要 class/function 定义名称
3. 检查 import 识别关键依赖
4. 按上述质量规范合成描述，确保不是文件名翻译

---

## quality 模式 — INDEX.md 审查细则

### 文件名翻译检测算法

对每个 INDEX.md 条目：
1. 提取文件名词集（如 `user_service.py` → {user, 用户, service, 服务}）
2. 提取目录层级词集（如 `services/` → {service, 服务}）
3. 提取描述词集
4. 如果 描述词集 ⊆ 文件名词集 ∪ 目录层级词集 → **标记为需增强**

### 重写低质量描述

对标记为需增强的条目：
1. 读取文件前 50 行，提取 docstring、class/function 定义、关键 import
2. 按质量规范重写描述
3. 确保通过「遮住文件名」测试

---

## quality 模式 — ARCHITECTURE.md 审查清单

1. **Domain Map 文件引用有效性**：检查每个引用的文件是否实际存在，标记已删除/重命名的过时引用
2. **Data Flow 完整性**：检查是否涵盖当前所有外部集成和认证流程
3. **Key Decisions 时效性**：检查版本迁移状态、技术选型等是否与代码现状一致
4. **Routes 同步性**：对比后端入口文件和前端路由配置中实际注册的路由，标记遗漏或过时条目

---

## regenerate 模式 — 描述质量自检（R2.5）

在生成 INDEX.md 之后、生成 ARCHITECTURE.md 之前执行：

对每个生成的 INDEX.md 条目：
1. 从描述中移除与文件名重复的词（如文件名 `user_service.py`，移除 "用户"、"服务" 等直接翻译词）
2. 剩余有意义词少于 3 个 → 标记为低质量
3. 对低质量条目：重新读取文件前 50 行，按质量规范重写描述
