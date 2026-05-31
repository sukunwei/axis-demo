# axis-demo — Real-time Watchlist & Portfolio

> Live Hyperliquid market data with a mock portfolio — 200+ symbols at 60fps, powered by a diff-only WebSocket backend built in Node.js.

---

## Key Capabilities (Interview Highlights)

| Capability | Implementation |
|------------|---------------|
| **60fps price animation** | RAF + direct DOM ref writes; `setState` fires only once on init |
| **200+ symbols without stutter** | Row-level MobX `observer` (PriceCell); Watchlist shell does NOT observe |
| **Diff-only protocol** | Field-level change push; 75ms batch flush; minimal bandwidth |
| **Frame scheduler** | WS messages aggregated via RAF; max one `runInAction` per frame; no MobX reaction storm |
| **Zero zombie prices on reconnect** | Client stores `lastSeq`; Ring Buffer replays within window; snapshot outside window |
| **30s background tab recovery** | RAF pauses on tab hide; `visibilitychange` detection; `hello` reconciliation on return |
| **Live market data** | Default: Hyperliquid `allMids` + `l2Book` real depth; mock is fallback |
| **One-to-many fanout** | Backend Hub single-process broadcast; backpressure skips slow clients |

---

## Quick Start

Requires [pnpm](https://pnpm.io/installation):

```bash
pnpm install && pnpm start
# Frontend http://localhost:5173 | Backend ws://localhost:5174
```

---

## Documentation

| Document | Contents |
|----------|----------|
| **[`docs/technical-design.md`](./docs/technical-design.md)** | Full architecture, protocol, module design |

---