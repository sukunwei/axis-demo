import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/useStore';
import { PriceTicker } from '../PriceTicker';

interface PriceCellProps {
  symbol: string;
  decimals?: number;
  prefix?: string;
}

export const PriceCell = observer(function PriceCell({ symbol, decimals = 2, prefix = '$' }: PriceCellProps) {
  const { marketStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  if (!asset) {
    return <span className="text-zinc-500 font-mono tabular-nums">—</span>;
  }

  const price = asset.price;
  if (!isFinite(price) || price === 0) {
    return <span className="text-zinc-500 font-mono tabular-nums">—</span>;
  }

  return <PriceTicker asset={asset} decimals={decimals} prefix={prefix} />;
});