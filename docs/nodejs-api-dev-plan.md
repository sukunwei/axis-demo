# Node.js API Development Plan — todo-list-web-app

> Backend development plan for Fastify + Prisma + PostgreSQL REST API.
> Document version: 2026-06-01

---

## Phase 1: Project Setup

### 1.1 Install backend dependencies

```bash
cd backend
pnpm add fastify @fastify/cors zod @prisma/client
pnpm add -D prisma typescript tsx vitest
```

### 1.2 Initialize Prisma

```bash
cd backend
npx prisma init
```

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Todo {
  id          Int       @id @default(autoincrement())
  text        String    @db.VarChar(500)
  description String?   @db.VarChar(2000)
  completed   Boolean   @default(false)
  priority    String    @default("medium")
  dueDate     DateTime? @db.Date
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([completed])
  @@index([createdAt])
  @@index([dueDate])
  @@index([priority])
}
```

### 1.3 Configure .env

Create `backend/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/todolist?schema=public"
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### 1.4 Create Prisma client singleton

Create `backend/src/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export { prisma }
```

### 1.5 Create backend entry point

Create `backend/src/server.ts`:
- Fastify instance with CORS
- `/health` route
- `/api/todos` routes registered
- Graceful shutdown

---

## Phase 2: Schema & Validation (Zod)

### 2.1 Zod schemas

Create `backend/src/schemas/todo.ts`:
- `createTodoSchema` — `text` (string, required), `description?` (string?), `priority` (enum), `dueDate?` (ISO date string)
- `updateTodoSchema` — all fields optional
- `todoQuerySchema` — `filter` (all/active/completed), `sort` (created/dueDate/priority), `search` (string)
- `todoParamsSchema` — `id` (positive integer)

### 2.2 JSON schemas from Zod

Generate JSON Schema for Fastify routeopts validation using `zod-to-json-schema`.

---

## Phase 3: REST Routes

### 3.1 Route file: `backend/src/routes/todos.ts`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/api/todos` | `getTodos` — apply filter/sort/search, return array |
| `GET` | `/api/todos/:id` | `getTodo` — return single or 404 |
| `POST` | `/api/todos` | `createTodo` — validate, create, return 201 |
| `PATCH` | `/api/todos/:id` | `updateTodo` — validate, update, return updated |
| `DELETE` | `/api/todos/:id` | `deleteTodo` — delete, return 204 |

### 3.2 Filter/sort/search logic

**Filter**:
- `active` → `WHERE completed = false`
- `completed` → `WHERE completed = true`
- `all` → no WHERE clause

**Sort**:
- `created` → `ORDER BY "createdAt" DESC`
- `dueDate` → `ORDER BY "dueDate" NULLS LAST, "createdAt" DESC`
- `priority` → `ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, "createdAt" DESC`

**Search**:
- `WHERE text ILIKE %search% OR description ILIKE %search%`

---

## Phase 4: Error Handling

### 4.1 Error shapes

- 400: Zod validation error → `{ error: "Validation error", details: [...] }`
- 404: Todo not found → `{ error: "Todo not found" }`
- 500: Unexpected error → `{ error: "Internal server error" }`

### 4.2 Custom error plugin

Create `backend/src/plugins/error.ts` — Fastify error handler that formats Zod errors and Prisma errors.

---

## Phase 5: Testing

### 5.1 Vitest setup

Configure `backend/vitest.config.ts` with `testEnvironment: 'node'`.

### 5.2 Unit tests

- Zod schema validation tests
- Filter/sort/search logic (with in-memory Prisma mock or SQLite)
- Route handler tests using `fastify.inject()`

### 5.3 Test coverage targets

| File | Tests |
|------|-------|
| `schemas/todo.test.ts` | 10+ cases per schema |
| `routes/todos.test.ts` | CRUD + filter/sort/search |

---

## Phase 6: Dev & Build Scripts

### 6.1 Scripts in `backend/package.json`

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "test": "vitest run"
  }
}
```

### 6.2 Prisma migrate

```bash
pnpm --filter backend db:migrate
pnpm --filter backend db:generate
```

---

## Phase 7: CORS & Port Config

- CORS: `http://localhost:5173` allowed
- Backend port: `3000`
- Frontend vite proxy: `/api` → `http://localhost:3000`

---

## File Structure

```
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── server.ts          # Fastify entry point
│   ├── db.ts              # Prisma client singleton
│   ├── plugins/
│   │   └── error.ts       # Error handler plugin
│   ├── schemas/
│   │   └── todo.ts        # Zod schemas
│   └── routes/
│       └── todos.ts       # REST route handlers
├── .env
├── vitest.config.ts
└── tsconfig.json
```

---

## Order of Implementation

1. Phase 1 — Project setup, Prisma init, .env, `db.ts`, `server.ts` skeleton
2. Phase 2 — Zod schemas
3. Phase 3 — REST route handlers
4. Phase 4 — Error handling plugin
5. Phase 5 — Tests
6. Phase 6 — Scripts verification
7. Phase 7 — CORS + port config + frontend proxy

---
