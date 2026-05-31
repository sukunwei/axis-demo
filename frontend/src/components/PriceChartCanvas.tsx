import { memo, useCallback, useEffect, useRef, type RefObject } from 'react';
import type { PricePoint } from '../hooks/usePriceHistoryRef';
import { formatTrimmed } from '../lib/format';

interface PriceChartCanvasProps {
  /** Ref to live price history — RAF loop reads this directly, zero re-renders */
  dataRef: RefObject<PricePoint[]>;
  stroke: string;
  decimals: number;
  /** Set true when tab is hidden — cancels RAF to save CPU */
  paused?: boolean;
}

interface ChartLayout {
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotW: number;
  plotH: number;
  min: number;
  max: number;
  span: number;
  labelDecimals: number;
  width: number;
  height: number;
}

/** Enough precision so adjacent Y grid lines don't collapse to the same label */
function yLabelDecimals(span: number, assetDecimals: number): number {
  const step = span / 4;
  if (step <= 0) return assetDecimals;
  let d = 0;
  let s = Math.abs(step);
  while (d < 10 && s < 1) {
    s *= 10;
    d++;
  }
  const fromStep = d + 1;
  return Math.min(8, Math.max(assetDecimals, fromStep, 2));
}

function computeLayout(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: PricePoint[],
  decimals: number,
): ChartLayout | null {
  if (data.length < 2 || width < 8 || height < 8) return null;

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
  const labelDecimals = yLabelDecimals(span, decimals);

  ctx.font = '11px ui-monospace, monospace';
  let maxLabelW = 0;
  for (let i = 0; i <= 4; i++) {
    const price = max - (span * i) / 4;
    maxLabelW = Math.max(maxLabelW, ctx.measureText(`$${formatTrimmed(price, labelDecimals)}`).width);
  }
  const padLeft = Math.ceil(maxLabelW) + 12;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  if (plotW <= 0 || plotH <= 0) return null;

  return {
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW,
    plotH,
    min,
    max,
    span,
    labelDecimals,
    width,
    height,
  };
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  data: PricePoint[],
  stroke: string,
  hoverIndex: number | null,
): void {
  const { padLeft, padTop, plotW, plotH, min, span, labelDecimals, width, height } = layout;

  ctx.clearRect(0, 0, width, height);

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
  for (let i = 0; i <= 4; i++) {
    const price = layout.max - (span * i) / 4;
    const y = padTop + (plotH * i) / 4;
    ctx.fillText(`$${formatTrimmed(price, labelDecimals)}`, padLeft - 8, y);
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

  const last = data[data.length - 1];
  const lastIdx = data.length - 1;
  const highlightIdx = hoverIndex ?? lastIdx;
  const hx = toX(highlightIdx);
  const hy = toY(data[highlightIdx].price);

  // Hover crosshair
  if (hoverIndex !== null) {
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hx, padTop);
    ctx.lineTo(hx, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Point dot (hover or last)
  ctx.beginPath();
  ctx.fillStyle = stroke;
  ctx.arc(hx, hy, hoverIndex !== null ? 4 : 3, 0, Math.PI * 2);
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

function indexAtX(layout: ChartLayout, dataLen: number, clientX: number, rectLeft: number): number {
  const x = clientX - rectLeft - layout.padLeft;
  if (x < 0 || x > layout.plotW || dataLen < 2) return -1;
  const ratio = x / layout.plotW;
  return Math.min(dataLen - 1, Math.max(0, Math.round(ratio * (dataLen - 1))));
}

export const PriceChartCanvas = memo(function PriceChartCanvas({
  dataRef,
  stroke,
  decimals,
  paused = false,
}: PriceChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const layoutRef = useRef<ChartLayout | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const lastRef = useRef({ len: 0, ts: 0, price: 0, stroke: '', w: 0, h: 0, hover: -1 });

  const paint = useCallback(
    (force = false) => {
      const canvas = canvasRef.current;
      const { w, h } = sizeRef.current;
      const data = dataRef.current;
      if (!canvas || w <= 0 || h <= 0 || !data || data.length < 2) return;

      const last = data[data.length - 1];
      const hover = hoverIndexRef.current;
      const prev = lastRef.current;
      const changed =
        force ||
        data.length !== prev.len ||
        last.timestamp !== prev.ts ||
        last.price !== prev.price ||
        stroke !== prev.stroke ||
        w !== prev.w ||
        h !== prev.h ||
        (hover ?? -1) !== prev.hover;

      if (!changed) return;

      prev.len = data.length;
      prev.ts = last.timestamp;
      prev.price = last.price;
      prev.stroke = stroke;
      prev.w = w;
      prev.h = h;
      prev.hover = hover ?? -1;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const layout = computeLayout(ctx, w, h, data, decimals);
      if (!layout) return;
      layoutRef.current = layout;
      drawChart(ctx, layout, data, stroke, hover);
    },
    [dataRef, stroke, decimals],
  );

  const updateTooltip = useCallback(
    (index: number | null) => {
      const tip = tooltipRef.current;
      const layout = layoutRef.current;
      const data = dataRef.current;
      if (!tip || !layout || !data || data.length < 2) {
        if (tip) tip.style.opacity = '0';
        return;
      }
      if (index === null || index < 0) {
        tip.style.opacity = '0';
        return;
      }

      const pt = data[index];
      const x = layout.padLeft + (index / (data.length - 1)) * layout.plotW;
      const y = layout.padTop + layout.plotH - ((pt.price - layout.min) / layout.span) * layout.plotH;

      tip.textContent = `$${formatTrimmed(pt.price, layout.labelDecimals)} · ${new Date(pt.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })}`;
      tip.style.opacity = '1';
      tip.style.left = `${x}px`;
      tip.style.top = `${Math.max(8, y - 36)}px`;
    },
    [dataRef],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      paint(true);
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const layout = layoutRef.current;
      const data = dataRef.current;
      if (!layout || !data || data.length < 2) return;
      const rect = el.getBoundingClientRect();
      const idx = indexAtX(layout, data.length, e.clientX, rect.left);
      if (idx < 0) {
        hoverIndexRef.current = null;
        updateTooltip(null);
        paint(true);
        return;
      }
      hoverIndexRef.current = idx;
      updateTooltip(idx);
      paint(true);
    };

    const onLeave = () => {
      hoverIndexRef.current = null;
      updateTooltip(null);
      paint(true);
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [dataRef, paint, updateTooltip]);

  // RAF loop: runs continuously, only redraws when data changes
  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = () => {
      paint(false);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, paint]);

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[400px]" style={{ contain: 'layout' }}>
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" aria-label="Price chart" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs font-mono tabular-nums text-zinc-200 opacity-0 shadow-lg transition-opacity"
        aria-hidden
      />
    </div>
  );
});
