import { memo, useEffect, useRef, type RefObject } from 'react';
import type { PricePoint } from '../hooks/usePriceHistoryRef';

interface PriceChartCanvasProps {
  /** Ref to live price history — RAF loop reads this directly, zero re-renders */
  dataRef: RefObject<PricePoint[]>;
  stroke: string;
  decimals: number;
  /** Set true when tab is hidden — cancels RAF to save CPU */
  paused?: boolean;
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: PricePoint[],
  stroke: string,
  decimals: number,
): void {
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2 || width < 8 || height < 8) return;

  const padLeft = 56;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  if (plotW <= 0 || plotH <= 0) return;

  // Single-pass min/max — avoids array allocation and spread argument lists
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const p = data[i].price;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  const range = max - min;
  const padY = range > 0 ? range * 0.06 : max * 0.001 || 0.01;
  min -= padY;
  max += padY;
  const span = max - min || 1;

  const toX = (i: number) => padLeft + (i / (data.length - 1)) * plotW;
  const toY = (price: number) => padTop + plotH - ((price - min) / span) * plotH;

  // Grid
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
  }

  // Y labels
  ctx.fillStyle = '#71717a';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelDecimals = decimals > 4 ? 4 : decimals;
  for (let i = 0; i <= 4; i++) {
    const price = max - (span * i) / 4;
    const y = padTop + (plotH * i) / 4;
    ctx.fillText(`$${price.toFixed(labelDecimals)}`, padLeft - 6, y);
  }

  // Area fill
  const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  gradient.addColorStop(0, stroke === '#4ade80' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.beginPath();
  data.forEach((pt, i) => {
    const x = toX(i);
    const y = toY(pt.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(toX(data.length - 1), padTop + plotH);
  ctx.lineTo(toX(0), padTop + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  data.forEach((pt, i) => {
    const x = toX(i);
    const y = toY(pt.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Last point dot
  const last = data[data.length - 1];
  const lx = toX(data.length - 1);
  const ly = toY(last.price);
  ctx.beginPath();
  ctx.fillStyle = stroke;
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fill();

  // X label
  ctx.fillStyle = '#71717a';
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  ctx.fillText(fmt(data[0].timestamp), padLeft, padTop + plotH + 6);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(last.timestamp), padLeft + plotW, padTop + plotH + 6);
}

export const PriceChartCanvas = memo(function PriceChartCanvas({
  dataRef,
  stroke,
  decimals,
  paused = false,
}: PriceChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  // Dirty-check primitives — compared per frame without allocating a key string
  const lastRef = useRef({ len: 0, ts: 0, price: 0, stroke: '', w: 0, h: 0 });

  // ResizeObserver writes to sizeRef — no setState, no re-render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  // RAF loop: runs continuously, only redraws when data changes
  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = () => {
      const canvas = canvasRef.current;
      const { w, h } = sizeRef.current;
      const data = dataRef.current;

      if (canvas && w > 0 && h > 0 && data && data.length >= 2) {
        const last = data[data.length - 1];
        const prev = lastRef.current;
        const changed =
          data.length !== prev.len ||
          last.timestamp !== prev.ts ||
          last.price !== prev.price ||
          stroke !== prev.stroke ||
          w !== prev.w ||
          h !== prev.h;

        if (changed) {
          prev.len = data.length;
          prev.ts = last.timestamp;
          prev.price = last.price;
          prev.stroke = stroke;
          prev.w = w;
          prev.h = h;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawChart(ctx, w, h, data, stroke, decimals);
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, dataRef, stroke, decimals]);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[400px]" style={{ contain: 'layout' }}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Price chart" />
    </div>
  );
});
