import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/useStore';
import { PriceTicker } from '../PriceTicker';

interface PriceCellProps {
  symbol: string;
  decimals?: number;
  prefix?: string;
  /** Extra pause when parent tab is hidden (keep-alive). */
  paused?: boolean;
  enableFlash?: boolean;
  animateNumber?: boolean;
}

export const PriceCell = observer(function PriceCell({
  symbol,
  decimals,
  prefix = '$',
  paused = false,
  enableFlash,
  animateNumber,
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

  // Dynamic decimals: 8 for sub-1, 4 for 1-100, 2 for 100+
  const d = decimals ?? (price > 100 ? 2 : price > 1 ? 4 : 8);

  return (
    <PriceTicker
      asset={asset}
      decimals={d}
      prefix={prefix}
      paused={paused || connectionStore.paused}
      enableFlash={enableFlash}
      animateNumber={animateNumber}
    />
  );
});