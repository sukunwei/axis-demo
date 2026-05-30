import { useEffect, useRef } from 'react';
import type { ColorTheme } from '../stores/themeStore';
import { applyBackgroundFlash, flashColor } from '../lib/flashColors';

const CUBIC_EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);
const DURATION_MS = 150;

interface UseAnimatedValueOptions {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  paused?: boolean;
  theme: ColorTheme;
  /** When false, skip number tween and flash effect. */
  enableFlash?: boolean;
  /** When false, skip number tween (flash still runs). */
  animateNumber?: boolean;
  resetKey?: string | number;
}

export function useAnimatedValue({
  value,
  decimals,
  prefix,
  suffix,
  paused = false,
  theme,
  enableFlash = false,
  animateNumber = false,
  resetKey,
}: UseAnimatedValueOptions) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number | null>(null);
  const fromRef = useRef(value);
  const cleanupFlashRef = useRef<(() => void) | null>(null);

  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    fromRef.current = value;
    if (valueRef.current) {
      valueRef.current.textContent = format(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (paused) {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      return;
    }

    const container = containerRef.current;
    const span = valueRef.current;
    if (!container || !span) return;

    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const from = fromRef.current;
    const to = value;

    if (Math.abs(from - to) < 0.0000001) {
      span.textContent = format(to);
      return;
    }

    if (enableFlash) {
      const direction: 'up' | 'down' = from < to ? 'up' : 'down';
      cleanupFlashRef.current?.();
      cleanupFlashRef.current = applyBackgroundFlash(container, flashColor(theme, direction));
    }

    if (!animateNumber || Math.abs(from - to) < 0.0001) {
      span.textContent = format(to);
      fromRef.current = to;
      return;
    }

    let startTime = 0;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / DURATION_MS, 1);
      const current = from + (to - from) * CUBIC_EASE_OUT(progress);
      span.textContent = format(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        fromRef.current = to;
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      cleanupFlashRef.current?.();
      cleanupFlashRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, paused, theme, enableFlash, decimals, prefix, suffix, animateNumber]);

  return { containerRef, valueRef, format, displayValue: value };
}
