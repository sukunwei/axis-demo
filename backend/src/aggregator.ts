/**
 * In-memory state aggregator with field-level diff engine.
 *
 * - Maintains Map<symbol, MarketItem> as the current state
 * - onTick() applies an incoming price tick and computes a field-diff
 *   (only changed fields relative to last sent state → MarketDiff)
 * - Diffs are accumulated in pendingBatch (last-write-wins per symbol)
 * - flush() is called by a timer; it emits a merged diff, bumps seq, and
 *   writes the entry to ringBuffer
 */

import type { MarketItem, MarketDiff } from './protocol.js';
import { RingBuffer } from './ringBuffer.js';

export type DiffHandler = (
  seq: number,
  fromSeq: number,
  toSeq: number,
  changes: MarketDiff[],
) => void;

export class Aggregator {
  private state = new Map<string, MarketItem>();
  private lastSent = new Map<string, MarketItem>();
  private pendingBatch = new Map<string, MarketDiff>();
  private _seq = 0;
  private flushMs: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private onDiff: DiffHandler;
  private ringBuffer: RingBuffer;
  private _lastTickAt = Date.now();

  constructor(opts: {
    flushMs?: number;
    ringBuffer?: RingBuffer;
    onDiff: DiffHandler;
  }) {
    this.flushMs = opts.flushMs ?? 75;
    this.ringBuffer = opts.ringBuffer ?? new RingBuffer();
    this.onDiff = opts.onDiff;
  }

  onTick(symbol: string, price: number): void {
    const now = Date.now();
    this._lastTickAt = now;
    const prev = this.state.get(symbol);

    if (!prev) {
      const item: MarketItem = {
        symbol,
        price,
        dayOpen: price,
        dayHigh: price,
        dayLow: price,
        volume24h: 0,
        changePercent: 0,
        ts: now,
      };
      this.state.set(symbol, item);
      this.lastSent.set(symbol, { ...item });
      this.addDiff({
        symbol,
        price,
        dayOpen: price,
        dayHigh: price,
        dayLow: price,
        ts: now,
      });
      return;
    }

    const dayHigh = Math.max(prev.dayHigh, price);
    const dayLow = prev.dayLow === 0 ? price : Math.min(prev.dayLow, price);
    const dayOpen = prev.dayOpen;
    const changePercent = dayOpen ? ((price - dayOpen) / dayOpen) * 100 : 0;

    const updated: MarketItem = {
      ...prev,
      price,
      dayHigh,
      dayLow,
      changePercent,
      ts: now,
    };

    this.state.set(symbol, updated);

    const diff = this.computeDiff(symbol, updated);
    if (diff) this.addDiff(diff);
  }

  /** Update order book depth for a symbol */
  onOrderBook(symbol: string, bids: [number, number][], asks: [number, number][]): void {
    const prev = this.state.get(symbol);
    if (!prev) return; // no price data yet, skip

    const updated: MarketItem = {
      ...prev,
      bids,
      asks,
      ts: Date.now(),
    };

    this.state.set(symbol, updated);

    const diff = this.computeOrderBookDiff(symbol, updated);
    if (diff) this.addDiff(diff);
  }

  private computeDiff(symbol: string, updated: MarketItem): MarketDiff | null {
    const last = this.lastSent.get(symbol);
    if (!last) return { symbol, price: updated.price, dayOpen: updated.dayOpen, dayHigh: updated.dayHigh, dayLow: updated.dayLow };

    const diff: MarketDiff = { symbol };
    let hasChanges = false;

    if (updated.price !== last.price) { diff.price = updated.price; hasChanges = true; }
    if (updated.dayHigh !== last.dayHigh) { diff.dayHigh = updated.dayHigh; hasChanges = true; }
    if (updated.dayLow !== last.dayLow) { diff.dayLow = updated.dayLow; hasChanges = true; }
    if (updated.changePercent !== last.changePercent) { diff.changePercent = updated.changePercent; hasChanges = true; }
    if (updated.volume24h !== last.volume24h) { diff.volume24h = updated.volume24h; hasChanges = true; }
    if (updated.ts !== last.ts) { diff.ts = updated.ts; hasChanges = true; }
    if (updated.bids !== last.bids) { diff.bids = updated.bids; hasChanges = true; }
    if (updated.asks !== last.asks) { diff.asks = updated.asks; hasChanges = true; }

    return hasChanges ? diff : null;
  }

  private computeOrderBookDiff(symbol: string, updated: MarketItem): MarketDiff | null {
    const last = this.lastSent.get(symbol);
    if (!last) return null;

    const diff: MarketDiff = { symbol };
    let hasChanges = false;

    if (JSON.stringify(updated.bids) !== JSON.stringify(last.bids)) { diff.bids = updated.bids; hasChanges = true; }
    if (JSON.stringify(updated.asks) !== JSON.stringify(last.asks)) { diff.asks = updated.asks; hasChanges = true; }
    if (updated.ts !== last.ts) { diff.ts = updated.ts; hasChanges = true; }

    return hasChanges ? diff : null;
  }

  private addDiff(diff: MarketDiff): void {
    const existing = this.pendingBatch.get(diff.symbol);
    // Merge per symbol within flush window — onTick then onOrderBook must not drop price
    this.pendingBatch.set(
      diff.symbol,
      existing ? { ...existing, ...diff, symbol: diff.symbol } : diff,
    );
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), this.flushMs);
  }

  /** Force an immediate flush — used during bootstrap */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pendingBatch.size === 0) return;

    const fromSeq = this._seq;
    this._seq++;
    const toSeq = this._seq;
    const changes = Array.from(this.pendingBatch.values());

    for (const diff of changes) {
      const current = this.state.get(diff.symbol);
      if (current) this.lastSent.set(diff.symbol, { ...current });
    }

    this.pendingBatch.clear();
    this.ringBuffer.push(toSeq, changes);
    this.onDiff(toSeq, fromSeq, toSeq, changes);
  }

  /** Bootstrap all symbols at once and flush to populate ring buffer before first client connects */
  bootstrap(symbols: Array<{ symbol: string; price: number }>): void {
    for (const { symbol, price } of symbols) {
      this.onTick(symbol, price);
    }
    this.flush();
  }

  /** Reset state — called when switching feed to prevent stale symbols persisting */
  reset(): void {
    this.state.clear();
    this.lastSent.clear();
    this.pendingBatch.clear();
    this._seq = 0;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  snapshot(): MarketItem[] {
    return Array.from(this.state.values());
  }

  get seq(): number {
    return this._seq;
  }

  get lastTickAt(): number {
    return this._lastTickAt;
  }
}
