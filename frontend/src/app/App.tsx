import { useState, useEffect } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { Watchlist } from '../components/Watchlist';
import { Portfolio } from '../components/Portfolio';
import { MarketOverview } from '../components/MarketOverview';
import { AssetDetail } from '../components/AssetDetail';
import { wsClient } from '../ws/client';
import { useStore } from '../stores/useStore';
import { marketStore } from '../stores/store-instances';

type Tab = 'watchlist' | 'portfolio';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('watchlist');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { connectionStore } = useStore();

  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  // Background resume: visibilitychange → reconnect + hello(lastSeq) if stale
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Always fire on visible; decide whether to reconnect based on state + staleness
      const state = connectionStore.connectionState;
      const msSinceMessage = Date.now() - connectionStore.lastMessageAt;
      if (state === 'reconnecting' || state === 'disconnected') {
        wsClient.connect();
      } else if (state === 'connected' && msSinceMessage > 10_000) {
        // Connected but stale (>10s since last message) — reconnect + send hello with lastSeq
        wsClient.connect();
        const lastSeq = marketStore.seq;
        wsClient.sendHello(lastSeq > 0 ? lastSeq : undefined);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connectionStore.connectionState, connectionStore.lastMessageAt]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold">axis-demo</h1>
        <ConnectionIndicator />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedSymbol ? (
            <AssetDetail symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
          ) : (
            <>
              <div className="flex items-center gap-1 px-4 pt-4">
                <button
                  onClick={() => setActiveTab('watchlist')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'watchlist'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Watchlist
                </button>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'portfolio'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Portfolio
                </button>
              </div>

              <div className="flex-1 p-4 overflow-hidden">
                {activeTab === 'watchlist' ? (
                  <Watchlist onSelectSymbol={setSelectedSymbol} />
                ) : (
                  <Portfolio onSelectSymbol={setSelectedSymbol} />
                )}
              </div>
            </>
          )}
        </main>

        <aside className="w-64 p-4 overflow-y-auto border-l border-zinc-800">
          <MarketOverview />
        </aside>
      </div>
    </div>
  );
}