import { useEffect, useRef } from 'react';
import { autorun } from 'mobx';
import { marketStore } from '../stores/store-instances';

export interface PricePoint {
  timestamp: number;
  price: number;
}

const MAX_HISTORY_POINTS = 120;

/** Fallback seed when no live ticks collected yet — day open → current price */
function seedFromDayOpen(symbol: string): PricePoint[] | null {
  const asset = marketStore.getAsset(symbol);
  if (!asset || asset.price <= 0) return null;
  const ts = asset.ts || Date.now();
  const open = asset.dayOpen > 0 ? asset.dayOpen : asset.price;
  return [
    { timestamp: ts - 60_000, price: open },
    { timestamp: ts, price: asset.price },
  ];
}

/**
 * Ref-based price history — zero React re-renders.
 * Seeds from marketStore rolling history (collected while browsing watchlist),
 * then appends live ticks via autorun.
 */
export function usePriceHistoryRef(symbol: string) {
  const historyRef = useRef<PricePoint[]>([]);
  const lastTsRef = useRef(0);

  useEffect(() => {
    historyRef.current = [];
    lastTsRef.current = 0;

    const stored = marketStore.getPriceHistory(symbol);
    if (stored.length >= 2) {
      historyRef.current = stored.map((p) => ({ ...p }));
      lastTsRef.current = historyRef.current[historyRef.current.length - 1].timestamp;
    } else {
      const seeded = seedFromDayOpen(symbol);
      if (seeded) {
        historyRef.current = seeded;
        lastTsRef.current = seeded[seeded.length - 1].timestamp;
      }
    }

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
    });

    return dispose;
  }, [symbol]);

  return historyRef;
}
