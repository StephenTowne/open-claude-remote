# 三层文档格式规范

## Tier 1: ARCHITECTURE.md（项目根目录，约150-250行）

采用「多层级地图」格式（参考 C4 模型），8 个标准章节：

```markdown
<!-- auto-doc: 新增领域/层/路由/外部集成时更新 -->
# {ProjectName} Architecture

## 1. Context
> 一句话业务目标
- Users: {角色列表及其职责}
- External Systems: {外部依赖及交互方式}
- Boundaries: {系统不做什么}
### Domain Dictionary
{核心术语 + 含义 + 易混淆项}

## 2. Stack
{技术栈 + 版本号，Backend / Frontend / Deploy 三行}

## 3. Layers
{分层架构箭头图 + 每层职责一句话}

## 4. Data Flow
{Mermaid 流程图 + 关键路径文字描述}
### Core Entity Relationships
{Mermaid ER图，核心实体关系}

## 5. Routes
{Backend / Frontend 路由列表，标注版本或废弃状态}

## 6. Domain Map
{按业务域分组，每个域列出全栈相关文件}

## 7. Key Decisions
{ADR 表格：决策 | 选择 | 原因 | 后果}

## 8. Deployment
{Production / Development / ENV vars / CI-CD}
```

**关键原则**：
- **Context** 明确系统边界，AI 知道哪些是内部可控、哪些是外部依赖
- **Data Flow + ER** 用 Mermaid（LLM 可直接读源码），不用图片
- **Key Decisions** 是 ADR 格式（背景→选择→原因→后果），防止 AI 违反设计决策
- **Domain Map** 按业务关键词定位全栈 5-6 个文件
- **Stack 带版本号**，AI 据此选择正确的语法特性和 API 用法

---

## Tier 2: INDEX.md（每个跟踪目录，约15-25行）

采用「紧凑列表」格式：

```markdown
<!-- auto-doc: 文件增删时更新 -->
# {目录路径}/ - {一句话职责}

- file_a.py: 一句话描述功能
- file_b.py: 一句话描述功能 [标注:行数L]
```

**规则**：
- 不包含语言约定的初始化文件（`__init__.py`、`index.ts` 仅re-export时）
- 不包含构建产物（`__pycache__`、`.class`等）
- 超过 500 行的文件标注 `[行数L]`，提醒复杂度
- 每行只写一个文件
- 按字母序排列
- 有子目录时用 `## subdir/` 标题分组

---

## Tier 3: 文件头注释

该文件的定位、作用等

```python
"""一句话中文描述"""          # Python
```
```typescript
/** 一句话描述 */            # TypeScript（仅对模块边界文件，可选）
```

---

## 跟踪目录的选择标准

并非所有目录都需要 INDEX.md，只跟踪满足以下条件的目录：
- 包含 **3个以上** 源代码文件
- 属于项目的 **核心分层**（如 models、services、api、pages、components）
- 文件之间有 **同层职责关系**（同一层的不同模块）

**不跟踪**的目录：
- 测试目录（tests/、__tests__/）
- 静态资源目录（assets/、static/、public/）
- 样式目录（styles/、css/）
- 构建配置目录
- 只有 1-2 个文件的目录

---

## 变更类型判定表

```
变更类型                    INDEX.md   ARCHITECTURE.md        文件头
──────────────────────────  ─────────  ─────────────────────  ──────
文件新增（A）                必须更新    仅新领域/层时          新文件加一行docstring
文件删除（D）                必须更新    仅被引用时             N/A
文件重命名/移动（R）         必须更新    仅被引用时             更新
文件内容修改（M）            跳过        跳过                   跳过
新增路由/入口注册            跳过        必须更新               跳过
新增外部集成/中间件          跳过        必须更新(Data Flow)    跳过
认证流程变更                 跳过        必须更新(Data Flow)    跳过
```
