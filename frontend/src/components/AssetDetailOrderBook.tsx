import { memo } from 'react';
import { OrderBook } from './OrderBook';
import { useThrottledOrderBook } from '../hooks/useThrottledOrderBook';

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

interface AssetDetailOrderBookProps {
  symbol: string;
}

/** Isolated from AssetDetail header — order book ticks do not re-render chart/header stats. */
export const AssetDetailOrderBook = memo(function AssetDetailOrderBook({ symbol }: AssetDetailOrderBookProps) {
  const book = useThrottledOrderBook(symbol);
  const bidLevels = Math.min(8, book?.bids.length ?? 0);
  const askLevels = Math.min(8, book?.asks.length ?? 0);
  const displayLevels = Math.min(8, Math.max(bidLevels, askLevels));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-full lg:w-[340px] xl:w-[380px]">
      <PanelHeader
        title="Order Book"
        subtitle={`Live · ${displayLevels} asks · ${displayLevels} bids [mock]`}
      />
      <div className="min-h-0 flex-1 px-3 py-3">
        <OrderBook symbol={symbol} embedded book={book} />
      </div>
    </div>
  );
});
