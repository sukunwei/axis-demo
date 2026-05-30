import { useState, useEffect, Component, type ReactNode, lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { SettingsButton } from '../components/SettingsButton';
import { SettingsModal } from '../components/SettingsModal';
import { PerformanceMonitor } from '../components/PerformanceMonitor';
import { Watchlist } from '../components/Watchlist';
import { Portfolio } from '../components/Portfolio';
import { MarketOverview } from '../components/MarketOverview';
import { AssetDetail } from '../components/AssetDetail';
import { wsClient } from '../ws/client';
import { useStore } from '../stores/useStore';
import { marketStore } from '../stores/store-instances';

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

const AppContent = observer(function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('watchlist');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { connectionStore, settingsStore } = useStore();

  useEffect(() => {
    wsClient.connect();
    return () => {
      wsClient.disconnect();
      connectionStore.dispose();
    };
  }, [connectionStore]);

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
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h1 className="text-lg font-semibold">axis-demo</h1>
          <div className="flex items-center gap-2">
            <ConnectionIndicator />
            <SettingsButton />
          </div>
        </header>

        <main
          className={`flex flex-1 flex-col ${settingsStore.showPerformancePanel ? 'pb-14' : ''}`}
        >
          {selectedSymbol ? (
            <div className="min-h-0 flex-1 p-4">
              <AssetDetail symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
            </div>
          ) : (
            <>
              <div className="px-4 pt-4">
                <MarketOverview />
              </div>

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
                <button
                  onClick={() => setActiveTab('news')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'news'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  News
                </button>
              </div>

              <div className="flex-1 p-4 overflow-hidden">
                {activeTab === 'watchlist' ? (
                  <Watchlist onSelectSymbol={setSelectedSymbol} />
                ) : activeTab === 'portfolio' ? (
                  <Portfolio onSelectSymbol={setSelectedSymbol} />
                ) : (
                  <Suspense fallback={<div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Loading...</div>}>
                    <NewsTab />
                  </Suspense>
                )}
              </div>
            </>
          )}
        </main>

        <PerformanceMonitor />
        <SettingsModal />
      </div>
    </ErrorBoundary>
  );
});

export default function App() {
  return <AppContent />;
}
