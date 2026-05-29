import { makeAutoObservable, runInAction } from 'mobx';
import type { MarketItem, MarketDiff } from '../lib/protocol';
import { Asset } from './models/Asset';

// Delay import to avoid circular dependency with store-instances
type WsClient = { requestResync: () => void };
let _wsClient: WsClient | null = null;
export const setWsClient = (c: WsClient) => { _wsClient = c; };

export class MarketStore {
  assets = new Map<string, Asset>();
  seq = 0;

  constructor() {
    makeAutoObservable(this);
  }

  getAsset(symbol: string): Asset | undefined {
    return this.assets.get(symbol);
  }

  get symbols(): string[] {
    return Array.from(this.assets.keys());
  }

  get symbolCount(): number {
    return this.assets.size;
  }

  applySnapshot(snapshot: MarketItem[]): void {
    runInAction(() => {
      this.assets.clear();
      for (const item of snapshot) {
        const asset = new Asset(item.symbol);
        asset.fromSnapshot(item);
        this.assets.set(item.symbol, asset);
      }
      this.seq = 0;
    });
  }

  applyDiffBatch(changes: MarketDiff[]): void {
    runInAction(() => {
      for (const diff of changes) {
        let asset = this.assets.get(diff.symbol);
        if (!asset) {
          asset = new Asset(diff.symbol);
          this.assets.set(diff.symbol, asset);
        }
        asset.patch(diff);
      }
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