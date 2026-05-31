/**
 * Axis Backend — HTTP + WebSocket server
 *
 * Wires: Hyperliquid/Mock feed → Aggregator → Hub → clients
 * Supports FEED_MODE=mock|hyperliquid (default: hyperliquid)
 * Stale detection: if no tick for STALE_THRESHOLD_MS → broadcast 'stale'
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Aggregator } from './aggregator.js';
import { Hub } from './hub.js';
import { RingBuffer } from './ringBuffer.js';
import { MockFeed } from './feed/mock.js';
import { HyperliquidFeed } from './feed/hyperliquid.js';
import { startContextScheduler } from './context/scheduler.js';
import { handleContext } from './routes/context.js';
import type { ClientMessage, ServerMessage } from './protocol.js';

const PORT = Number(process.env.PORT ?? 5174);
const FEED_MODE = process.env.FEED_MODE ?? 'hyperliquid';
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
  if (req.method === 'GET' && req.url?.startsWith('/snapshot')) {
    const url = new URL(req.url, 'http://localhost');
    const mode = url.searchParams.get('mode') as 'mock' | 'hyperliquid' | null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      seq: aggregator.seq,
      feedMode: activeFeedMode,
      modeRequested: mode,
      symbolCount: aggregator.snapshot().length,
      data: aggregator.snapshot(),
    }));
    return;
  }
  if (req.method === 'GET' && req.url === '/context') {
    handleContext(req, res);
    return;
  }
  res.writeHead(404);
  res.end();
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

/** Ref-counted l2Book subscriptions (shared across clients) */
const orderBookSubRefs = new Map<string, number>();
const clientOrderBookSubs = new WeakMap<WebSocket, Set<string>>();

function subscribeOrderBookSymbol(symbol: string): void {
  const next = (orderBookSubRefs.get(symbol) ?? 0) + 1;
  orderBookSubRefs.set(symbol, next);
  if (next === 1 && feed instanceof HyperliquidFeed) {
    feed.subscribeOrderBook(symbol);
  }
}

function unsubscribeOrderBookSymbol(symbol: string): void {
  const current = orderBookSubRefs.get(symbol) ?? 0;
  if (current <= 1) {
    orderBookSubRefs.delete(symbol);
    if (feed instanceof HyperliquidFeed) {
      feed.unsubscribeOrderBook(symbol);
    }
  } else {
    orderBookSubRefs.set(symbol, current - 1);
  }
}

function trackClientOrderBookSub(ws: WebSocket, symbol: string): void {
  let subs = clientOrderBookSubs.get(ws);
  if (!subs) {
    subs = new Set();
    clientOrderBookSubs.set(ws, subs);
  }
  if (subs.has(symbol)) return;
  subs.add(symbol);
  subscribeOrderBookSymbol(symbol);
}

function untrackClientOrderBookSub(ws: WebSocket, symbol: string): void {
  const subs = clientOrderBookSubs.get(ws);
  if (!subs?.has(symbol)) return;
  subs.delete(symbol);
  unsubscribeOrderBookSymbol(symbol);
}

function resubscribeAllOrderBooks(): void {
  if (!(feed instanceof HyperliquidFeed)) return;
  for (const symbol of orderBookSubRefs.keys()) {
    feed.subscribeOrderBook(symbol);
  }
}

wss.on('connection', (ws: WebSocket) => {
  hub.addClient(ws);
  ws.send(JSON.stringify({ type: 'feed_mode', mode: activeFeedMode } satisfies ServerMessage));

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
    } else if (msg.type === 'set_feed_mode') {
      const requested = msg.mode;
      if (requested === activeFeedMode) return;

      mockFallbackDone = requested === 'mock';
      if (requested === 'mock') {
        startMockFeed('client request');
      } else {
        startHyperliquidFeed();
      }

      hub.broadcastFeedMode(activeFeedMode);
      hub.broadcastSnapshot(aggregator.seq, aggregator.snapshot());
    } else if (msg.type === 'subscribe_orderbook') {
      trackClientOrderBookSub(ws, msg.symbol);
    } else if (msg.type === 'unsubscribe_orderbook') {
      untrackClientOrderBookSub(ws, msg.symbol);
    }
  });

  ws.on('close', () => {
    const subs = clientOrderBookSubs.get(ws);
    if (subs) {
      for (const symbol of subs) unsubscribeOrderBookSymbol(symbol);
      clientOrderBookSubs.delete(ws);
    }
    hub.removeClient(ws);
  });
  ws.on('error', (err) => console.error('[ws] client error', err));
});

// ── Feed ─────────────────────────────────────────────────────────────────────
type Feed = MockFeed | HyperliquidFeed;
let feed: Feed;
/** Effective feed after HL stall fallback (may differ from FEED_MODE env). */
let activeFeedMode: 'mock' | 'hyperliquid' = FEED_MODE === 'hyperliquid' ? 'hyperliquid' : 'mock';
let mockFallbackDone = false;

const HL_STALL_FALLBACK_MS = 12_000;

function stopCurrentFeed(): void {
  if (feed instanceof MockFeed) feed.stop();
  else if (feed instanceof HyperliquidFeed) feed.stop();
}

function startMockFeed(reason?: string): void {
  stopCurrentFeed();
  activeFeedMode = 'mock';
  aggregator.reset();
  feed = new MockFeed(
    (symbol, price) => aggregator.onTick(symbol, price),
    (symbol, bids, asks) => aggregator.onOrderBook(symbol, bids, asks),
  );
  const initial = feed.bootstrap();
  aggregator.flush();
  // console.log(`[feed] bootstrapped ${initial.length} symbols`);
  feed.start();
}

function startHyperliquidFeed(): void {
  stopCurrentFeed();
  activeFeedMode = 'hyperliquid';
  aggregator.reset();
  feed = new HyperliquidFeed(
    (symbol, price) => aggregator.onTick(symbol, price),
    (symbol, bids, asks) => aggregator.onOrderBook(symbol, bids, asks),
  );

  feed.start().then(async () => {
    await (feed as HyperliquidFeed).waitForOpen();
    resubscribeAllOrderBooks();
  }).catch((err: unknown) => {
    console.error('[feed] HL feed failed to start, falling back to mock', err);
    startMockFeed('HL start failed');
  });
}

if (FEED_MODE === 'hyperliquid') {
  startHyperliquidFeed();
} else {
  startMockFeed();
}

// ── Context scheduler ───────────────────────────────────────────────────────
startContextScheduler();

// ── Status broadcast + HL stall → mock fallback ───────────────────────────────
const STATUS_INTERVAL = 5_000;
setInterval(() => {
  const now = Date.now();
  const msSinceTick = now - aggregator.lastTickAt;

  if (
    FEED_MODE === 'hyperliquid' &&
    !mockFallbackDone &&
    activeFeedMode === 'hyperliquid' &&
    feed instanceof HyperliquidFeed &&
    msSinceTick > HL_STALL_FALLBACK_MS
  ) {
    mockFallbackDone = true;
    console.warn(
      `[feed] Hyperliquid stalled (no tick for ${msSinceTick}ms) — switching to mock for stable demo`,
    );
    startMockFeed('HL upstream stalled');
  }

  const noTickRecently = msSinceTick > STALE_THRESHOLD_MS;
  const hlConnected = feed instanceof HyperliquidFeed && feed.isConnected;
  const state: 'connected' | 'stale' =
    noTickRecently || (activeFeedMode === 'hyperliquid' && !hlConnected) ? 'stale' : 'connected';
  hub.broadcastStatus(state, now);
}, STATUS_INTERVAL);

// ── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`➜ Local: ws://localhost:${PORT}`);
});
