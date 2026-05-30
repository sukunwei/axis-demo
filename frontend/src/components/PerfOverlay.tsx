import { useEffect, useRef } from 'react';

export function PerfOverlay() {
  const fpsRef = useRef<HTMLSpanElement>(null);
  const memoryRef = useRef<HTMLSpanElement>(null);
  const lastTimeRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perf = performance as any;

    const tick = (now: number) => {
      framesRef.current++;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1_000) {
        const fps = Math.round((framesRef.current * 1000) / elapsed);
        if (fpsRef.current) {
          fpsRef.current.textContent = fps.toString();
        }
        framesRef.current = 0;
        lastTimeRef.current = now;

        if (memoryRef.current && perf.memory) {
          const used = Math.round(perf.memory.usedJSHeapSize / 1048576);
          memoryRef.current.textContent = `${used}MB`;
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
      <span>
        FPS: <span ref={fpsRef} className="text-zinc-100">--</span>
      </span>
      {typeof performance !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (performance as any).memory && (
          <span>
            MEM: <span ref={memoryRef} className="text-zinc-100">--</span>
          </span>
        )}
    </div>
  );
}
