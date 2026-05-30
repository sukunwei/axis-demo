import { describe, it, expect } from 'vitest';
import { Aggregator } from '../aggregator.js';
import type { MarketDiff } from '../protocol.js';

describe('Aggregator — diff engine', () => {
  const make = () => {
    const emitted: Array<{ seq: number; changes: MarketDiff[] }> = [];
    const agg = new Aggregator({
      onDiff: (_seq, _from, _to, changes) => emitted.push({ seq: _to, changes }),
    });
    return { agg, emitted };
  };

  it('emits full fields on first tick (bootstrap)', () => {
    const { agg, emitted } = make();
    agg.onTick('BTC', 67000);
    agg.flush();

    expect(emitted).toHaveLength(1);
    const change = emitted[0].changes.find((c) => c.symbol === 'BTC')!;
    expect(change.price).toBe(67000);
    expect(change.dayOpen).toBe(67000);
    expect(change.dayHigh).toBe(67000);
  });

  it('only includes changed fields in subsequent diffs', () => {
    const { agg, emitted } = make();
    agg.onTick('BTC', 67000);
    agg.flush();

    agg.onTick('BTC', 67100);
    agg.flush();

    const diff = emitted[1].changes.find((c) => c.symbol === 'BTC')!;
    expect(diff.price).toBe(67100);
    expect(diff.dayHigh).toBe(67100);
    // dayLow and dayOpen didn't change — not in diff
    expect(diff).not.toHaveProperty('dayLow');
    expect(diff).not.toHaveProperty('dayOpen');
  });

  it('last-write-wins within a batch window', () => {
    const { agg, emitted } = make();
    agg.onTick('BTC', 67000);
    agg.onTick('BTC', 67100);
    agg.onTick('BTC', 67200);
    agg.flush();

    const diff = emitted[0].changes.find((c) => c.symbol === 'BTC')!;
    expect(diff.price).toBe(67200);
  });

  it('updates dayHigh when price rises, dayLow when price falls', () => {
    const { agg, emitted } = make();
    agg.onTick('ETH', 3500);
    agg.flush();

    agg.onTick('ETH', 3600);
    agg.flush();

    const d2 = emitted[1].changes.find((c) => c.symbol === 'ETH')!;
    expect(d2.price).toBe(3600);
    expect(d2.dayHigh).toBe(3600);
    expect(d2).not.toHaveProperty('dayLow');

    agg.onTick('ETH', 3400);
    agg.flush();

    const d3 = emitted[2].changes.find((c) => c.symbol === 'ETH')!;
    expect(d3.price).toBe(3400);
    expect(d3.dayLow).toBe(3400);
    expect(d3).not.toHaveProperty('dayHigh');
  });

  it('snapshot returns all current state', () => {
    const { agg } = make();
    agg.onTick('BTC', 67000);
    agg.onTick('ETH', 3500);
    agg.flush();

    const snap = agg.snapshot();
    expect(snap.length).toBe(2);
    expect(snap.find((s) => s.symbol === 'BTC')?.price).toBe(67000);
    expect(snap.find((s) => s.symbol === 'ETH')?.price).toBe(3500);
  });

  it('seq increments on each flush', () => {
    const { agg } = make();
    expect(agg.seq).toBe(0);
    agg.onTick('BTC', 67000);
    agg.flush();
    expect(agg.seq).toBe(1);
    agg.onTick('ETH', 3500);
    agg.flush();
    expect(agg.seq).toBe(2);
  });

  it('merges price tick and order book update in same flush window', () => {
    const { agg, emitted } = make();
    agg.onTick('BTC', 67000);
    agg.flush();
    emitted.length = 0;

    agg.onTick('BTC', 67100);
    agg.onOrderBook('BTC', [[67099, 1]], [[67101, 1]]);
    agg.flush();

    const diff = emitted[0].changes.find((c) => c.symbol === 'BTC')!;
    expect(diff.price).toBe(67100);
    expect(diff.bids).toEqual([[67099, 1]]);
    expect(diff.asks).toEqual([[67101, 1]]);
  });
});
