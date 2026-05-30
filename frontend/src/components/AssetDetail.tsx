import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeftIcon } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { PriceCell } from './cells/PriceCell';
import { AssetDetailChart } from './AssetDetailChart';
import { AssetDetailOrderBook } from './AssetDetailOrderBook';

interface AssetDetailProps {
  symbol: string;
  onBack: () => void;
}

function priceDecimals(price: number): number {
  if (price > 100) return 2;
  if (price > 1) return 4;
  return 6;
}

function formatPrice(value: number, decimals?: number): string {
  const d = decimals ?? priceDecimals(value);
  return `$${value.toFixed(d)}`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

interface StatItemProps {
  label: string;
  children: ReactNode;
  accent?: 'neutral' | 'up' | 'down';
}

function StatItem({ label, children, accent = 'neutral' }: StatItemProps) {
  const valueClass =
    accent === 'up'
      ? 'text-green-400'
      : accent === 'down'
        ? 'text-red-400'
        : 'text-zinc-100';

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
      <div className={`font-mono tabular-nums text-sm font-medium truncate ${valueClass}`}>
        {children}
      </div>
    </div>
  );
}

export const AssetDetail = observer(function AssetDetail({ symbol, onBack }: AssetDetailProps) {
  const { marketStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  if (!asset) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
        Symbol not found: {symbol}
      </div>
    );
  }

  const decimals = priceDecimals(asset.price);
  const isPositive = asset.changePercent >= 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Top: symbol + market stats */}
      <section className="shrink-0 border-b border-zinc-800">
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-base font-bold text-white">
            {symbol.charAt(0)}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-zinc-100">{symbol}</h2>
            <p className="text-xs text-zinc-500">On-chain Perpetual</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
          <StatItem label="Day Open">{formatPrice(asset.dayOpen, decimals)}</StatItem>
          <StatItem label="Day High" accent="up">
            {formatPrice(asset.dayHigh, decimals)}
          </StatItem>
          <StatItem label="Day Low" accent="down">
            {formatPrice(asset.dayLow, decimals)}
          </StatItem>
          <StatItem label="24h Volume">{formatVolume(asset.volume24h)}</StatItem>
          <StatItem label="Last Price">
            <PriceCell symbol={symbol} decimals={decimals} prefix="$" />
          </StatItem>
          <StatItem label="Change" accent={isPositive ? 'up' : 'down'}>
            {isPositive ? '+' : ''}
            {asset.changePercent.toFixed(2)}%
          </StatItem>
        </div>
      </section>

      {/* Bottom: chart (left) + order book (right) */}
      <section className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[400px] min-w-0 flex-1 flex-col border-b border-zinc-800 lg:min-h-0 lg:border-b-0 lg:border-r">
          <AssetDetailChart symbol={symbol} isPositive={isPositive} decimals={decimals} />
        </div>

        <AssetDetailOrderBook symbol={symbol} />
      </section>
    </div>
  );
});
