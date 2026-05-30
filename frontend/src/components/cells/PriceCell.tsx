import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/useStore';
import { PriceTicker } from '../PriceTicker';

interface PriceCellProps {
  symbol: string;
  decimals?: number;
  prefix?: string;
  /** Extra pause when parent tab is hidden (keep-alive). */
  paused?: boolean;
}

export const PriceCell = observer(function PriceCell({
  symbol,
  decimals = 2,
  prefix = '$',
  paused = false,
}: PriceCellProps) {
  const { marketStore, connectionStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  if (!asset) {
    return <span className="text-zinc-500 font-mono tabular-nums">—</span>;
  }

  const price = asset.price;
  if (!isFinite(price) || price === 0) {
    return <span className="text-zinc-500 font-mono tabular-nums">—</span>;
  }

  return (
    <PriceTicker
      asset={asset}
      decimals={decimals}
      prefix={prefix}
      paused={paused || connectionStore.paused}
    />
  );
});