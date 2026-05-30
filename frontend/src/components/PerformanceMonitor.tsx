import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  ActivityIcon,
  CpuIcon,
  HelpCircleIcon,
  ZapIcon,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { perfStore } from '../stores/store-instances';

export const PerformanceMonitor = observer(function PerformanceMonitor() {
  const { settingsStore } = useStore();
  const fpsRef = useRef(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafIdRef = useRef(0);

  useEffect(() => {
    if (!settingsStore.showPerformancePanel) {
      perfStore.stopRenderCounter();
      return;
    }

    perfStore.startRenderCounter();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perf = performance as any;

    const tick = (now: number) => {
      framesRef.current++;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1_000) {
        fpsRef.current = Math.round((framesRef.current * 1000) / elapsed);
        perfStore.setFps(fpsRef.current);
        framesRef.current = 0;
        lastTimeRef.current = now;

        if (perf.memory) {
          const used = Math.round(perf.memory.usedJSHeapSize / 1048576);
          const total = Math.round(perf.memory.jsHeapSizeLimit / 1048576);
          perfStore.setMemory(used, total);
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      perfStore.stopRenderCounter();
    };
  }, [settingsStore.showPerformancePanel]);

  if (!settingsStore.showPerformancePanel) return null;

  const memPercent =
    perfStore.memoryTotalMb > 0
      ? Math.min(100, (perfStore.memoryUsedMb / perfStore.memoryTotalMb) * 100)
      : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-4 py-2.5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <ActivityIcon className="h-4 w-4 text-blue-400" />
          <span className="whitespace-nowrap text-sm font-medium text-zinc-200">
            Performance Monitor
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
          <ZapIcon className="h-3.5 w-3.5 text-yellow-400" />
          <span className="font-mono text-sm tabular-nums text-yellow-400">{perfStore.fps}</span>
          <span className="text-xs text-zinc-500">FPS</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
          <CpuIcon className="h-3.5 w-3.5 text-purple-400" />
          <span className="font-mono text-sm tabular-nums text-green-400">
            {perfStore.memoryUsedMb}
          </span>
          <span className="text-xs text-zinc-500">/ {perfStore.memoryTotalMb || '—'} MB</span>
          <div className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${memPercent}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
          <ActivityIcon className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-sm tabular-nums text-cyan-400">
            {perfStore.renders}
          </span>
          <span className="text-xs text-zinc-500">renders/s</span>
        </div>


        <button
          type="button"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700"
          title="FPS / memory / batch render time / diff updates applied"
        >
          <HelpCircleIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
