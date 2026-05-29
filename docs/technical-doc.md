# Real-time Portfolio - Technical Solution

## 1. 已确认决策

- 市场方向：On-chain Top 200 Tokens
- 数据来源：Mock Quote Generator（可选叠加真实价格基线）
- 后端语言：Node.js（TypeScript）
- 项目形态：新仓库（前后端分离，统一在一个 monorepo）

## 2. 目标与验收标准

### 2.1 产品目标

实现一个可实时更新的 Web 投资组合系统，包含：

- **Watchlist**：symbol / last / 24h change%，实时更新
- **Portfolio**：qty / avg cost / last / unrealized P&L / total value，每 tick 计算
- **资产详情视图**：可点击任意 symbol 查看细节（图表或深度信息）

### 2.2 性能与正确性目标

- 在 30 symbols * 5Hz 更新频率下，界面保持接近 60fps
- 数字变化使用平滑过渡（非跳变）
- 涨跌方向有短时颜色闪烁（up/down flash）
- 连接状态可见：connected / reconnecting / stale
- 页面后台 30 秒后返回，状态自动 reconcile，无明显整页重载

### 2.3 协议目标（后端必做）

- 仅发送 diff（symbol + 变更字段）
- 50-100ms 批量窗口聚合消息
- 客户端 reconnect 时上报 `lastSeenSeq`
- 服务端 ring buffer 回放缺失区间；超过窗口则返回全量 snapshot

## 3. 项目结构

```
realtime-portfolio/
├── frontend/                     # React/Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── lib/
│   │   ├── workers/
│   │   └── __tests__/
│   └── package.json
├── backend/                      # Node.js WebSocket 服务
│   ├── src/
│   │   ├── server/
│   │   ├── feed/
│   │   ├── protocol/
│   │   ├── hub/
│   │   └── tests/
│   └── package.json
└── docs/
    ├── technical-solution.md
    └── api-protocol.md
```

## 4. 技术架构

### 4.1 数据链路

```
Mock Feed -> Aggregator -> Diff Engine -> Batch Window -> WS Hub -> Clients
```

**说明：**

- Mock Feed 为 200 个 token 持续产生价格变动
- Aggregator 更新内存态（symbol state）
- Diff Engine 只提取变化字段（如 `last`, `changePct`）
- Batch Window 每 50~100ms 聚合后广播
- Hub 负责多客户端 fanout 与背压控制

### 4.2 前端链路

```
WebSocket Client -> Message Buffer -> MobX Store -> Virtualized UI + Animated Number
```

**说明：**

- WS 消息先进入轻量缓冲，避免每条消息直接触发渲染
- Store 按 symbol map 更新，行级组件做 memo/observer
- 大列表使用虚拟滚动
- 数字动画用 requestAnimationFrame 插值

## 5. 协议设计（V1）

### 5.1 客户端 -> 服务端

| 类型 | 格式 |
|------|------|
| `hello` | `{ type: "hello", lastSeenSeq?: number, watchSymbols: string[] }` |
| `ping` | `{ type: "ping", ts: number }` |
| `set_watchlist` | `{ type: "set_watchlist", symbols: string[] }` |

### 5.2 服务端 -> 客户端

| 类型 | 格式 |
|------|------|
| `snapshot` | `{ type: "snapshot", seq: number, data: Record<symbol, SnapshotItem> }` |
| `diff_batch` | `{ type: "diff_batch", fromSeq: number, toSeq: number, diffs: DiffItem[] }` |
| `stale_notice` | `{ type: "stale_notice", serverTs: number, reason: string }` |
| `pong` | `{ type: "pong", ts: number }` |
| `error` | `{ type: "error", code: string, message: string }` |

### 5.3 回放规则

- 若 `lastSeenSeq` 在 ring buffer 覆盖范围内：返回 `diff_batch` 回放
- 若不在覆盖范围内：返回新 `snapshot`
- 客户端收到 `snapshot` 时重置本地 seq 基线

## 6. 后端模块设计（Node）

### 6.1 Feed Generator

- 维护 200 tokens 初始价格
- 每个 symbol 可配置 tick 频率（默认 1~5Hz）
- 每 tick 生成：`last`, `changePct`, `ts`

### 6.2 Hub + Fanout

- Hub 单例管理客户端连接
- 每个客户端维护：订阅 symbols、`lastAckSeq`、待发送队列长度
- 队列超阈值触发慢客户端断开（backpressure）

### 6.3 Ring Buffer

- 全局递增 `seq`
- 固定长度环形数组（例如 20,000 条）
- 存储 `seq + diff`
- 提供 `readRange(fromSeq, toSeq)` 方法

### 6.4 Batch Dispatcher

- 50~100ms 周期 flush
- 同一 symbol 在窗口内多次更新，仅保留最新值（last-write-wins）
- 广播时按客户端订阅集合过滤

## 7. 前端模块设计

### 7.1 页面

- `/watchlist`
- `/portfolio`
- `/asset/[symbol]`（可简化为 drawer/modal）

### 7.2 状态

- `marketStore`：symbol 最新行情 map，seq 管理，stale 检测
- `portfolioStore`：mock positions + 基于行情实时计算 P&L
- `connectionStore`：状态机（connected/reconnecting/stale）

### 7.3 性能策略

- 表格行组件拆分并 `memo`
- 虚拟列表（symbol > 80）
- 动画与闪烁尽量走 CSS/RAF，避免频繁 React state 抖动
- 每帧最多一次批量提交 store 更新（节流）

## 8. 开发计划

### Phase 1：骨架与协议（0.5 天）

- 初始化 monorepo 目录
- 产出 `api-protocol.md`
- 后端 ws server 可启动，前端可连通并显示连接状态

### Phase 2：后端实时链路（1 天）

- 完成 feed generator + diff + batch + ring buffer
- 完成 reconnect/backfill
- 加入 backpressure 保护
- 单测覆盖核心协议路径

### Phase 3：前端两屏与性能（1 天）

- Watchlist + Portfolio 完整功能
- 数字动画 + 闪烁效果
- 背景恢复与 stale 处理
- 初步性能压测（30*5Hz）

### Phase 4：部署与交付（0.5 天）

- Railway 部署 backend
- Vercel 部署 frontend
- README + Design Decisions + Loom 视频

## 9. 测试与验收清单

**单元测试：**
- ring buffer 边界
- diff merge 正确性
- reconnect 回放路径

**集成测试：**
- 客户端断线后恢复
- snapshot 回退逻辑

**性能验证：**
- 30*5Hz 时 UI 无明显卡顿
- 消息吞吐稳定，无内存持续增长

## 10. 风险与降级策略

| 风险 | 策略 |
|------|------|
| 高频更新导致前端掉帧 | 前端消息节流 + 行级渲染隔离 + 虚拟滚动 |
| 慢客户端拖垮服务端发送 | 发送队列阈值 + 主动断连 + 重连后补偿 |
| 免费部署资源不足 | 提供 `docker-compose up` 本地一键回放方案 |

## 11. 交付物清单

- [x] 公共 GitHub 仓库（本项目）
- [x] 在线可访问前后端部署地址
- [x] `README.md`（启动说明 + 架构说明 + 设计决策）
- [x] `docs/technical-solution.md`（本文件）
- [x] `docs/api-protocol.md`（协议细节）
- [x] 3-5 分钟 Loom 演示视频
