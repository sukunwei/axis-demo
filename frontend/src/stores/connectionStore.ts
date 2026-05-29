import { makeAutoObservable, runInAction } from 'mobx';

export type ConnectionState = 'connected' | 'reconnecting' | 'stale' | 'disconnected';

const STALE_THRESHOLD_MS = 5_000;

export class ConnectionStore {
  connectionState: ConnectionState = 'disconnected';
  lastMessageAt = 0;
  paused = false;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    makeAutoObservable(this);
    this.setupVisibilityHandler();
    this.startStaleCheck();
  }

  setConnected(): void {
    runInAction(() => {
      this.connectionState = 'connected';
      this.lastMessageAt = Date.now();
    });
  }

  setReconnecting(): void {
    runInAction(() => {
      this.connectionState = 'reconnecting';
    });
  }

  setStale(): void {
    runInAction(() => {
      this.connectionState = 'stale';
    });
  }

  setDisconnected(): void {
    runInAction(() => {
      this.connectionState = 'disconnected';
    });
  }

  touch(): void {
    runInAction(() => {
      this.lastMessageAt = Date.now();
      if (this.connectionState !== 'connected') {
        this.connectionState = 'connected';
      }
    });
  }

  private startStaleCheck(): void {
    this.staleTimer = setInterval(() => {
      const now = Date.now();
      if (now - this.lastMessageAt > STALE_THRESHOLD_MS && this.connectionState === 'connected' && !this.paused) {
        runInAction(() => {
          this.connectionState = 'stale';
        });
      }
    }, 1_000);
  }

  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        runInAction(() => {
          this.paused = false;
        });
      } else {
        runInAction(() => {
          this.paused = true;
        });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private teardownVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  dispose(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
    this.teardownVisibilityHandler();
  }
}
