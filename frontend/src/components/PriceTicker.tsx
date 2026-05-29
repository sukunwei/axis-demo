import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import type { Asset } from '../stores/models/Asset';
import { useStore } from '../stores/useStore';

interface PriceTickerProps {
  asset: Asset;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const CUBIC_EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

export const PriceTicker = observer(function PriceTicker({
  asset,
  decimals = 2,
  prefix = '$',
  suffix = '',
  className = '',
}: PriceTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number | null>(null);
  const fromRef = useRef<number>(asset.price);
  const toRef = useRef<number>(asset.price);
  const startTimeRef = useRef<number>(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { connectionStore } = useStore();

  // Stop RAF when paused (background tab)
  const isPaused = connectionStore.paused;

  useEffect(() => {
    if (isPaused) {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      return;
    }

    const span = spanRef.current;
    if (!span) return;

    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const from = fromRef.current;
    const to = asset.price;
    toRef.current = to;

    if (Math.abs(from - to) < 0.0001) {
      span.textContent = `${prefix}${to.toFixed(decimals)}${suffix}`;
      return;
    }

    const dir: 'up' | 'down' | 'flat' = from > to ? 'down' : from < to ? 'up' : 'flat';

    if (dir !== 'flat' && from !== to) {
      const flashClass = dir === 'up' ? 'text-green-400' : 'text-red-400';
      span.classList.add(flashClass);

      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        span.classList.remove('text-green-400', 'text-red-400');
      }, 300);
    }

    startTimeRef.current = 0;
    const duration = 150;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = CUBIC_EASE_OUT(progress);

      const current = from + (to - from) * eased;
      span.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        animRef.current = null;
        fromRef.current = to;
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [asset.price, decimals, prefix, suffix, isPaused]);

  // Sync fromRef on symbol mount
  useEffect(() => {
    fromRef.current = asset.price;
    toRef.current = asset.price;
    if (spanRef.current) {
      spanRef.current.textContent = `${prefix}${asset.price.toFixed(decimals)}${suffix}`;
    }
  }, [asset.symbol, prefix, decimals, suffix]);

  return (
    <span
      ref={spanRef}
      className={`font-mono tabular-nums ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {prefix}{asset.price.toFixed(decimals)}{suffix}
    </span>
  );
});