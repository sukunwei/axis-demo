import { useMemo, useState, useRef, useEffect } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { PriceSparkline } from './PriceSparkline';
import type { MarketData } from '../types/market';
import { ArrowUpIcon, ArrowDownIcon, SearchIcon, TrendingUpIcon } from 'lucide-react';

interface WatchlistProps {
  marketData: Map<string, MarketData>;
  onSelectSymbol: (symbol: string) => void;
}

const ITEM_HEIGHT = 56; // Height of each row in pixels
const OVERSCAN = 5; // Number of items to render outside viewport

export function Watchlist({ marketData, onSelectSymbol }: WatchlistProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change'>('symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Filter and sort data
  const sortedData = useMemo(() => {
    let filtered = Array.from(marketData.values());

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'change':
          comparison = a.changePercent - b.changePercent;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [marketData, searchTerm, sortBy, sortDirection]);

  // Virtual scrolling calculations
  const totalHeight = sortedData.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    sortedData.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  const visibleItems = sortedData.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
        <button
          onClick={() => toggleSort('symbol')}
          className="text-left hover:text-gray-900 transition-colors"
        >
          Symbol {sortBy === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => toggleSort('price')}
          className="text-right hover:text-gray-900 transition-colors"
        >
          Price {sortBy === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => toggleSort('change')}
          className="text-right hover:text-gray-900 transition-colors"
        >
          24h Change {sortBy === 'change' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <div className="text-center">Trend</div>
        <div className="text-right">Volume</div>
      </div>

      {/* Virtual Scrolling List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((item) => (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol(item.symbol)}
                className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                style={{ height: ITEM_HEIGHT }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {item.symbol.charAt(0)}
                  </div>
                  <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.symbol}
                  </span>
                </div>

                <div className="flex items-center justify-end">
                  <AnimatedNumber
                    value={item.price}
                    decimals={item.price < 1 ? 4 : 2}
                    prefix="$"
                    className="text-gray-900 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-1">
                  {item.changePercent > 0 ? (
                    <ArrowUpIcon className="w-3 h-3 text-green-500" />
                  ) : item.changePercent < 0 ? (
                    <ArrowDownIcon className="w-3 h-3 text-red-500" />
                  ) : null}
                  <AnimatedNumber
                    value={item.changePercent}
                    decimals={2}
                    suffix="%"
                    className={`font-mono ${
                      item.changePercent > 0
                        ? 'text-green-500'
                        : item.changePercent < 0
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-center">
                  <PriceSparkline
                    symbol={item.symbol}
                    marketData={item}
                    width={60}
                    height={20}
                  />
                </div>

                <div className="flex items-center justify-end">
                  <AnimatedNumber
                    value={item.volume24h}
                    decimals={0}
                    prefix="$"
                    className="text-gray-600 font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
