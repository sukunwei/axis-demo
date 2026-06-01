# Python Web API 技术方案（FastAPI）

> 新增第三套后端，与 Node.js（Fastify + Prisma）、ASP.NET Core 共用 **同一 API 契约**；前端 **零改动**，Vite 仍代理到 `http://localhost:3000`。  
> 文档版本：2026-06-01

---

## 概述

| 目标 | 说明 |
|------|------|
| **协议一致** | 路径、方法、状态码、JSON 字段、camelCase、错误体与 `frontend/src/lib/api.ts` 对齐 |
| **可切换** | 与 Node / .NET 相同端口 **`3000`**，**同时只启动一个**后端 |
| **高性能异步** | FastAPI + ASGI（Uvicorn）+ SQLAlchemy 2.0 异步会话 |
| **开发体验** | 自带 Swagger UI / ReDoc（OpenAPI 3） |

参考实现基准：`backend/nodejs/src/routes/todos.ts`、`backend/nodejs/src/schemas/todo.ts`。

---

## 技术栈

| 层面 | 选型 | 说明 |
|------|------|------|
| 语言 | **Python 3.12+** | 团队统一 3.12 或 3.13 |
| Web 框架 | **FastAPI** | 异步、类型提示、自动 OpenAPI |
| ASGI 服务器 | **Uvicorn**（开发）/ **Gunicorn + UvicornWorker**（生产可选） | `uvicorn app.main:app --reload --port 3000` |
| ORM | **SQLAlchemy 2.0（async）** + **asyncpg** | 见下文「ORM 选型」 |
| 迁移 | **Alembic** | 与现有表对齐时可用「空迁移 + 反射」或手写对齐迁移 |
| 校验 | **Pydantic v2** | Request/Response 模型，对齐 Zod 规则 |
| 配置 | **pydantic-settings** + `.env` | `DATABASE_URL`、`PORT`、`CORS_ORIGINS` |
| 测试 | **pytest** + **pytest-asyncio** + **httpx.AsyncClient** | 集成测试打真实 ASGI app |
| 包管理 | **uv**（推荐）或 **poetry** | 锁文件、虚拟环境 |

### ORM 选型：SQLAlchemy 2.0 vs Tortoise-ORM

| 维度 | SQLAlchemy 2.0 + asyncpg | Tortoise-ORM |
|------|--------------------------|--------------|
| FastAPI 生态 | **主流**，文档与示例最多 | 可用，社区偏小 |
| 映射现有 Prisma 表 | 显式 `__tablename__` / 列名即可对齐 `"Todo"` 表 | 需核对 PG 引号列名支持 |
| 复杂查询（ILike、多字段排序） | `select()` + `where()` 表达力强 | 可行，API 不同 |
| 迁移 | Alembic 成熟 | Aerich |
| 团队学习成本 | 与 .NET EF 概念接近 | 偏 Django 风格 |

**结论：采用 SQLAlchemy 2.0（异步）+ asyncpg**，不采用 Tortoise-ORM（除非团队已有 Tortoise 积累）。

---

## 多后端约定（与 Node / .NET 一致）

详见 [`dual-backend.md`](dual-backend.md)（将扩展为三后端切换）。

| 项 | 统一值 |
|----|--------|
| 监听 | `http://0.0.0.0:3000`（或 `127.0.0.1:3000`） |
| API | `/api/todos`、`/api/todos/{id}` |
| 健康检查 | `GET /health` → `{ "status": "ok" }` |
| CORS | `http://localhost:5173` |
| JSON | **camelCase**（Pydantic `alias_generator` / `Field(alias=...)`） |
| DELETE | **204**，**无 body** |
| 错误 | `{ "error": string }`，可选 `details` |

---

## 项目结构

```
backend/python/
├── app/
│   ├── main.py                 # FastAPI 工厂、路由挂载、CORS
│   ├── config.py               # Settings（pydantic-settings）
│   ├── api/
│   │   ├── router.py           # APIRouter 汇总
│   │   └── routes/
│   │       ├── health.py       # GET /health
│   │       └── todos.py        # /api/todos CRUD
│   ├── schemas/
│   │   ├── todo.py             # Pydantic：Create / Update / Response / Query
│   │   └── error.py            # ErrorResponse
│   ├── models/
│   │   └── todo.py             # SQLAlchemy Declarative Base
│   ├── db/
│   │   ├── session.py          # async engine、AsyncSession、get_db
│   │   └── base.py
│   ├── services/
│   │   └── todo_service.py     # 业务与查询（filter / search / sort）
│   └── core/
│       └── exceptions.py       # 404 / 校验 → HTTPException 或 handler
├── alembic/                    # 可选：仅当需独立演进 schema
├── tests/
│   ├── conftest.py             # app fixture、test DB
│   ├── test_todos_api.py       # 集成：CRUD + 404
│   └── test_todo_service.py    # 单元：排序/搜索逻辑
├── .env.example
├── pyproject.toml
└── README.md
```

---

## 数据库：映射现有 Prisma 表（不新建表）

Prisma 迁移创建的表名为 **`"Todo"`**（PascalCase），列名为 **camelCase 引号标识符**（如 `"dueDate"`）。Python 侧须显式映射，**不要**默认转成 `todos` / `due_date`，否则与 Node/.NET 不同库。

```python
# app/models/todo.py
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Todo(Base):
    __tablename__ = "Todo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column("text", String(500))
    description: Mapped[str | None] = mapped_column("description", String(2000), nullable=True)
    completed: Mapped[bool] = mapped_column("completed", Boolean, default=False)
    priority: Mapped[str] = mapped_column("priority", String, default="medium")
    due_date: Mapped[date | None] = mapped_column("dueDate", Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

连接串（与 Node 相同逻辑）：

```env
# backend/python/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/todolist
PORT=3000
CORS_ORIGINS=http://localhost:5173
```

---

## API 契约

| Method | Path | 成功 | 说明 |
|--------|------|------|------|
| GET | `/health` | 200 | `{ "status": "ok" }` |
| GET | `/api/todos` | 200 | Query: `filter`, `sort`, `search` |
| GET | `/api/todos/{id}` | 200 / 404 | |
| POST | `/api/todos` | 201 | Body: CreateTodo |
| PATCH | `/api/todos/{id}` | 200 / 404 | 部分更新 |
| DELETE | `/api/todos/{id}` | **204** / 404 | `Response(status_code=204)`，无 content |

### Pydantic 模型（对齐 Zod）

```python
# app/schemas/todo.py（示意）
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

class TodoBase(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        ser_json_by_alias=True,
    )

class CreateTodoRequest(TodoBase):
    text: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = Field(default=None, alias="dueDate")  # YYYY-MM-DD

class UpdateTodoRequest(TodoBase):
    text: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    completed: bool | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: str | None = Field(default=None, alias="dueDate")

class TodoResponse(TodoBase):
    id: int
    text: str
    description: str | None
    completed: bool
    priority: str
    due_date: datetime | None = Field(alias="dueDate")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
```

校验失败由 FastAPI 统一处理，**覆盖为**与前端一致的错误体（见「错误处理」）。

### 查询参数默认值

与前端 `api.ts` 一致：未传时使用默认值，而非 422。

```python
filter: Literal["all", "active", "completed"] = "all"
sort: Literal["created", "dueDate", "priority"] = "created"
search: str = ""
```

---

## 过滤 / 搜索 / 排序（Parity）

实现放在 `todo_service.py`，逻辑与 Node / .NET **逐条对齐**。

### filter

| 值 | SQLAlchemy |
|----|------------|
| `all` | 无条件 |
| `active` | `Todo.completed.is_(False)` |
| `completed` | `Todo.completed.is_(True)` |

### search（大小写不敏感）

```python
from sqlalchemy import or_, func

if search.strip():
    pattern = f"%{search.strip()}%"
    stmt = stmt.where(
        or_(
            func.lower(Todo.text).like(func.lower(pattern)),  # 或 ilike(pattern)
            Todo.description.isnot(None) & func.lower(Todo.description).like(func.lower(pattern)),
        )
    )
```

推荐 PostgreSQL：**`Todo.text.ilike(pattern)`**（`description` 非 null 时同样 `ilike`）。

### sort

| sort | 主排序 | 次排序 |
|------|--------|--------|
| `created` | `created_at DESC` | — |
| `dueDate` | `due_date ASC NULLS LAST`（或 `nulls_last()`） | `created_at DESC` |
| `priority` | `priority ASC` | `created_at DESC` |

```python
from sqlalchemy import nulls_last

if sort == "dueDate":
    stmt = stmt.order_by(nulls_last(Todo.due_date.asc()), Todo.created_at.desc())
elif sort == "priority":
    stmt = stmt.order_by(Todo.priority.asc(), Todo.created_at.desc())
else:
    stmt = stmt.order_by(Todo.created_at.desc())
```

---

## 错误响应（与 `api.ts` 一致）

前端只读 `body.error`。自定义 `exception_handler`：

| HTTP | `error` | 场景 |
|------|---------|------|
| 400 | `Validation error` | Pydantic `RequestValidationError` |
| 404 | `Todo not found` | 单条不存在 / DELETE 无记录 |
| 500 | `Internal server error` | 未捕获异常（日志记 stack，响应不暴露） |

```python
# app/main.py（示意）
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": "Validation error", "details": exc.errors()},
    )

@app.exception_handler(NotFoundError)  # 自定义业务异常
async def not_found_handler(_: Request, __: NotFoundError):
    return JSONResponse(status_code=404, content={"error": "Todo not found"})
```

**DELETE**：使用 `return Response(status_code=204)`，不要返回 `JSONResponse`。

---

## FastAPI 应用骨架

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 可选：启动时检查 DB 连接
    yield
    # 关闭 engine

app = FastAPI(
    title="Todo API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

路由挂载：

```python
# app/api/router.py
from fastapi import APIRouter
from app.api.routes import todos

api_router = APIRouter()
api_router.include_router(todos.router, prefix="/api/todos", tags=["todos"])
```

---

## 配置

```python
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/todolist"
    port: int = 3000
    cors_origins: list[str] = ["http://localhost:5173"]

settings = Settings()
```

启动：

```bash
cd backend/python
uv sync   # 或 poetry install
uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

根目录可增加：`pnpm dev:python` → `concurrently` 启动 Python API + 前端。

---

## 依赖清单（`pyproject.toml` 摘要）

```toml
[project]
name = "todo-api"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "sqlalchemy[asyncio]>=2.0",
  "asyncpg>=0.30",
  "pydantic>=2.0",
  "pydantic-settings>=2.0",
  "alembic>=1.14",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.24",
  "httpx>=0.28",
  "pytest-cov>=6.0",
]
```

---

## 测试策略

### 集成测试（pytest + httpx）

| 用例 | 断言 |
|------|------|
| CRUD happy path | POST 201 → GET 200 → PATCH 200 → DELETE **204** → GET **404** |
| 404 | `GET /api/todos/99999` → `error == "Todo not found"` |
| DELETE 无 body | `response.content == b""`，status 204 |

```python
# tests/test_todos_api.py（示意）
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_crud_happy_path():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/todos", json={"text": "pytest"})
        assert r.status_code == 201
        todo_id = r.json()["id"]
        assert await client.get(f"/api/todos/{todo_id}") 
        assert (await client.patch(f"/api/todos/{todo_id}", json={"completed": True})).status_code == 200
        assert (await client.delete(f"/api/todos/{todo_id}")).status_code == 204
        assert (await client.get(f"/api/todos/{todo_id}")).status_code == 404
```

数据库：本地 `todolist_test` 或 pytest fixture 事务回滚；CI 可用 **Testcontainers PostgreSQL**。

### 单元测试

- `todo_service`：filter / `ilike` / 双字段排序（mock AsyncSession 或使用内存 SQLite 仅测表达式，**ILike 以 PG 集成测试为准**）。

---

## 实现步骤

1. 初始化 `backend/python`（`uv init` / 目录结构）  
2. `Settings`、async engine、`get_db` 依赖注入  
3. SQLAlchemy `Todo` 模型映射 **`"Todo"`** 表  
4. Pydantic schemas（camelCase 序列化）  
5. `TodoService` + `routes/todos.py`  
6. 全局异常处理、CORS、`/health`  
7. OpenAPI 默认可用，核对 `/docs` 与契约一致  
8. pytest 集成测试（CRUD + 404）  
9. 更新 `docs/dual-backend.md`、根目录 `pnpm dev:python`  
10. 按 Parity Checklist 与 Node 后端对比验收  

---

## 验收标准

### 功能

- [ ] CRUD 状态码：200 / 201 / 204 / 400 / 404 / 500  
- [ ] `filter` / `sort` / `search` 与 Node 结果一致（含 **case-insensitive**、次要排序）  
- [ ] `DELETE` → 204，无 body  
- [ ] 404 → `{ "error": "Todo not found" }`  
- [ ] 前端 `5173` → 代理 `3000`，**无需改** `frontend/src/lib/api.ts`  

### 多后端切换

- [ ] 停 Node/.NET，只启 Python → 前端 CRUD 正常  
- [ ] 三套后端共用同一 `todolist` 库，数据可见  

### 质量

- [ ] `GET /health` → `{ "status": "ok" }`  
- [ ] `/docs`、`/openapi.json` 可访问  
- [ ] 集成测试：至少 **1× CRUD happy path + 1× 404**  
- [ ] `.env` 不入库，提供 `.env.example`  

### Parity Checklist（Node / .NET / Python）

- [ ] 表 `"Todo"` + camelCase 列名  
- [ ] Query 默认：`filter=all`、`sort=created`  
- [ ] 搜索：`text` + `description`，**不区分大小写**  
- [ ] 排序：`dueDate` / `priority` + `createdAt desc`  
- [ ] 错误字段 `error`；JSON **camelCase**；日期 ISO 8601 UTC  

---

## 与 Node / .NET 的差异说明（允许）

| 项 | 说明 |
|----|------|
| 文档路径 | FastAPI：`/docs`、`/redoc`；.NET：`/openapi/v1.json`；Node 无内置 UI |
| 调试端点 | 仅 .NET 可有 `/debug/db`；Python **不要** 增加前端未使用的调试路由 |
| 内部实现 | 异步 SQLAlchemy vs Prisma vs EF；对前端透明 |

---

## 参考

| 文档 / 代码 | 用途 |
|-------------|------|
| [`dual-backend.md`](dual-backend.md) | 端口与切换约定 |
| [`asp.net-web-technical-design.md`](asp.net-web-technical-design.md) | 契约与 Parity 细节 |
| `backend/nodejs/src/routes/todos.ts` | 行为基准 |
| `frontend/src/lib/api.ts` | 前端契约 |
| `backend/nodejs/prisma/migrations/.../migration.sql` | 表结构 |
