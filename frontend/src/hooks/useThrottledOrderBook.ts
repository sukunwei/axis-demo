import { useEffect, useRef, useState } from 'react';
import { autorun, reaction } from 'mobx';
import { connectionStore, marketStore } from '../stores/store-instances';

export interface OrderBookSnapshot {
  bids: [number, number][];
  asks: [number, number][];
  price: number;
  bookTs: number;
}

const BOOK_FLUSH_MS = 250;

/**
 * Order book depth for UI — throttled ~4 FPS, skips flush when tab hidden.
 */
export function useThrottledOrderBook(symbol: string): OrderBookSnapshot | null {
  const [snap, setSnap] = useState<OrderBookSnapshot | null>(null);
  const bufferRef = useRef<OrderBookSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    bufferRef.current = null;
    dirtyRef.current = false;
    setSnap(null);

    const flushToReact = () => {
      timerRef.current = null;
      if (!dirtyRef.current || !bufferRef.current) return;
      dirtyRef.current = false;
      if (connectionStore.paused) return;
      setSnap(bufferRef.current);
    };

    const scheduleFlush = () => {
      dirtyRef.current = true;
      if (connectionStore.paused || timerRef.current !== null) return;
      timerRef.current = setTimeout(flushToReact, BOOK_FLUSH_MS);
    };

    const disposeBook = autorun(() => {
      const asset = marketStore.getAsset(symbol);
      if (!asset) return;

      bufferRef.current = {
        bids: asset.bids ?? [],
        asks: asset.asks ?? [],
        price: asset.price,
        bookTs: asset.ts,
      };
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
      disposeBook();
      disposePaused();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [symbol]);

  return snap;
}
