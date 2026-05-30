import { useState, useMemo, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { PriceCell } from './cells/PriceCell';
import { AnimatedNumber } from './AnimatedNumber';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

export const PortfolioSummary = observer(function PortfolioSummary({ paused = false }: { paused?: boolean }) {
  const { portfolioStore } = useStore();
  const totalValue = portfolioStore.totalValue;
  const totalPnL = portfolioStore.totalPnL;
  const totalPnLPercent = portfolioStore.totalPnLPercent;
  const gainerCount = portfolioStore.gainerCount;
  const loserCount = portfolioStore.loserCount;

  const pnlColor = totalPnL >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = totalPnL >= 0 ? '+' : '';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div>
        <div className="text-xs text-zinc-500 mb-1">Portfolio Value</div>
        <AnimatedNumber
          value={totalValue}
          decimals={2}
          prefix="$"
          className="text-xl font-semibold text-zinc-100"
          enableFlash={false}
          paused={paused}
        />
      </div>
      <div className="lg:col-span-1 col-span-2">
        <div className="text-xs text-zinc-500 mb-1">Total P&L</div>
        <div className={`text-xl font-semibold ${pnlColor}`}>
          <AnimatedNumber
            value={Math.abs(totalPnL)}
            decimals={2}
            prefix={`${pnlSign}$`}
            className={pnlColor}
            enableFlash={false}
            paused={paused}
          />
          <span className="text-sm ml-1">
            (
            <AnimatedNumber
              value={totalPnLPercent}
              decimals={2}
              prefix={totalPnLPercent >= 0 ? '+' : ''}
              suffix="%"
              className={`text-sm ${pnlColor}`}
              enableFlash={false}
              paused={paused}
            />
            )
          </span>
        </div>
      </div>
      <div>
        <div className="text-xs text-zinc-500 mb-1">Gainers</div>
        <div className="flex items-center gap-1 text-xl font-semibold text-green-400">
          <ArrowUpIcon className="w-5 h-5" />
          {gainerCount}
        </div>
      </div>
      <div>
        <div className="text-xs text-zinc-500 mb-1">Losers</div>
        <div className="flex items-center gap-1 text-xl font-semibold text-red-400">
          <ArrowDownIcon className="w-5 h-5" />
          {loserCount}
        </div>
      </div>
    </div>
  );
});

interface PortfolioRowProps {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

const PortfolioRow = observer(function PortfolioRow({
  symbol,
  quantity,
  avgCost,
  marketValue,
  unrealizedPnL,
  unrealizedPnLPercent,
  paused,
}: PortfolioRowProps & { paused: boolean }) {
  const pnlColor = unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {symbol.charAt(0)}
        </div>
        <div>
          <div className="font-medium text-zinc-100 text-sm">{symbol}</div>
          <div className="text-xs text-zinc-500">{quantity.toLocaleString()}</div>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <PriceCell symbol={symbol} paused={paused} />
      </div>
      <div className="flex items-center justify-end font-mono tabular-nums text-sm text-zinc-400">
        ${avgCost.toFixed(2)}
      </div>
      <div className="flex items-center justify-end font-mono tabular-nums text-sm text-zinc-100">
        <AnimatedNumber value={marketValue} decimals={2} prefix="$" enableFlash={false} />
      </div>
      <div className={`flex items-center justify-end font-mono tabular-nums text-sm ${pnlColor}`}>
        <AnimatedNumber
          value={unrealizedPnLPercent}
          decimals={2}
          prefix={unrealizedPnL >= 0 ? '+' : ''}
          suffix="%"
          className={pnlColor}
          enableFlash={false}
        />
      </div>
    </div>
  );
});

interface PortfolioProps {
  onSelectSymbol?: (symbol: string) => void;
  isActive?: boolean;
}

type SortField = 'symbol' | 'price' | 'cost' | 'value' | 'pnl';

const PortfolioColumnHeaders = observer(function PortfolioColumnHeaders({
  sortBy,
  sortDir,
  onToggle,
}: {
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  onToggle: (field: SortField) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
      <button onClick={() => onToggle('symbol')} className="text-left hover:text-zinc-300 transition-colors">
        Symbol {sortBy === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('price')} className="text-right hover:text-zinc-300 transition-colors">
        Price {sortBy === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('cost')} className="text-right hover:text-zinc-300 transition-colors">
        Avg Cost {sortBy === 'cost' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('value')} className="text-right hover:text-zinc-300 transition-colors">
        Market Value {sortBy === 'value' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
      <button onClick={() => onToggle('pnl')} className="text-right hover:text-zinc-300 transition-colors">
        P&L {sortBy === 'pnl' && (sortDir === 'asc' ? '↑' : '↓')}
      </button>
    </div>
  );
});

const PortfolioSorted = observer(function PortfolioSorted({
  sortBy,
  sortDir,
  onSelectSymbol,
  isActive,
}: {
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  onSelectSymbol?: (symbol: string) => void;
  isActive: boolean;
}) {
  const { marketStore, portfolioStore } = useStore();
  const needsLiveSort = sortBy === 'price' || sortBy === 'value' || sortBy === 'pnl';
  const sorted = useMemo(() => {
    const list = [...portfolioStore.positions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortBy === 'price') {
        cmp = (marketStore.getAsset(a.symbol)?.price ?? 0) - (marketStore.getAsset(b.symbol)?.price ?? 0);
      } else if (sortBy === 'cost') cmp = a.avgCost - b.avgCost;
      else if (sortBy === 'value') cmp = a.marketValue - b.marketValue;
      else cmp = a.unrealizedPnLPercent - b.unrealizedPnLPercent;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [portfolioStore, marketStore, sortBy, sortDir, needsLiveSort ? marketStore.priceUpdateAt : 0]);

  return (
    <div className="flex-1 overflow-y-auto">
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
          No positions in portfolio
        </div>
      ) : (
        sorted.map((pos) => (
          <div
            key={pos.symbol}
            onClick={() => onSelectSymbol?.(pos.symbol)}
            className={onSelectSymbol ? 'cursor-pointer' : ''}
          >
            <PortfolioRow
              symbol={pos.symbol}
              quantity={pos.quantity}
              avgCost={pos.avgCost}
              marketValue={pos.marketValue}
              unrealizedPnL={pos.unrealizedPnL}
              unrealizedPnLPercent={pos.unrealizedPnLPercent}
              paused={!isActive}
            />
          </div>
        ))
      )}
    </div>
  );
});

export const Portfolio = observer(function Portfolio({ onSelectSymbol, isActive = true }: PortfolioProps) {
  const [sortBy, setSortBy] = useState<SortField>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = useCallback((field: SortField) => {
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
      <PortfolioSummary paused={!isActive} />
      <PortfolioColumnHeaders sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
      <PortfolioSorted
        sortBy={sortBy}
        sortDir={sortDir}
        onSelectSymbol={onSelectSymbol}
        isActive={isActive}
      />
    </div>
  );
});