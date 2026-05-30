# Real-time Portfolio 开发计划（0 → 1）

> 本文件是给 **Claude CLI / AI 编码代理** 执行的工程蓝图。
> 按 Phase 顺序执行，每个 Phase 完成后必须满足其「验收标准（DoD）」并跑通「验证命令」再进入下一阶段。
> 面试作业要求见 `docs/axis.md`；本计划已整合并**修正**了 `docs/technical-doc.md` 与 `docs/technical-solution.md` 中的矛盾。  
> **Agent 入口**：先读仓库根目录 `onboard.md`、`CLAUDE.md`，再执行本文件。

---

## 0. 背景与现状盘点

### 0.1 作业目标（来自 `docs/axis.md`）
构建一个 Web 版资产组合 + 自选列表应用，通过 WebSocket 逐笔实时更新，要求：
- 自选列表（symbol / last / 24h change%，实时）
- 资产组合（qty / avgCost / last / 未实现 P&L / 总资产，每 tick 重算）
- 数字平滑过渡 + 涨绿跌红闪烁，**30 symbols × 5Hz 下稳定 60fps**
- 连接状态可见：connected / reconnecting / stale
- 后台 30s 返回后自动 reconcile，无脏价、无整页刷新
- **后端**：接入行情、扇出给多客户端不重复拉源、**仅发 diff**、50–100ms 批量、reconnect 时按 `lastSeenSeq` 从 ring buffer 回放，超窗则回全量 snapshot、背压处理
- 部署：后端 Railway（公网 wss）、前端 Vercel；README + 设计决策 + 3–5 分钟演示

### 0.2 现有资产盘点（`figma/` 目录）
`figma/` 是一份 **Figma Make 导出的可运行原型**（不是纯设计稿），可作为 UI 与样式基线复用，但**数据链路不可直接采用**。可复用：
- UI 组件：`Watchlist.tsx`（含手写虚拟滚动）、`Portfolio.tsx`、`AssetDetail.tsx`（recharts 图表）、`ConnectionIndicator.tsx`、`MarketOverview.tsx`、`AnimatedNumber.tsx`、`PriceSparkline.tsx`
- 样式：Tailwind v4 + shadcn 主题（`src/app/components/ui/*`、`src/styles/*`）
- 后端骨架：`backend/src/server.ts`（ws + ring buffer + 批处理雏形）
- 部署物料：`docker-compose.yml`、`Dockerfile.frontend`、`nginx.conf`、`backend/Dockerfile`

### 0.3 现有原型的关键缺陷（**本计划要修复的重点**）
| # | 缺陷 | 影响 | 修复阶段 |
|---|------|------|---------|
| D1 | 前端 `useWebSocket.ts` **直连 Hyperliquid**，完全绕过自家后端 | 后端的 diff/批处理/ring buffer/回填/背压（核心评分项）全部未被使用 | P2/P3 |
| D2 | 后端 `batch` 推送的是整条 `MarketData`，**不是仅变更字段** | 不满足 "diff-only" 硬性要求，浪费带宽 | P2 |
| D3 | 两份方案矛盾：市场（Top200+Mock vs Hyperliquid+Express）、状态管理（纯 React vs MobX） | 架构不收敛 | 见 §1 决策（**已统一为 MobX**） |
| D4 | 类型不一致：`market.ts` 用 `lastUpdate`/`prevPrice`，`useWebSocket` 写 `timestamp` 且漏字段 | 运行期字段错位 | P3 |
| D5 | `useAnimatedNumber` **每 RAF 帧 `setState`**，200 个数字 → React 重渲染风暴 | 难达 60fps，掉帧、耗电 | P4 |
| D6 | 无序列号驱动的端到端回填；前端不发 `lastSeq`、不追踪 seq | reconnect/backfill 不闭环 | P2/P3 |
| D7 | 前端无 `visibilitychange` 后台恢复；无客户端本地 stale 检测 | 后台 30s 恢复要求不满足 | P3 |
| D8 | 无任何单元测试 | ring buffer/diff/回放正确性无保障 | P2/P5 |

---

## 1. 已收敛的技术决策（解决方案矛盾，**执行前不要再改**）

| 维度 | 决策 | 理由 |
|------|------|------|
| **市场方向** | **Hyperliquid 永续**（真实数据），同时提供 **Mock Feed 模式**作为回退与压测 | 真实数据更有说服力；Mock 保证可复现的 30×5Hz 压测、离线 demo、规避免费额度限制；HL `allMids` 一次给 200+ 标的，满足"≥200"要求 |
| **后端语言/框架** | **Node.js + TypeScript**，原生 `http` + `ws`（**不引入 Express**） | 作业看重 fanout/背压而非 HTTP 路由；原生更轻、更快；`/health`、`/snapshot` 用原生 `http` 即可 |
| **数据流向** | 浏览器 **只连自家后端**：`Hyperliquid/Mock → 后端聚合 → diff/批量 → 前端`。前端**绝不**直连 HL | 让后端真正承担 diff/批处理/ring buffer/回填/背压（核心评分项） |
| **前端状态管理** | **MobX 6 + `mobx-react-lite`**：`store-instances.ts` 单例 + `StoreProvider` / `useStore()`（对齐 `react-app`）；**行级 `observer` 小组件**，列表壳层不 observer | 与 `technical-solution.md` 一致；`computed` 派生 P&L；`runInAction` 批量写入 |
| **动画策略** | **`PriceTicker`（observer）+ RAF 插值写 DOM ref**；闪烁用 CSS class；**禁止在 RAF 里 `setState`**；仅可见行动画 | MobX 负责「何时更新目标价」，RAF 负责「如何平滑显示」，避免每帧触发整树重渲染（修复 D5） |
| **列表渲染** | 复用 `Watchlist` 的手写虚拟滚动（或换 `@tanstack/react-virtual`），只渲染可见行 | 200+ 行必须虚拟化 |
| **项目形态** | **Monorepo**：`frontend/` + `backend/` + `docs/`（pnpm workspace） | 与 `technical-doc.md` 一致，前后端分离清晰 |
| **部署** | 后端 Railway（公网 `wss://`），前端 Vercel（`expo`无关，纯 web）；`docker-compose up` 作为一键本地回退 | 满足作业部署要求 |
| **保存位置** | 全新代码写入 `frontend/`、`backend/`；`figma/` 仅作为**素材来源**按需拷贝，不在其上原地改 | 保持新仓干净，避免 Figma Make 配置（如 `figma:asset` resolver、海量未用依赖）污染 |

---

## 1.1 MobX 前端架构（P3 / P4 必读）

### Store 分层（对齐 react-app 注入方式）
```
stores/store-instances.ts   # 单例导出
├── connectionStore         connectionState, lastMessageAt
├── marketStore             assets: Map<string, Asset>, seq, applySnapshot/applyDiffBatch
└── portfolioStore          mock positions, computed: totalValue / totalPnL / rows

stores/StoreProvider.tsx    # <StoreContext.Provider value={stores}>
stores/useStore.ts          # useStore() → typeof stores
```

### 领域模型 `Asset`（`stores/models/Asset.ts`）
```ts
class Asset {
  symbol = '';
  price = 0;
  prevPrice = 0;        // 仅用于涨跌闪烁方向，不发给后端
  dayOpen = 0;
  dayHigh = 0;
  dayLow = 0;
  volume24h = 0;
  changePercent = 0;
  ts = 0;

  constructor(data: MarketItem) {
    makeAutoObservable(this);
    this.patch(data);
  }

  patch(diff: Partial<MarketItem>) {
    if (diff.price != null && diff.price !== this.price) {
      this.prevPrice = this.price;
      this.price = diff.price;
    }
    // ... 其余字段按需合并
  }
}
```

### 写入规则（性能关键）
| 规则 | 做法 |
|------|------|
| WS 消息 → Store | `frameScheduler` 每帧合并 diff 后，**单次** `runInAction(() => marketStore.applyDiffBatch(changes))` |
| 禁止 | 每条 WS 消息单独 `applyDiff`（会触发 N 次 reaction） |
| 禁止 | 在 `App` / `Watchlist` 根组件包 `observer`（会导致整表随 tick 重渲染） |
| 必须 | `WatchlistRow` 只渲染 symbol 文本（可不 observer）；`PriceCell` / `ChangeCell` 用 `observer` 且只读 `marketStore.getAsset(symbol)!` |
| P&L | `portfolioStore` 用 `computed` 派生，**不要**在 WS 回调里手算 |

### 组件粒度（示例）
```tsx
// ❌ 错误：整表 observer
const Watchlist = observer(({ symbols }) => ...);

// ✅ 正确：行内最小单元 observer
const PriceCell = observer(({ symbol }: { symbol: string }) => {
  const asset = marketStore.getAsset(symbol);
  if (!asset) return null;
  return <PriceTicker asset={asset} decimals={2} prefix="$" />;
});
```

### `PriceTicker`（P4，observer + RAF）
- `observer` 仅在 `asset.price` 变化时重跑 effect 入口，**不在 RAF 循环里 setState**。
- RAF 从 `displayRef` 当前文本插值到 `asset.price`；`asset.prevPrice` vs `asset.price` 决定 `up`/`down` class。

---

## 2. 目标架构

### 2.1 数据链路（端到端）
```
                         ┌─────────────────────────── backend (Node + ws) ───────────────────────────┐
Hyperliquid WS / Mock →  │ Feed Adapter → Aggregator(内存态) → Diff Engine → Batch(50–100ms) → Ring  │ →  ws  → 浏览器
   (单一上游连接)         │                                          │              Buffer + seq        │      (多客户端 fanout)
                         │                                          └→ 全量 snapshot 按需             │
                         └───────────────────────────────────────────────────────────────────────────┘
                                                                                          │
浏览器： ws client → frameScheduler(每帧合并) → runInAction → MarketStore(Asset Map)
         → observer(PriceCell/ChangeCell) → PriceTicker(RAF+ref) → 虚拟列表
```

### 2.2 目标目录结构
```
axis-demo/
├── frontend/                         # Vite + React + TS（从 figma/ 迁移 UI）
│   ├── src/
│   │   ├── app/App.tsx
│   │   ├── components/               # Watchlist / Portfolio / AssetDetail / ConnectionIndicator / MarketOverview
│   │   │   ├── cells/                # PriceCell / ChangeCell（observer 最小单元）
│   │   │   ├── PriceTicker.tsx       # observer + RAF 动画（P4）
│   │   │   └── ui/                   # shadcn 组件（按需）
│   │   ├── stores/                   # MobX（命名对齐 react-app）
│   │   │   ├── store-instances.ts    # export const stores = { marketStore, ... }
│   │   │   ├── useStore.ts           # StoreContext + useStore()
│   │   │   ├── StoreProvider.tsx
│   │   │   ├── marketStore.ts
│   │   │   ├── portfolioStore.ts
│   │   │   ├── connectionStore.ts
│   │   │   └── models/Asset.ts
│   │   ├── ws/
│   │   │   ├── wsManager.ts          # 可选：借鉴 react-app 重连/心跳
│   │   │   ├── client.ts             # 协议层：hello/diff/snapshot 解析
│   │   │   └── frameScheduler.ts     # 每帧合并 → runInAction → marketStore
│   │   ├── hooks/                    # usePriceHistory 等（非价格动画）
│   │   ├── lib/protocol.ts           # 与后端共享的协议类型（或软链 shared）
│   │   ├── styles/
│   │   └── __tests__/
│   ├── index.html  vite.config.ts  package.json  tsconfig.json
│   └── .env.example                  # VITE_WS_URL=ws://localhost:8080
├── backend/                          # Node + TS + ws
│   ├── src/
│   │   ├── server.ts                 # http(/health,/snapshot) + ws fanout 入口
│   │   ├── hub.ts                    # 客户端管理 + 扇出 + 背压
│   │   ├── aggregator.ts             # 内存态 + diff + 批量 flush
│   │   ├── ringBuffer.ts             # seq 环形缓冲 + readRange
│   │   ├── feed/
│   │   │   ├── hyperliquid.ts        # 真实源适配器
│   │   │   └── mock.ts               # 确定性 Mock 源（200 标的，可配频率）
│   │   ├── protocol.ts               # 消息类型（与前端保持一致）
│   │   └── __tests__/                # ringBuffer / diff / backfill 单测
│   ├── package.json  tsconfig.json  Dockerfile
│   └── .env.example                  # PORT=8080  FEED_MODE=mock|hyperliquid
├── docs/                             # 现有文档 + 新增 api-protocol.md / DESIGN_DECISIONS.md
├── docker-compose.yml                # 本地一键（前后端）
├── pnpm-workspace.yaml
├── CLAUDE.md                         # AI 编码规范
├── onboard.md                        # Agent 第一必读
├── .claudeignore
├── README.md
└── docs/dev-plan.md                  # 本文件
```

---

## 3. 通信协议 V1（前后端共享，写入 `docs/api-protocol.md` 并落到两端 `protocol.ts`）

### 3.1 数据模型
```ts
interface MarketItem {
  symbol: string;
  price: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  changePercent: number;   // (price - dayOpen)/dayOpen*100
  ts: number;              // 服务端最后更新时间(ms)
}
// diff：只含变化字段，symbol 必带
type MarketDiff = { symbol: string } & Partial<Omit<MarketItem, 'symbol'>>;
```

### 3.2 客户端 → 服务端
| type | 载荷 | 说明 |
|------|------|------|
| `hello` | `{ type:'hello', lastSeq?: number }` | 连接/重连首帧；带上次 seq 触发回放 |
| `ping` | `{ type:'ping', ts:number }` | 心跳，用于 RTT 与本地 stale 判定 |

### 3.3 服务端 → 客户端
| type | 载荷 | 说明 |
|------|------|------|
| `snapshot` | `{ type:'snapshot', seq:number, data: MarketItem[] }` | 全量；客户端据此重置本地 seq 基线 |
| `diff` | `{ type:'diff', fromSeq:number, toSeq:number, changes: MarketDiff[] }` | 批量增量；窗口内同 symbol last-write-wins，仅含变更字段 |
| `pong` | `{ type:'pong', ts:number }` | 心跳回包 |
| `status` | `{ type:'status', state:'connected'\|'stale', serverTs:number }` | 服务端侧状态（上游断/停滞） |
| `error` | `{ type:'error', code:string, message:string }` | 错误 |

### 3.4 回放规则（reconnect / backfill）
1. 收到 `hello`：
   - `lastSeq` 缺失或为 0 → 回 `snapshot`
   - `lastSeq` 在 ring buffer 覆盖区间内 → 回**合并后的 `diff`**（`fromSeq=lastSeq, toSeq=当前seq`），将区间内同 symbol 合并
   - `lastSeq` 早于 ring buffer 最早 seq（超窗）→ 回 `snapshot`
2. 客户端收到 `snapshot` → 清空本地态并以此为基线；收到 `diff` → 校验 `fromSeq === 本地seq`，否则主动重发 `hello` 请求快照（防止丢段造成脏价）。

---

## 4. 分阶段开发计划（按序执行）

> 约定：每个 Phase 末尾的「验证命令」必须本地跑通；DoD 勾选完才进入下一阶段。

### Phase 0 — 仓库与脚手架（约 0.5h）
**任务**
- [x] 在 `axis-demo/` 建立 monorepo：`pnpm-workspace.yaml` 含 `frontend`、`backend`。
- [x] `backend/` 初始化：`package.json`(type module)、`tsconfig.json`、依赖 `ws`，devDeps `tsx typescript @types/node @types/ws vitest`。脚本 `dev: tsx watch src/server.ts`、`build: tsc`、`start: node dist/server.js`、`test: vitest run`。
- [x] `frontend/` 初始化：基于 Vite React-TS 模板；依赖含 `mobx`、`mobx-react-lite`、`react react-dom lucide-react recharts tailwindcss @tailwindcss/vite reconnecting-websocket`。**剔除** figma 中海量未使用依赖（MUI、dnd、carousel、slick 等）与 `figma:asset` resolver。
- [x] `frontend/src/stores/` 占位：`store-instances.ts`、`useStore.ts`、`StoreProvider.tsx`（模式同 `react-app/react-app/src/stores/`）。
- [x] 根 `.gitignore`、根 `README.md` 占位、`docs/api-protocol.md`（写入 §3 协议）。
- [x] `.env.example` 两端就位。

**DoD**：`pnpm install` 通过；`pnpm --filter backend dev` 能起；`pnpm --filter frontend dev` 打开空白页无报错。
**验证**：`pnpm -r exec tsc --noEmit`（或各自 build）通过。

---

### Phase 1 — 协议与连通骨架（约 0.5 天）
**任务**
- [x] 落地 `backend/src/protocol.ts` 与 `frontend/src/lib/protocol.ts`（内容一致，§3）。
- [x] `backend/src/server.ts`：原生 `http` 提供 `GET /health` 返回 200；`ws` 接受连接，收到 `hello` 先回一个**写死的 snapshot**（占位数据），收到 `ping` 回 `pong`。
- [x] `frontend/src/ws/wsManager.ts`（推荐）：借鉴 react-app `WsManager`—指数退避、ping/pong、`onStatusChange`；或薄封装 `reconnecting-websocket`。
- [x] `frontend/src/ws/client.ts`：连 `VITE_WS_URL`；`open` 发 `hello`；解析 `snapshot/diff/pong/status` 并交给 `frameScheduler`（P3 再接 store）。
- [x] `stores/connectionStore.ts`（MobX）：`connectionState: connected | reconnecting | stale | disconnected`，由 ws 在 `runInAction` 内更新。
- [x] `ConnectionIndicator` 用 `observer` 包裹，读 `connectionStore.connectionState`。
- [x] `App` 外包 `StoreProvider`，顶部接 `ConnectionIndicator`。

**DoD**：前端连上后端、能显示 connected、收到占位 snapshot 渲染出 symbol 数；断开后端能进入 reconnecting，恢复后自动重连。
**验证**：手动 `pnpm --filter backend dev` + `pnpm --filter frontend dev`；浏览器 Network/WS 面板看到 `hello`→`snapshot`、定时 `ping`/`pong`。

---

### Phase 2 — 后端实时链路（核心，约 1 天）
**任务**
- [x] `feed/mock.ts`：确定性 Mock 源，初始化 **200 标的**（可复用 `figma` 的 symbol 列表与 BASE_PRICES），支持 `TICK_HZ`、`SYMBOLS_PER_TICK` 配置，对外 `onUpdate(symbol, {price})`。
- [x] `feed/hyperliquid.ts`：单条上游 ws 连 `wss://api.hyperliquid.xyz/ws` 订阅 `allMids`；先 `POST /info {type:'meta'}` 建 assetId→name 映射；断线指数退避重连；对外同样 `onUpdate`。
- [x] `aggregator.ts`：维护 `Map<symbol, MarketItem>` 内存态；`onUpdate` 时计算 `dayOpen/High/Low/changePercent`，并与**上次已发送值比对生成字段级 diff**（修复 D2）放入 `pendingBatch`（last-write-wins）。
- [x] 批量 flush：`setInterval` 75ms（可配 50–100ms），将 `pendingBatch` 合并为一条 `diff`，`seq++`，写入 ring buffer，扇出。
- [x] `ringBuffer.ts`：固定容量（如 20000）环形数组，存 `{seq, diff}`，`readRange(fromSeq)` 合并区间内同 symbol diff。
- [x] `hub.ts`：`Set<client>` 管理；`hello` 按 §3.4 回放（snapshot 或合并 diff）；**背压**：每客户端维护待发计数/`ws.bufferedAmount` 阈值，超阈值则跳过本轮或主动断开慢客户端（断后靠重连+回放补偿）。
- [x] `server.ts`：`GET /snapshot` 返回当前全量 JSON（HTTP 兜底）；`status` 周期广播（上游断/数据停滞 > N 秒）。
- [x] `FEED_MODE` 环境变量切换 mock/hyperliquid。

**单测（`backend/src/__tests__/`，vitest）**
- [x] ring buffer：写满后环绕、`readRange` 边界、超窗返回空触发 snapshot 路径。
- [x] diff engine：仅输出变更字段；窗口内多次更新 last-write-wins。
- [x] backfill：`hello(lastSeq)` 在窗内→diff、超窗→snapshot。

**DoD**：mock 模式下 200 标的持续推 diff；多个浏览器/wscat 同时连接互不影响；杀掉某客户端不影响其他；reconnect 带 `lastSeq` 能补回缺失区间。
**验证**：`pnpm --filter backend test` 全绿（17/17）；`curl localhost:8080/health` 与 `/snapshot` 正常。

---

### Phase 3 — MobX 数据层 + 两屏功能（约 1 天）
**任务**
- [x] 从 `figma/` 迁移并清理 UI 组件与 `styles/`、`ui/`；协议类型对齐 §3.1（`MarketItem` + `MarketDiff`；`prevPrice` 仅存在于 `Asset` 模型内，修复 D4）。
- [x] **MobX 模型与 Store**（见 §1.1）：
  - [x] `stores/models/Asset.ts`：`makeAutoObservable`，`patch(diff)` 更新价格时写 `prevPrice`。
  - [x] `stores/marketStore.ts`：`assets = new Map<string, Asset>()` + `makeAutoObservable`；`seq`；`getAsset(symbol)`；`applySnapshot` / `applyDiffBatch`；`fromSeq` 失败 → `wsClient.requestResync()`。
  - [x] `stores/portfolioStore.ts`：构造注入 `marketStore`；mock 持仓（figma `MOCK_POSITIONS`）；`computed`：`positionRows`、`totalValue`、`totalPnL`、`totalPnLPercent`。
  - [x] `stores/connectionStore.ts`：`connectionState`、`lastMessageAt`、`paused` + visibilitychange 监听。
  - [x] `stores/store-instances.ts`：组装单例；`stores/useStore.ts` + `StoreProvider.tsx`（与 react-app 一致）。
- [x] **WS 接入 Store**：
  - [x] `ws/client.ts`：解析消息后**不直接改 store**，只 `frameScheduler.enqueue(msg)`；`requestResync()` 发送 hello。
  - [x] `ws/frameScheduler.ts`：队列 + `requestAnimationFrame`；每帧合并多条 `diff` 的 `changes` 数组，**一次** `runInAction(() => { marketStore.applyDiffBatch(...); connectionStore.touch() })`；校验 fromSeq。
  - [x] `open` / 重连：`hello({ lastSeq: marketStore.seq })`；`snapshot` → `applySnapshot`；`diff` → 入队；`connect()` 防重复建连 guard。
- [x] **组件接线（MobX 行级更新）**：
  - [x] `Watchlist`：**不 observer**；虚拟列表只传 `symbol` 字符串；提取 `SymbolCountBadge`（observer）和 `ColumnHeaders`（observer）子组件；sorted useMemo 不依赖 marketStore。
  - [x] `Portfolio`：整体 observer；`PortfolioSummary`（observer）；持仓表每行 `PortfolioRow`（observer）+ `PriceCell`。
  - [x] `MarketOverview`（`observer`）：读 marketStore 聚合统计（symbol 数、涨跌家数等）。
  - [x] `AssetDetail`：详情头价格用 `PriceCell`。
- [x] **connectionStore 本地 stale**：`setInterval` 1s 检查 `Date.now() - lastMessageAt > 5000` → `runInAction` 设 `stale`（修复 D7）；`paused` 时跳过 stale 检测。
- [x] **后台恢复**（修复 D7）：`visibilitychange` → `paused = true/false`；visible 时若 stale >10s 发 `hello(lastSeq)`；`PriceTicker` 读取 `paused` 停 RAF；禁止 `window.location.reload()`。

**DoD**：MobX DevTools（可选）中可见每帧一次 batch action；改一个 symbol 价格时仅对应 `PriceCell` 重渲染（React Profiler 验证）；Watchlist/Portfolio/AssetDetail 功能完整；P&L 随 tick 自动更新；后台 30s 恢复正确。
**验证**：`pnpm --filter frontend dev` + backend mock；React Profiler 录制：tick 时 `Watchlist` 根组件 render 次数应为 0；切 tab 30s 恢复；断网→`reconnecting`→数据补齐。

---

### Phase 4 — MobX + 动画与 60fps 性能（约 0.5–1 天）
**任务**
- [x] 实现 `components/PriceTicker.tsx`（**`observer` + RAF**，替换 figma 的 `useAnimatedNumber` setState 方案，修复 D5）：
  - props：`asset: Asset`、`decimals`、`prefix`、`suffix`、`className`。
  - `useEffect` 依赖 `asset.price`：启动 RAF 从 `displayRef` 当前值插值到 `asset.price`（cubic ease-out）；**循环内只写 `ref.textContent`，禁止 `setState`**。
  - 方向闪烁：`asset.price` vs `asset.prevPrice` → 给 `<span ref>` 加 `text-green-400` / `text-red-400`，300ms 后移除（`setTimeout`）。
  - `style={{ fontVariantNumeric: 'tabular-nums' }}`。
- [x] `components/cells/PriceCell.tsx`：薄封装 `observer` + `PriceTicker`。
- [x] **可见性优化**：`PriceTicker` 读取 `connectionStore.paused`，为 true 时 cancel RAF 并提前返回；离屏行卸载即停止 RAF（`useEffect` cleanup `cancelAnimationFrame`）。
- [x] **MobX 性能复查**（P4 必做）：
  - [x] 确认 `App`、`Watchlist` 列表容器、虚拟滚动外壳**无** `observer`。
  - [x] 确认 `marketStore.applyDiffBatch` 始终在 `runInAction` 内且每帧最多 1 次。
  - [x] `Portfolio` 的 `totalValue` 等仅用 `computed`，不在 render 里 `reduce`。
- [x] 删除或废弃 figma 的 `useAnimatedNumber.ts`（每帧 setState 版本），统一走 `PriceTicker`。
- [x] 压测：`FEED_MODE=mock`，`SYMBOLS_PER_TICK=30`、`TICK_HZ=5`（作业场景）。
- [x] TypeScript 编译干净；前后端 dev server 正常。

**DoD**：30×5Hz 下 ~60fps；MobX 不导致整表重渲染；动画平滑、涨绿跌红闪烁可见；后台暂停 RAF。
**验证**：Performance 录屏 + Profiler「Ranked」中 `Watchlist` 无高频 render；DESIGN_DECISIONS 记录 MobX+RAF 分工。

---

### Phase 5 — 测试、健壮性与边界（约 0.5 天）
**任务**
- [x] 前端单测（vitest）：`marketStore`（13 tests）、`portfolioStore`（14 tests）、`connectionStore`（12 tests）— 全绿 39 tests。
- [x] 后端单测（vitest）：`ringBuffer`（7）、`aggregator`（6）、`backfill`（4）+ `backfill-integration`（8）— 全绿 25 tests。
- [x] 集成脚本 `backend/src/__tests__/backfill-integration.test.ts`：覆盖短断线 in-window、长断线 out-of-window、last-write-wins、空 ring buffer 等场景。
- [x] 边界覆盖：symbol 不在行情回退 avgCost、负 P&L 颜色、price=0 不崩溃、空列表 UI（Watchlist）、超长 symbol truncate。
- [x] 背压：hub fanOut 时跳过 `bufferedAmount > 256KB` 的慢客户端（跳过本轮，非主动断连）。
- [x] `pnpm -r test` 全绿（64 tests）。

**DoD**：`pnpm -r test` 全绿；上述场景手动核对通过。

---

### Phase 6 — 部署与交付（约 0.5 天）
**任务**
- [x] 后端 `Dockerfile` + `docker-compose.yml` 校准；`docker-compose up` 一键起前后端作为回退。
- [x] `README.md`：项目简介、架构图、本地启动（mock）、环境变量说明、一键 compose。
- [x] `docs/DESIGN_DECISIONS.md`：关键决策（diff-only、RAF+行级 observer、Ring Buffer、背压），并诚实列出已知不足 + 3 件事。
- [x] `backend/Dockerfile`：Node 20 + multi-stage build（deps → builder → runner）。
- [ ] 录制 3–5 分钟演示：①性能（Performance 面板）②网络透明度（WS 帧看 diff/batch）③韧性（断网→reconnecting→自动补回）④架构讲解。

**DoD**：README 可一键复现；DESIGN_DECISIONS 已落地；Docker build 成功；演示视频待录制。

---

## 5. 验收对照表（映射作业评分项）

| 作业评分项 | 满足方式 | 验证 |
|------------|----------|------|
| Tick 流畅度 | `runInAction` 每帧 batch + `PriceCell` observer + `PriceTicker` RAF | P4 Performance + Profiler |
| UI 性能 | 虚拟滚动 + 列表不 observer + 仅可见 `PriceTicker` | 30×5Hz 60fps |
| Reconnect 行为 | `hello(lastSeq)` + ring buffer 回放/超窗 snapshot | P2/P5 集成场景 |
| 网络传输效率 | 字段级 diff + 50–100ms 批量 | WS 帧体积对比 |
| 背压 | 每客户端缓冲阈值 + 降级/断连 | P5 慢客户端测试 |
| 代码结构 | monorepo；后端 feed/hub；前端 `stores/` + ws + cells | 目录 §2.2 |
| 后台恢复 | visibilitychange + 重连回放/快照 reconcile | P3 手测 |
| 连接状态 | connectionStore 四态 + 本地 stale | P1/P3 |
| FPS 监控 | PerfOverlay RAF 写 DOM ref，无 setState | P7 右上角实时 FPS |
| 涨跌色切换 | ThemeStore + ThemeToggle + PriceTicker/ChangeCell 主题感知 | P8 导航栏按钮 |

---

## 6. 风险与降级

| 风险 | 降级策略 |
|------|----------|
| Hyperliquid 限频/不稳/CORS | `FEED_MODE=mock` 一键切确定性源，demo 不依赖外网 |
| Railway 免费额度断流 | README 提供 `docker-compose up` 本地回退 + 线上仍尽量保活 |
| 前端高频掉帧 | `runInAction` 批量、列表不 observer、`PriceCell` 粒度、RAF 不写 state（P3/P4） |
| MobX 误用导致整表渲染 | Code review：仅 cells/summary observer；Profiler 验收（P4） |
| 慢客户端拖垮 fanout | 背压阈值 + 主动断连 + 重连补偿（P2/P5） |
| 丢段导致脏价 | 客户端校验 `fromSeq===本地seq`，不符则请求 snapshot |

---

## 7. 给 Claude CLI 的执行提示

1. **先读** `onboard.md`、`CLAUDE.md`，再执行本文件当前 Phase。
2. **严格按 Phase 顺序**，每个 Phase 结束跑「验证命令」，全绿再继续。
3. **不要在 `figma/` 上原地改**；只拷贝到 `frontend/`/`backend/` 再改。
4. **§1 的决策是冻结的**；与 `technical-doc.md` / `technical-solution.md` 冲突时**以本计划为准**。
5. 协议改动必须同步 `docs/api-protocol.md` 与两端 `protocol.ts`。
6. 每完成一个 Phase，更新本文件 checkbox，并追加「实际产出/偏差说明」。
7. 建议每个 Phase 一个独立 commit。

**推荐分阶段 prompt：**
- `阅读 onboard.md 与 CLAUDE.md，执行 docs/dev-plan.md Phase 0 与 Phase 1`
- `执行 Phase 2，vitest 全绿后用 wscat 演示 hello→snapshot→diff`
- `执行 Phase 3：stores/store-instances + Market/Portfolio/ConnectionStore + frameScheduler + 行级 observer cells`
- `执行 Phase 4：PriceTicker（observer+RAF），Profiler 证明 Watchlist 根无高频 render`
= `执行 Phase 5 与 Phase 6`
- `执行 Phase 7：PerfOverlay FPS 面板`
- `执行 Phase 8：涨跌色切换 ThemeToggle`

---

### Phase 7 — 性能监控面板（FPS Overlay）

**任务**
- 开发 `frontend/src/components/PerfOverlay.tsx`：固定在右上角（`Connected` badge 旁），显示：
  - **FPS**：最近 1 秒内 `requestAnimationFrame` 触发次数（rolling counter，每秒重置）
  - **Memory**（可选）：`performance.memory.usedJSHeapSize` / `totalJSHeapSize`
  - **WS Msg/s**（可选）：后端每秒推送消息计数
- 实现：纯 RAF 循环计数，**无 `setState`**，只写 DOM ref（`fpsRef.textContent = fps`），避免触发 React 重渲染
- 样式：半透明背景、小字号、monospace，与页面主题色一致
- 连接状态检测：WS 断开时显示 `WS DISCONNECTED` 红色警告

**DoD**：FPS 面板实时更新；WS 断连时警告显示；不影响页面性能（RAF 写 DOM ref 无 setState）

**验证**：`npm run start` 后右上角可见实时 FPS；断开后端 WS 后面板显示红色断连警告

---

### Phase 8 — 涨跌色切换（绿涨红跌 ↔ 红涨绿跌）

**任务**
- 新增 `stores/themeStore.ts`：`ThemeStore` 管理 `colorTheme: 'green-red' | 'red-green'`，localStorage 持久化
- 新增 `components/ThemeToggle.tsx`：observer 按钮，开关切换 colorTheme
- 修改 `PriceTicker.tsx`：涨跌闪烁、方向颜色读取 `themeStore.colorTheme`，切换时跟随变化
- 修改 `ChangeCell.tsx`：涨跌幅颜色随主题切换
- 入口 `App.tsx` header 区域添加 `<ThemeToggle />`

**DoD**：点击按钮可切换绿涨红跌 ↔ 红涨绿跌；刷新页面保持主题

**验证**：点击按钮后价格闪烁颜色翻转；刷新后主题一致

---
