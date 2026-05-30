import { useEffect, useRef } from 'react';
import { autorun } from 'mobx';
import { marketStore } from '../stores/store-instances';

export interface PricePoint {
  timestamp: number;
  price: number;
}

const MAX_HISTORY_POINTS = 120;

/**
 * Ref-based price history — zero React re-renders.
 * Data is written to a ref; Canvas reads it via RAF loop.
 * This eliminates the 250ms setState throttle that caused 4fps visual stuttering.
 */
export function usePriceHistoryRef(symbol: string) {
  const historyRef = useRef<PricePoint[]>([]);
  const lastTsRef = useRef(0);

  useEffect(() => {
    historyRef.current = [];
    lastTsRef.current = 0;

    const dispose = autorun(() => {
      const asset = marketStore.getAsset(symbol);
      if (!asset || asset.price <= 0) return;

      const ts = asset.ts || Date.now();
      if (ts === lastTsRef.current) return;
      lastTsRef.current = ts;

      const buf = historyRef.current;
      buf.push({ timestamp: ts, price: asset.price });
      if (buf.length > MAX_HISTORY_POINTS) {
        buf.splice(0, buf.length - MAX_HISTORY_POINTS);
      }
      // No setState — Canvas RAF loop reads this ref directly
    });

    return dispose;
  }, [symbol]);

  return historyRef;
}
