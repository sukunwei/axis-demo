import { describe, it, expect, beforeEach } from 'vitest';
import { MarketStore } from '../stores/marketStore';
import type { MarketItem, MarketDiff } from '../lib/protocol';

const makeItem = (symbol: string, price: number, overrides: Partial<MarketItem> = {}): MarketItem => ({
  symbol,
  price,
  dayOpen: price,
  dayHigh: price,
  dayLow: price,
  volume24h: 1000,
  changePercent: 0,
  ts: Date.now(),
  ...overrides,
});

describe('MarketStore', () => {
  let store: MarketStore;

  beforeEach(() => {
    store = new MarketStore();
  });

  describe('applySnapshot', () => {
    it('populates assets from snapshot', () => {
      const items: MarketItem[] = [
        makeItem('BTC', 45000),
        makeItem('ETH', 2800),
      ];
      store.applySnapshot(items);
      expect(store.symbols).toContain('BTC');
      expect(store.symbols).toContain('ETH');
      expect(store.symbolCount).toBe(2);
    });

    it('resets seq to 0', () => {
      store.setSeq(999);
      store.applySnapshot([makeItem('BTC', 45000)]);
      expect(store.seq).toBe(0);
    });

    it('overwrites existing assets', () => {
      store.applySnapshot([makeItem('BTC', 40000)]);
      store.applySnapshot([makeItem('BTC', 50000)]);
      expect(store.getAsset('BTC')?.price).toBe(50000);
    });
  });

  describe('applyDiffBatch', () => {
    it('applies price change to existing asset', () => {
      store.applySnapshot([makeItem('BTC', 45000)]);
      store.applyDiffBatch([{ symbol: 'BTC', price: 46000 }]);
      expect(store.getAsset('BTC')?.price).toBe(46000);
    });

    it('creates new asset if not found', () => {
      store.applyDiffBatch([{ symbol: 'NEW', price: 123 }]);
      expect(store.getAsset('NEW')?.price).toBe(123);
    });

    it('updates prevPrice on price change', () => {
      store.applySnapshot([makeItem('BTC', 45000)]);
      store.applyDiffBatch([{ symbol: 'BTC', price: 46000 }]);
      expect(store.getAsset('BTC')?.prevPrice).toBe(45000);
      expect(store.getAsset('BTC')?.price).toBe(46000);
    });

    it('applies partial diff (only price field)', () => {
      store.applySnapshot([makeItem('BTC', 45000, { dayHigh: 46000, dayLow: 44000 })]);
      store.applyDiffBatch([{ symbol: 'BTC', price: 45500 }]);
      // dayHigh and dayLow should be unchanged
      expect(store.getAsset('BTC')?.dayHigh).toBe(46000);
      expect(store.getAsset('BTC')?.dayLow).toBe(44000);
      expect(store.getAsset('BTC')?.price).toBe(45500);
    });

    it('applies multiple diffs in one batch', () => {
      store.applySnapshot([
        makeItem('BTC', 45000),
        makeItem('ETH', 2800),
      ]);
      const changes: MarketDiff[] = [
        { symbol: 'BTC', price: 46000 },
        { symbol: 'ETH', price: 2900 },
      ];
      store.applyDiffBatch(changes);
      expect(store.getAsset('BTC')?.price).toBe(46000);
      expect(store.getAsset('ETH')?.price).toBe(2900);
    });

    it('handles price of 0 without crashing', () => {
      store.applySnapshot([makeItem('BTC', 45000)]);
      store.applyDiffBatch([{ symbol: 'BTC', price: 0 }]);
      expect(store.getAsset('BTC')?.price).toBe(0);
    });

    it('last-write-wins when same symbol appears twice in batch', () => {
      store.applySnapshot([makeItem('BTC', 45000)]);
      const changes: MarketDiff[] = [
        { symbol: 'BTC', price: 46000 },
        { symbol: 'BTC', price: 47000 },
      ];
      store.applyDiffBatch(changes);
      // Last write wins
      expect(store.getAsset('BTC')?.price).toBe(47000);
    });
  });

  describe('setSeq', () => {
    it('updates seq', () => {
      store.setSeq(42);
      expect(store.seq).toBe(42);
    });
  });

  describe('getAsset', () => {
    it('returns undefined for missing symbol', () => {
      expect(store.getAsset('MISSING')).toBeUndefined();
    });

    it('returns asset for existing symbol', () => {
      store.applySnapshot([makeItem('BTC', 45000)]);
      expect(store.getAsset('BTC')).toBeDefined();
      expect(store.getAsset('BTC')?.symbol).toBe('BTC');
    });
  });
});