import { useEffect, useRef, useState } from 'react';
import { autorun, reaction } from 'mobx';
import { connectionStore, marketStore } from '../stores/store-instances';

export interface PricePoint {
  timestamp: number;
  price: number;
}

const MAX_HISTORY_POINTS = 120;
/** Chart UI refresh cap (~4 FPS) — buffer still collects every tick */
const CHART_FLUSH_MS = 250;

/**
 * Price history for charts — only tracks price/ts (not order book).
 * Throttles React updates; pauses UI flush when tab is hidden.
 */
export function useThrottledPriceHistory(symbol: string): PricePoint[] {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const bufferRef = useRef<PricePoint[]>([]);
  const lastTsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    bufferRef.current = [];
    lastTsRef.current = 0;
    dirtyRef.current = false;
    setHistory([]);

    const flushToReact = () => {
      timerRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      if (connectionStore.paused) return;
      setHistory([...bufferRef.current]);
    };

    const scheduleFlush = () => {
      dirtyRef.current = true;
      if (connectionStore.paused || timerRef.current !== null) return;
      timerRef.current = setTimeout(flushToReact, CHART_FLUSH_MS);
    };

    const disposePrice = autorun(() => {
      const asset = marketStore.getAsset(symbol);
      if (!asset || asset.price <= 0) return;

      const ts = asset.ts || Date.now();
      if (ts === lastTsRef.current) return;
      lastTsRef.current = ts;

      const buf = bufferRef.current;
      buf.push({ timestamp: ts, price: asset.price });
      if (buf.length > MAX_HISTORY_POINTS) {
        buf.splice(0, buf.length - MAX_HISTORY_POINTS);
      }
      scheduleFlush();
    });

    const disposePaused = reaction(
      () => connectionStore.paused,
      (paused) => {
        if (!paused && dirtyRef.current) {
          if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          flushToReact();
        }
      },
    );

    return () => {
      disposePrice();
      disposePaused();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [symbol]);

  return history;
}
