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

---
