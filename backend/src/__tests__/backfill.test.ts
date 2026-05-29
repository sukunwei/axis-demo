import { describe, it, expect } from 'vitest';
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

function emptySnapshot(): MarketItem[] {
  return [];
}

describe('Hub — backfill', () => {
  it('lastSeq=0 → snapshot', () => {
    const rb = new RingBuffer(100);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    const result = hub.resolveHello(ws, 0, emptySnapshot(), 0);
    expect(result.action).toBe('snapshot');
    expect((result as { action: 'snapshot'; seq: number }).seq).toBe(0);
  });

  it('lastSeq >= latest → uptodate', () => {
    const rb = new RingBuffer(100);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    rb.push(1, [{ symbol: 'A', price: 100 }]);
    rb.push(2, [{ symbol: 'B', price: 200 }]);

    const result = hub.resolveHello(ws, 2, emptySnapshot(), 2);
    expect(result.action).toBe('uptodate');
    if (result.action === 'uptodate') expect(result.seq).toBe(2);
  });

  it('lastSeq out of window → snapshot', () => {
    const rb = new RingBuffer(3);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    // Fill beyond capacity so earliest seq is evicted
    for (let i = 1; i <= 5; i++) {
      rb.push(i, [{ symbol: `S${i}`, price: i * 10 }]);
    }

    const result = hub.resolveHello(ws, 1, emptySnapshot(), 5);
    expect(result.action).toBe('snapshot');
  });

  it('lastSeq in window → merged diff with last-write-wins', () => {
    const rb = new RingBuffer(100);
    const hub = new Hub(rb);
    const ws = makeMockWs();
    hub.addClient(ws);

    rb.push(1, [{ symbol: 'A', price: 100 }]);
    rb.push(2, [{ symbol: 'B', price: 200 }]);
    rb.push(3, [{ symbol: 'A', price: 110 }]); // A updated to 110

    const result = hub.resolveHello(ws, 1, emptySnapshot(), 3);
    expect(result.action).toBe('diff');
    const r = result as { action: 'diff'; fromSeq: number; toSeq: number; changes: Array<{ symbol: string; price: number }> };
    expect(r.fromSeq).toBe(1);
    expect(r.toSeq).toBe(3);
    // A appears once with latest price (110), B appears once (200)
    const a = r.changes.find((c) => c.symbol === 'A');
    expect(a?.price).toBe(110);
    const b = r.changes.find((c) => c.symbol === 'B');
    expect(b?.price).toBe(200);
  });
});
