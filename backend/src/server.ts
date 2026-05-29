/**
 * Axis Backend — HTTP + WebSocket server
 *
 * Wires: Hyperliquid/Mock feed → Aggregator → Hub → clients
 * Supports FEED_MODE=mock|hyperliquid (default: mock)
 * Stale detection: if no tick for STALE_THRESHOLD_MS → broadcast 'stale'
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Aggregator } from './aggregator.js';
import { Hub } from './hub.js';
import { RingBuffer } from './ringBuffer.js';
import { MockFeed } from './feed/mock.js';
import { HyperliquidFeed } from './feed/hyperliquid.js';
import type { ClientMessage, ServerMessage } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8080);
const FEED_MODE = process.env.FEED_MODE ?? 'mock';
const STALE_THRESHOLD_MS = 10_000;

// ── Infrastructure ────────────────────────────────────────────────────────────
const ringBuffer = new RingBuffer(20_000);

const aggregator = new Aggregator({
  flushMs: 75,
  ringBuffer,
  onDiff: (toSeq, fromSeq, _seq, changes) => hub.fanOut(toSeq, fromSeq, changes),
});

const hub = new Hub(ringBuffer);

// ── HTTP ─────────────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.method === 'GET' && req.url === '/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ seq: aggregator.seq, data: aggregator.snapshot() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  hub.addClient(ws);

  ws.on('message', (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString()) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === 'hello') {
      const lastSeq = msg.lastSeq ?? 0;
      const result = hub.resolveHello(ws, lastSeq, aggregator.snapshot(), aggregator.seq);

      if (result.action === 'snapshot') {
        hub.sendSnapshot(ws, result.seq, result.data);
      } else if (result.action === 'diff') {
        ws.send(JSON.stringify({ type: 'diff', fromSeq: result.fromSeq, toSeq: result.toSeq, changes: result.changes } satisfies ServerMessage));
      } else {
        ws.send(JSON.stringify({ type: 'diff', fromSeq: result.seq, toSeq: result.seq, changes: [] } satisfies ServerMessage));
      }
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: msg.ts } satisfies ServerMessage));
    }
  });

  ws.on('close', () => hub.removeClient(ws));
  ws.on('error', (err) => console.error('[ws] client error', err));
});

// ── Feed ─────────────────────────────────────────────────────────────────────
let feed: MockFeed | HyperliquidFeed;

if (FEED_MODE === 'hyperliquid') {
  console.log('[feed] starting Hyperliquid feed');
  feed = new HyperliquidFeed((symbol, price) => aggregator.onTick(symbol, price));
  feed.start().catch((err) => {
    console.error('[feed] HL feed failed to start, falling back to mock', err);
    startMockFeed();
  });
} else {
  startMockFeed();
}

function startMockFeed(): void {
  console.log('[feed] starting Mock feed');
  feed = new MockFeed((symbol, price) => aggregator.onTick(symbol, price));
  const initial = feed.bootstrap(); // populate aggregator.state with all symbols
  aggregator.flush(); // ensure ring buffer has initial seq 1
  console.log(`[feed] bootstrapped ${initial.length} symbols`);
  feed.start();
}

// ── Status broadcast (with tick-based stale detection) ─────────────────────────
const STATUS_INTERVAL = 5_000;
setInterval(() => {
  const now = Date.now();
  const noTickRecently = now - aggregator.lastTickAt > STALE_THRESHOLD_MS;
  const hlConnected = feed instanceof HyperliquidFeed && (feed as HyperliquidFeed).isConnected;
  const state: 'connected' | 'stale' =
    noTickRecently || (FEED_MODE === 'hyperliquid' && !hlConnected) ? 'stale' : 'connected';
  hub.broadcastStatus(state, now);
}, STATUS_INTERVAL);

// ── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`backend listening on ${PORT} (FEED_MODE=${FEED_MODE})`);
});
