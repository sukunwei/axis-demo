import { ConnectionStore } from './connectionStore';
import { MarketStore } from './marketStore';
import { PortfolioStore } from './portfolioStore';
import { ThemeStore } from './themeStore';
import { SettingsStore } from './settingsStore';
import { PerfStore } from './perfStore';
import { NewsStore } from './newsStore';

export const connectionStore = new ConnectionStore();
export const marketStore = new MarketStore();
export const portfolioStore = new PortfolioStore(marketStore);
export const themeStore = new ThemeStore();
export const settingsStore = new SettingsStore();
export const perfStore = new PerfStore();
export const newsStore = new NewsStore();

// wsClient self-injects via setWsClient(wsClient) at bottom of client.ts
// after both modules are initialized — no placeholder needed here

export const stores = {
  connectionStore,
  marketStore,
  portfolioStore,
  themeStore,
  settingsStore,
  perfStore,
  newsStore,
};