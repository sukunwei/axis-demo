import { makeAutoObservable, runInAction } from 'mobx';
import type { MarketItem, MarketDiff } from '../lib/protocol';
import { Asset } from './models/Asset';

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
}

const MAX_PRICE_HISTORY = 120;

// Delay import to avoid circular dependency with store-instances
type WsClient = { requestResync: () => void };
let _wsClient: WsClient | null = null;
export const setWsClient = (c: WsClient) => { _wsClient = c; };

export class MarketStore {
  assets = new Map<string, Asset>();
  seq = 0;
  /** Bumped on every price update — sort useMemos depend on this to re-sort */
  priceUpdateAt = 0;
  /** Cached symbols array — only recomputed when assets change */
  private _symbols: string[] = [];
  /** Rolling tick history per symbol — survives detail-page navigation */
  private priceHistories = new Map<string, PriceHistoryPoint[]>();

  constructor() {
    makeAutoObservable(this);
  }

  getAsset(symbol: string): Asset | undefined {
    return this.assets.get(symbol);
  }

  getPriceHistory(symbol: string): readonly PriceHistoryPoint[] {
    return this.priceHistories.get(symbol) ?? [];
  }

  private recordPriceTick(symbol: string, ts: number, price: number): void {
    let buf = this.priceHistories.get(symbol);
    if (!buf) {
      buf = [];
      this.priceHistories.set(symbol, buf);
    }
    const last = buf[buf.length - 1];
    if (last && last.timestamp === ts) return;
    buf.push({ timestamp: ts, price });
    if (buf.length > MAX_PRICE_HISTORY) {
      buf.splice(0, buf.length - MAX_PRICE_HISTORY);
    }
  }

  get symbols(): string[] {
    return this._symbols;
  }

  get symbolCount(): number {
    return this.assets.size;
  }

  applySnapshot(snapshot: MarketItem[]): void {
    runInAction(() => {
      this.assets.clear();
      this.priceHistories.clear();
      for (const item of snapshot) {
        const asset = new Asset(item.symbol);
        asset.fromSnapshot(item);
        this.assets.set(item.symbol, asset);
        if (item.price > 0) {
          this.recordPriceTick(item.symbol, item.ts || Date.now(), item.price);
        }
      }
      this._symbols = Array.from(this.assets.keys());
      this.seq = 0;
      this.priceUpdateAt = Date.now();
    });
  }

  applyDiffBatch(changes: MarketDiff[]): void {
    let newSymbolAdded = false;
    runInAction(() => {
      for (const diff of changes) {
        let asset = this.assets.get(diff.symbol);
        if (!asset) {
          asset = new Asset(diff.symbol);
          this.assets.set(diff.symbol, asset);
          newSymbolAdded = true;
        }
        const prevPrice = asset.price;
        asset.patch(diff);
        if (diff.price !== undefined && diff.price !== prevPrice && diff.price > 0) {
          this.recordPriceTick(diff.symbol, diff.ts ?? asset.ts ?? Date.now(), diff.price);
        }
      }
      if (newSymbolAdded) {
        this._symbols = Array.from(this.assets.keys());
      }
      this.priceUpdateAt = Date.now();
    });
  }

  setSeq(s: number): void {
    runInAction(() => {
      this.seq = s;
    });
  }

  requestResync(): void {
    _wsClient?.requestResync();
  }
}