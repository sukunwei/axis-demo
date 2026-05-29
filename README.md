# axis-demo

> Real-time portfolio + watchlist powered by self-built WebSocket backend with field-level diff engine.

## 架构

```
Browser (React + MobX) ← WebSocket ← Backend (Node.js)
                               ↓
                         Mock Feed / Hyperliquid Feed
                               ↓
                         Aggregator → Diff Engine → Ring Buffer
                               ↓
                         Hub (fanout + backpressure)
```

**前端**：React 18 + Vite + MobX 6 + Tailwind CSS v4
**后端**：Node.js + TypeScript + 原生 `ws` + `http`
**协议**：diff-only WebSocket（snapshot/diff/hello/ping/pong/status）

## 快速启动

### 本地开发（mock 数据）

```bash
# 安装依赖
pnpm install

# 启动后端（mock feed，200 symbols，5Hz tick）
pnpm --filter backend dev

# 启动前端（新窗口）
pnpm --filter frontend dev
```

打开 http://localhost:5173

### Docker Compose（一体化）

```bash
docker-compose up --build
```

前端：http://localhost:5173 | 后端：http://localhost:8080

## 环境变量

### 后端（`backend/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | HTTP/WS 监听端口 |
| `FEED_MODE` | `mock` | `mock` 或 `hyperliquid` |
| `TICK_HZ` | `5` | 每秒 tick 次数 |
| `SYMBOLS_PER_TICK` | `30` | 每次 tick 更新的 symbol 数量 |

### 前端（`frontend/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_WS_URL` | `ws://localhost:8080` | WebSocket 连接地址 |

## 主要功能

- **Watchlist** — 200 symbols，虚拟滚动，搜索/排序，实时 PriceCell + ChangeCell
- **Portfolio** — 10 mock positions，实时 P&L 汇总，未实现盈亏颜色指示
- **AssetDetail** — 点击 symbol 查看详情（Day Open/High/Low/Volume + 简易走势图）
- **连接状态** — 四态指示（connected / reconnecting / stale / disconnected）
- **后台恢复** — `visibilitychange` 检测，暂停 RAF，省电不丢消息

## 技术亮点

- **diff-only 协议**：字段级变化推送，最小化带宽
- **每帧批量写入**：RAF 聚合 + 单次 `runInAction`，MobX reaction 风暴防护
- **行级 observer**：仅 PriceCell/ChangeCell 订阅价格，`Watchlist` 根不 observer
- **RAF 价格动画**：DOM ref 直写，无 `setState` 触发重渲染
- **Ring Buffer 回填**：断线重连按 seq 补差，超窗回全量 snapshot
- **背压保护**：慢客户端跳过本轮扇出，不影响其他客户端
- **确定性 Mock**：mulberry32 PRNG seed=42，保证压测可复现

## 目录结构

```
axis-demo/
├── frontend/src/
│   ├── app/App.tsx              # 布局 + tab 导航
│   ├── components/
│   │   ├── Watchlist.tsx         # 虚拟滚动列表（非 observer）
│   │   ├── Portfolio.tsx         # 持仓总览 + 列表（observer）
│   │   ├── PriceTicker.tsx       # RAF 价格动画
│   │   └── cells/                # PriceCell / ChangeCell（observer）
│   ├── stores/                   # MobX stores（market / portfolio / connection）
│   ├── ws/                       # client.ts + frameScheduler.ts
│   └── lib/protocol.ts           # 与后端共享的类型
├── backend/src/
│   ├── server.ts                # HTTP + WebSocket 入口
│   ├── hub.ts                    # 客户端管理 + 扇出
│   ├── aggregator.ts             # 内存态 + field diff
│   ├── ringBuffer.ts             # seq 环形缓冲
│   ├── feed/                     # mock.ts / hyperliquid.ts
│   └── __tests__/               # vitest
├── docs/
│   ├── dev-plan.md               # 工程蓝图
│   └── api-protocol.md            # WS 协议 SSOT
├── pnpm-workspace.yaml
└── docker-compose.yml
```

## 测试

```bash
pnpm -r test     # 前端 39 tests + 后端 25 tests = 64 tests 全绿
```

## 已知局限

1. Sparkline 图表为占位符（硬编码 SVG），非真实 K 线数据
2. Hyperliquid feed 未接入真实 API（`FEED_MODE=hyperliquid` 暂不可用）
3. 无持久化存储，重启后数据重置
4. 无身份验证 / 多用户隔离

## 下一步（可改进方向）

1. Hyperliquid 真实数据源接入（`FEED_MODE=hyperliquid`）
2. 持久化存储（Redis）保存聚合状态
3. 真实 K 线图表（集成 TradingView 或自定义 Canvas）
4. 多房间 / 多用户持仓隔离
5. 性能压测报告（Chrome Profiler + Performance 录制）