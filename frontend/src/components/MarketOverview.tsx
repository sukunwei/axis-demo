import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon } from 'lucide-react';

export const MarketOverview = observer(function MarketOverview() {
  const { marketStore, portfolioStore } = useStore();
  const symbolCount = marketStore.symbols.length;
  const gainerCount = portfolioStore.gainerCount;
  const loserCount = portfolioStore.loserCount;
  const totalValue = portfolioStore.totalValue;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ActivityIcon className="w-4 h-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Market Overview</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Symbols</span>
          <span className="font-mono tabular-nums text-sm text-zinc-100">{symbolCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Portfolio Value</span>
          <span className="font-mono tabular-nums text-sm text-zinc-100">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <TrendingUpIcon className="w-3 h-3 text-green-400" /> Gainers
          </span>
          <span className="font-mono tabular-nums text-sm text-green-400">{gainerCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <TrendingDownIcon className="w-3 h-3 text-red-400" /> Losers
          </span>
          <span className="font-mono tabular-nums text-sm text-red-400">{loserCount}</span>
        </div>
      </div>
    </div>
  );
});