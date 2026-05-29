import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../ringBuffer.js';
import type { MarketDiff } from '../protocol.js';

const diff = (symbol: string, price: number): MarketDiff => ({ symbol, price });

describe('RingBuffer', () => {
  it('starts empty with seq 0', () => {
    const rb = new RingBuffer(3);
    expect(rb.latestSeq()).toBe(0);
    expect(rb.earliestSeq()).toBe(0);
  });

  it('pushes entries and advances seq', () => {
    const rb = new RingBuffer(10);
    rb.push(1, [diff('A', 100)]);
    rb.push(2, [diff('B', 200)]);
    expect(rb.latestSeq()).toBe(2);
    expect(rb.earliestSeq()).toBe(1);
  });

  it('wraps around when capacity is exceeded', () => {
    const rb = new RingBuffer(3);
    rb.push(1, [diff('A', 100)]);
    rb.push(2, [diff('B', 200)]);
    rb.push(3, [diff('C', 300)]);
    expect(rb.latestSeq()).toBe(3);
    expect(rb.earliestSeq()).toBe(1);

    // 4th push evicts seq 1
    rb.push(4, [diff('D', 400)]);
    expect(rb.latestSeq()).toBe(4);
    expect(rb.earliestSeq()).toBe(2);
    // seq 1 was evicted, but seqs 2,3,4 remain → readRange(1) returns 3 entries
    expect(rb.readRange(1).length).toBe(3);
  });

  it('readRange returns entries with seq > fromSeq', () => {
    const rb = new RingBuffer(10);
    rb.push(1, [diff('A', 100)]);
    rb.push(2, [diff('B', 200)]);
    rb.push(3, [diff('C', 300)]);

    const entries = rb.readRange(1);
    expect(entries.length).toBe(2);
    expect(entries[0].seq).toBe(2);
    expect(entries[1].seq).toBe(3);
  });

  it('readRange returns empty when fromSeq >= latestSeq', () => {
    const rb = new RingBuffer(10);
    rb.push(1, [diff('A', 100)]);
    rb.push(2, [diff('B', 200)]);
    expect(rb.readRange(2)).toEqual([]);
    expect(rb.readRange(5)).toEqual([]);
  });

  it('isInWindow detects seq within buffer range', () => {
    const rb = new RingBuffer(5);
    for (let i = 1; i <= 5; i++) rb.push(i, [diff(String(i), i * 10)]);
    expect(rb.isInWindow(2)).toBe(true);
    expect(rb.isInWindow(1)).toBe(false); // earliest
    expect(rb.isInWindow(6)).toBe(false); // beyond latest
  });

  it('clear resets buffer', () => {
    const rb = new RingBuffer(3);
    rb.push(1, [diff('A', 100)]);
    rb.push(2, [diff('B', 200)]);
    rb.clear();
    expect(rb.latestSeq()).toBe(0);
    expect(rb.readRange(0)).toEqual([]);
  });
});
