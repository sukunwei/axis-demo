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
  res.writeHead(404);
  res.end();
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

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
    }
  });

  ws.on('close', () => hub.removeClient(ws));
  ws.on('error', (err) => console.error('[ws] client error', err));
});

// ── Feed ─────────────────────────────────────────────────────────────────────
interface FeedWithOrderBook {
  subscribeOrderBook(symbol: string): void;
  unsubscribeOrderBook(symbol: string): void;
  start(): Promise<void>;
}

type Feed = MockFeed | HyperliquidFeed;
let feed: Feed;
/** Effective feed after HL stall fallback (may differ from FEED_MODE env). */
let activeFeedMode: 'mock' | 'hyperliquid' = FEED_MODE === 'hyperliquid' ? 'hyperliquid' : 'mock';
let mockFallbackDone = false;

const HL_STALL_FALLBACK_MS = 12_000;

// Hyperliquid symbols for order book subscription
const PERP_COINS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'MATIC', 'DOT', 'SHIB', 'LTC', 'UNI', 'ATOM', 'APT',
];

function stopCurrentFeed(): void {
  if (feed instanceof MockFeed) feed.stop();
  else if (feed instanceof HyperliquidFeed) feed.stop();
}

function startMockFeed(reason?: string): void {
  stopCurrentFeed();
  activeFeedMode = 'mock';
  console.log(`[feed] starting Mock feed${reason ? ` (${reason})` : ''}`);
  aggregator.reset();
  feed = new MockFeed(
    (symbol, price) => aggregator.onTick(symbol, price),
    (symbol, bids, asks) => aggregator.onOrderBook(symbol, bids, asks),
  );
  const initial = feed.bootstrap();
  aggregator.flush();
  console.log(`[feed] bootstrapped ${initial.length} symbols`);
  feed.start();
}

function startHyperliquidFeed(): void {
  activeFeedMode = 'hyperliquid';
  console.log('[feed] starting Hyperliquid feed');
  aggregator.reset();
  feed = new HyperliquidFeed(
    (symbol, price) => aggregator.onTick(symbol, price),
    (symbol, bids, asks) => aggregator.onOrderBook(symbol, bids, asks),
  );

  feed.start().then(async () => {
    await (feed as HyperliquidFeed).waitForOpen();
    const hlFeed = feed as FeedWithOrderBook;
    for (const coin of PERP_COINS) {
      hlFeed.subscribeOrderBook(coin);
    }
    console.log(`[hl] subscribed to ${PERP_COINS.length} order books`);
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
  console.log(`backend listening on ${PORT} (FEED_MODE=${FEED_MODE}, active=${activeFeedMode})`);
});
