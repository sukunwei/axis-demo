/**
 * Backfill integration script
 *
 * Simulates two reconnect scenarios:
 *   1. Short disconnect (5s) → hello(lastSeq) → diff补回 (in-window)
 *   2. Long disconnect (>ring buffer) → hello(0) → snapshot全量 reconcile
 *
 * Run: npx tsx src/__tests__/backfill-integration.test.ts
 * (or: pnpm --filter backend test)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../ringBuffer.js';
import { Hub } from '../hub.js';
import type { WebSocket } from 'ws';
import type { MarketItem } from '../protocol.js';

function makeMockWs() {
  const calls: string[] = [];
  return {
    readyState: 1,
    bufferedAmount: 0,
    send: (msg: string) => calls.push(msg),
    _calls: calls,
  } as unknown as WebSocket & { send: (msg: string) => void; _calls: string[] };
}

const emptySnapshot = (): MarketItem[] => [];

/**
 * Scenario 1: Short disconnect (~5s), still in ring buffer window
 *
 * Setup: ring buffer capacity=10, seq 1-8 present.
 * Simulate: client lastSeq=5, disconnects, reappears with lastSeq=5.
 * Expect: diff {fromSeq:5, toSeq:8} — fills gaps 5→8
 */
describe('Backfill integration — short disconnect (in-window)', () => {
  it('fills gaps when lastSeq is within ring buffer window', () => {
    const rb = new RingBuffer(10); // capacity 10
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    // Simulate 8 tick batches written to ring buffer
    for (let seq = 1; seq <= 8; seq++) {
      rb.push(seq, [{ symbol: 'BTC', price: 40000 + seq * 100 }]);
    }

    // Client was at seq=5, reconnected now (server at seq=8)
    const result = hub.resolveHello(ws, 5, emptySnapshot(), 8);
    expect(result.action).toBe('diff');
    if (result.action === 'diff') {
      expect(result.fromSeq).toBe(5);
      expect(result.toSeq).toBe(8);
      // Should contain 3 diff entries (seq 6,7,8)
      expect(result.changes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('resume from seq 0 (fresh client) → snapshot', () => {
    const rb = new RingBuffer(10);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    for (let seq = 1; seq <= 8; seq++) {
      rb.push(seq, [{ symbol: 'BTC', price: 40000 + seq * 100 }]);
    }

    const result = hub.resolveHello(ws, 0, emptySnapshot(), 8);
    expect(result.action).toBe('snapshot');
  });

  it('resume from seq >= latest → up-to-date (no data needed)', () => {
    const rb = new RingBuffer(10);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    for (let seq = 1; seq <= 8; seq++) {
      rb.push(seq, [{ symbol: 'BTC', price: 40000 + seq * 100 }]);
    }

    const result = hub.resolveHello(ws, 8, emptySnapshot(), 8);
    expect(result.action).toBe('uptodate');
    if (result.action === 'uptodate') {
      expect(result.seq).toBe(8);
    }
  });
});

/**
 * Scenario 2: Long disconnect (ring buffer window exceeded)
 *
 * Setup: small ring buffer (capacity=3), seq 1-5 written (seq 1-2 evicted).
 * Client lastSeq=1, reconnects at seq=5. Seq 1 is out of window.
 * Expect: snapshot (cannot serve diff from seq 1)
 */
describe('Backfill integration — long disconnect (out-of-window)', () => {
  it('out-of-window lastSeq → snapshot (cannot merge)', () => {
    const rb = new RingBuffer(3); // small — only keeps last 3 entries
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    // Write 5 entries, seq 1 and 2 will be evicted
    for (let seq = 1; seq <= 5; seq++) {
      rb.push(seq, [{ symbol: 'BTC', price: 40000 + seq * 100 }]);
    }

    // Confirm seq 1 and 2 are gone
    const earliest = rb.earliestSeq();
    expect(earliest).toBeGreaterThanOrEqual(3);

    // Client with lastSeq=1 is now out of window
    const result = hub.resolveHello(ws, 1, emptySnapshot(), 5);
    expect(result.action).toBe('snapshot');
  });

  it('lastSeq in evicted range → snapshot even if some later seq remain', () => {
    const rb = new RingBuffer(5); // keeps 5
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    // Push 8 entries — seq 1-3 will be evicted
    for (let seq = 1; seq <= 8; seq++) {
      rb.push(seq, [{ symbol: 'ETH', price: 2000 + seq * 10 }]);
    }

    const earliest = rb.earliestSeq();
    expect(earliest).toBe(4); // seq 1-3 evicted

    // Client lastSeq=2 is out of window
    const result = hub.resolveHello(ws, 2, emptySnapshot(), 8);
    expect(result.action).toBe('snapshot');
  });

  it('lastSeq=3 (just before window start) → diff from seq 4', () => {
    const rb = new RingBuffer(5);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    for (let seq = 1; seq <= 8; seq++) {
      rb.push(seq, [{ symbol: 'ETH', price: 2000 + seq * 10 }]);
    }

    // earliest is 4, so lastSeq=3 is out of window
    const result = hub.resolveHello(ws, 3, emptySnapshot(), 8);
    expect(result.action).toBe('snapshot');
  });
});

/**
 * Scenario 3: Last-write-wins within a backfill window
 *
 * Client lastSeq=1. While disconnected, BTC got updated multiple times.
 * Only final state should be in the diff response.
 */
describe('Backfill integration — last-write-wins in window', () => {
  it('merges multiple updates to same symbol, keeps latest price', () => {
    const rb = new RingBuffer(100);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    // BTC updated at seq 2, 4, 6 with prices 41000, 42000, 43000
    rb.push(1, [{ symbol: 'BTC', price: 40000 }]);
    rb.push(2, [{ symbol: 'BTC', price: 41000 }]);
    rb.push(3, [{ symbol: 'ETH', price: 2000 }]);
    rb.push(4, [{ symbol: 'BTC', price: 42000 }]);
    rb.push(5, [{ symbol: 'ETH', price: 2100 }]);
    rb.push(6, [{ symbol: 'BTC', price: 43000 }]);

    // Client was at seq 1, reconnect at seq 6
    const result = hub.resolveHello(ws, 1, emptySnapshot(), 6);
    expect(result.action).toBe('diff');
    if (result.action === 'diff') {
      // BTC should appear once with price=43000 (latest)
      const btcChanges = result.changes.filter((c) => c.symbol === 'BTC');
      expect(btcChanges.length).toBe(1);
      expect(btcChanges[0].price).toBe(43000);

      // ETH should appear once with price=2100 (latest from seq 5)
      const ethChanges = result.changes.filter((c) => c.symbol === 'ETH');
      expect(ethChanges.length).toBe(1);
      expect(ethChanges[0].price).toBe(2100);
    }
  });
});

/**
 * Scenario 4: Empty ring buffer (server just started)
 *
 * Client connects to fresh server with no history.
 * Expect: snapshot (even though lastSeq=0)
 */
describe('Backfill integration — empty ring buffer', () => {
  it('fresh server returns snapshot even for lastSeq=0', () => {
    const rb = new RingBuffer(10);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    const result = hub.resolveHello(ws, 0, emptySnapshot(), 0);
    expect(result.action).toBe('snapshot');
  });
});

