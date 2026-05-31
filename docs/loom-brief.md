# Loom 演示脚本（精简版）

> 建议总时长 **4:30**（3:30–5:00）

| # | 章节 | 时间 |
|---|------|------|
| 0 | 开场 + 本地运行 | 0:00–0:25 |
| 1 | 产品功能 | 0:25–1:35 |
| 2 | 动画与性能 | 1:35–2:05 |
| 3 | 网络与协议 | 2:05–2:45 |
| 4 | 韧性（断线 + 后台） | 2:45–3:35 |
| 5 | 架构与设计 | 3:35–4:10 |
| 6 | 收尾 | 4:10–4:30 |

---

## 0 — 开场 + 本地运行 | 0:00–0:25

**界面**：README 或终端 `pnpm install && pnpm start` → 浏览器 `http://localhost:5173`，右上角 **Connected**

**中文**：这是 axis-demo：实时 Watchlist 和模拟 Portfolio。数据只走自建后端 WebSocket，前端不直连交易所。本次提交是公开 GitHub 加本地一键启动和本视频，没有部署云端。后端默认连接 Hyperliquid 实盘行情（200 个标的），也可切换 mock 数据。

**English**：This is axis-demo: a real-time watchlist and mock portfolio. All market data goes through our own WebSocket backend—the browser never talks to the exchange directly. I'm delivering a public GitHub repo, one-command local setup, and this walkthrough—no cloud deployment. The backend connects to Hyperliquid live market data by default (200 symbols), with an optional mock mode.

---

## 1 — 产品功能 | 0:25–1:35

**界面**：

| 时间 | 界面 |
|------|------|
| 0:25–0:50 | **Watchlist**：200 symbols，搜索/排序，价格与 24h Change 实时更新 |
| 0:50–1:05 | 指 **1–2 个 PriceCell**：数字平滑滚动 + 涨绿跌红闪一下 |
| 1:05–1:20 | **Portfolio**：qty、成本、现价、未实现 P&L、Total 随 tick 变化 |
| 1:20–1:35 | 点 **BTC** → **AssetDetail**：日高低量 + 左侧 **Price Chart** + 右侧 **Order Book** → 返回 |

**中文**：Watchlist 三列实时更新，虚拟列表支撑两百个标的。价格用 RAF 动画，方向有颜色闪烁。Portfolio 是 mock 持仓，每笔 tick 重算 P&L。点进详情可以看到统计、价格图和订单簿，订单簿来自 Hyperliquid 真实深度。

**English**：The watchlist shows symbol, last price, and day change for two hundred symbols with virtual scrolling. Prices animate smoothly with a brief green-or-red flash on direction—not hard jumps. The portfolio uses mock positions; unrealized P&L and total value update every tick. Asset detail adds stats, a live price chart, and an order book fed by live Hyperliquid depth.

---

## 2 — 动画与性能 | 1:35–2:05

**界面**：盯住 **一个 PriceCell** 3–5 秒；（可选）Chrome **Performance** 或 **React Profiler** 一小段

**中文**：性能上，MobX 只在 PriceCell 和 ChangeCell 做 observer，Watchlist 外壳不订阅价格。WebSocket 消息先进入帧调度器，每帧一次 runInAction 批量写入，避免两百行同时 setState。后端默认 Hyperliquid 实时行情，也可切换 mock 模式（30 个 symbol 每秒 5 次 tick）。

**English**：For performance, only row-level cells are MobX observers—the list shell doesn't subscribe to every price. Incoming messages are batched per animation frame with a single runInAction, so we don't trigger two hundred React renders per tick. The backend connects to Hyperliquid live data by default; mock mode (30 symbols at 5 Hz) is available via Settings.

---

## 3 — 网络与协议 | 2:05–2:45

**界面**：DevTools → **Network** → **WS** → 先看 `snapshot`，再看连续 `diff`；点开一条 `diff` 看 `changes` 仅含变更字段（约 30 条/批）

**中文**：网络层是字段级 diff，大约每 75 毫秒批量 flush 一次。首包 snapshot 建基线，之后是 diff。客户端用 hello 带上 lastSeq，服务端用环形缓冲回填；超窗则全量 snapshot，避免脏价。慢客户端超过缓冲阈值会跳过本轮扇出，实现背压。

**English**：On the wire we send field-level diffs, batched roughly every seventy-five milliseconds. The first message is a snapshot; then diffs only. On reconnect the client sends hello with lastSeq; the server replays from a ring buffer, or sends a fresh snapshot if the client is out of window—preventing stale prices. Backpressure skips slow clients when their socket buffer is too large.

---

## 4 — 韧性：断线 + 后台 | 2:45–3:35

**界面 A — 断线（约 35s）**：右上角 **Connected** → 停 backend → **Reconnecting** → 重启 backend → **Connected**，价格继续更新

**界面 B — 后台（约 25s）**：记住某 symbol 价格 → **切到其他标签** ≥30s → 切回：无整页刷新，价格与当前一致

**中文**：断线时状态会变 Reconnecting，后端起来后自动重连并用 lastSeq 对齐。切到后台会暂停 RAF 动画省电，回到前台如果超过十秒会发 hello 带序号做 reconcile，不会出现三十秒前的僵尸价，也不会整页 reload。

**English**：When the backend stops, the UI shows reconnecting, then recovers automatically with lastSeq backfill. When the tab is backgrounded we pause RAF animations; on return we reconcile with hello and the stored sequence—no full page reload and no zombie prices from thirty seconds ago.

---

## 5 — 架构与设计 | 3:35–4:10

**界面**：README **架构图** 或 `docs/DESIGN_DECISIONS.md`（Feed → Aggregator → Hub → 前端 MobX + RAF）

**中文**：架构上，单一上游 feed 进 Aggregator 做字段 diff 和批量，再经 Hub 扇出给多个 WebSocket 客户端。前端 MobX 管状态，RAF 管动画。选型是 Node 加原生 ws，单实例用内存 Hub，作业允许 in-process fanout。更细的决策写在 DESIGN_DECISIONS。

**English**：Architecturally, one upstream feed feeds an aggregator that computes field diffs and batches them; a hub fans out to many WebSocket clients without re-fetching the source. The frontend uses MobX for state and RAF for number animation. I chose Node with native ws and an in-process hub for this single-instance demo. Details are in DESIGN_DECISIONS.

---

## 6 — 收尾 | 4:10–4:30

**界面**：GitHub 仓库首页（public）

**中文**：已知不足和接下来三件事：第一，后端默认连接 Hyperliquid，偶发断线会 fallback 到 mock，需进一步优化重连策略。第二，补 Profiler 和 E2E，把 60 秒后台恢复做成可重复证据。第三，volume 和 K 线是占位，chart 可加入更多时间序列。仓库和本地启动步骤在 README，谢谢。

**English**：Three things I'd improve next: first, the backend now connects to Hyperliquid live data by default with automatic mock fallback on stalls—need further reconnect tuning. Second, add Profiler captures and E2E tests for reconnect and thirty-second background resume. Third, replace placeholder volume and sparkline with real or tick-buffered series. The repo and local setup are in the README. Thanks for watching.
