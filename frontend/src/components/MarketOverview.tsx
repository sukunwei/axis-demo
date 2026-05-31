import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { upColor, downColor } from '../lib/themeColors';

export const MarketOverview = observer(function MarketOverview() {
  const { marketStore, portfolioStore, themeStore } = useStore();
  const theme = themeStore.colorTheme;
  const gainerColor = upColor(theme);
  const loserColor = downColor(theme);
  const symbolCount = marketStore.symbolCount;
  const gainerCount = portfolioStore.gainerCount;
  const loserCount = portfolioStore.loserCount;
  const totalValue = portfolioStore.totalValue;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="flex items-center justify-around">
        <div className="flex flex-col items-center">
          <span className="font-mono tabular-nums text-lg text-zinc-100">{symbolCount}</span>
          <span className="text-xs text-zinc-500">Symbols</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono tabular-nums text-lg text-zinc-100">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-zinc-500">Portfolio</span>
        </div>
        <div className="flex flex-col items-center">
          <span className={`font-mono tabular-nums text-lg ${gainerColor}`}>{gainerCount}</span>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <TrendingUpIcon className={`w-3 h-3 ${gainerColor}`} />Gainers
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className={`font-mono tabular-nums text-lg ${loserColor}`}>{loserCount}</span>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <TrendingDownIcon className={`w-3 h-3 ${loserColor}`} />Losers
          </span>
        </div>
      </div>
    </div>
  );
});