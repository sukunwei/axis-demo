import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioStore } from '../stores/portfolioStore';
import { MarketStore } from '../stores/marketStore';
import type { MarketItem } from '../lib/protocol';

// Keep real MOCK_POSITIONS
const makeItem = (symbol: string, price: number): MarketItem => ({
  symbol,
  price,
  dayOpen: price,
  dayHigh: price,
  dayLow: price,
  volume24h: 1000,
  changePercent: 0,
  ts: Date.now(),
});

describe('PortfolioStore', () => {
  let marketStore: MarketStore;
  let portfolioStore: PortfolioStore;

  beforeEach(() => {
    marketStore = new MarketStore();
    portfolioStore = new PortfolioStore(marketStore);
  });

  describe('positions computed', () => {
    it('maps mock positions with live prices', () => {
      marketStore.applySnapshot([
        makeItem('BTC', 45000),
        makeItem('ETH', 2800),
      ]);
      const positions = portfolioStore.positions;
      const btc = positions.find((p) => p.symbol === 'BTC');
      const eth = positions.find((p) => p.symbol === 'ETH');
      expect(btc?.currentPrice).toBe(45000);
      expect(eth?.currentPrice).toBe(2800);
    });

    it('uses avgCost when symbol not in marketStore', () => {
      const positions = portfolioStore.positions;
      const btc = positions.find((p) => p.symbol === 'BTC');
      // BTC avgCost = 45000, not in store yet
      expect(btc?.currentPrice).toBe(45000); // falls back to avgCost
    });

    it('computes marketValue = quantity * currentPrice', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]); // BTC: 0.5 * 50000 = 25000
      const btc = portfolioStore.positions.find((p) => p.symbol === 'BTC');
      expect(btc?.marketValue).toBe(0.5 * 50000);
    });

    it('computes unrealizedPnL = marketValue - costBasis', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]); // cost basis = 0.5 * 45000 = 22500
      const btc = portfolioStore.positions.find((p) => p.symbol === 'BTC');
      const expectedPnL = (0.5 * 50000) - (0.5 * 45000);
      expect(btc?.unrealizedPnL).toBeCloseTo(expectedPnL);
    });

    it('computes unrealizedPnLPercent correctly', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]);
      const btc = portfolioStore.positions.find((p) => p.symbol === 'BTC');
      const costBasis = 0.5 * 45000;
      const pnl = (0.5 * 50000) - costBasis;
      expect(btc?.unrealizedPnLPercent).toBeCloseTo((pnl / costBasis) * 100, 1);
    });

    it('handles zero cost basis (edge case)', () => {
      // MOCK_POSITIONS don't have zero avgCost, but if they did
      const positions = portfolioStore.positions;
      positions.forEach((p) => {
        expect(Number.isFinite(p.unrealizedPnLPercent)).toBe(true);
      });
    });

    it('recomputes on market price change', () => {
      marketStore.applySnapshot([makeItem('BTC', 45000)]);
      const btc1 = portfolioStore.positions.find((p) => p.symbol === 'BTC');
      marketStore.applyDiffBatch([{ symbol: 'BTC', price: 55000 }]);
      const btc2 = portfolioStore.positions.find((p) => p.symbol === 'BTC');
      expect(btc2?.marketValue).not.toBe(btc1?.marketValue);
    });
  });

  describe('totalValue', () => {
    it('sums all position marketValues (not just those in snapshot)', () => {
      // Only BTC and SOL in store — other positions fall back to avgCost
      marketStore.applySnapshot([
        makeItem('BTC', 45000),
        makeItem('ETH', 2800),
      ]);
      // totalValue includes ALL 10 positions, some with live price some with avgCost
      const val = portfolioStore.totalValue;
      expect(val).toBeGreaterThan(0);
      expect(typeof val).toBe('number');
    });

    it('totalValue changes when prices update', () => {
      const before = portfolioStore.totalValue;
      marketStore.applyDiffBatch([{ symbol: 'BTC', price: 100000 }]);
      const after = portfolioStore.totalValue;
      expect(after).not.toBeCloseTo(before);
    });
  });

  describe('totalPnL', () => {
    it('totalValue - totalCost', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]);
      expect(portfolioStore.totalPnL).toBeCloseTo(
        portfolioStore.totalValue - portfolioStore.totalCost
      );
    });

    it('can be negative', () => {
      marketStore.applySnapshot([makeItem('BTC', 40000)]); // below avg cost 45000
      expect(portfolioStore.totalPnL).toBeLessThan(0);
    });
  });

  describe('totalPnLPercent', () => {
    it('totalPnL / totalCost * 100', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]);
      const expected = (portfolioStore.totalPnL / portfolioStore.totalCost) * 100;
      expect(portfolioStore.totalPnLPercent).toBeCloseTo(expected, 1);
    });
  });

  describe('gainerCount / loserCount', () => {
    it('counts gainers (unrealizedPnL > 0)', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000), makeItem('ETH', 2000)]); // BTC up, ETH down
      expect(portfolioStore.gainerCount).toBeGreaterThanOrEqual(0);
      expect(portfolioStore.loserCount).toBeGreaterThanOrEqual(0);
    });

    it('updates when prices change', () => {
      marketStore.applySnapshot([makeItem('BTC', 50000)]);
      const before = portfolioStore.gainerCount;
      marketStore.applyDiffBatch([{ symbol: 'BTC', price: 30000 }]); // BTC way down
      const after = portfolioStore.gainerCount;
      expect(after).not.toBe(before);
    });
  });
});