import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { PriceCell } from './cells/PriceCell';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

export const PortfolioSummary = observer(function PortfolioSummary() {
  const { portfolioStore } = useStore();
  const totalValue = portfolioStore.totalValue;
  const totalPnL = portfolioStore.totalPnL;
  const totalPnLPercent = portfolioStore.totalPnLPercent;
  const gainerCount = portfolioStore.gainerCount;
  const loserCount = portfolioStore.loserCount;

  const pnlColor = totalPnL >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = totalPnL >= 0 ? '+' : '';

  return (
    <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div>
        <div className="text-xs text-zinc-500 mb-1">Portfolio Value</div>
        <div className="text-xl font-semibold text-zinc-100">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-500 mb-1">Total P&L</div>
        <div className={`text-xl font-semibold font-mono tabular-nums ${pnlColor}`}>
          {pnlSign}${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-sm ml-1">({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
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
}: PortfolioRowProps) {
  const pnlColor = unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = unrealizedPnL >= 0 ? '+' : '';

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
        <PriceCell symbol={symbol} />
      </div>
      <div className="flex items-center justify-end font-mono tabular-nums text-sm text-zinc-400">
        ${avgCost.toFixed(2)}
      </div>
      <div className="flex items-center justify-end font-mono tabular-nums text-sm text-zinc-100">
        ${marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`flex items-center justify-end font-mono tabular-nums text-sm ${pnlColor}`}>
        {pnlSign}{unrealizedPnLPercent.toFixed(2)}%
      </div>
    </div>
  );
});

interface PortfolioProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const Portfolio = observer(function Portfolio({ onSelectSymbol }: PortfolioProps) {
  const { portfolioStore } = useStore();
  const positions = portfolioStore.positions;

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <PortfolioSummary />

      <div className="grid grid-cols-5 gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-500">
        <div>Symbol</div>
        <div className="text-right">Price</div>
        <div className="text-right">Avg Cost</div>
        <div className="text-right">Market Value</div>
        <div className="text-right">P&L</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {positions.map((pos) => (
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
            />
          </div>
        ))}
      </div>
    </div>
  );
});