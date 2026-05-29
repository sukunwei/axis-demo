import type { ClientMessage, ServerMessage } from '../lib/protocol';
import { connectionStore, marketStore } from '../stores/store-instances';
import { frameScheduler } from './frameScheduler';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

class WsClient {
  private ws: WebSocket | null = null;
  private retryDelay = 1_000;
  private maxDelay = 30_000;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers = new Set<(msg: ServerMessage) => void>();

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;
    this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearPing();
    this.ws?.close();
    this.ws = null;
    frameScheduler.dispose();
  }

  /** Force a full resync: send hello with lastSeq=0 to get snapshot */
  requestResync(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'hello', lastSeq: undefined });
    }
  }

  /** Send hello with explicit lastSeq (for background resume with known seq) */
  sendHello(lastSeq?: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'hello', lastSeq });
    }
  }

  private open(): void {
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.retryDelay = 1_000;
      connectionStore.setConnected();
      this.startPing();
      const lastSeq = marketStore.seq;
      this.send({ type: 'hello', lastSeq: lastSeq > 0 ? lastSeq : undefined });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      connectionStore.touch();

      if (msg.type === 'pong') return;

      if (msg.type === 'status') {
        if (msg.state === 'stale') connectionStore.setStale();
        else connectionStore.setConnected();
        return;
      }

      frameScheduler.enqueue(msg);

      for (const h of this.messageHandlers) h(msg);
    };

    this.ws.onerror = () => {};

    this.ws.onclose = () => {
      this.clearPing();
      if (this.shouldReconnect) {
        connectionStore.setReconnecting();
        this.scheduleReconnect();
      } else {
        connectionStore.setDisconnected();
      }
    };
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      if (this.shouldReconnect) this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, this.maxDelay);
  }

  private startPing(): void {
    this.clearPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', ts: Date.now() });
      }
    }, 15_000);
  }

  private clearPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  offMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandlers.delete(handler);
  }
}

export const wsClient = new WsClient();