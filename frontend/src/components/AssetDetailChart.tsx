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

  // Reset hasData and restart polling whenever symbol changes
  useEffect(() => {
    if (dataRef.current.length >= 2) {
      setHasData(true);
      return;
    }
    setHasData(false);
    let raf = requestAnimationFrame(function check() {
      if (dataRef.current && dataRef.current.length > 1) {
        setHasData(true);
      } else {
        raf = requestAnimationFrame(check);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [symbol, dataRef]);

  const stroke = isPositive ? '#4ade80' : '#f87171';

  return (
    <div className="flex h-full min-h-[400px] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-5 py-3">
        <h3 className="text-sm font-medium text-zinc-300">Price Chart</h3>
        <span className="text-xs text-zinc-500">Live</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        {hasData ? (
          <PriceChartCanvas dataRef={dataRef} stroke={stroke} decimals={decimals} paused={isPaused} />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden />
              <span className="text-sm text-zinc-500">Collecting live price data…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
