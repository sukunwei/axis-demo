import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = ''
}: AnimatedNumberProps) {
  const { displayValue, direction } = useAnimatedNumber(value, { decimals });

  const flashClass =
    direction === 'up'
      ? 'text-green-500'
      : direction === 'down'
      ? 'text-red-500'
      : '';

  return (
    <span
      className={`transition-colors duration-300 ${flashClass} ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {prefix}
      {displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}
      {suffix}
    </span>
  );
}
