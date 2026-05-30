import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/useStore';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { upColor, downColor } from '../../lib/themeColors';

interface ChangeCellProps {
  symbol: string;
  paused?: boolean;
}

export const ChangeCell = observer(function ChangeCell({ symbol, paused = false }: ChangeCellProps) {
  const { marketStore, themeStore, connectionStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  const pct = asset?.changePercent ?? 0;
  const { containerRef, valueRef, format } = useAnimatedValue({
    value: pct,
    decimals: 2,
    prefix: pct >= 0 ? '+' : '',
    suffix: '%',
    paused: paused || connectionStore.paused,
    theme: themeStore.colorTheme,
    animateNumber: false,
    resetKey: symbol,
  });

  if (!asset) {
    return <span className="text-zinc-500">—</span>;
  }

  if (!isFinite(pct)) {
    return <span className="text-zinc-500">—</span>;
  }

  const color = pct > 0 ? upColor(themeStore.colorTheme) : pct < 0 ? downColor(themeStore.colorTheme) : 'text-zinc-400';

  return (
    <span
      ref={containerRef}
      className={`inline-flex items-center justify-end gap-1 rounded px-0.5 font-mono tabular-nums text-sm ${color}`}
    >
      {pct > 0 ? <ArrowUpIcon className="h-3 w-3" /> : pct < 0 ? <ArrowDownIcon className="h-3 w-3" /> : null}
      <span ref={valueRef}>{format(pct)}</span>
    </span>
  );
});
