# Python Testing Patterns (pytest)

Comprehensive reference for testing in Python using pytest, fixtures, mocking, parameterization, and advanced patterns.

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

## Basic pytest Tests

```python
import pytest

class Calculator:
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
    calc = Calculator()
    assert calc.add(2, 3) == 5
    assert calc.add(-1, 1) == 0
    assert calc.add(0, 0) == 0

def test_division_by_zero():
    calc = Calculator()
    with pytest.raises(ValueError, match="Cannot divide by zero"):
        calc.divide(5, 0)
```

## Fixtures for Setup and Teardown

```python
import pytest
from typing import Generator

@pytest.fixture
def db() -> Generator[Database, None, None]:
    """Fixture that provides connected database."""
    database = Database("sqlite:///:memory:")
    database.connect()
    yield database           # Provide to test
    database.disconnect()    # Teardown

def test_database_query(db):
    results = db.query("SELECT * FROM users")
    assert len(results) == 1

# Scope options: function (default), class, module, session
@pytest.fixture(scope="session")
def app_config():
    """Created once per test session."""
    return {"database_url": "postgresql://localhost/test", "debug": True}

@pytest.fixture(scope="module")
def api_client(app_config):
    """Created once per test module. Can depend on other fixtures."""
    client = {"config": app_config, "session": "active"}
    yield client
    client["session"] = "closed"
```

## Parameterized Tests

```python
import pytest

@pytest.mark.parametrize("email,expected", [
    ("user@example.com", True),
    ("test.user@domain.co.uk", True),
    ("invalid.email", False),
    ("@example.com", False),
    ("", False),
])
def test_email_validation(email, expected):
    assert is_valid_email(email) == expected

# With custom test IDs
@pytest.mark.parametrize("value,expected", [
    pytest.param(1, True, id="positive"),
    pytest.param(0, False, id="zero"),
    pytest.param(-1, False, id="negative"),
])
def test_is_positive(value, expected):
    assert (value > 0) == expected
```

## Mocking with unittest.mock

```python
from unittest.mock import Mock, patch, MagicMock

def test_get_user_success():
    client = APIClient("https://api.example.com")

    mock_response = Mock()
    mock_response.json.return_value = {"id": 1, "name": "John Doe"}
    mock_response.raise_for_status.return_value = None

    with patch("requests.get", return_value=mock_response) as mock_get:
        user = client.get_user(1)
        assert user["name"] == "John Doe"
        mock_get.assert_called_once_with("https://api.example.com/users/1")

# Decorator syntax
@patch("requests.post")
def test_create_user(mock_post):
    mock_post.return_value.json.return_value = {"id": 2, "name": "Jane"}
    mock_post.return_value.raise_for_status.return_value = None

    result = client.create_user({"name": "Jane"})
    assert result["id"] == 2
    mock_post.assert_called_once()
```

## Testing Exceptions

```python
import pytest

def test_zero_division():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_exception_message():
    with pytest.raises(ZeroDivisionError, match="Division by zero"):
        divide(5, 0)

def test_exception_info():
    with pytest.raises(ValueError) as exc_info:
        int("not a number")
    assert "invalid literal" in str(exc_info.value)
```

## Monkeypatch

```python
import os

def test_custom_env_var(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/test")
    assert get_database_url() == "postgresql://localhost/test"

def test_env_var_not_set(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert get_database_url() == "sqlite:///:memory:"

def test_monkeypatch_attribute(monkeypatch):
    config = Config()
    monkeypatch.setattr(config, "api_key", "test-key")
    assert config.get_api_key() == "test-key"
```

## Temporary Files (tmp_path)

```python
from pathlib import Path

def test_file_operations(tmp_path):
    test_file = tmp_path / "test_data.txt"
    save_data(test_file, "Hello, World!")
    assert test_file.exists()
    assert load_data(test_file) == "Hello, World!"

def test_multiple_files(tmp_path):
    files = {"file1.txt": "Content 1", "file2.txt": "Content 2"}
    for name, content in files.items():
        save_data(tmp_path / name, content)
    assert len(list(tmp_path.iterdir())) == 2
```

## Conftest and Shared Fixtures

```python
# conftest.py — shared fixtures for all tests in directory
import pytest

@pytest.fixture(scope="session")
def database_url():
    return "postgresql://localhost/test_db"

@pytest.fixture(autouse=True)
def reset_database(database_url):
    """Auto-use fixture that runs before each test."""
    yield
    # Teardown after each test

@pytest.fixture
def sample_user():
    return {"id": 1, "name": "Test User", "email": "test@example.com"}

# Parametrized fixture — test runs once per param
@pytest.fixture(params=["sqlite", "postgresql", "mysql"])
def db_backend(request):
    return request.param
```

## Test Markers

```python
import pytest

@pytest.mark.slow
def test_slow_operation():
    """Run with: pytest -m slow"""
    pass

@pytest.mark.skip(reason="Feature not implemented yet")
def test_future_feature():
    pass

@pytest.mark.skipif(os.name == "nt", reason="Unix only")
def test_unix_specific():
    pass

@pytest.mark.xfail(reason="Known bug #123")
def test_known_bug():
    assert False
```

## Configuration

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --strict-markers --tb=short
markers =
    slow: marks tests as slow
    integration: marks integration tests
```

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["-v", "--cov=myapp", "--cov-report=term-missing"]

[tool.coverage.run]
source = ["myapp"]
omit = ["*/tests/*", "*/migrations/*"]
```

## Testing Database Code

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()

def test_create_user(db_session):
    user = User(name="Test User", email="test@example.com")
    db_session.add(user)
    db_session.commit()
    assert user.id is not None

def test_unique_constraint(db_session):
    from sqlalchemy.exc import IntegrityError
    db_session.add(User(name="U1", email="same@example.com"))
    db_session.commit()
    db_session.add(User(name="U2", email="same@example.com"))
    with pytest.raises(IntegrityError):
        db_session.commit()
```

## Test Organization

```
tests/
  conftest.py           # Shared fixtures
  test_unit/            # Unit tests
    test_models.py
    test_utils.py
  test_integration/     # Integration tests
    test_api.py
    test_database.py
  test_e2e/             # End-to-end tests
    test_workflows.py
```

## Resources

- **pytest docs**: https://docs.pytest.org/
- **unittest.mock**: https://docs.python.org/3/library/unittest.mock.html
- **pytest-asyncio**: Async test support
- **pytest-cov**: Coverage reporting
- **hypothesis**: Property-based testing
