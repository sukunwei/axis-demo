/**
 * Hyperliquid WebSocket feed adapter.
 * Connects to wss://api.hyperliquid.xyz/ws, subscribes to `allMids`,
 * and emits onUpdate(symbol, price) for each price change.
 * Also subscribes to `l2Book` for per-symbol order book depth.
 *
 * allMids keys ARE symbol names (e.g. "BTC", "ETH") — no mapping needed.
 */

import { WebSocket } from 'ws';

export type TickHandler = (symbol: string, price: number) => void;
export type OrderBookHandler = (symbol: string, bids: [number, number][], asks: [number, number][]) => void;

interface L2BookData {
  coin: string;
  levels: [L2Level[], L2Level[]];
}

interface L2Level {
  px: string;
  sz: string;
  n?: number;
}

export class HyperliquidFeed {
  private ws: WebSocket | null = null;
  private onUpdate: TickHandler;
  private onOrderBook: OrderBookHandler;
  private reconnectDelay = 1_000;
  private maxDelay = 30_000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(onUpdate: TickHandler, onOrderBook: OrderBookHandler) {
    this.onUpdate = onUpdate;
    this.onOrderBook = onOrderBook;
  }

  async start(): Promise<void> {
    this.shouldReconnect = true;
    this.connect();
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  /** Returns a promise that resolves when the WebSocket is open */
  waitForOpen(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => clearInterval(check), 10_000);
    });
  }

  private connect(): void {
    if (!this.shouldReconnect) return;

    this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    this.ws.on('open', () => {
      console.log('[hl] connected');
      this._connected = true;
      this.reconnectDelay = 1_000;
      this.ws!.send(
        JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }),
      );
    });

    this.ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        this.handleMessage(msg);
      } catch (err) {
        console.error('[hl] parse error', err);
      }
    });

    this.ws.on('error', (err) => console.error('[hl] ws error', err));

    this.ws.on('close', () => {
      this._connected = false;
      console.log('[hl] disconnected');
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
          this.connect();
        }, this.reconnectDelay);
      }
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // allMids channel — mark prices
    if (msg.channel === 'allMids' && typeof msg.data === 'object' && msg.data !== null) {
      const data = msg.data as { mids?: Record<string, string> };
      if (data.mids) {
        for (const [symbol, price] of Object.entries(data.mids)) {
          this.onUpdate(symbol, parseFloat(price));
        }
      }
      return;
    }

    // l2Book channel — order book depth
    if (msg.channel === 'l2Book' && typeof msg.data === 'object' && msg.data !== null) {
      const data = msg.data as L2BookData;
      const coin: string = data.coin;
      const levels: [L2Level[], L2Level[]] = data.levels;

      const bids: [number, number][] = levels[0].slice(0, 8).map(l => [parseFloat(l.px), parseFloat(l.sz)]);
      const asks: [number, number][] = levels[1].slice(0, 8).map(l => [parseFloat(l.px), parseFloat(l.sz)]);

      this.onOrderBook(coin, bids, asks);
    }
  }

  /** Subscribe to order book for a specific symbol (e.g. 'BTC-PERP') */
  subscribeOrderBook(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin: symbol } });
      console.log('[hl] subscribing l2Book:', symbol, '→', msg);
      this.ws.send(msg);
    }
  }

  /** Unsubscribe from order book for a specific symbol */
  unsubscribeOrderBook(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ method: 'unsubscribe', subscription: { type: 'l2Book', coin: symbol } }),
      );
    }
  }
}
