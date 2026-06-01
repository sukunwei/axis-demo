# Python FastAPI Web API 開發計劃

> 基於 `docs/python-web-solution.md`，按實施順序排列。

---

## 階段一：項目初始化（第 1 天）

### 1.1 初始化專案

```bash
cd backend
mkdir -p python
cd python

# 使用 uv 初始化（推薦）
uv init --name todo-api

# 或使用 virtualenv + requirements.txt
python3 -m venv .venv
source .venv/bin/activate
```

### 1.2 安裝依賴

```bash
# 核心依賴
uv add fastapi uvicorn[standard]
uv add sqlalchemy[asyncio] asyncpg
uv add pydantic pydantic-settings
uv add alembic

# 開發依賴
uv add --dev pytest pytest-asyncio httpx pytest-cov
```

### 1.3 創建目錄結構

```
backend/python/
├── app/
│   ├── main.py                 # FastAPI 應用工廠
│   ├── config.py               # pydantic-settings
│   ├── api/
│   │   ├── router.py          # APIRouter 匯總
│   │   └── routes/
│   │       ├── health.py      # GET /health
│   │       └── todos.py       # /api/todos CRUD
│   ├── schemas/
│   │   ├── todo.py            # Pydantic 模型
│   │   └── error.py           # ErrorResponse
│   ├── models/
│   │   └── todo.py            # SQLAlchemy 模型
│   ├── db/
│   │   ├── session.py         # async engine、AsyncSession
│   │   └── base.py            # DeclarativeBase
│   ├── services/
│   │   └── todo_service.py    # 業務邏輯
│   └── core/
│       └── exceptions.py      # 自定義異常
├── tests/
│   ├── conftest.py            # pytest fixture
│   ├── test_todos_api.py      # CRUD 集成測試
│   └── test_todo_service.py   # 單元測試
├── .env.example
├── pyproject.toml
└── README.md
```

### 1.4 設定 .env

```bash
# backend/python/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/todolist
PORT=3000
CORS_ORIGINS=http://localhost:5173
```

---

## 階段二：Config + Database（第 1-2 天）

### 2.1 Settings

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

### 2.2 資料庫會話

```python
# app/db/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

# app/db/session.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(settings.database_url, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session_maker() as session:
        yield session
```

---

## 階段三：SQLAlchemy Model（第 2 天）

### 3.1 Todo 模型

```python
# app/models/todo.py
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Todo(Base):
    __tablename__ = "Todo"  # 保持 PascalCase 與 Prisma 一致

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

**關鍵：表名 `"Todo"` + 列名 `"dueDate"` / `"createdAt"` / `"updatedAt"` 使用 camelCase。**

---

## 階段四：Pydantic Schemas（第 2-3 天）

### 4.1 Schema 定義

```python
# app/schemas/todo.py
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
    due_date: str | None = Field(default=None, alias="dueDate")

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

### 4.2 Query 參數

```python
# app/schemas/todo.py
from typing import Literal

class TodoQuery:
    filter: Literal["all", "active", "completed"] = "all"
    sort: Literal["created", "dueDate", "priority"] = "created"
    search: str = ""
```

---

## 階段五：Service 層（第 3-4 天）

### 5.1 TodoService

```python
# app/services/todo_service.py
from datetime import datetime
from sqlalchemy import or_, func, nulls_last
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.todo import Todo
from app.schemas.todo import CreateTodoRequest, UpdateTodoRequest, TodoResponse

class TodoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_todos(self, filter: str, sort: str, search: str) -> list[TodoResponse]:
        stmt = select(Todo)

        # Filter
        if filter == "active":
            stmt = stmt.where(Todo.completed.is_(False))
        elif filter == "completed":
            stmt = stmt.where(Todo.completed.is_(True))

        # Search (case-insensitive)
        if search.strip():
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Todo.text.ilike(pattern),
                    Todo.description.isnot(None) & Todo.description.ilike(pattern),
                )
            )

        # Sort
        if sort == "dueDate":
            stmt = stmt.order_by(nulls_last(Todo.due_date.asc()), Todo.created_at.desc())
        elif sort == "priority":
            stmt = stmt.order_by(Todo.priority.asc(), Todo.created_at.desc())
        else:
            stmt = stmt.order_by(Todo.created_at.desc())

        result = await self.db.execute(stmt)
        todos = result.scalars().all()
        return [TodoResponse.model_validate(t) for t in todos]

    async def get_by_id(self, id: int) -> TodoResponse | None:
        stmt = select(Todo).where(Todo.id == id)
        result = await self.db.execute(stmt)
        todo = result.scalar_one_or_none()
        return TodoResponse.model_validate(todo) if todo else None

    async def create(self, data: CreateTodoRequest) -> TodoResponse:
        due_date = datetime.strptime(data.due_date, "%Y-%m-%d").date() if data.due_date else None
        todo = Todo(
            text=data.text,
            description=data.description,
            priority=data.priority or "medium",
            due_date=due_date,
        )
        self.db.add(todo)
        await self.db.commit()
        await self.db.refresh(todo)
        return TodoResponse.model_validate(todo)

    async def update(self, id: int, data: UpdateTodoRequest) -> TodoResponse | None:
        todo = await self.db.get(Todo, id)
        if not todo:
            return None
        # 更新欄位...
        await self.db.commit()
        await self.db.refresh(todo)
        return TodoResponse.model_validate(todo)

    async def delete(self, id: int) -> bool:
        todo = await self.db.get(Todo, id)
        if not todo:
            return False
        await self.db.delete(todo)
        await self.db.commit()
        return True
```

---

## 階段六：Routes + Exceptions（第 4-5 天）

### 6.1 全域異常處理

```python
# app/core/exceptions.py
from fastapi import HTTPException

class NotFoundError(HTTPException):
    def __init__(self):
        super().__init__(status_code=404, detail="Todo not found")
```

### 6.2 Todos Router

```python
# app/api/routes/todos.py
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.todo import CreateTodoRequest, UpdateTodoRequest, TodoResponse, TodoQuery
from app.services.todo_service import TodoService

router = APIRouter()

@router.get("", response_model=list[TodoResponse])
async def get_todos(
    query: TodoQuery,
    db: AsyncSession = Depends(get_db),
):
    service = TodoService(db)
    return await service.get_todos(query.filter, query.sort, query.search)

@router.get("/{id}", response_model=TodoResponse)
async def get_todo(id: int, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    todo = await service.get_by_id(id)
    if not todo:
        raise NotFoundError()
    return todo

@router.post("", status_code=201, response_model=TodoResponse)
async def create_todo(data: CreateTodoRequest, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    return await service.create(data)

@router.patch("/{id}", response_model=TodoResponse)
async def update_todo(id: int, data: UpdateTodoRequest, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    todo = await service.update(id, data)
    if not todo:
        raise NotFoundError()
    return todo

@router.delete("/{id}", status_code=204)
async def delete_todo(id: int, db: AsyncSession = Depends(get_db)):
    service = TodoService(db)
    deleted = await service.delete(id)
    if not deleted:
        raise NotFoundError()
    return Response(status_code=204)
```

### 6.3 主應用

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # 啟動/關閉清理

app = FastAPI(title="Todo API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": "Validation error"})

@app.exception_handler(NotFoundError)
async def not_found_handler(_: Request, __: NotFoundError):
    return JSONResponse(status_code=404, content={"error": "Todo not found"})

app.include_router(api_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## 階段七：測試（第 5-6 天）

### 7.1 pytest 配置

```python
# tests/conftest.py
import pytest
import asyncio
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

### 7.2 CRUD 集成測試

```python
# tests/test_todos_api.py
import pytest

@pytest.mark.asyncio
async def test_crud_happy_path(client: AsyncClient):
    # POST
    r = await client.post("/api/todos", json={"text": "pytest"})
    assert r.status_code == 201
    todo_id = r.json()["id"]

    # GET
    r = await client.get(f"/api/todos/{todo_id}")
    assert r.status_code == 200

    # PATCH
    r = await client.patch(f"/api/todos/{todo_id}", json={"completed": True})
    assert r.status_code == 200

    # DELETE
    r = await client.delete(f"/api/todos/{todo_id}")
    assert r.status_code == 204

    # GET 404
    r = await client.get(f"/api/todos/{todo_id}")
    assert r.status_code == 404
    assert r.json()["error"] == "Todo not found"
```

### 7.3 Service 單元測試

```python
# tests/test_todo_service.py
import pytest
from app.services.todo_service import TodoService
# filter / sort / search 邏輯測試
```

---

## 階段八：整合啟動腳本（第 6 天）

### 8.1 更新根目錄 package.json

```bash
# 已在 asp.net-web-dev-plan.md 中添加 dev:python
pnpm dev:python
```

### 8.2 啟動命令

```bash
# 方式一：直接啟動
cd backend/python
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload

# 方式二：根目錄一鍵啟動
pnpm dev:python  # Python 後端 + 前端
```

### 8.3 停止其他後端

```bash
# 停止 Node / .NET 後再啟動 Python
lsof -ti:3000 | xargs kill -9
```

---

## 驗收清單

| # | 項目 | 標準 |
|---|------|------|
| 1 | GET /health | `200 { "status": "ok" }` |
| 2 | POST /api/todos | `201` + created todo |
| 3 | GET /api/todos?filter=active | 只返回未完成 |
| 4 | GET /api/todos?sort=priority | priority ASC + createdAt DESC |
| 5 | GET /api/todos?search=buy | text/description 大小寫不敏感匹配 |
| 6 | PATCH /api/todos/{id} | `200` + 更新後資料 |
| 7 | DELETE /api/todos/{id} | `204` No Content，無 body |
| 8 | GET /api/todos/99999 | `404 { "error": "Todo not found" }` |
| 9 | DELETE /api/todos/99999 | `404 { "error": "Todo not found" }` |
| 10 | 前端新增任務 | 立即顯示在列表，無需刷新 |
| 11 | 前端刪除任務 | 立即從列表消失，無需刷新 |
| 12 | 集成測試 | CRUD happy path + 404 通過 |
| 13 | GET /docs | Swagger UI 可訪問 |

---

## 預估時間線

| 階段 | 內容 | 預估 |
|------|------|------|
| 一 | 項目初始化 | 0.5 天 |
| 二 | Config + Database | 0.5 天 |
| 三 | SQLAlchemy Model | 0.5 天 |
| 四 | Pydantic Schemas | 1 天 |
| 五 | Service 層 | 1 天 |
| 六 | Routes + Exceptions | 1 天 |
| 七 | 測試 | 1 天 |
| 八 | 整合 + 驗收 | 0.5 天 |
| **合計** | | **6 天** |

---

## 快速啟動腳本

```bash
# 1. 初始化項目
cd backend
mkdir -p python && cd python
uv init --name todo-api

# 2. 安裝依賴
uv add fastapi uvicorn[standard]
uv add sqlalchemy[asyncio] asyncpg
uv add pydantic pydantic-settings
uv add alembic
uv add --dev pytest pytest-asyncio httpx pytest-cov

# 3. 啟動開發伺服器
uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload

# 访问 http://localhost:3000/docs（Swagger UI）
```