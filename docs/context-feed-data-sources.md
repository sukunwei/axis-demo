# 扩展目标：外部数据源（永续交易 / 非预测市场）

> 对应 [`axis.md`](./axis.md) §擴展目標  
> **项目定位**：Hyperliquid 风格 **永续合约 + Watchlist + Portfolio** 实时终端，**不是** Polymarket / 体育博彩 / 预测市场。  
> 架构见 [`context-feed-design.md`](./context-feed-design.md)

---

## 1. 选型原则（交易终端）

| 原则 | 说明 |
|------|------|
| **服务「为什么现在要看这个币」** | 新闻、宏观日历、资金费率/OI、情绪指数 — 都应对齐 **可交易的 perp symbol** |
| **不与 tick 混流** | 行情仍走 `snapshot/diff`；情境数据走低频 `context`（30–60s） |
| **Key 仅放后端** | 禁止 `VITE_*` 暴露第三方 token |
| **优先已有链路** | HL Info / WS 能拿到的，不重复买第三方行情 |

### 不建议用于本项目

| 数据源 | 原因 |
|--------|------|
| **Polymarket / Struct** | 预测市场合约，与 HL perp 产品形态不一致 |
| **The Odds API** | 体育赔率/比分，和永续交易无关（axis 原文举例用，非本仓库方向） |
| **美股 company-news 按 AAPL** | HL 标的为 `BTC`/`ETH`，应走 crypto 新闻或按 coin 过滤 |

---

## 2. 推荐组合（按优先级）

### 2.1 最小可演示（1–2 个 key + 无 key）

| 优先级 | 用途 | 数据源 | 轮询 | 需要 Key |
|--------|------|--------|------|----------|
| **P0** | 加密新闻（按当前 symbol） | **CryptoPanic** | 30s | ✅ |
| **P0** | 宏观事件（FOMC/CPI/非农） | **Finnhub Economic Calendar** | 5–15min | ✅ |
| **P0** | 推荐特征（量/OI/资金费率） | **Hyperliquid Info**（项目已有） | 60s 或随 feed | ❌ |
| **P0** | 行为推荐 | **本地 telemetry** | 实时 | ❌ |
| **P1** | 加密向市场新闻 | **Finnhub** `category=crypto` | 60s | ✅ |
| **P1** | 联储声明原文 | **Federal Reserve RSS** | 15–60min | ❌ |
| **P1** | 全网情绪（BTC 风险偏好转盘） | **Alternative.me Fear & Greed** | 1h | ❌ |
| **P2** | 「热搜币」补充推荐 | **CoinGecko Trending** | 5min | ❌（注意限流） |
| **P2** | 利率/宏观背景图 | **FRED** | 按需 | ✅ 可选 |

**推荐只申请 2 个 Key**：`CRYPTOPANIC_TOKEN` + `FINNHUB_TOKEN`。其余用 HL + RSS + 免费公开 API。

### 2.2 和两条扩展目标的对应关系

| axis 扩展目标 | 更合适的数据 |
|--------------|--------------|
| 根据浏览器活动推荐市场 | **本地埋点** + HL `metaAndAssetCtxs`（24h 量、资金费率、OI）+ 可选 CoinGecko trending |
| 相关市场动态（联储等） | **Finnhub 经济日历** + **Fed RSS** + **CryptoPanic**（BTC/ETH 相关标题） |
| ~~体育直播~~ | **不做**；若演示「宏观冲击」用日历 + 新闻即可 |

---

## 3. 可对接接口（主推）

### 3.1 Hyperliquid Info（推荐引擎 + 情境，零额外供应商）

| 项 | 内容 |
|----|------|
| 文档 | https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api |
| 项目笔记 | [`hyperliquid-api-doc.md`](./hyperliquid-api-doc.md) |
| WS（已实现） | `wss://api.hyperliquid.xyz/ws` — `allMids`, `l2Book` |

```http
POST https://api.hyperliquid.xyz/info
Content-Type: application/json

{"type":"metaAndAssetCtxs"}
```

| 字段（assetCtx） | 推荐 / 情境用途 |
|------------------|-----------------|
| `dayNtlVlm` | 24h 成交额 → 「高活跃」排序 |
| `openInterest` | OI 异动 → Context 标签 `oi` |
| `funding` | 资金费率极端 → 「费率预警」卡片 |
| `markPx` / `midPx` | 与 watchlist 价对齐 |

```http
POST https://api.hyperliquid.xyz/info

{"type":"meta"}
```

用于 universe 列表、精度、是否 only-isolated 等（新币发现）。

**归一化示例**

```ts
{ kind: 'signal', title: 'BTC funding 0.012%/8h', symbols: ['BTC'], tags: ['funding'], source: 'hyperliquid' }
```

---

### 3.2 CryptoPanic（加密新闻）

| 项 | 内容 |
|----|------|
| 文档 | https://cryptopanic.com/developers/api/ |
| Base URL | `https://cryptopanic.com/api/v1/` |
| 鉴权 | `auth_token`（Query） |

```http
GET https://cryptopanic.com/api/v1/posts/?auth_token={TOKEN}&currencies=BTC,ETH,SOL&filter=hot&kind=news&public=true
```

| 参数 | 说明 |
|------|------|
| `currencies` | 与 watchlist / 当前详情页 symbol 一致 |
| `filter` | `hot` \| `important` \| `bullish` \| `bearish` |
| `kind` | 固定 `news`（少噪音） |

```ts
{ kind: 'news', title, url, symbols: ['BTC'], source: 'cryptopanic' }
```

---

### 3.3 Finnhub（宏观日历 + 加密新闻）

| 项 | 内容 |
|----|------|
| 文档 | https://finnhub.io/docs/api |
| Base URL | `https://finnhub.io/api/v1` |
| 鉴权 | `token=` |
| 注意 | **新闻用 REST**；WS 更适合 trade，不适合当新闻主通道 |

#### 经济日历（联储 / CPI / 非农 — 影响 BTC/ETH perp）

```http
GET https://finnhub.io/api/v1/calendar/economic?from=2026-05-30&to=2026-06-06&token={TOKEN}
```

筛选建议：`country === 'US'` 且 `impact === 'high'`，映射 `symbols: ['BTC','ETH']`。

```ts
{ kind: 'macro', title: 'US CPI', tags: ['cpi','usd'], symbols: ['BTC','ETH'], source: 'finnhub' }
```

#### 加密新闻（比 `category=general` 更贴 perp）

```http
GET https://finnhub.io/api/v1/news?category=crypto&token={TOKEN}
```

标题关键词再匹配 `BTC` / `ETH` / `SOL` 写入 `symbols`。

---

### 3.4 Federal Reserve RSS（联储 — 无 Key）

| 源 | URL |
|----|-----|
| 全部新闻稿 | https://www.federalreserve.gov/feeds/press_all.xml |
| 货币政策 / FOMC | https://www.federalreserve.gov/feeds/press_monetary.xml |

后端解析 RSS → `kind: 'macro'`, `tags: ['fed','fomc']`, `symbols: ['BTC','ETH']`。

适合回答 axis 原文里的「联储新闻」，**无需**预测市场或体育 API。

---

### 3.5 Alternative.me — 加密恐惧贪婪指数（无 Key）

| 项 | 内容 |
|----|------|
| 文档 | https://alternative.me/crypto/fear-and-greed-index/ |
| 端点 | `GET https://api.alternative.me/fng/?limit=1` |

响应：`data[0].value`（0–100）、`value_classification`（Extreme Fear …）。

```ts
{ kind: 'sentiment', title: 'Fear & Greed: 72 (Greed)', tags: ['sentiment'], symbols: [], source: 'alternative_me' }
```

展示在 **MarketOverview 侧栏** 或 Portfolio 顶栏即可；和单个 symbol 弱绑定，偏大盘情绪。

---

### 3.6 CoinGecko Trending（补充推荐，无 Key）

```http
GET https://api.coingecko.com/api/v3/search/trending
```

Header 建议：`Accept: application/json`；免费档 **≤30 次/分钟**，轮询 **≥5min**。

用途：与「用户常看 SOL」结合，若 trending 含 `SOL` 则提高推荐分；**不要**替代 HL 价格源。

```ts
// recommendations .reason
"Trending on CoinGecko + you viewed SOL"
```

---

### 3.7 FRED（可选 — 宏观背景，非实时）

```http
GET https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key={KEY}&file_type=json&sort_order=desc&limit=1
```

用于 AssetDetail **静态小图**（联邦基金利率），不是「直播流」。

---

## 4. 统一 Context 协议（交易向）

```ts
type ContextKind = 'news' | 'macro' | 'sentiment' | 'signal';
// news: 标题新闻  macro: 经济日历/Fed  sentiment: 恐惧贪婪  signal: 费率/OI 等 HL 衍生

type ContextItem = {
  id: string;
  kind: ContextKind;
  title: string;
  summary?: string;
  url?: string;
  symbols?: string[];   // HL perp: BTC, ETH, SOL
  tags?: string[];      // fed, cpi, funding, oi
  ts: number;
  source: string;       // hyperliquid | cryptopanic | finnhub | fed_rss | alternative_me
};

| { type: 'context'; items: ContextItem[] }
| { type: 'recommendations'; symbols: string[]; reasons?: Record<string, string> }
```

**轮询示例（仅交易相关源）**

```ts
const watch = marketStore.symbols.slice(0, 20); // 或用户 watchlist

await Promise.all([
  fetchCryptoPanic(watch),
  fetchFinnhubCalendar(),
  fetchFinnhubCryptoNews(),
  fetchHlAssetSignals(),      // funding / OI 极端
  fetchFearGreed(),           // 1h
]);
hub.broadcastContext(mergeDedupe());
```

---

## 5. Symbol 映射（HL perp）

| HL Symbol | CryptoPanic | 宏观关键词 | HL signal |
|-----------|-------------|------------|-----------|
| BTC | `currencies=BTC` | fed, cpi, rates, etf | funding, OI |
| ETH | `ETH` | etf, sec, l2 | 同上 |
| SOL | `SOL` | — | 同上 |
| 全局 | — | Finnhub `US` + `high impact` | Fear & Greed |

---

## 6. 推荐引擎（无需预测类 API）

```
score(symbol) =
  dwellSec(symbol)           * 1
  + clicks(symbol)         * 3
  + inPortfolio(symbol)    * 5
  + inWatchlist(symbol)    * 2
  + norm(hlDayVolume)      * 2    // metaAndAssetCtxs
  + abs(funding) > threshold ? 1 : 0
  + trendingCoinGecko(symbol) ? 2 : 0
```

输出 Top 5，排除已在 watchlist 的 symbol；`reasons` 用一句话（「高资金费率」「你常看 ETH」）。

---

## 7. 环境变量

```bash
# backend/.env.example — 永续交易终端 Stretch
CRYPTOPANIC_TOKEN=
FINNHUB_TOKEN=
FRED_API_KEY=              # 可选，宏观图
CONTEXT_POLL_MS=30000
FEAR_GREED_POLL_MS=3600000 # 1h
COINGECKO_TRENDING_MS=300000
```

---

## 8. 实现顺序（建议）

1. `hyperliquid.ts`（context 子模块）：从 `metaAndAssetCtxs` 生成 `signal`（费率/OI）  
2. `cryptopanic.ts` + `finnhub.ts`（calendar + crypto news）  
3. `fedRss.ts`（可选，无 key）  
4. `telemetry` + `recommendations`  
5. `alternative_me.ts` + `coingecko.ts`（P2，注意限流）

---

## 9. 参考链接

| 名称 | URL |
|------|-----|
| Hyperliquid API | https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api |
| CryptoPanic | https://cryptopanic.com/developers/api/ |
| Finnhub | https://finnhub.io/docs/api |
| Fed RSS 列表 | https://www.federalreserve.gov/feeds/feeds.htm |
| Fear & Greed API | https://alternative.me/crypto/fear-and-greed-index/ |
| CoinGecko Trending | https://www.coingecko.com/en/api/documentation |
| FRED | https://fred.stlouisfed.org/docs/api/fred/ |

---

## 附录：与本项目无关的 API（可忽略）

<details>
<summary>Polymarket / The Odds API（预测 & 体育）</summary>

仅当作业刻意做 **Polymarket 赛道** 时才需要；当前 axis-demo 为 **Hyperliquid 永续**，不必接入。

- Polymarket Gamma：`https://gamma-api.polymarket.com/markets?...`
- The Odds API：`https://api.the-odds-api.com/v4/sports/{sport}/scores?...`

</details>
