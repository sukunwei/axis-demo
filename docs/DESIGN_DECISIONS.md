# 设计决策（Design Decisions）

> 本文档记录 axis-demo 的关键架构决策、权衡分析与已知局限。

## 核心架构决策

### 1. 数据流：浏览器只连自家后端

**决策**：前端绝不直连 Hyperliquid，必须经过自家后端。

**理由**：
- 让后端真正承担 diff/批处理/ring buffer/回填/背压（核心评分项）
- 提供一致的协议层，支持 mock 模式离线演示
- 避免 CORS 问题，免费 API 额度限制

**权衡**：延迟比直连 HL 高几个 ms，但对于本应用（30×5Hz）可忽略。

---

### 2. diff-only 协议

**决策**：后端只发送变化的字段，不发送完整 MarketItem。

```typescript
type MarketDiff = { symbol: string } & Partial<Omit<MarketItem, 'symbol'>>;
```

**理由**：
- 带宽最小化：200 symbols × 5 Hz = 1000 msg/s，仅发送实际变化字段
- 字段级 diff 由 Aggregator 对比 `lastSent` Map 生成

**权衡**：客户端需要正确合并 diff 到本地状态；fromSeq 校验防止丢段。

---

### 3. 后端批量 flush（75ms）

**决策**：Aggregator 每 75ms 将 pending batch 合并为一条 diff，seq++，写入 ring buffer，扇出。

**理由**：
- 平衡延迟与吞吐量：75ms ≈ 13 frames，既不会太迟（用户感知慢），也不会太频繁（协议开销大）
- last-write-wins：同一 symbol 在窗口内多次更新，只发送最终值

**权衡**：窗口内最多次更新为 75ms × 5Hz = 0.375 次/symbol，对高频交易场景略显迟缓；可通过环境变量调低到 50ms。

---

### 4. Ring Buffer 回填

**决策**：固定容量 20,000 条环形缓冲，按 seq 索引。重连时：
- `lastSeq=0` → snapshot（全量）
- `lastSeq` 在窗内 → 合并 diff（fromSeq → latestSeq）
- `lastSeq` 早于 earliestSeq → snapshot（超窗）

**理由**：
- 有限内存成本下提供确定性回填能力
- 小 buffer 环境变量测试超窗路径

**权衡**：超过 20,000 seq（约 3.3 分钟 @ 100seq/s）则超窗，无法 diff 恢复。

---

### 5. MobX 行级 observer + frameScheduler 批量

**决策**：
- `Watchlist` 根组件**不 observer**（避免整表重渲染）
- `PriceCell` / `ChangeCell` / `PortfolioSummary` 用 `observer`
- WS 消息经 `frameScheduler.enqueue()` → RAF flush → 单次 `runInAction(applyDiffBatch)`

**理由**：
- 修复 D5（`useAnimatedNumber` 每帧 `setState` 导致 reaction 风暴）
- 每帧最多一次 batch action，MobX DevTools 可验证

**权衡**：
- 需要开发者严格遵守「不在 render 里 setState」规范
- PriceCell 每次 price 变化会重启 RAF 动画（符合设计）

---

### 6. PriceTicker：observer + RAF DOM ref 直写

**决策**：
- `observer` 包裹 PriceTicker，依赖 `asset.price`
- price 变化时启动 RAF 动画（cubic ease-out，150ms）
- 动画循环内只写 `spanRef.textContent`，禁止 `setState`
- 闪烁通过 `span.classList.add('text-green-400')`，300ms 后移除

**理由**：
- 分离关注点：MobX 管「何时更新」，RAF 管「如何平滑」
- DOM ref 直写绕过 React 渲染 pipeline，避免重渲染

**权衡**：后台 tab 时 `connectionStore.paused = true`，RAF 暂停（节省 CPU）。

---

### 7. 背压策略

**决策**：Hub fanOut 时跳过 `bufferedAmount > 256KB` 的慢客户端（本轮跳过，不主动断连）。

```typescript
if (ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
  console.warn(`[hub] slow client, skipping`);
  continue;
}
```

**理由**：
- 跳过本轮避免网络堆积，客户端下次正常接收
- 不主动断连避免误伤偶发抖动的连接

**权衡**：长期慢客户端会导致消息堆积；生产环境应增加超时主动断连逻辑。

---

### 8. Hyperliquid + Mock 双 Feed

**决策**：后端支持 `FEED_MODE=mock|hyperliquid`，环境变量切换。

**理由**：
- Mock 保证 demo 可离线运行、压测可复现（seed=42 PRNG）
- HL 真实数据源提供真实场景验证

**权衡**：目前 `FEED_MODE=hyperliquid` 尚未接入真实 HL，HYPERLIQUID_WS_URL 和签名逻辑待实现。

---

## 已知不足与接下来要修的 3 件事

### 1. Hyperliquid 真实数据源未完成
`feed/hyperliquid.ts` 骨架存在，但 `FEED_MODE=hyperliquid` 暂不可用。需要：
- 实现 `/info` 签名（ nonce + HMAC-SHA256）
- 正确映射 `allMids` key → symbol（当前 `allMids` keys 已经是 symbol names）
- 处理断线重连与指数退避

### 2. 无持久化
重启后所有状态丢失（200 symbols 重新 bootstrap）。可改进：
- 接入 Redis 存储聚合状态
- 后端启动时先从 Redis 恢复，不依赖上游 feed

### 3. Sparkline 为占位符
`AssetDetail.tsx` 的价格走势图是硬编码 SVG 模拟，非真实 K 线数据。可改进：
- 接入真实 OHLC 数据源
- 使用 Canvas 渲染或轻量图表库（Recharts 已在依赖中）

---

## 技术栈选择理由

| 选择 | 决策 | 理由 |
|------|------|------|
| 状态管理 | MobX 6 + `mobx-react-lite` | `makeAutoObservable` + `computed` 适合复杂派生状态；行级 `observer` 防止整表渲染 |
| 前端框架 | React 18 + Vite | 对比 Next.js：项目不需要 SSR/路由，`Vite` 更轻更快 |
| 后端 | Node.js + TypeScript + 原生 `ws` | 不引入 Express，保持轻量；Hub 模式足够管理扇出 |
| CSS | Tailwind CSS v4 | 复用 `figma/` 主题，按需引入，无 CSS Modules |
| 包管理 | pnpm workspace | monorepo 结构，前后端分离清晰 |