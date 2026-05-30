import { useMemo, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeftIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { PriceCell } from './cells/PriceCell';
import { ChangeCell } from './cells/ChangeCell';
import { OrderBook } from './OrderBook';
import { usePriceHistory } from '../hooks/usePriceHistory';

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

interface PanelHeaderProps {
  title: string;
  subtitle: string;
}

function PanelHeader({ title, subtitle }: PanelHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-5 py-3">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      <span className="text-xs text-zinc-500">{subtitle}</span>
    </div>
  );
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
  const history = usePriceHistory(symbol, asset);

  const chartData = useMemo(
    () =>
      history.map((point) => ({
        timestamp: point.timestamp,
        price: point.price,
        time: new Date(point.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      })),
    [history],
  );

  if (!asset) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500">
        Symbol not found: {symbol}
      </div>
    );
  }

  const decimals = priceDecimals(asset.price);
  const isPositive = asset.changePercent >= 0;
  const bidLevels = Math.min(8, asset.bids?.length ?? 0);
  const askLevels = Math.min(8, asset.asks?.length ?? 0);
  const displayLevels = Math.min(8, Math.max(bidLevels, askLevels));

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

          <div className="hidden items-baseline gap-3 sm:flex">
            <PriceCell symbol={symbol} decimals={decimals} prefix="$" />
            <ChangeCell symbol={symbol} />
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isPositive
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            {isPositive ? (
              <TrendingUpIcon className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <TrendingDownIcon className="h-3.5 w-3.5 text-red-400" />
            )}
            <span
              className={`font-mono text-xs tabular-nums ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {asset.changePercent.toFixed(2)}%
            </span>
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
          <PanelHeader title="Price Chart" subtitle={`Live · last ${history.length} ticks`} />

          <div className="min-h-[400px] flex-1 px-3 py-3">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="time"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(value: number) => `$${value.toFixed(decimals > 4 ? 4 : decimals)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      color: '#fafafa',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: number) => [`$${value.toFixed(decimals)}`, 'Price']}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={isPositive ? '#4ade80' : '#f87171'}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 text-sm text-zinc-500">
                Collecting live price data…
              </div>
            )}
          </div>
        </div>

        <div className="flex h-[360px] shrink-0 flex-col lg:h-auto lg:w-[340px] xl:w-[380px]">
          <PanelHeader
            title="Order Book"
            subtitle={`Live · ${displayLevels} asks · ${displayLevels} bids`}
          />
          <div className="min-h-0 flex-1 px-3 py-3">
            <OrderBook symbol={symbol} embedded />
          </div>
        </div>
      </section>
    </div>
  );
});
