import type { MarketDiff } from './protocol.js';

export interface RingEntry {
  seq: number;
  changes: MarketDiff[]; // each flush writes an array of diffs
  ts: number;
}

/**
 * Fixed-capacity ring buffer storing seq→diffs entries.
 * readRange(fromSeq) merges all diffs in the range (last-write-wins per symbol).
 */
export class RingBuffer {
  private buf: RingEntry[] = [];
  private capacity: number;

  constructor(capacity = 20_000) {
    this.capacity = capacity;
  }

  push(seq: number, changes: MarketDiff[]): void {
    if (this.buf.length >= this.capacity) {
      this.buf.shift();
    }
    this.buf.push({ seq, changes, ts: Date.now() });
  }

  /**
   * Returns all entries with seq > fromSeq.
   */
  readRange(fromSeq: number): RingEntry[] {
    if (fromSeq >= this.latestSeq()) return [];
    return this.buf.filter((e) => e.seq > fromSeq);
  }

  latestSeq(): number {
    return this.buf.length === 0 ? 0 : this.buf[this.buf.length - 1].seq;
  }

  earliestSeq(): number {
    return this.buf.length === 0 ? 0 : this.buf[0].seq;
  }

  isInWindow(seq: number): boolean {
    return seq > this.earliestSeq() && seq < this.latestSeq();
  }

  clear(): void {
    this.buf = [];
  }
}
