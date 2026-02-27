---
name: python-testing-patterns
description: >
  Implement comprehensive testing strategies with pytest, fixtures, mocking,
  and test-driven development. Use when writing Python tests, setting up test
  suites, or implementing testing best practices. Covers: (1) Basic pytest tests
  and assertions, (2) Fixtures for setup/teardown, (3) Parameterized tests,
  (4) Mocking with unittest.mock, (5) Testing exceptions, (6) Advanced patterns
  (async, monkeypatch, property-based) via references.
---

# Python Testing Patterns

Comprehensive guide to implementing robust testing strategies in Python using pytest, fixtures, mocking, parameterization, and test-driven development practices.

## Core Concepts

### 1. Test Types

- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test interaction between components
- **Functional Tests**: Test complete features end-to-end
- **Performance Tests**: Measure speed and resource usage

### 2. Test Structure (AAA Pattern)

- **Arrange**: Set up test data and preconditions
- **Act**: Execute the code under test
- **Assert**: Verify the results

### 3. Test Coverage

- Measure what code is exercised by tests
- Identify untested code paths
- Aim for meaningful coverage, not just high percentages

### 4. Test Isolation

- Tests should be independent
- No shared state between tests
- Each test should clean up after itself

## Quick Start

```python
# test_example.py
def add(a, b):
    return a + b

def test_add():
    """Basic test example."""
    result = add(2, 3)
    assert result == 5

def test_add_negative():
    """Test with negative numbers."""
    assert add(-1, 1) == 0

# Run with: pytest test_example.py
```

## Fundamental Patterns

### Pattern 1: Basic pytest Tests

```python
# test_calculator.py
import pytest

class Calculator:
    """Simple calculator for testing."""

    def add(self, a: float, b: float) -> float:
        return a + b

    def subtract(self, a: float, b: float) -> float:
        return a - b

    def multiply(self, a: float, b: float) -> float:
        return a * b

    def divide(self, a: float, b: float) -> float:
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b


def test_addition():
    """Test addition."""
    calc = Calculator()
    assert calc.add(2, 3) == 5
    assert calc.add(-1, 1) == 0
    assert calc.add(0, 0) == 0


def test_subtraction():
    """Test subtraction."""
    calc = Calculator()
    assert calc.subtract(5, 3) == 2
    assert calc.subtract(0, 5) == -5


def test_multiplication():
    """Test multiplication."""
    calc = Calculator()
    assert calc.multiply(3, 4) == 12
    assert calc.multiply(0, 5) == 0


def test_division():
    """Test division."""
    calc = Calculator()
    assert calc.divide(6, 3) == 2
    assert calc.divide(5, 2) == 2.5


def test_division_by_zero():
    """Test division by zero raises error."""
    calc = Calculator()
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        calc.divide(5, 0)
```

### Pattern 2: Fixtures for Setup and Teardown

```python
# test_database.py
import pytest
from typing import Generator

class Database:
    """Simple database class."""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connected = False

    def connect(self):
        """Connect to database."""
        self.connected = True

    def disconnect(self):
        """Disconnect from database."""
        self.connected = False

    def query(self, sql: str) -> list:
        """Execute query."""
        if not self.connected:
            raise RuntimeError("Not connected")
        return [{"id": 1, "name": "Test"}]


@pytest.fixture
def db() -> Generator[Database, None, None]:
    """Fixture that provides connected database."""
    # Setup
    database = Database("sqlite:///:memory:")
    database.connect()

    # Provide to test
    yield database

    # Teardown
    database.disconnect()


def test_database_query(db):
    """Test database query with fixture."""
    results = db.query("SELECT * FROM users")
    assert len(results) == 1
    assert results[0]["name"] == "Test"


@pytest.fixture(scope="session")
def app_config():
    """Session-scoped fixture - created once per test session."""
    return {
        "database_url": "postgresql://localhost/test",
        "api_key": "test-key",
        "debug": True
    }


@pytest.fixture(scope="module")
def api_client(app_config):
    """Module-scoped fixture - created once per test module."""
    # Setup expensive resource
    client = {"config": app_config, "session": "active"}
    yield client
    # Cleanup
    client["session"] = "closed"


def test_api_client(api_client):
    """Test using api client fixture."""
    assert api_client["session"] == "active"
    assert api_client["config"]["debug"] is True
```

### Pattern 3: Parameterized Tests

```python
# test_validation.py
import pytest

def is_valid_email(email: str) -> bool:
    """Check if email is valid."""
    return "@" in email and "." in email.split("@")[1]


@pytest.mark.parametrize("email,expected", [
    ("user@example.com", True),
    ("test.user@domain.co.uk", True),
    ("invalid.email", False),
    ("@example.com", False),
    ("user@domain", False),
    ("", False),
])
def test_email_validation(email, expected):
    """Test email validation with various inputs."""
    assert is_valid_email(email) == expected


@pytest.mark.parametrize("a,b,expected", [
    (2, 3, 5),
    (0, 0, 0),
    (-1, 1, 0),
    (100, 200, 300),
    (-5, -5, -10),
])
def test_addition_parameterized(a, b, expected):
    """Test addition with multiple parameter sets."""
    from test_calculator import Calculator
    calc = Calculator()
    assert calc.add(a, b) == expected


# Using pytest.param for special cases
@pytest.mark.parametrize("value,expected", [
    pytest.param(1, True, id="positive"),
    pytest.param(0, False, id="zero"),
    pytest.param(-1, False, id="negative"),
])
def test_is_positive(value, expected):
    """Test with custom test IDs."""
    assert (value > 0) == expected
```

### Pattern 4: Mocking with unittest.mock

```python
# test_api_client.py
import pytest
from unittest.mock import Mock, patch, MagicMock
import requests

class APIClient:
    """Simple API client."""

    def __init__(self, base_url: str):
        self.base_url = base_url

    def get_user(self, user_id: int) -> dict:
        """Fetch user from API."""
        response = requests.get(f"{self.base_url}/users/{user_id}")
        response.raise_for_status()
        return response.json()

    def create_user(self, data: dict) -> dict:
        """Create new user."""
        response = requests.post(f"{self.base_url}/users", json=data)
        response.raise_for_status()
        return response.json()


def test_get_user_success():
    """Test successful API call with mock."""
    client = APIClient("https://api.example.com")

    mock_response = Mock()
    mock_response.json.return_value = {"id": 1, "name": "John Doe"}
    mock_response.raise_for_status.return_value = None

    with patch("requests.get", return_value=mock_response) as mock_get:
        user = client.get_user(1)

        assert user["id"] == 1
        assert user["name"] == "John Doe"
        mock_get.assert_called_once_with("https://api.example.com/users/1")


def test_get_user_not_found():
    """Test API call with 404 error."""
    client = APIClient("https://api.example.com")

    mock_response = Mock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")

    with patch("requests.get", return_value=mock_response):
        with pytest.raises(requests.HTTPError):
            client.get_user(999)


@patch("requests.post")
def test_create_user(mock_post):
    """Test user creation with decorator syntax."""
    client = APIClient("https://api.example.com")

    mock_post.return_value.json.return_value = {"id": 2, "name": "Jane Doe"}
    mock_post.return_value.raise_for_status.return_value = None

    user_data = {"name": "Jane Doe", "email": "jane@example.com"}
    result = client.create_user(user_data)

    assert result["id"] == 2
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args.kwargs["json"] == user_data
```

### Pattern 5: Testing Exceptions

```python
# test_exceptions.py
import pytest

def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ZeroDivisionError("Division by zero")
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Arguments must be numbers")
    return a / b


def test_zero_division():
    """Test exception is raised for division by zero."""
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)


def test_zero_division_with_message():
    """Test exception message."""
    with pytest.raises(ZeroDivisionError, match="Division by zero"):
        divide(5, 0)


def test_type_error():
    """Test type error exception."""
    with pytest.raises(TypeError, match="must be numbers"):
        divide("10", 5)


def test_exception_info():
    """Test accessing exception info."""
    with pytest.raises(ValueError) as exc_info:
        int("not a number")

    assert "invalid literal" in str(exc_info.value)
```

## Test Quality Checklist

Systematic checklist for Code Review and self-verification:

### 1. Test Completeness (测试完整性)

- [ ] 是否有单元测试？
- [ ] 是否测试了主要功能？
- [ ] 是否测试了边界情况？
- [ ] 是否测试了异常情况？

### 2. Test Quality (测试质量)

- [ ] 测试是否独立？（不依赖其他测试）
- [ ] 测试是否可重复？（多次运行结果一致）
- [ ] 测试是否清晰？（命名和意图明确）
- [ ] 测试是否快速？（避免不必要的等待）

### 3. Test Coverage (测试覆盖率)

- [ ] 代码覆盖率是否达标？（≥80%）
- [ ] 关键路径是否覆盖？
- [ ] 边界情况是否覆盖？

## Test Design Principles

### One Behavior Per Test

Each test should verify exactly one behavior. This makes failures easy to diagnose and tests easy to maintain.

```python
# BAD - testing multiple behaviors
def test_user_service():
    user = service.create_user(data)
    assert user.id is not None
    assert user.email == data["email"]
    updated = service.update_user(user.id, {"name": "New"})
    assert updated.name == "New"

# GOOD - focused tests
def test_create_user_assigns_id():
    user = service.create_user(data)
    assert user.id is not None

def test_create_user_stores_email():
    user = service.create_user(data)
    assert user.email == data["email"]

def test_update_user_changes_name():
    user = service.create_user(data)
    updated = service.update_user(user.id, {"name": "New"})
    assert updated.name == "New"
```

### Test Error Paths

Always test failure cases, not just happy paths.

```python
def test_get_user_raises_not_found():
    with pytest.raises(UserNotFoundError) as exc_info:
        service.get_user("nonexistent-id")

    assert "nonexistent-id" in str(exc_info.value)

def test_create_user_rejects_invalid_email():
    with pytest.raises(ValueError, match="Invalid email format"):
        service.create_user({"email": "not-an-email"})
```

### Test Boundary Cases - Complete Example

Comprehensive boundary testing prevents 90% of bugs.

```python
import pytest
import uuid

# ❌ 不完整的测试：只测试正常情况
def test_divide_incomplete():
    assert divide(10, 2) == 5
    # 这样会漏掉很多潜在bug！

# ✅ 完整的边界情况测试
def test_divide_complete():
    """测试除法函数的所有边界情况。"""
    # 正常情况
    assert divide(10, 2) == 5
    assert divide(9, 3) == 3

    # 边界情况
    assert divide(0, 5) == 0      # 分子为0
    assert divide(10, 1) == 10    # 除数为1
    assert divide(5, 5) == 1      # 相等

    # 异常情况
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)             # 除数为0

    # 负数情况
    assert divide(-10, 2) == -5   # 分子为负
    assert divide(10, -2) == -5   # 除数为负
    assert divide(-10, -2) == 5   # 都为负

    # 浮点数情况
    assert divide(5, 2) == 2.5
    assert divide(1, 3) == pytest.approx(0.333, rel=0.01)
```

### Test Independence - Critical Pattern

Tests MUST be independent. Each test prepares its own data and cleans up.

```python
import uuid

# ❌ 错误：测试不独立（依赖其他测试和数据库状态）
def test_user_creation_bad():
    user = create_user("test")
    assert user.name == "test"
    # 依赖数据库状态，可能因为之前的测试失败

def test_user_deletion_bad():
    delete_user("test")  # 依赖上一个测试创建的用户
    assert get_user("test") is None
    # 如果 test_user_creation 先失败，这个测试也会失败

# ✅ 正确：测试独立（每个测试独立准备和清理数据）
def test_user_creation_good():
    # 每个测试都独立准备数据
    unique_name = "test_" + str(uuid.uuid4())[:8]
    user = create_user(unique_name)

    assert user.name == unique_name

    # 清理：不留下测试数据
    delete_user(user.id)

def test_user_deletion_good():
    # 独立准备数据
    unique_name = "test_" + str(uuid.uuid4())[:8]
    user = create_user(unique_name)

    # 测试删除
    delete_user(user.id)

    # 验证删除成功
    assert get_user(user.id) is None

# ✅ 更好的方式：使用fixture确保隔离
@pytest.fixture
def isolated_user():
    """每个测试获得独立的用户，测试后自动清理。"""
    unique_name = "test_" + str(uuid.uuid4())[:8]
    user = create_user(unique_name)
    yield user
    # Teardown: 确保清理
    try:
        delete_user(user.id)
    except Exception:
        pass  # 用户可能已被测试删除

def test_user_update(isolated_user):
    isolated_user.name = "updated"
    result = update_user(isolated_user)
    assert result.name == "updated"
```

## Testing Best Practices

### Test Naming Convention

A common pattern: `test_<unit>_<scenario>_<expected_outcome>`. Adapt to your team's preferences.

```python
# Pattern: test_<unit>_<scenario>_<expected>
def test_create_user_with_valid_data_returns_user():
    ...

def test_create_user_with_duplicate_email_raises_conflict():
    ...

def test_get_user_with_unknown_id_returns_none():
    ...

# Good test names - clear and descriptive
def test_user_creation_with_valid_data():
    """Clear name describes what is being tested."""
    pass

def test_login_fails_with_invalid_password():
    """Name describes expected behavior."""
    pass

def test_api_returns_404_for_missing_resource():
    """Specific about inputs and expected outcomes."""
    pass

# Bad test names - avoid these
def test_1():  # Not descriptive
    pass

def test_user():  # Too vague
    pass

def test_function():  # Doesn't explain what's tested
    pass
```

## Best Practices Summary

### Critical Rules (MUST follow)

1. **测试必须独立** - 每个测试准备自己的数据，不依赖其他测试
2. **测试必须覆盖边界** - 空值、边界值、异常情况、负数、特殊字符
3. **测试必须可重复** - 多次运行结果一致，无随机失败
4. **测试必须快速** - 单元测试毫秒级，集成测试秒级

### Testing Workflow

1. **Write tests first** (TDD) or alongside code
2. **Run tests before commit** - 确保 `SERVER_ENV=dev`
3. **One assertion per test** when possible
4. **Use descriptive test names** that explain behavior
5. **Use fixtures** for setup and teardown
6. **Mock external dependencies** appropriately
7. **Parametrize tests** to reduce duplication
8. **Measure coverage** - aim for ≥80%, focus on critical paths
9. **Run tests in CI/CD** on every commit
10. **Clean up test data** - 不留下测试残渣

### Test Case Checklist (每个功能点必须验证)

| 场景类型 | 检查项 |
|---------|--------|
| 正常情况 | 主要功能是否正常工作？ |
| 边界值 | 最小值、最大值、0、空字符串、空列表 |
| 空值处理 | None、null、缺失字段 |
| 类型错误 | 错误的类型输入 |
| 异常情况 | 网络错误、数据库错误、超时 |
| 并发情况 | 多线程/多进程访问 |
| 大数据量 | 性能边界测试 |
| 权限不足 | 未授权访问 |
| 重复提交 | 幂等性测试 |

## Advanced Patterns

For advanced testing scenarios, load the reference file as needed:

See [references/advanced-patterns.md](references/advanced-patterns.md) for:
- Testing async code (pytest-asyncio)
- Monkeypatch for environment/attribute patching
- Temporary files and directories (tmp_path)
- Custom fixtures and conftest patterns
- Property-based testing (Hypothesis)
- Testing retry behavior
- Mocking time with Freezegun
- Test markers and conditional skips
- Coverage reporting
- Testing database code (SQLAlchemy)
- CI/CD integration
- Configuration files (pytest.ini, pyproject.toml)
- Test organization (directory structure)
- Resources and references
