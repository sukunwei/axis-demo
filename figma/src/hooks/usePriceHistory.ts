import { useEffect, useRef, useState } from 'react';
import type { MarketData } from '../types/market';

interface PricePoint {
  timestamp: number;
  price: number;
}

const MAX_HISTORY_POINTS = 100;

export function usePriceHistory(symbol: string, currentData?: MarketData) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!currentData || currentData.lastUpdate === lastUpdateRef.current) {
      return;
    }

    lastUpdateRef.current = currentData.lastUpdate;

    setHistory(prev => {
      const newPoint: PricePoint = {
        timestamp: currentData.lastUpdate,
        price: currentData.price
      };

      const next = [...prev, newPoint];

      // Keep only last N points
      if (next.length > MAX_HISTORY_POINTS) {
        next.shift();
      }

      return next;
    });
  }, [currentData, symbol]);

  return history;
}
