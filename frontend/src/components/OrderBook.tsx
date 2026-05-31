import { memo, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { applyBackgroundFlash } from '../lib/flashColors';
import { upColor, downColor, upBgColor, downBgColor, flashColor } from '../lib/themeColors';
import { formatTrimmed } from '../lib/format';
import type { OrderBookSnapshot } from '../hooks/useThrottledOrderBook';
import { useThrottledOrderBook } from '../hooks/useThrottledOrderBook';

interface OrderBookRowProps {
  price: number;
  size: number;
  total: number;
  side: 'ask' | 'bid';
  maxTotal: number;
  priceDecimals: number;
  colorTheme: 'green-red' | 'red-green';
  paused: boolean;
}

const OrderBookRow = memo(function OrderBookRow({
  price,
  size,
  total,
  side,
  maxTotal,
  priceDecimals,
  colorTheme,
  paused,
}: OrderBookRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const prevSizeRef = useRef(size);
  const isBid = side === 'bid';
  const depthPercent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const textColor = isBid ? upColor(colorTheme) : downColor(colorTheme);
  const bgColor = isBid ? upBgColor(colorTheme) : downBgColor(colorTheme);

  useEffect(() => {
    if (paused || prevSizeRef.current === size || !rowRef.current) return;
    const cleanup = applyBackgroundFlash(
      rowRef.current,
      flashColor(colorTheme, isBid ? 'up' : 'down'),
    );
    prevSizeRef.current = size;
    return cleanup;
  }, [size, isBid, colorTheme, paused]);

  return (
    <div
      ref={rowRef}
      className="relative grid grid-cols-3 cursor-default px-2 py-[3px] text-xs font-mono hover:bg-zinc-800/40"
    >
      <div
        className={`absolute inset-y-0 pointer-events-none ${bgColor}`}
        style={{
          width: `${depthPercent}%`,
          [isBid ? 'left' : 'right']: 0,
        }}
      />
      <span className={`relative z-10 tabular-nums ${textColor}`}>
        {formatTrimmed(price, priceDecimals)}
      </span>
      <span className="relative z-10 text-right tabular-nums text-zinc-300">
        {size.toFixed(4)}
      </span>
      <span className="relative z-10 text-right tabular-nums text-zinc-400">
        {total.toFixed(4)}
      </span>
    </div>
  );
});

const COLUMN_HEADERS = ['Price (USDT)', 'Size', 'Total'] as const;

function OrderBookColumnHeader() {
  return (
    <div className="grid shrink-0 grid-cols-3 border-b border-zinc-800/80 bg-zinc-800/20 px-2 py-2">
      {COLUMN_HEADERS.map((label, index) => (
        <span
          key={label}
          className={`text-[11px] font-medium uppercase tracking-wide text-zinc-400 ${
            index > 0 ? 'text-right' : ''
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

interface OrderBookContentProps {
  embedded: boolean;
  book: OrderBookSnapshot | null;
  colorTheme: 'green-red' | 'red-green';
  paused: boolean;
}

const OrderBookContent = memo(function OrderBookContent({
  embedded,
  book,
  colorTheme,
  paused,
}: OrderBookContentProps) {
  const rootClass = embedded
    ? 'h-full flex flex-col overflow-hidden'
    : 'bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden h-full flex flex-col';

  if (!book) {
    return (
      <div className={rootClass}>
        <div className="flex min-h-[300px] items-center justify-center text-zinc-600 text-xs">
          Loading order book…
        </div>
      </div>
    );
  }

  const rawBids = book.bids;
  const rawAsks = book.asks;
  const MAX_DEPTH = 8;

  let bidTotal = 0;
  const bidsWithTotal = rawBids.slice(0, MAX_DEPTH).map(([price, size]: [number, number]) => {
    bidTotal += size;
    return { price, size, total: bidTotal };
  });

  let askTotal = 0;
  const asksWithTotal = rawAsks.slice(0, MAX_DEPTH).map(([price, size]: [number, number]) => {
    askTotal += size;
    return { price, size, total: askTotal };
  });

  const maxBidTotal = bidsWithTotal.length > 0 ? bidsWithTotal[bidsWithTotal.length - 1].total : 0;
  const maxAskTotal = asksWithTotal.length > 0 ? asksWithTotal[asksWithTotal.length - 1].total : 0;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  const priceDecimals = book.price > 100 ? 2 : book.price > 1 ? 4 : 8;

  const spread =
    rawBids.length > 0 && rawAsks.length > 0 ? rawAsks[0][0] - rawBids[0][0] : 0;
  const spreadPercent =
    rawBids.length > 0 && rawAsks.length > 0
      ? ((rawAsks[0][0] - rawBids[0][0]) / rawBids[0][0]) * 100
      : 0;

  const hasData = rawBids.length > 0 || rawAsks.length > 0;

  return (
    <div className={rootClass}>
      {!embedded && (
        <div className="px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-400">Order Book</span>
        </div>
      )}

      {!hasData ? (
        <div className="flex min-h-[300px] items-center justify-center text-zinc-600 text-xs">
          No order book data
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <OrderBookColumnHeader />

          <div className="shrink-0">
            <div className="flex flex-col-reverse">
              {asksWithTotal.map(({ price, size, total }) => (
                <OrderBookRow
                  key={`ask-${price}-${size}`}
                  price={price}
                  size={size}
                  total={total}
                  side="ask"
                  maxTotal={maxTotal}
                  priceDecimals={priceDecimals}
                  colorTheme={colorTheme}
                  paused={paused}
                />
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-y border-zinc-800/80 bg-zinc-800/20 px-2 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Spread
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-zinc-200">
                {spread.toFixed(priceDecimals)}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                ({spreadPercent.toFixed(3)}%)
              </span>
            </div>
          </div>

          <div className="shrink-0">
            {bidsWithTotal.map(({ price, size, total }) => (
              <OrderBookRow
                key={`bid-${price}-${size}`}
                price={price}
                size={size}
                total={total}
                side="bid"
                maxTotal={maxTotal}
                priceDecimals={priceDecimals}
                colorTheme={colorTheme}
                paused={paused}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

interface OrderBookProps {
  symbol: string;
  embedded?: boolean;
  /** Pre-throttled snapshot from parent — avoids observer on every tick */
  book?: OrderBookSnapshot | null;
}

const OrderBookWithStore = observer(function OrderBookWithStore({
  symbol,
  embedded,
  book,
}: OrderBookProps) {
  const { themeStore, connectionStore } = useStore();
  const liveBook = useThrottledOrderBook(symbol);
  const resolved = book !== undefined ? book : liveBook;

  return (
    <OrderBookContent
      embedded={embedded ?? false}
      book={resolved}
      colorTheme={themeStore.colorTheme}
      paused={connectionStore.paused}
    />
  );
});

export const OrderBook = memo(function OrderBook(props: OrderBookProps) {
  return <OrderBookWithStore {...props} />;
});
