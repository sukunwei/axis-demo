import { observer } from 'mobx-react-lite';
import type { Asset } from '../stores/models/Asset';
import { useStore } from '../stores/useStore';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

interface PriceTickerProps {
  asset: Asset;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  paused?: boolean;
}

export const PriceTicker = observer(function PriceTicker({
  asset,
  decimals = 2,
  prefix = '$',
  suffix = '',
  className = '',
  paused = false,
}: PriceTickerProps) {
  const { connectionStore, themeStore } = useStore();
  const { containerRef, valueRef, format, displayValue } = useAnimatedValue({
    value: asset.price,
    decimals,
    prefix,
    suffix,
    paused: paused || connectionStore.paused,
    theme: themeStore.colorTheme,
    enableFlash: false,
    resetKey: asset.symbol,
  });

  return (
    <span ref={containerRef} className={`inline-block rounded px-0.5 ${className}`}>
      <span ref={valueRef} className="font-mono tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format(displayValue)}
      </span>
    </span>
  );
});
