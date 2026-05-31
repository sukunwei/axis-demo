import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  paused?: boolean;
  enableFlash?: boolean;
  animateNumber?: boolean;
}

export const AnimatedNumber = observer(function AnimatedNumber({
  value,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
  paused,
  enableFlash = false,
  animateNumber,
}: AnimatedNumberProps) {
  const { connectionStore, themeStore } = useStore();
  const { containerRef, valueRef, format, displayValue } = useAnimatedValue({
    value,
    decimals,
    prefix,
    suffix,
    paused: paused ?? connectionStore.paused,
    theme: themeStore.colorTheme,
    enableFlash,
    animateNumber,
  });

  return (
    <span ref={containerRef} className={`inline-block rounded px-0.5 ${className}`}>
      <span ref={valueRef} className="font-mono tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format(displayValue)}
      </span>
    </span>
  );
});
