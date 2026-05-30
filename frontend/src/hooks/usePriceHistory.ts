import { useEffect, useRef, useState } from 'react';
import type { Asset } from '../stores/models/Asset';

interface PricePoint {
  timestamp: number;
  price: number;
}

const MAX_HISTORY_POINTS = 120;

export function usePriceHistory(symbol: string, asset: Asset | undefined): PricePoint[] {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const lastTsRef = useRef<number>(0);

  useEffect(() => {
    lastTsRef.current = 0;
    setHistory([]);
  }, [symbol]);

  useEffect(() => {
    if (!asset || asset.price <= 0) return;
    if (asset.ts === lastTsRef.current) return;

    lastTsRef.current = asset.ts;

    setHistory((prev) => {
      const next = [...prev, { timestamp: asset.ts || Date.now(), price: asset.price }];
      if (next.length > MAX_HISTORY_POINTS) {
        next.shift();
      }
      return next;
    });
  }, [asset, asset?.price, asset?.ts]);

  return history;
}
