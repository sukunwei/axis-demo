import { useState, useEffect, useCallback, Component, type ReactNode, lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { SettingsButton } from '../components/SettingsButton';
import { SettingsModal } from '../components/SettingsModal';
import { Watchlist } from '../components/Watchlist';
import { Portfolio } from '../components/Portfolio';
import { MarketOverview } from '../components/MarketOverview';
import { AssetDetail } from '../components/AssetDetail';
import { wsClient } from '../ws/client';
import { useStore } from '../stores/useStore';
import { marketStore } from '../stores/store-instances';
import { useRenderCounter } from '../hooks/useRenderCounter';

const NewsTab = lazy(() => import('../components/NewsTab').then((m) => ({ default: m.NewsTab })));

type Tab = 'watchlist' | 'portfolio' | 'news';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64 text-red-400">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">Something went wrong</div>
            <div className="text-sm text-zinc-500">{this.state.error?.message}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-100 rounded-lg text-sm hover:bg-zinc-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Tab buttons — pure React, no MobX, stable re-renders */
function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 pt-4">
      {(['watchlist', 'portfolio', 'news'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === tab
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}

const AppContent = observer(function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('watchlist');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { connectionStore } = useStore();

  useRenderCounter();

  const handleTabChange = useCallback((tab: Tab) => setActiveTab(tab), []);
  const handleSelectSymbol = useCallback((symbol: string) => setSelectedSymbol(symbol), []);
  const handleBack = useCallback(() => setSelectedSymbol(null), []);

  useEffect(() => {
    wsClient.connect();
    return () => {
      wsClient.disconnect();
      connectionStore.dispose();
    };
  }, [connectionStore]);

  // Background resume: read latest store state inside handler — avoid rebinding on every WS tick
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const state = connectionStore.connectionState;
      const msSinceMessage = Date.now() - connectionStore.lastMessageAt;
      if (state === 'reconnecting' || state === 'disconnected') {
        wsClient.connect();
      } else if (state === 'connected' && msSinceMessage > 10_000) {
        wsClient.connect();
        const lastSeq = marketStore.seq;
        wsClient.sendHello(lastSeq > 0 ? lastSeq : undefined);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connectionStore]);

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h1 className="text-lg font-semibold">axis-trading</h1>
          <div className="flex items-center gap-2">
            <ConnectionIndicator />
            <SettingsButton />
          </div>
        </header>

        <main className="flex flex-1 flex-col">
          {selectedSymbol ? (
            <div className="min-h-0 flex-1 p-4">
              <AssetDetail symbol={selectedSymbol} onBack={handleBack} />
            </div>
          ) : (
            <>
              <div className="px-4 pt-4">
                <MarketOverview />
              </div>

              <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

              <div className="relative flex-1 overflow-hidden p-4">
                {activeTab === 'watchlist' && (
                  <Watchlist
                    isActive={true}
                    onSelectSymbol={handleSelectSymbol}
                  />
                )}
                {activeTab === 'portfolio' && (
                  <Portfolio
                    isActive={true}
                    onSelectSymbol={handleSelectSymbol}
                  />
                )}
                {activeTab === 'news' && (
                  <Suspense
                    fallback={
                      <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                        Loading...
                      </div>
                    }
                  >
                    <NewsTab />
                  </Suspense>
                )}
              </div>
            </>
          )}
        </main>

        <SettingsModal />
      </div>
    </ErrorBoundary>
  );
});

export default function App() {
  return <AppContent />;
}
