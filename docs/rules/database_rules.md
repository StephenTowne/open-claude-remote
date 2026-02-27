# Database Rules (数据库规范)

## 适用范围
- MySQL 数据库
- OB_MySQL 数据库

---

## 表 (Tables)

### 必须遵循的规则

| 规则 | 等级 | 说明 | 解决方案 |
|------|------|------|----------|
| 表名不能是数据库关键字 | 中 | 关键字表名会导致SQL语法错误或需要特殊转义 | 修改表名 |
| 表必须填写备注 (COMMENT) | 中 | 备注有助于理解表的用途 | 增加表注释 |
| 表名格式：小写字母、数字、下划线 | 中 | 保持命名一致性，避免跨平台问题 | 修改表名 |
| 新建表必须设置字符集 | 中 | 未设置时会自动继承库的字符集，可能导致编码问题 | 显式设置表字符集 (如 `CHARSET=utf8mb4`) |
| 表必须有主键 (PK) | 高 | 主键能提高查询性能并保证数据完整性 | 设置主键 |
| **表必须包含 `gmt_create` 或 `gmt_modify` 字段** | 高 | 记录创建时间和修改时间，便于审计和追踪 | 添加 `gmt_create TIMESTAMP DEFAULT CURRENT_TIMESTAMP` 和 `gmt_modify TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

### 禁止的操作

| 操作 | 风险 | 说明 |
|------|------|------|
| 删除已存在的表 | 高 | 删除表会造成数据丢失，不可恢复 | 只允许设计阶段删除本结构设计项目内新建的表，删除已存在的表请提表删除工单 |

---

## 字段 (Columns)

### 必须遵循的规则

| 规则                            | 等级 | 说明 | 解决方案 |
|-------------------------------|------|------|----------|
| **字段名不能是数据库关键字**，如key/value   | 中 | 关键字段名会导致SQL语法错误 | 修改列名 |
| 字段必须填写备注 (COMMENT)            | 中 | 备注有助于理解字段用途 | 增加列注释 |
| 字段名格式：小写字母、数字、下划线             | 中 | 保持命名一致性，避免跨平台问题 | 修改列名 |
| **非空字段 (NOT NULL) 必须明确指定默认值** | 中 | 非空字段默认为null时会导致应用数据写入失败 | 为每个非空字段设置合理的默认值，如 `DEFAULT 0`、`DEFAULT ''`、`DEFAULT CURRENT_TIMESTAMP` |
| 自增ID字段强制使用 BIGINT 类型          | 高 | 防止主键溢出 | 使用 `BIGINT UNSIGNED AUTO_INCREMENT` |

### 禁止的数据类型

| 数据类型 | 风险 | 替代方案 |
|----------|------|----------|
| `longtext`、`longblob` | 中 | 大字段占用磁盘空间较大，变更索引时容易失败 | 1. 推荐使用 `mediumtext`、`mediumblob` 代替<br>2. 如需使用，请先评估字段容量后找DBA审批报备 |
| `datetime` | 高 | 不包含时区信息，可能导致跨时区场景下的时间计算错误 | 推荐使用 `timestamp` 类型存储时区信息 |
| `double`、`float` | 高 | 浮点数存储的是近似值而不是精确值，可能会引起资损（尤其是财务计算） | 建议使用 `DECIMAL` 代替，如 `DECIMAL(10, 2)` |
| `bit` | 高 | 可读性和可维护性弱，索引和性能较差 | 推荐使用 `tinyint` (0或1) 代替 |
| `set`、`enum` | 高 | 固定的值集合更改时需要调整表结构，扩展性差 | 推荐使用 `varchar` + 应用层验证 |

### 禁止的操作

| 操作 | 风险 | 说明 |
|------|------|------|
| 删除已有字段 | 高 | 删除原有字段导致表结构变更，数据丢失 | 生产库不允许删字段，线下库允许删除。删除前请确保已进行数据备份 |

---

## 索引 (Indexes)

### 索引命名规则

| 索引类型 | 命名规则 | 示例 | 说明 |
|----------|----------|------|------|
| 唯一索引 (UNIQUE) | 必须以 `uk_` 开头 | `uk_user_email` | 唯一索引用于保证字段值的唯一性 |
| 普通索引 (NORMAL) | 必须以 `idx_` 开头 | `idx_user_created_at` | 普通索引用于加速查询 |

---

## 最佳实践示例

### 创建表的正确示例

```sql
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '用户名',
  `email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '邮箱',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `gmt_create` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `gmt_modify` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

---

## AI 开发检查清单

创建或修改数据库表时，AI 必须确认以下事项：

### 表层面
- [ ] 表名使用小写字母、数字、下划线
- [ ] 表名不是数据库关键字
- [ ] 表添加了 COMMENT 注释
- [ ] 表显式设置了字符集（推荐 `utf8mb4`）
- [ ] 表有主键
- [ ] 表包含 `gmt_create` 或 `gmt_modify` 字段

### 字段层面
- [ ] 字段名使用小写字母、数字、下划线
- [ ] 字段名不是数据库关键字
- [ ] 字段添加了 COMMENT 注释
- [ ] NOT NULL 字段设置了默认值
- [ ] 没有使用 `longtext`、`longblob`（除非特殊审批）
- [ ] 没有使用 `datetime`（使用 `timestamp` 替代）
- [ ] 没有使用 `double`、`float`（使用 `DECIMAL` 替代）
- [ ] 没有使用 `bit`（使用 `tinyint` 替代）
- [ ] 没有使用 `set`、`enum`（使用 `varchar` 替代）
- [ ] 自增ID字段使用 `BIGINT` 类型

### 索引层面
- [ ] 唯一索引以 `uk_` 开头
- [ ] 普通索引以 `idx_` 开头

---

## 风险等级说明

- **高**：严重影响数据完整性、安全性或性能，必须严格遵循
- **中**：可能导致维护困难、潜在错误，建议遵循