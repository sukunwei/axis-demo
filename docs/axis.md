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

**時間預算：** 截止日期：香港時間週日晚間 8 點

**交付成果：** 公開的 GitHub 程式碼庫、線上部署（或一鍵本地部署）、3-5 分鐘的 Loom 演示

---

## 問題

建立一個 Web 投資組合和自選列表，透過 WebSocket 實現逐筆即時更新，流暢無卡頓，避免丟幀或價格過時。

此項目應專注於以下三個市場之一：

- 鏈上熱門代幣（Solana、以太坊、Base）- 至少包含 200 個

- Polymarket（https://docs.polymarket.com/api-reference/introduction，也可選擇使用：https://www.struct.to/）

- Hyperliquid（https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api）

請注意以下幾點：支援回填重連、僅更新差異數據，以及在不耗盡電池電量的情況下渲染螢幕上不斷變化的數字。

用戶開啟應用程式後，會看到一個可設定的自選股清單和模擬投資組合。資產資訊流會即時加載，並更新價格和訂單簿成交資訊。儀表板會顯示不同的資產視圖，使用者可以點擊查看任何單一資產或市場的詳細資訊。盈虧會在每個交易週期重新計算。當使用者將應用程式置於背景 30 秒後再返回時，螢幕會自動恢復到正確狀態，無需重新載入。

## 所需功能

一個 React Native 或 React 應用，包含以下內容：

- 自選股清單介面：顯示股票代碼、最新價格和當日漲跌幅百分比，並即時更新。

- 投資組合介面：顯示持倉數量、平均成本、最新價格、未實現損益和投資組合總價值，並在每個交易週期更新（可使用模擬成交資訊）。

- 數位過渡動畫（非跳躍式），以及在交易週期方向（綠色上漲，紅色下跌）時短暫的顏色閃爍。所有動畫必須保持流暢——在 60fps 下清晰可見——同時 30 個股票代碼以 5Hz 的頻率進行交易。

- 使用者可見的連線狀態：已連線、正在重新連線、過期（超過 N 秒無資料）。

- 後台恢復功能，確保資料同步正確－不會出現 30 秒前的殭屍價格。

後端功能：

- 接收報價流

- 將報價分發給多個 WebSocket 用戶端，無需為每個用戶端重複工作。

- 僅發送差異更新（交易品種和更改字段，而不是整個自選列表），並在較小的視窗（例如 50-100 毫秒）內批量發送更新，以控制訊息速率。

- 處理重新連接：客戶端發送上次連接序號，伺服器從記憶體中的環形緩衝區重播任何錯過的資料；如果資料更早，則客戶端獲取最新的快照。

## 擴展目標

創建一個推薦引擎，該引擎能夠根據用戶在瀏覽器中的活動，推薦不同的交易市場。

新增外部資料來源，幫助用戶隨時了解與其相關的市場動態（例如，體育賽事直播、聯準會新聞等）。

## 推薦技術堆疊

Web/行動端：React 或 React Native

後端：Go/Rust/Node。任何一種都可以，選擇交付速度最快的。 Go 在每個客戶端的 goroutine 分配方面表現更佳，Node 則能帶來更快的迭代速度。請記錄選擇該技術棧的原因。

發布/訂閱：Redis Pub/Sub 或 NATS 用於分配。對於單一實例演示，進程內通道也是可以接受的。

## 部署

後端部署在 Railway 上，並提供一個公共 WebSocket 端點。請在 README 檔案中記錄 URL，並在審核期間保持其運作。如果您的免費套餐無法支持，請記錄 `docker-compose up` 作為備用方案——但對於以實時性為核心的應用程式來說，強烈建議使用可訪問的 URL。

行動端可透過 Expo EAS 預覽版（可在真機上安裝）或 `expo export:web` 部署。在 Vercel 上。網頁版足以進行評分；而設備版才是示範影片令人印象深刻的關鍵。

## 我們將評估的內容

負載下的流暢度

使用者介面性能

重連行為

線路效率
反壓
代碼組織

## 設計決策部分

請總結您在編寫程式碼時所做的主要決策。

我們理解 48 小時的開發週期可能會有一些瑕疵。我們正在尋找一位能夠*發現*自身不足之處，並能清楚闡述接下來需要改進的三個問題的工程師。

## 視訊演示或現場演示

大約 3-5 分鐘，向我們介紹產品本身及其工作原理。