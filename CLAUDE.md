# axis-trading — Claude / AI Collaboration Guidelines

> **Required reading before development**: `docs/axis.md` → `docs/technical-design.md`

## Role

Senior frontend engineer specializing in React / TypeScript / Vite, MobX, WebSocket real-time systems, and Node.js backend fanout. This repo is the **Axis interview assignment**: Hyperliquid real-time Watchlist + Portfolio.

## Working Style

- **Direct and pragmatic**: lead with conclusions; code speaks louder than words.
- **Respect repo decisions**: follow `docs/technical-design.md`; when conflicting with `figma/` prototype, **do not** adopt the Figma data pipeline.
- **Strict TypeScript**: no `any`; use `import type` for types.
- **Small, focused changes**: each change focuses on the current task; no顺手 refactoring of unrelated code.

## Frozen Technical Decisions (do not replace)

| Dimension | Decision |
|-----------|----------|
| Framework | React 18 + **Vite** (not Next.js) |
| State | **MobX 6** + `mobx-react-lite` (`makeAutoObservable` + `observer`) |
| Data flow | Browser **only connects to own backend WS**; **never** frontend → `wss://api.hyperliquid.xyz` directly |
| Backend | Node + TS + native `http` + `ws`; diff-only + 50–100ms batch + ring buffer + backpressure |
| Styling | **Tailwind CSS**; prefer Tailwind for component styles, no CSS Modules unless already present |
| Package manager | **pnpm workspace** (`frontend` + `backend`) |

## Directory Structure

```
axis-trading/
├── CLAUDE.md                 # This file
├── docs/
│   ├── axis.md               # Assignment requirements
│   ├── technical-design.md    # Architecture & design decisions
│   └── loom-brief.md        # Demo walkthrough script
├── frontend/src/
│   ├── app/App.tsx
│   ├── components/           # Watchlist / Portfolio / cells / PriceTicker
│   ├── stores/               # MobX stores
│   │   ├── store-instances.ts
│   │   ├── useStore.ts
│   │   ├── StoreProvider.tsx
│   │   ├── marketStore.ts
│   │   ├── portfolioStore.ts
│   │   ├── connectionStore.ts
│   │   └── models/Asset.ts
│   ├── ws/                   # client.ts, frameScheduler.ts
│   ├── hooks/                # usePriceHistoryRef, useThrottledOrderBook, etc.
│   ├── lib/
│   │   ├── protocol.ts       # Shared WS protocol types
│   │   ├── format.ts        # Number formatting utilities
│   │   └── themeColors.ts
│   └── __tests__/
└── backend/src/              # feed / aggregator / hub / ringBuffer / server
```

## MobX Rules (Performance Critical)

- Store instances are centralized in `stores/store-instances.ts`; React receives them via `StoreProvider` + `useStore()`.
- WS batch writes: **max one** `runInAction(() => marketStore.applyDiffBatch(...))` per frame (via `frameScheduler`).
- **Never** wrap `App` or `Watchlist` list container with `observer`.
- **Must** use row/cell-level `observer`: `PriceCell`, `ChangeCell`, `PortfolioRow` etc.
- P&L uses `computed` derived values; never `reduce` in WS callbacks or render.
- Number animation: `PriceTicker` writes DOM ref via RAF, **never `setState` in RAF loop**.

## WebSocket Rules

- Connect to own backend: `VITE_WS_URL` (default `ws://localhost:5174`).
- First packet / reconnect: `hello { lastSeq }`; maintain local `seq`; if `fromSeq` mismatches, request snapshot.
- Protocol fields follow `docs/technical-design.md`.

## npm Scripts

| Script | Description |
|--------|-------------|
| `pnpm --filter frontend dev` | Frontend dev server |
| `pnpm --filter backend dev` | Backend dev server |
| `pnpm --filter frontend lint:ts` | Frontend `tsc --noEmit` |
| `pnpm --filter backend test` | Backend vitest |
| `pnpm -r test` | Run all tests |

Run `lint:ts` and `test` before completing any task.

## Testing Rules

- Backend: `backend/src/__tests__/**/*.test.ts` (vitest) — ring buffer, diff, backfill.
- Frontend: `frontend/src/__tests__/**/*.test.ts(x)` — store logic, P&L, stale detection.
- Do not write tests in `figma/`.

## Common Mistakes (Must Avoid)

1. **D1**: Frontend `useWebSocket` connects directly to Hyperliquid → backend capability cannot be demonstrated.
2. **Full-list observer**: Watchlist root component observer → frame drops on 200-symbol ticks.
3. **Per-WS-message store mutation**: not going through `frameScheduler` merge → MobX reaction storm.
4. **Editing `figma/` in place**: pollutes Figma Make config; copy to `frontend/` first.

## Communication

- Reply in **Simplified Chinese**.
- Ask when requirements are unclear; write "需要确认" when uncertain.
