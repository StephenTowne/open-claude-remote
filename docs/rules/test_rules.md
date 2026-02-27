# Test Rules (测试规范)

## 检查清单（执行前必读）

- [ ] 测试放在正确目录（unit/integration/e2e）
- [ ] 文件名 `test_{模块名}.py`
- [ ] 函数名 `test_{操作}_{预期结果}`
- [ ] unit 不用 db_session/client
- [ ] 创建用户提供 employee_id
- [ ] 无硬编码 ID
- [ ] 无 time.sleep()

---

## 快速参考

### 测试分类速查

| 目录 | 特征 | 典型场景 |
|-----|------|---------|
| unit/ | 无 DB、无 HTTP、无外部服务 | 纯函数、配置解析、数据转换 |
| integration/ | 真实 DB 或 HTTP | API 端点、Service 业务流、Repository 操作 |
| e2e/ | 浏览器自动化 | 完整用户流程 |

### 核心 Fixtures 速查

| 想要... | 使用 |
|--------|-----|
| 数据库会话（自动回滚）| `db_session` |
| 需要真实 commit | `explicit_commit_session` |
| HTTP 请求（未登录）| `client` |
| HTTP 请求（已登录）| `auth_client` |
| HTTP 请求（真实 cookie）| `admin_auth_client` |
| 创建测试数据 | `user_factory`, `team_factory`, `meeting_factory` |

### 禁止事项

| 禁止 | 替代方案 |
|-----|---------|
| `time.sleep()` | mock 或 freezegun |
| 硬编码 ID | 从返回值获取 |
| unit 用 db_session | mock 替代 |
| 共享可变状态 | 独立准备数据 |

---

## 目录结构

```
tests/
├── conftest.py          # 全局 fixtures
├── helpers/             # 测试辅助函数（mock_helpers.py 等）
├── unit/                # 纯逻辑，无外部依赖
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── repositories/
│   ├── services/
│   └── utils/
├── integration/         # 真实 DB/HTTP
│   ├── api/
│   ├── auth/
│   ├── repositories/
│   └── services/
└── e2e/                 # 浏览器自动化
```

---

## Fixture 完整列表

### 数据库相关

| Fixture | 作用 | 适用场景 |
|---------|------|---------|
| `engine` | SQLite 测试数据库引擎 | session 级别，自动创建/销毁 |
| `db_session` | 数据库会话（自动回滚）| 大多数 integration 测试 |
| `explicit_commit_session` | 显式 commit 专用 | 测试真实 commit 行为 |

### HTTP 客户端

| Fixture | 作用 | 适用场景 |
|---------|------|---------|
| `client` | 无认证 TestClient | 不需要登录的 API |
| `auth_client` | 管理员认证 TestClient | 需要登录的 API |
| `auth_client_explicit` | 认证 + 显式 commit | 测试 commit 行为的 API |
| `admin_auth_client` | 管理员 + 签名 cookie | impersonation 等需真实 cookie |
| `auth_client_with_team` | 带 X-Team-ID header | 需要团队上下文 |

### 数据工厂（推荐使用）

| Fixture | 示例 |
|---------|------|
| `user_factory` | `user = user_factory(username="custom", is_admin=True)` |
| `team_factory` | `team = team_factory(name="自定义团队", owner=user)` |
| `meeting_factory` | `meeting = meeting_factory(title="测试会议")` |
| `schedule_factory` | `schedule = schedule_factory(team_id=team.id)` |
| `host_rotation_factory` | `rotation = host_rotation_factory(user_id=user.id)` |

### 数据模板

| Fixture | 作用 |
|---------|------|
| `sample_user_data` | 示例用户字典 |
| `sample_team_data` | 示例团队字典 |
| `sample_meeting_data` | 示例会议字典 |
| `sample_agenda_data` | 示例议程字典 |

### 预置实体

| Fixture | 作用 |
|---------|------|
| `current_user` | 已创建的测试用户 |
| `secondary_user` | 第二个测试用户 |
| `sample_team` | 通过 API 预创建的团队 |
| `user_repository` | user_repository 实例 |

### 辅助函数（非 fixture）

| 函数 | 作用 |
|------|------|
| `create_test_user_direct(db, username, full_name)` | 通过 repository 直接创建用户并 commit |
| `_build_signed_cookie(session_data)` | 构建 HMAC 签名 cookie |
| `_create_auth_client(db_session, *, is_admin, with_cookie)` | 认证客户端工厂 |

### helpers/ 模块

| 模块 | 作用 |
|------|------|
| `mock_helpers.mock_httpx_response(json_data, status_code)` | 创建 mock httpx 响应 |
| `mock_helpers.mock_httpx_client(response_data, status_code)` | 创建 mock httpx.AsyncClient |

---

## 测试模板

### unit 测试

```python
"""模块功能简述"""
from unittest.mock import patch, MagicMock

class TestTargetFunction:
    def test_normal_case(self):
        result = target_function(input_data)
        assert result == expected

    def test_error_case(self):
        with pytest.raises(ValueError, match="错误信息"):
            target_function(bad_input)
```

### integration API 测试

```python
"""API 端点简述"""

class TestXxxEndpoint:
    def test_success(self, auth_client, db_session):
        response = auth_client.post("/api/v1/xxx", json={...})
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_unauthorized(self, client):
        response = client.post("/api/v1/xxx", json={...})
        assert response.status_code == 401
```

### integration Service 测试

```python
"""Service 功能简述"""

class TestXxxService:
    def test_business_logic(self, db_session):
        result = xxx_service.do_something(db=db_session, ...)
        assert result is not None
```

**参考现有测试文件获取完整示例：**
- unit: `tests/unit/services/test_dingtalk_service.py`
- integration API: `tests/integration/api/test_teams.py`
- integration Service: `tests/integration/services/test_scheduler_service.py`

---

## 命名约定

### 文件名

```
test_{模块名}.py          # 基本格式
test_{模块名}_{场景}.py    # 同模块有多个测试文件时
```

### 函数名

```python
def test_{操作}_{预期结果}(self, ...):
```

示例：
- `test_create_team_success`
- `test_non_admin_cannot_create_user`

---

## 禁止事项（严格执行）

| 禁止 | 原因 | 替代方案 |
|-----|-----|---------|
| `time.sleep()` | 慢且不稳定 | `freezegun` 或 mock 时间 |
| 硬编码 ID | 不可预测 | 从创建返回值获取 |
| unit 用 db_session | 违反隔离 | mock 替代 |
| 共享可变状态 | 顺序依赖 | 独立准备数据 |
| 跨文件 import 测试函数 | 耦合 | 提取到 conftest.py 或 helpers/ |
| 省略 employee_id | NOT NULL | 始终提供 |

---

## 环境要求

```bash
# 必须设置环境变量
SERVER_ENV=dev

# 必须在 backend 目录下执行
cd backend

# 必须使用 uv 执行
SERVER_ENV=dev uv run pytest tests/path/to/test_file.py

# 运行单个测试（推荐）
SERVER_ENV=dev uv run pytest tests/integration/api/test_teams.py::TestTeamCreation::test_create_team_success -v
```

---

## Markers（自动标记）

markers 由 `conftest.py` 自动添加，无需手动标注：

```
tests/unit/        → @pytest.mark.unit
tests/integration/ → @pytest.mark.integration
tests/e2e/         → @pytest.mark.e2e
```

运行特定类型测试：

```bash
SERVER_ENV=dev uv run pytest -m unit          # 仅 unit
SERVER_ENV=dev uv run pytest -m integration   # 仅 integration
SERVER_ENV=dev uv run pytest -m "not slow"    # 排除慢速测试
```

需要手动标注 `@pytest.mark.slow` 的场景：
- 涉及多线程/并发的测试
- 数据量大的批量操作测试
- 需要等待超时的测试

---

## 测试质量保障

### 边界用例建议覆盖

根据功能特点选择相关场景，非强制全覆盖：

| 场景 | 示例 |
|-----|------|
| 空值/零值 | `test_create_with_empty_name` |
| 权限不足 | `test_non_admin_cannot_delete` |
| 重复提交 | `test_duplicate_create_returns_conflict` |

其他场景（边界值、并发、大数据量、类型错误）按需覆盖。

### 变异测试（可选）

用于检验测试有效性的进阶手段，非强制要求：

```bash
SERVER_ENV=dev uv run mutmut run --paths-to-mutate=app/services/target_service.py
```

- 仅在关键业务逻辑变更时建议运行
- 不设具体得分阈值
- PR 中不强制附结果

### 覆盖率

```bash
SERVER_ENV=dev uv run pytest tests/ --cov=app --cov-branch --cov-report=term-missing
```

行覆盖率 ≥ 80% 为基础门槛，分支覆盖率更能反映异常路径覆盖情况。

---

## 分类标准详情

### unit（单元测试）

**判定条件**（满足全部）：
- 不依赖数据库（不使用 `db_session`）
- 不依赖 HTTP 客户端（不使用 `client`、`auth_client`）
- 不依赖外部服务
- 依赖项全部通过 mock/patch 注入

### integration（集成测试）

**判定条件**（满足任一）：
- 使用 `db_session` 进行真实数据库读写
- 使用 `client` 或 `auth_client` 发送 HTTP 请求
- 多个组件协作

### e2e（端到端测试）

**判定条件**：
- 模拟完整用户操作流程（浏览器自动化）
- 前后端联动测试