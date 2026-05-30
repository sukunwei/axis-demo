/**
 * Hub — manages connected WebSocket clients, fans out diffs,
 * and handles backpressure by monitoring bufferedAmount.
 */

import type { WebSocket } from 'ws';
import type { ServerMessage, MarketItem, MarketDiff, FeedMode } from './protocol.js';
import { RingBuffer } from './ringBuffer.js';

interface ClientEntry {
  ws: WebSocket;
  lastSeq: number;
}

export type HelloResult =
  | { action: 'snapshot'; seq: number; data: MarketItem[] }
  | { action: 'diff'; fromSeq: number; toSeq: number; changes: MarketDiff[] }
  | { action: 'uptodate'; seq: number };

const MAX_BUFFERED_AMOUNT = 256 * 1024; // 256 KB

export class Hub {
  private clients = new Map<WebSocket, ClientEntry>();
  private ringBuffer: RingBuffer;

  constructor(ringBuffer: RingBuffer) {
    this.ringBuffer = ringBuffer;
  }

  addClient(ws: WebSocket): void {
    this.clients.set(ws, { ws, lastSeq: 0 });
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  /**
   * Determine what to send in response to a hello message.
   * Server calls this and then sends the appropriate response directly.
   */
  resolveHello(ws: WebSocket, lastSeq: number, snapshot: MarketItem[], currentSeq: number): HelloResult {
    const latestSeq = this.ringBuffer.latestSeq();

    if (lastSeq === 0 || latestSeq === 0 || lastSeq < this.ringBuffer.earliestSeq()) {
      return { action: 'snapshot', seq: currentSeq, data: snapshot };
    }

    if (lastSeq >= latestSeq) {
      return { action: 'uptodate', seq: latestSeq };
    }

    // Within window — replay merged diff
    const entries = this.ringBuffer.readRange(lastSeq);
    const merged = new Map<string, MarketDiff>();
    for (const e of entries) {
      for (const change of e.changes) {
        merged.set(change.symbol, change);
      }
    }
    const changes = Array.from(merged.values());
    return { action: 'diff', fromSeq: lastSeq, toSeq: latestSeq, changes };
  }

  fanOut(toSeq: number, fromSeq: number, changes: MarketDiff[]): void {
    if (changes.length === 0) return;
    const msg: ServerMessage = { type: 'diff', fromSeq, toSeq, changes };
    const payload = JSON.stringify(msg);

    for (const [ws, entry] of this.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        console.warn(`[hub] slow client bufferedAmount=${ws.bufferedAmount}, skipping`);
        continue;
      }
      try {
        ws.send(payload);
        entry.lastSeq = toSeq;
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  sendSnapshot(ws: WebSocket, seq: number, data: MarketItem[]): void {
    if (ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'snapshot', seq, data } satisfies ServerMessage));
      this.clients.get(ws)!.lastSeq = seq;
    } catch {
      this.clients.delete(ws);
    }
  }

  broadcastStatus(state: 'connected' | 'stale', serverTs: number): void {
    const msg: ServerMessage = { type: 'status', state, serverTs };
    const payload = JSON.stringify(msg);
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(payload); } catch { /* drop */ }
      }
    }
  }

  broadcastFeedMode(mode: FeedMode): void {
    const msg: ServerMessage = { type: 'feed_mode', mode };
    const payload = JSON.stringify(msg);
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(payload); } catch { /* drop */ }
      }
    }
  }

  broadcastSnapshot(seq: number, data: MarketItem[]): void {
    const msg: ServerMessage = { type: 'snapshot', seq, data };
    const payload = JSON.stringify(msg);
    for (const [ws, entry] of this.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      try {
        ws.send(payload);
        entry.lastSeq = seq;
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
