import { makeAutoObservable, runInAction } from 'mobx';
import type { FeedMode } from '../lib/protocol';

const MOCK_KEY = 'axis-mock-data';

export class SettingsStore {
  settingsOpen = false;
  /** UI preference: mock feed on/off (default off = Hyperliquid). */
  mockDataEnabled = false;
  /** Last known server feed mode (synced from WS). */
  serverFeedMode: FeedMode = 'mock';

  constructor() {
    const mockStored = localStorage.getItem(MOCK_KEY);
    if (mockStored === 'true') this.mockDataEnabled = true;
    makeAutoObservable(this);
  }

  openSettings(): void {
    runInAction(() => {
      this.settingsOpen = true;
    });
  }

  closeSettings(): void {
    runInAction(() => {
      this.settingsOpen = false;
    });
  }

  syncFeedMode(mode: FeedMode): void {
    runInAction(() => {
      this.serverFeedMode = mode;
    });
  }

  setMockDataEnabled(enabled: boolean, onApply?: (mode: FeedMode) => void): void {
    runInAction(() => {
      this.mockDataEnabled = enabled;
      localStorage.setItem(MOCK_KEY, String(enabled));
    });
    const mode: FeedMode = enabled ? 'mock' : 'hyperliquid';
    onApply?.(mode);
  }
}
