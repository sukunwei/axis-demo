import { ConnectionStore } from './connectionStore';
import { MarketStore, setWsClient } from './marketStore';
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

// Wire marketStore → wsClient (after both are created to avoid circular import)
setWsClient({ requestResync: () => {} }); // placeholder until ws client is ready

export const stores = {
  connectionStore,
  marketStore,
  portfolioStore,
  themeStore,
  settingsStore,
  perfStore,
  newsStore,
};