**Time budget:** due Sunday night 8pm HK time
**Deliverables:** public GitHub repo, live deployment (or one-command local deploy), 3–5 min Loom walkthrough

---

## The problem

Build a web portfolio and watchlist that updates tick-by-tick over WebSockets, smoothly, without dropping frames or stale prices. 

This should focus on 1 of the 3 markets: 

- Top tokens on-chain (Solana, Ethereum, Base) - include at least 200
- Polymarket (https://docs.polymarket.com/api-reference/introduction optionally can use: https://www.struct.to/)
- Hyperliquid (https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api)

Keep in mind the following: reconnect with backfill, diff-only updates, and rendering a screen full of constantly-changing numbers without melting the battery.

The user opens the app and sees a configurable watchlist and mock portfolio. feed of assets loads with live price updates, orderbook fills. a dashboard views of different asset views, with ability to click into any individual asset or market to see details. P&L recomputes on every tick. When the user backgrounds the app for 30 seconds and returns, the screen reconciles to the correct state without a visible reload.

## Required scope

A React Native or React app with:

- A watchlist screen: symbol, last price, day change %, updating live.
- A portfolio screen: positions with qty, avg cost, last, unrealized P&L, total portfolio value updating on every tick (can use mock fills).
- Number transitions that animate (not jump) and a brief color flash on tick direction (green up, red down). This must stay smooth — visibly at 60fps — with 30 symbols ticking at 5 Hz.
- Connection state visible to the user: connected, reconnecting, stale (no ticks for >N seconds).
- Background-and-resume that reconciles correctly — no zombie prices from 30 seconds ago.

A backend that:

- Ingests a quote feed
- Fans quotes out to many WebSocket clients without re-doing work per client.
- Sends diff-only updates (the symbol and changed fields, not the whole watchlist) and batches updates within a small window (e.g., 50–100ms) to cap message rate.
- Handles reconnect: client sends last-seen sequence number, server replays anything missed from a bounded in-memory ring buffer; older than that, client gets a fresh snapshot.

## Stretch goal

Create a recommendation engine which, based on user activity in the browser, begins recommending different markets to trade.

Adding in external data sources to help the user keep up to date on markets that are relevant to them (ex. sports live game updates, FED news, 

## Suggested stack

Web/Mobile: React or React Native
Backend: Go/Rust/Node. Any are fine; pick what you'll ship faster in. Go gives you better story on goroutine-per-client fanout, Node gives you faster iteration. Document why you picked yours.
Pub/sub: Redis Pub/Sub or NATS for fanout. In-process channels are acceptable for a single-instance demo.

## Deployment

Backend on Railway with a public WebSocket endpoint. Document the URL in the README and keep it running through the review window. If your free tier can't sustain it, document `docker-compose up` as the fallback — but a live URL is strongly preferred for an app whose whole point is real-time behavior.

Mobile via Expo EAS preview build (installable on a real device) or `expo export:web` on Vercel. The web build is fine for grading; the device build is what makes the demo video impressive.

## What we'll evaluate

Tick smoothness under load 
UI performance
Reconnect behavior
Wire efficiency
Backpressure
Code organization

## Design decisions section

Write a summary covering the main decisions you made behind the code you wrote.

We expect rough edges in a 48-hour build. We're looking for an engineer who *sees* their own rough edges and can articulate the next three things they'd fix.

## Video walkthrough or live demo

~3-5 minutes, taking us through the product itself and how



中文：
项目需求
构建一个网页版资产组合与自选列表应用，通过 WebSocket 实现逐笔实时更新，要求流畅、不掉帧、价格不延迟失效。
你必须选择以下 3 类市场中的其中一类：
主流链上代币（Solana、Ethereum、Base）至少包含 200 个
Polymarket 预测市场
Hyperliquid 衍生品市场
必须实现：
断线重连 + 缺失数据回填、增量更新（diff-only）、大量数字实时变化不卡顿、不耗电。
用户打开应用后看到：
可自定义的自选列表
模拟资产组合
实时价格、成交数据推送
仪表盘展示不同资产视图
点击任意资产可查看详情
每一次价格变动都重新计算盈亏（P&L）
当用户把应用切到后台 30 秒再返回时，
页面必须自动恢复到最新正确状态，不出现刷新、不出现旧价格。
必须实现的功能（Web 端）
前端（React Web）
自选列表页面：交易对、最新价格、涨跌幅，实时更新
资产组合页面：持仓数量、成本价、最新价、未实现盈亏、总资产，每一笔 tick 都实时更新
数字动画：价格平滑变化，不跳变；涨绿跌红闪烁。在 30 个交易对、5Hz 更新频率下保持 60fps 流畅
连接状态显示：已连接 / 重连中 / 数据停滞
后台恢复：切后台 30 秒返回后自动同步最新状态，无脏数据、无明显刷新
后端
接入行情数据源
向大量 WebSocket 客户端广播数据，不重复拉取源
只发送增量更新（diff-only），并在 50–100ms 内批量打包消息
断线重连：客户端上传最后序号，服务端从内存环形缓冲区补发消息；超时则返回全量快照
进阶目标（加分）
基于用户行为实现交易对推荐引擎
接入外部数据（体育实时比分、美联储新闻等）
推荐技术栈（Web 版）
前端：React (Web)
后端：Go / Rust / Node.js（任选）
消息广播：Redis Pub/Sub 或 NATS
部署要求
后端部署到 Railway，提供公网 WebSocket 地址
前端部署到 Vercel
README 写明启动方式与线上地址
评分标准
高频率价格更新的流畅度
UI 性能
断线重连表现
网络传输效率
背压处理
代码结构
设计说明
写一段总结，说明你做的关键技术决策。
我们能接受 48 小时开发的不完美，但希望你能说出自己知道哪里不够好，以及接下来要优化哪 3 件事。