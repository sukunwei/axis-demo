# axis-demo — Real-time Watchlist & Portfolio

> Hyperliquid 實時行情 Watchlist + 模擬 Portfolio，60fps 流暢更新，WebSocket 後端自建。

**GitHub**: [sukunwei/axis-demo](https://github.com/sukunwei/axis-demo)
**一鍵啟動**: `pnpm install && pnpm start` → [http://localhost:5173](http://localhost:5173)

---

## 核心能力（面試亮點）

| 能力 | 實現方式 |
|------|---------|
| **60fps 價格動畫** | RAF + DOM ref 直接寫入，`setState` 只在初始化觸發一次 |
| **200 標的不卡頓** | 行級 MobX `observer`（PriceCell），Watchlist 根組件不 observer |
| **diff-only 協議** | 字段級變更推送，75ms 批量 flush，節省帶寬 |
| **幀調度器** | WS 消息 RAF 批次聚合，每幀最多一次 `runInAction`，杜絕 MobX 反應風暴 |
| **斷線零僵屍價** | 客戶端存 `lastSeq`，Ring Buffer 窗口內補差，窗口外全量 Snapshot |
| **30s 後台恢復** | Tab 隱藏時 RAF 暫停，`visibilitychange` 檢測，返回時 `hello` 對齊 |
| **真實行情** | 默認 Hyperliquid `allMids` + `l2Book` 真實深度，mock 為備用 |
| **一對多扇出** | 後端 Hub 單進程廣播，慢客戶端自動跳過（背壓保護）|

---

## 架構一覽

```
Browser (React 18 + MobX)
    ↑ WebSocket
Backend (Node.js + ws)
    ├── HyperliquidFeed (默認) / MockFeed (備用)
    ├── Aggregator (字段 diff + 75ms 批量)
    ├── Ring Buffer (20k seq 窗口)
    └── Hub (客戶端註冊 + 扇出 + 背壓)
```

---

## 快速啟動

```bash
pnpm install && pnpm start
# 前端 http://localhost:5173 | 後端 ws://localhost:5174
```

**切換 mock 模式**：右上角 Settings → Mock Data

---

## 技術文檔導航

| 文檔 | 內容 |
|------|------|
| **[`docs/technical-design.md`](./docs/technical-design.md)** | 完整架構、協議、模塊設計 |
| **[`docs/axis.md`](./docs/axis.md)** | 作業原文 |
| **[`docs/loom-brief.md`](./docs/loom-brief.md)** | 3-5 分鐘 Loom 演示腳本 |

---

## 測試覆蓋

```
前端: 46 tests (vitest) — marketStore / portfolioStore / frameScheduler / connectionStore
後端: 25+ tests (vitest) — aggregator / ringBuffer / backfill
```

```bash
pnpm -r test
```
