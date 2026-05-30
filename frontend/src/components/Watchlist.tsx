import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { PriceCell } from './cells/PriceCell';
import { ChangeCell } from './cells/ChangeCell';
import { SearchIcon } from 'lucide-react';

const ITEM_HEIGHT = 56;
const OVERSCAN = 5;

interface WatchlistProps {
  onSelectSymbol: (symbol: string) => void;
}

const SymbolCountBadge = observer(function SymbolCountBadge() {
  const { marketStore, settingsStore } = useStore();
  return (
    <span className="inline-flex items-center gap-2 ml-3">
      {settingsStore.serverFeedMode === 'mock' && (
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
          MOCK
        </span>
      )}
      <span className="text-xs text-zinc-500 font-mono tabular-nums">
        {marketStore.symbolCount} symbols
      </span>
    </span>
  );
});

const ColumnHeaders = observer(function ColumnHeaders({
  sortBy,
  sortDir,
  onToggle,
}: {
  sortBy: 'symbol' | 'price' | 'change';
  sortDir: 'asc' | 'desc';
  onToggle: (field: typeof sortBy) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
      <button onClick={() => onToggle('symbol')} className="text-left hover:text-zinc-300 transition-colors">
        Symbol {sortBy === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('price')} className="text-right hover:text-zinc-300 transition-colors">
        Last Price {sortBy === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('change')} className="text-right hover:text-zinc-300 transition-colors">
        24h Change {sortBy === 'change' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
    </div>
  );
});

/** Pure virtual scroll — no MobX subscriptions */
function WatchlistBody({
  sortedSymbols,
  searchTerm,
  onSelectSymbol,
}: {
  sortedSymbols: string[];
  searchTerm: string;
  onSelectSymbol: (symbol: string) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = sortedSymbols.length * ITEM_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    sortedSymbols.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  const visible = sortedSymbols.slice(startIdx, endIdx);
  const offsetY = startIdx * ITEM_HEIGHT;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContainerHeight(el!.clientHeight));
    observer.observe(el);
    setContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const q = searchTerm.toLowerCase();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
      {sortedSymbols.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
          No symbols found
        </div>
      ) : (
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visible.map((symbol) => (
              <div
                key={symbol}
                onClick={() => onSelectSymbol(symbol)}
                className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/60 cursor-pointer transition-colors"
                style={{ height: ITEM_HEIGHT }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {symbol.charAt(0)}
                  </div>
                  <span className="font-medium text-zinc-100 text-sm truncate">
                    {q ? highlightMatch(symbol, q) : symbol}
                  </span>
                </div>
                <div className="flex items-center justify-end">
                  <PriceCell symbol={symbol} />
                </div>
                <ChangeCell symbol={symbol} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Highlight matching characters in a string */
function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      <span className="text-zinc-100">{text.slice(0, idx)}</span>
      <span className="text-yellow-400 font-medium">{text.slice(idx, idx + query.length)}</span>
      <span className="text-zinc-100">{text.slice(idx + query.length)}</span>
    </>
  );
}

/** Observer — subscribes to marketStore.symbols, computes sorted list */
const WatchlistSorted = observer(function WatchlistSorted({
  searchTerm,
  sortBy,
  sortDir,
  onSelectSymbol,
}: {
  searchTerm: string;
  sortBy: 'symbol' | 'price' | 'change';
  sortDir: 'asc' | 'desc';
  onSelectSymbol: (symbol: string) => void;
}) {
  const { marketStore } = useStore();
  const sorted = useMemo(() => {
    const symbols = marketStore.symbols;
    let list = [...symbols];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((s) => s.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'symbol') cmp = a.localeCompare(b);
      else if (sortBy === 'price') {
        cmp = (marketStore.getAsset(a)?.price ?? 0) - (marketStore.getAsset(b)?.price ?? 0);
      } else {
        cmp = (marketStore.getAsset(a)?.changePercent ?? 0) - (marketStore.getAsset(b)?.changePercent ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [marketStore.symbols, searchTerm, sortBy, sortDir]);

  return <WatchlistBody sortedSymbols={sorted} searchTerm={searchTerm} onSelectSymbol={onSelectSymbol} />;
});

export function Watchlist({ onSelectSymbol }: WatchlistProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change'>('change');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = useCallback((field: typeof sortBy) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search symbols…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
          <SymbolCountBadge />
        </div>
      </div>

      <ColumnHeaders sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />

      <WatchlistSorted
        searchTerm={searchTerm}
        sortBy={sortBy}
        sortDir={sortDir}
        onSelectSymbol={onSelectSymbol}
      />
    </div>
  );
}