import { makeAutoObservable } from 'mobx';
import { MarketStore } from './marketStore';

interface MockPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
}

const MOCK_POSITIONS: MockPosition[] = [
  { symbol: 'BTC', quantity: 0.5, avgCost: 45_000 },
  { symbol: 'ETH', quantity: 5, avgCost: 2_800 },
  { symbol: 'SOL', quantity: 100, avgCost: 95 },
  { symbol: 'ARB', quantity: 1_000, avgCost: 1.2 },
  { symbol: 'MATIC', quantity: 5_000, avgCost: 0.85 },
  { symbol: 'AVAX', quantity: 50, avgCost: 35 },
  { symbol: 'OP', quantity: 500, avgCost: 2.5 },
  { symbol: 'LINK', quantity: 200, avgCost: 14 },
  { symbol: 'UNI', quantity: 300, avgCost: 6.5 },
  { symbol: 'DOGE', quantity: 10_000, avgCost: 0.08 },
];

export interface PositionRow {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export class PortfolioStore {
  private marketStore: MarketStore;

  constructor(marketStore: MarketStore) {
    this.marketStore = marketStore;
    makeAutoObservable(this);
  }

  /** True once real market data has arrived (priceUpdateAt > 0) */
  get hasMarketData(): boolean {
    return this.marketStore.priceUpdateAt > 0;
  }

  /** Static holdings (symbol/qty/cost) — stable reference for list sort keys */
  get positionBasis(): readonly MockPosition[] {
    return MOCK_POSITIONS;
  }

  get positions(): PositionRow[] {
    return MOCK_POSITIONS.map((pos) => {
      const asset = this.marketStore.getAsset(pos.symbol);
      const currentPrice = asset?.price ?? pos.avgCost;
      const marketValue = pos.quantity * currentPrice;
      const costBasis = pos.quantity * pos.avgCost;
      const unrealizedPnL = marketValue - costBasis;
      const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

      return {
        symbol: pos.symbol,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        currentPrice,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent,
      };
    });
  }

  get totalValue(): number {
    return this.positions.reduce((sum, p) => sum + p.marketValue, 0);
  }

  get totalCost(): number {
    return MOCK_POSITIONS.reduce((sum, p) => sum + p.quantity * p.avgCost, 0);
  }

  get totalPnL(): number {
    return this.totalValue - this.totalCost;
  }

  get totalPnLPercent(): number {
    return this.totalCost > 0 ? (this.totalPnL / this.totalCost) * 100 : 0;
  }

  get gainerCount(): number {
    return this.positions.filter((p) => p.unrealizedPnL > 0).length;
  }

  get loserCount(): number {
    return this.positions.filter((p) => p.unrealizedPnL < 0).length;
  }
}
