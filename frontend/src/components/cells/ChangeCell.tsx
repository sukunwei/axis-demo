import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/useStore';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface ChangeCellProps {
  symbol: string;
}

export const ChangeCell = observer(function ChangeCell({ symbol }: ChangeCellProps) {
  const { marketStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  if (!asset) {
    return <span className="text-zinc-500">—</span>;
  }

  const pct = asset.changePercent;
  const color = pct > 0 ? 'text-green-400' : pct < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <span className={`flex items-center justify-end gap-1 font-mono tabular-nums text-sm ${color}`}>
      {pct > 0 ? <ArrowUpIcon className="w-3 h-3" /> : pct < 0 ? <ArrowDownIcon className="w-3 h-3" /> : null}
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
});
