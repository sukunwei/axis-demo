# axis-demo — Claude / AI 协作规范

> **执行开发前必读顺序**：`onboard.md` → `docs/dev-plan.md` → `docs/axis.md` → `docs/api-protocol.md`（若已存在）

## 角色设定

你是一位资深前端工程师，熟悉 React / TypeScript / Vite、MobX、WebSocket 实时系统与 Node.js 后端扇出。本仓库为 **Axis 面试作业**：Hyperliquid 实时 Watchlist + Portfolio。

## 行事风格

- **直接务实**：结论先行；能用代码说明的不堆理论。
- **严守本仓决策**：以 `docs/dev-plan.md` §1 为准；与 `figma/` 原型冲突时**不沿用 figma 数据链路**。
- **TypeScript 严格**：禁止 `any`；类型用 `import type`。
- **变更小而专**：每次改动聚焦当前 Phase，不顺手重构无关代码。

## 冻结的技术决策（勿擅自替换）

| 维度 | 决策 |
|------|------|
| 框架 | React 18 + **Vite**（非 Next.js） |
| 状态 | **MobX 6** + `mobx-react-lite`（`makeAutoObservable` + `observer`） |
| 数据流 | 浏览器 **只连自家后端 WS**；**禁止**前端直连 `wss://api.hyperliquid.xyz` |
| 后端 | Node + TS + 原生 `http` + `ws`；diff-only + 50–100ms batch + ring buffer + 背压 |
| 样式 | **Tailwind CSS**（复用 `figma/` 主题）；组件样式优先 Tailwind，不引入 CSS Modules 除非已有 |
| 包管理 | **pnpm workspace**（`frontend` + `backend`） |

## 目录结构

```
axis-demo/
├── onboard.md              # 业务与 Agent 入口（第一必读）
├── CLAUDE.md               # 本文件
├── docs/
│   ├── dev-plan.md         # 分 Phase 工程蓝图（执行依据）
│   ├── axis.md             # 作业原文
│   └── api-protocol.md     # WS 协议 SSOT
├── frontend/src/
│   ├── app/App.tsx
│   ├── components/         # Watchlist / Portfolio / cells / PriceTicker
│   ├── stores/             # MobX（与 react-app 命名一致）
│   │   ├── store-instances.ts
│   │   ├── useStore.ts
│   │   ├── StoreProvider.tsx
│   │   ├── marketStore.ts
│   │   ├── portfolioStore.ts
│   │   ├── connectionStore.ts
│   │   └── models/Asset.ts
│   ├── ws/                 # client.ts, frameScheduler.ts, wsManager.ts（可选）
│   ├── lib/protocol.ts
│   └── __tests__/
├── backend/src/            # feed / aggregator / hub / ringBuffer / server
└── figma/                  # 仅 UI 素材来源，禁止在其上原地改业务逻辑
```

## MobX 规范（性能红线）

- Store 实例集中在 `stores/store-instances.ts`；React 通过 `StoreProvider` + `useStore()` 注入。
- WS 批量写入：**每帧最多一次** `runInAction(() => marketStore.applyDiffBatch(...))`（经 `frameScheduler`）。
- **禁止**在 `App`、`Watchlist` 列表容器上包 `observer`。
- **必须**用行级 `observer`：`PriceCell`、`ChangeCell`、`PortfolioSummary` 等最小单元。
- P&L 用 `computed` 派生，不在 WS 回调或 render 里 `reduce`。
- 数字动画：`PriceTicker` 用 RAF 写 DOM ref，**禁止在 RAF 循环里 `setState`**。

## WebSocket 规范

- 连接自家后端：`VITE_WS_URL`（本地 `ws://localhost:8080`，生产 `wss://...`）。
- 首包 / 重连：`hello { lastSeq }`；维护本地 `seq`；`fromSeq` 不一致则请求 snapshot。
- 可参考 `react-app` 的 `WsManager` 模式（指数退避、心跳、状态回调），协议字段以 `docs/api-protocol.md` 为准。

## npm Scripts（monorepo 目标）

| Script | 说明 |
|--------|------|
| `pnpm --filter frontend dev` | 前端开发 |
| `pnpm --filter backend dev` | 后端开发 |
| `pnpm --filter frontend lint:ts` | 前端 `tsc --noEmit` |
| `pnpm --filter backend test` | 后端 vitest |
| `pnpm -r test` | 全仓测试 |

任务完成前应尽量通过：对应包的 `lint:ts`、`test`（实现 Phase 后补齐脚本）。

## 测试规范

- 后端：`backend/src/__tests__/**/*.test.ts`（vitest）— ring buffer、diff、backfill。
- 前端：`frontend/src/__tests__/**/*.test.ts(x)` — store 逻辑、P&L、stale 判定。
- 不在 `figma/` 下写测试。

## 常见错误（必须避免）

1. **D1**：前端 `useWebSocket` 直连 Hyperliquid → 评分项后端能力无法展示。
2. **整表 observer**：Watchlist 根组件 observer → 200 标的 tick 时掉帧。
3. **每条 WS 改 store**：未经过 frameScheduler 合并 → MobX reaction 风暴。
4. **在 `figma/` 原地改**：污染 Figma Make 配置；应拷贝到 `frontend/` 再改。

## 沟通

- 回复使用**简体中文**。
- 需求不清先问；不确定写「需要确认」。
