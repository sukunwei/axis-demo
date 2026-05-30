# 资讯模块开发计划

> 基于 [`context-feed-design.md`](./context-feed-design.md) · **新闻走 REST，不走 WebSocket**

## 1. 目标

新增 **资讯 Tab**（`news`），展示联储宏观新闻；**Watchlist** 上方展示推荐币种横条。  
行情 tick 仍只走现有 WS；**宏观新闻与推荐均通过 HTTP 拉取**，不占用 WS 通道、不进入 `frameScheduler`。

## 2. 设计决策

| 决策 | 选型 | 理由 |
|------|------|------|
| 新 Tab | `news` | 资讯与行情/组合隔离，避免触发 `marketStore` reaction |
| **新闻获取** | **`GET /context` REST** | Fed RSS 更新慢（15–30min），按需/定时 HTTP 即可；与 tick WS 解耦 |
| **推荐获取** | **`GET /recommendations` REST** | 同上，30s 轮询或进入 Watchlist 时拉一次 |
| 后端缓存 | 内存 `contextCache` | scheduler 后台刷新 RSS，HTTP 只读缓存，响应快 |
| 状态隔离 | `newsStore` + `recommendationStore` | 与 `marketStore` 完全隔离 |
| 懒加载 | `React.lazy(NewsTab)` | 未点资讯 Tab 不加载组件、不请求 `/context` |
| 列表渲染 | 普通列表 | Fed RSS 条目有限（通常 &lt;50），无需虚拟滚动 |

### 通道划分

| 数据 | 通道 | 说明 |
|------|------|------|
| 价格 / diff / snapshot | **WebSocket**（现有） | 不变 |
| 宏观新闻 | **HTTP** `GET /context` | 本模块 |
| 推荐 Top5 | **HTTP** `GET /recommendations` | 本模块 |
| 行为埋点 | **HTTP** `POST /telemetry` | 本模块 |

**不修改** `hub.ts` 的 fanOut；**不新增** WS 消息类型 `context` / `recommendations`。

## 3. 实现顺序

### Phase 1：后端 Fed RSS + HTTP + NewsTab

**后端**

```
backend/src/context/
  fedRss.ts          # fetch + XML 解析（依赖 fast-xml-parser）
  normalize.ts       # → ContextItem[]
  scheduler.ts       # 启动立即拉一次 + 每 15min 刷新 → 写入 contextCache
  contextCache.ts    # 内存 { items, updatedAt }

backend/src/routes/context.ts   # GET /context → contextCache
backend/src/types/context.ts    # ContextItem 类型（或 protocol.ts 共享）
backend/src/server.ts           # 注册路由 + 启动 scheduler
```

**HTTP 契约**

```http
GET /context
→ 200 { "items": ContextItem[], "updatedAt": number }
```

```ts
type ContextItem = {
  id: string;
  kind: 'macro';
  title: string;
  summary?: string;
  url?: string;
  symbols?: string[];
  tags?: string[];
  ts: number;
  source: 'fed_rss';
};
```

**前端**

```
frontend/src/api/context.ts       # fetchContext(baseUrl)
frontend/src/stores/newsStore.ts  # items, loading, error, load()
frontend/src/components/NewsTab.tsx
frontend/src/components/MacroFeed.tsx
frontend/src/app/App.tsx          # 新增 news Tab，lazy NewsTab
```

**数据流**

```
Fed RSS → scheduler(15min) → contextCache
                ↑
NewsTab mount → GET /context → newsStore → MacroFeed
```

用户 **首次点开 News Tab** 才 `newsStore.load()`；可选 Tab 内「Refresh」手动再拉。

### Phase 2：推荐横条（HTTP）

**后端**

```
backend/src/context/
  hyperliquidMeta.ts
  coingeckoTrending.ts
  recommendation.ts      # score → Top5 + reasons
backend/src/telemetry.ts
backend/src/routes/recommendations.ts   # GET /recommendations
backend/src/routes/telemetry.ts         # POST /telemetry
```

```http
GET /recommendations
→ 200 { "symbols": string[], "reasons": Record<string, string>, "updatedAt": number }

POST /telemetry
Body: { "event": "symbol_click"|"symbol_view"|"search", "symbol"?, "dwellMs"?, "query"? }
→ 204
```

**前端**

- `recommendationStore` + `RecommendationBar`（挂在 Watchlist 上方）
- 进入 Watchlist 时 `loadRecommendations()`，之后每 30s 轮询（`visibilityState === 'visible'` 时才续轮询）

### Phase 3：埋点

- `AssetDetail` mount/unmount → `POST /telemetry` `symbol_view` + `dwellMs`
- Watchlist 行点击 → `symbol_click`
- 搜索提交 → `search`
- 后端更新 telemetry → 下次 `GET /recommendations` 反映新分数

## 4. 文件清单

### 后端新增

| 文件 | 职责 |
|------|------|
| `backend/src/context/fedRss.ts` | Fed RSS fetch + XML 解析 |
| `backend/src/context/contextCache.ts` | 宏观新闻内存缓存 |
| `backend/src/context/scheduler.ts` | Fed / trending / HL meta 后台调度 |
| `backend/src/context/normalize.ts` | → `ContextItem` |
| `backend/src/context/hyperliquidMeta.ts` | HL `metaAndAssetCtxs` |
| `backend/src/context/coingeckoTrending.ts` | CoinGecko trending |
| `backend/src/context/recommendation.ts` | 推荐引擎 |
| `backend/src/telemetry.ts` | 行为内存聚合 |
| `backend/src/routes/context.ts` | `GET /context` |
| `backend/src/routes/recommendations.ts` | `GET /recommendations` |
| `backend/src/routes/telemetry.ts` | `POST /telemetry` |

**依赖**：`fast-xml-parser`（`backend/package.json`）

### 后端修改

| 文件 | 改动 |
|------|------|
| `backend/src/server.ts` | 挂载上述 HTTP 路由；启动 context scheduler |

**不修改**：`hub.ts`、`protocol.ts` 的 WS `ServerMessage`（新闻/推荐不进 WS）

### 前端新增

| 文件 | 职责 |
|------|------|
| `frontend/src/api/context.ts` | `fetchContext()` |
| `frontend/src/api/recommendations.ts` | `fetchRecommendations()`、`postTelemetry()` |
| `frontend/src/stores/newsStore.ts` | 宏观新闻 |
| `frontend/src/stores/recommendationStore.ts` | 推荐 Top5 |
| `frontend/src/components/NewsTab.tsx` | lazy Tab |
| `frontend/src/components/MacroFeed.tsx` | 新闻列表 |
| `frontend/src/components/RecommendationBar.tsx` | Watchlist 横条 |

### 前端修改

| 文件 | 改动 |
|------|------|
| `frontend/src/app/App.tsx` | `news` Tab + lazy `NewsTab` |
| `frontend/src/components/Watchlist.tsx` | 顶部 `RecommendationBar` |
| `frontend/src/stores/store-instances.ts` | 注册 `newsStore`、`recommendationStore` |

**不修改**：`ws/client.ts`、`frameScheduler.ts`（新闻与 WS 无关）

## 5. FPS 保障

| 措施 | 说明 |
|------|------|
| 新闻走 HTTP | WS 仅 tick，无 context 解析开销 |
| 独立 store | `newsStore` / `recommendationStore` 与 `marketStore` 隔离 |
| 懒加载 NewsTab | 默认不 fetch `/context` |
| Tab 内轮询 | 仅 **News Tab 可见** 时可选手动 Refresh；**不**在后台全局轮询新闻 |
| 推荐轮询 | 仅 **Watchlist 可见** 时 30s `GET /recommendations` |
| Fed RSS 15min | 后端 scheduler 刷新缓存，前端 HTTP 读缓存即毫秒级 |

## 6. 环境变量

```bash
# backend/.env
CONTEXT_FED_RSS_MS=900000       # 15min，后端 scheduler
CONTEXT_TRENDING_MS=300000      # 5min
CONTEXT_HL_META_MS=60000
RECOMMENDATIONS_RECOMPUTE_MS=30000
FUNDING_ALERT_THRESHOLD=0.0001

# frontend/.env（可选）
VITE_API_BASE=http://localhost:5174
```

## 7. 验证标准

- [ ] `pnpm start` 前后端正常；`GET /context`、`GET /recommendations` 返回 200
- [ ] **未打开 News Tab 时** 浏览器 Network 无 `/context` 请求
- [ ] 打开 News Tab 后显示 Fed RSS 最新条目（≥1 条）
- [ ] 行情 Watchlist 的 WS tick / 60fps 动画不受 News Tab 影响
- [ ] `ws/client.ts` 消息类型中 **无** `context` / `recommendations`
- [ ] Mock 模式下推荐 symbol ⊆ `marketStore.symbols`
- [ ] Watchlist 推荐横条显示 Top5 + reason
- [ ] `fedRss.test.ts`：fixture XML → 至少 1 条 `ContextItem`

## 8. 与 design 文档差异

[`context-feed-design.md`](./context-feed-design.md) 中 WS `broadcastContext` 方案 **本计划不采用**；以本文 **HTTP 读缓存** 为准。design 中数据源（Fed RSS、CoinGecko、HL Info、telemetry）与推荐公式不变。
