export interface MarketData {
  symbol: string;
  price: number;
  prevPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  changePercent: number;
  lastUpdate: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'stale';

export interface WebSocketMessage {
  type: 'batch' | 'snapshot' | 'connection_state';
  seq?: number;
  data?: MarketData[];
  state?: ConnectionState;
  timestamp: number;
}
