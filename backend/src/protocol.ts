// Shared WebSocket protocol types — SSOT in docs/api-protocol.md

export type FeedMode = 'mock' | 'hyperliquid';

export interface MarketItem {
  symbol: string;
  price: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  changePercent: number; // (price - dayOpen) / dayOpen * 100
  ts: number;           // server-side last update time (ms)
  bids?: [number, number][]; // [price, size] top 10 bids
  asks?: [number, number][]; // [price, size] top 10 asks
}

// diff: only changed fields, symbol is always present
export type MarketDiff = { symbol: string } & Partial<Omit<MarketItem, 'symbol'>>;

// Client → Server
export type ClientMessage =
  | { type: 'hello'; lastSeq?: number }
  | { type: 'ping'; ts: number }
  | { type: 'set_feed_mode'; mode: FeedMode }
  | { type: 'subscribe_orderbook'; symbol: string }
  | { type: 'unsubscribe_orderbook'; symbol: string };

// Server → Client
export type ServerMessage =
  | { type: 'snapshot'; seq: number; data: MarketItem[] }
  | { type: 'diff'; fromSeq: number; toSeq: number; changes: MarketDiff[] }
  | { type: 'pong'; ts: number }
  | { type: 'status'; state: 'connected' | 'stale'; serverTs: number }
  | { type: 'feed_mode'; mode: FeedMode }
  | { type: 'error'; code: string; message: string };
