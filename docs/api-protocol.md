# WebSocket API Protocol

> SSOT for both frontend and backend. Any change must update this file AND both `protocol.ts` implementations.

---

## Data Models

```ts
interface MarketItem {
  symbol: string;
  price: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  changePercent: number; // (price - dayOpen) / dayOpen * 100
  ts: number;            // server-side last update time (ms)
  bids?: [number, number][]; // [price, size] top 10 bids
  asks?: [number, number][]; // [price, size] top 10 asks
}

// diff: only changed fields, symbol is always present
type MarketDiff = { symbol: string } & Partial<Omit<MarketItem, 'symbol'>>;
```

---

## Client → Server

| type | payload | description |
|------|---------|-------------|
| `hello` | `{ type: 'hello', lastSeq?: number }` | connection/reconnect; includes last seq to trigger backfill |
| `ping` | `{ type: 'ping', ts: number }` | heartbeat for RTT and local stale detection |

---

## Server → Client

| type | payload | description |
|------|---------|-------------|
| `snapshot` | `{ type: 'snapshot', seq: number, data: MarketItem[] }` | full state; client resets local seq baseline |
| `diff` | `{ type: 'diff', fromSeq: number, toSeq: number, changes: MarketDiff[] }` | batched incremental; same symbol last-write-wins within window |
| `pong` | `{ type: 'pong', ts: number }` | heartbeat response |
| `status` | `{ type: 'status', state: 'connected' \| 'stale', serverTs: number }` | server-side upstream status |
| `error` | `{ type: 'error', code: string, message: string }` | error |

---

## Reconnect / Backfill Rules

1. Client sends `hello { lastSeq }`:
   - `lastSeq` missing or 0 → server responds with `snapshot`
   - `lastSeq` within ring buffer window → server responds with merged `diff` (`fromSeq=lastSeq, toSeq=currentSeq`)
   - `lastSeq` older than ring buffer (out of window) → server responds with `snapshot`
2. Client receives `snapshot` → clears local state and uses it as baseline.
3. Client receives `diff` → must validate `fromSeq === localSeq`, otherwise send `hello` to request snapshot (prevents stale prices from gaps).

---

## HTTP Endpoints

- `GET /health` → `200 OK`
- `GET /snapshot` → full state JSON (HTTP fallback)
