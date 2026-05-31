import { memo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePriceHistoryRef } from '../hooks/usePriceHistoryRef';
import { PriceChartCanvas } from './PriceChartCanvas';
import { connectionStore } from '../stores/store-instances';

interface AssetDetailChartProps {
  symbol: string;
  isPositive: boolean;
  decimals: number;
  /** Controls RAF loop pause — matches parent tab visibility */
  paused?: boolean;
}

/**
 * Ref-based chart — zero React re-renders on price ticks.
 * Canvas RAF loop reads dataRef directly; only pauses/resumes on tab switch.
 * hasData is the only state trigger (initial paint vs placeholder).
 */
export const AssetDetailChart = memo(function AssetDetailChart({
  symbol,
  isPositive,
  decimals,
  paused = false,
}: AssetDetailChartProps) {
  const dataRef = usePriceHistoryRef(symbol);
  const [hasData, setHasData] = useState(false);
  const isPaused = paused || connectionStore.paused;

  // Track first time data becomes available — single state flip, no continuous updates
  useEffect(() => {
    let raf = requestAnimationFrame(function check() {
      if (dataRef.current && dataRef.current.length > 1) {
        setHasData(true);
      } else {
        raf = requestAnimationFrame(check);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  const stroke = isPositive ? '#4ade80' : '#f87171';

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-5 py-3">
        <h3 className="text-sm font-medium text-zinc-300">Price Chart</h3>
        <span className="text-xs text-zinc-500">Live</span>
      </div>

      <div className="min-h-[400px] flex-1 px-3 py-3">
        {hasData ? (
          <PriceChartCanvas dataRef={dataRef} stroke={stroke} decimals={decimals} paused={isPaused} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden />
            <span className="text-sm text-zinc-500">Collecting live price data…</span>
          </div>
        )}
      </div>
    </>
  );
});
