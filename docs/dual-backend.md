# 多后端切换说明（Node.js / ASP.NET / Python）

前端**无需任何改动**：始终请求相对路径 `/api/*`，由 Vite 代理到本机固定端口。

---

## 约定（三套后端必须一致）

| 项 | 统一值 |
|----|--------|
| **监听地址** | `http://localhost:3000` |
| **API 前缀** | `/api/todos` |
| **健康检查** | `GET /health` → `{ "status": "ok" }` |
| **CORS** | 允许 `http://localhost:5173` |
| **JSON** | camelCase；错误体 `{ "error": "..." }` |
| **DELETE** | `204` 无 body |

行为细节（filter / search / sort）见 [`asp.net-web-technical-design.md`](asp.net-web-technical-design.md) 或 [`python-web-solution.md`](python-web-solution.md) 中的 **Parity Checklist**，与 `backend/nodejs` 实现对齐。

---

## 前端如何访问 API

```
浏览器  →  http://localhost:5173/api/todos
              ↓ (Vite proxy)
          http://localhost:3000/api/todos   ←  whichever backend is running
```

`frontend/vite.config.ts` 固定代理到 **`http://localhost:3000`**，不区分 Node 或 .NET。

`frontend/src/lib/api.ts` 只使用 `const API_BASE = '/api'`，无硬编码后端端口。

---

## 启动方式（三选一，勿同时开）

### Node.js（Fastify + Prisma）

```bash
cd backend/nodejs
pnpm dev
# 默认 PORT=3000（见 .env）
```

### ASP.NET Core

```bash
cd backend/donet/TodoApi
dotnet run
# launchSettings + appsettings: http://localhost:3000
```

### Python（FastAPI）

```bash
cd backend/python
uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
# 见 docs/python-web-solution.md
```

### 前端（任意后端已启动后）

```bash
cd frontend
pnpm dev
```

### 便捷脚本（仓库根目录）

```bash
pnpm dev:node    # Node 后端 + 前端
pnpm dev:dotnet  # .NET 后端 + 前端
pnpm dev:python  # Python 后端 + 前端（实现后启用，见 python-web-solution.md）
```

---

## 端口冲突

三套后端**不能同时**监听 `3000`。若启动第二个会报端口占用：

- 先停掉另一个进程，或
- `lsof -ti:3000 | xargs kill`（macOS/Linux）

---

## 数据库

各后端默认连接**同一 PostgreSQL** 库（如 `todolist`），表结构一致，切换后端后数据仍在。

连接串各自配置：

- Node：`backend/nodejs/.env` → `DATABASE_URL`
- .NET：`backend/donet/TodoApi/appsettings.json` / User Secrets → `ConnectionStrings:Default`
- Python：`backend/python/.env` → `DATABASE_URL`（`postgresql+asyncpg://...`）

---

## 验收：切换后前端零修改

1. 启动 Node + 前端 → 完成 CRUD  
2. 停 Node，启动 .NET 或 Python + 前端（不刷新配置）→ 同样 CRUD  
3. 列表、搜索、排序、删除 204 行为一致  

若某条仅在一边失败，对照 Parity Checklist 修后端，**不要改前端**。
