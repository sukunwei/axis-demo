import { makeAutoObservable } from 'mobx';
import type { MarketDiff, MarketItem } from '../../lib/protocol';

/**
 * Asset — MobX observable model for a single market symbol.
 *
 * prevPrice is internal only (for direction detection in PriceTicker).
 * It is NOT part of the network protocol (MarketItem / MarketDiff).
 */
export class Asset {
  symbol: string;
  price = 0;
  prevPrice = 0; // internal: price before last tick — used for direction flash
  dayOpen = 0;
  dayHigh = 0;
  dayLow = 0;
  volume24h = 0;
  changePercent = 0;
  ts = 0;
  bids: [number, number][] = [];
  asks: [number, number][] = [];

  constructor(symbol: string) {
    makeAutoObservable(this);
    this.symbol = symbol;
  }

  /** Apply a MarketDiff (only changed fields) */
  patch(diff: MarketDiff): void {
    if (diff.price !== undefined && diff.price !== this.price) {
      this.prevPrice = this.price;
      this.price = diff.price;
    }
    if (diff.dayOpen !== undefined) this.dayOpen = diff.dayOpen;
    if (diff.dayHigh !== undefined) this.dayHigh = diff.dayHigh;
    if (diff.dayLow !== undefined) this.dayLow = diff.dayLow;
    if (diff.volume24h !== undefined) this.volume24h = diff.volume24h;
    if (diff.changePercent !== undefined) this.changePercent = diff.changePercent;
    if (diff.ts !== undefined) this.ts = diff.ts;
    if (diff.bids !== undefined) this.bids = diff.bids;
    if (diff.asks !== undefined) this.asks = diff.asks;
  }

  /** Bootstrap from a full MarketItem snapshot */
  fromSnapshot(item: MarketItem): void {
    this.price = item.price;
    this.prevPrice = item.price;
    this.dayOpen = item.dayOpen;
    this.dayHigh = item.dayHigh;
    this.dayLow = item.dayLow;
    this.volume24h = item.volume24h;
    this.changePercent = item.changePercent;
    this.ts = item.ts;
    this.bids = item.bids ?? [];
    this.asks = item.asks ?? [];
  }

  get direction(): 'up' | 'down' | 'flat' {
    if (this.price > this.prevPrice) return 'up';
    if (this.price < this.prevPrice) return 'down';
    return 'flat';
  }
}
