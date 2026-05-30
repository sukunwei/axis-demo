import { useRef } from 'react';
import { perfStore } from '../stores/store-instances';

/**
 * Lightweight render counter — increments perfStore.renders each time
 * the host component renders. Reset every 1s by PerfMonitor.
 *
 * Usage: import and call `useRenderCounter()` inside any observer component.
 * Place it in key layout roots (AppContent, tab panels) to gauge how many
 * reactive re-renders happen per second.
 */
export function useRenderCounter(): void {
  const countRef = useRef(0);
  countRef.current++;
  // Report batched count on next microtask so we don't polyfill performance.mark
  queueMicrotask(() => {
    if (countRef.current > 0) {
      for (let i = 0; i < countRef.current; i++) {
        perfStore.incrementRenderCount();
      }
      countRef.current = 0;
    }
  });
}
