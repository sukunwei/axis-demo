import { ConnectionStore } from './connectionStore';
import { MarketStore, setWsClient } from './marketStore';
import { PortfolioStore } from './portfolioStore';

export const connectionStore = new ConnectionStore();
export const marketStore = new MarketStore();
export const portfolioStore = new PortfolioStore(marketStore);

// Wire marketStore → wsClient (after both are created to avoid circular import)
setWsClient({ requestResync: () => {} }); // placeholder until ws client is ready

export const stores = {
  connectionStore,
  marketStore,
  portfolioStore,
};