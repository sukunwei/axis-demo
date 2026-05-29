/**
 * Hyperliquid WebSocket feed adapter.
 * Connects to wss://api.hyperliquid.xyz/ws, subscribes to `allMids`,
 * and emits onUpdate(symbol, price) for each price change.
 *
 * allMids keys ARE symbol names (e.g. "BTC", "ETH") — no mapping needed.
 */

import { WebSocket } from 'ws';

export type TickHandler = (symbol: string, price: number) => void;

export class HyperliquidFeed {
  private ws: WebSocket | null = null;
  private onUpdate: TickHandler;
  private reconnectDelay = 1_000;
  private maxDelay = 30_000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(onUpdate: TickHandler) {
    this.onUpdate = onUpdate;
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
        const msg = JSON.parse(raw.toString()) as {
          channel?: string;
          data?: { mids?: Record<string, string> };
        };
        if (msg.channel === 'allMids' && msg.data?.mids) {
          for (const [symbol, price] of Object.entries(msg.data.mids)) {
            this.onUpdate(symbol, parseFloat(price));
          }
        }
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
}
