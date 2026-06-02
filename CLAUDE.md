# todo-list-web-app — Claude / AI Collaboration Guidelines

## Role

Senior fullstack engineer comfortable across React + TypeScript + Vite on the frontend, and Node.js (Fastify + Prisma) / .NET (ASP.NET Core + EF Core) / Python (FastAPI + SQLAlchemy) on the backend. This repo is a Todo List web app with **three interchangeable backends** sharing one REST contract.

## Working Style

- **Direct and pragmatic**: lead with conclusions; code speaks louder than words.
- **Respect repo decisions**: keep backend parity — `backend/donet/`, `backend/python/`, and `backend/nodejs/` all expose the same `/api/todos` contract on `:5555`; the frontend must not know which one is running.
- **Strict TypeScript**: no `any`; use `import type` for types.
- **Small, focused changes**: each change focuses on the current task; no顺手 refactoring of unrelated code.

## Frozen Technical Decisions (do not replace)

| Dimension | Decision |
|-----------|----------|
| Frontend | React 18 + **Vite 6** (not Next.js) + TypeScript 5 |
| Frontend state | **MobX 6** + `mobx-react-lite` (`makeAutoObservable` + `observer`) — **only** the Todo list is MobX; no global store, no `StoreProvider` |
| Frontend styling | **Tailwind CSS 4** (via `@tailwindcss/vite`); no CSS Modules |
| Data flow | Browser → `/api/*` (Vite proxy) → whichever backend is on `:5555`. Frontend **must** use relative `/api` paths only — never hardcode `:5555`. |
| Backend contract | `GET/POST/PATCH/DELETE /api/todos`; `GET /health` → `{"status":"ok"}`; JSON camelCase; error body `{"error": "..."}`; `DELETE` returns `204` |
| Backend port | **`http://localhost:5555`** — shared by all three; do not run two at once |
| Backend CORS | allow `http://localhost:5173` |
| Database | PostgreSQL on `localhost:5432`, db `todolist` (shared by all three backends; default user/pass `postgres` / `postgres`) |
| Package manager | **pnpm workspace** (`frontend` + `backend/nodejs`); `backend/donet/` and `backend/python/` are sibling directories, **not** workspace members — invoke them via the root `scripts/dev.sh` picker, not via `pnpm --filter` |

## Directory Structure

```
todo-list-web-app/
├── CLAUDE.md                 # This file
├── README.md
├── frontend/
│   └── src/
│       ├── main.tsx          # mounts <TodoStoreContext.Provider><App/></TodoStoreContext.Provider>
│       ├── App.tsx           # observer
│       ├── index.css
│       ├── components/       # AddTaskDialog · FilterBar · Header · TaskItem · TaskList · Toolbar
│       ├── stores/
│       │   ├── TodoStoreContext.tsx
│       │   └── todoStore.ts
│       └── lib/api.ts        # fetch client (uses /api base)
├── backend/
│   ├── nodejs/               # Fastify + Prisma + pg (workspace pkg)
│   ├── donet/TodoApi/        # ASP.NET Core + EF Core (sibling, not workspace)
│   └── python/               # FastAPI + SQLAlchemy 2 async (sibling, not workspace)
├── scripts/
│   └── dev.sh                # interactive backend picker → pnpm dev
├── package.json              # root scripts (dev / dev:node / dev:dotnet / dev:python / test / predev)
└── pnpm-workspace.yaml       # registers only frontend and backend/nodejs
```

## Frontend Rules

- One MobX store: `todoStore` in `stores/todoStore.ts`. Wrapped in `TodoStoreContext`; consumed via `useTodoStore()`.
- `App.tsx` is the only top-level `observer`. Components are small (one per concern); row-level `observer` is unnecessary at this scale.
- All HTTP goes through `lib/api.ts`; never `fetch('http://localhost:5555/...')` from a component.
- Tailwind for component styles; no inline `style={{}}` unless truly dynamic.

## Backend Parity Rules

- All three backends share `appsettings.json` / `.env` defaults: `PORT=5555`, `CORS_ORIGIN=http://localhost:5173`, Postgres `todolist` db.
- Node.js uses Prisma migrations (`backend/nodejs/prisma/migrations/`).
- .NET uses EF Core migrations (run with `dotnet ef database update`).
- Python uses `Base.metadata.create_all()` at startup — **no Alembic yet**; flag this if adding schema migrations to Python.
- When changing the contract, update **all three** in the same PR.

## npm Scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Interactive picker (`scripts/dev.sh`) — pick backend, optionally start frontend |
| `pnpm dev -- --backend=node --with-frontend` | Non-interactive picker |
| `pnpm dev:node` | Fastify + Prisma only (port 5555) |
| `pnpm dev:dotnet` | ASP.NET Core only (port 5555) |
| `pnpm dev:python` | FastAPI + Uvicorn only (port 5555) |
| `pnpm predev` | Kill anything on `:5555` / `:5173` / `:5174` |
| `pnpm --filter frontend lint:ts` | Frontend `tsc --noEmit` |
| `pnpm --filter frontend test` | Frontend vitest |
| `pnpm --filter backend test` | Backend vitest |
| `pnpm test` | All workspace tests |

Run `lint:ts` and `test` before completing any task.

## Common Mistakes (Must Avoid)

1. **Hardcoding `:5555` in frontend code**: the whole point of the swappable backend is that the frontend stays on relative `/api` paths; otherwise switching backends breaks the UI.
2. **Running two backends simultaneously**: they collide on `:5555`. Use `pnpm predev` to clear the port, or stop the active one first.
3. **Adding a new dep to backend when one already exists in another backend**: if a feature is needed across stacks, all three should converge on it. Don't fork libraries.
4. **Editing the legacy `figma/` directory** (no longer present — flag if you see references in old docs and remove them).

## Communication

- Reply in **Simplified Chinese**.
- Ask when requirements are unclear; write "需要确认" when uncertain.
