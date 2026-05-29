import { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Watchlist } from '../components/Watchlist';
import { Portfolio } from '../components/Portfolio';
import { AssetDetail } from '../components/AssetDetail';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { MarketOverview } from '../components/MarketOverview';
import { LayoutDashboardIcon, WalletIcon } from 'lucide-react';

type View = 'watchlist' | 'portfolio' | 'detail';

export default function App() {
  const { marketData, connectionState } = useWebSocket();
  const [view, setView] = useState<View>('watchlist');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setView('detail');
  };

  const handleBack = () => {
    setView('watchlist');
    setSelectedSymbol(null);
  };

  return (
    <div className="size-full flex flex-col bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Hyperliquid Trading
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time market data • {marketData.size} symbols
          </p>
        </div>

        <ConnectionIndicator state={connectionState} />
      </div>

      {/* Navigation Tabs */}
      {view !== 'detail' && (
        <div className="flex gap-2 px-6 py-3 border-b border-gray-200 bg-white">
          <button
            onClick={() => setView('watchlist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              view === 'watchlist'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <LayoutDashboardIcon className="w-4 h-4" />
            Watchlist
          </button>
          <button
            onClick={() => setView('portfolio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              view === 'portfolio'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <WalletIcon className="w-4 h-4" />
            Portfolio
          </button>
        </div>
      )}

      {/* Market Overview */}
      {view !== 'detail' && <MarketOverview marketData={marketData} />}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'watchlist' && (
          <Watchlist
            marketData={marketData}
            onSelectSymbol={handleSelectSymbol}
          />
        )}
        {view === 'portfolio' && (
          <Portfolio
            marketData={marketData}
            onSelectSymbol={handleSelectSymbol}
          />
        )}
        {view === 'detail' && selectedSymbol && (
          <AssetDetail
            symbol={selectedSymbol}
            marketData={marketData}
            onBack={handleBack}
          />
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-gray-600">
              Last update: <span className="text-gray-900">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-600">Live Updates Active</span>
            </div>
          </div>
          <div className="text-gray-600">
            Powered by <span className="text-blue-600 font-medium">Hyperliquid</span> • Real-time Data
          </div>
        </div>
      </div>
    </div>
  );
}