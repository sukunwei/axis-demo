import { useMemo } from 'react';
import { usePriceHistory } from '../hooks/usePriceHistory';
import type { MarketData } from '../types/market';

interface PriceSparklineProps {
  symbol: string;
  marketData?: MarketData;
  width?: number;
  height?: number;
  className?: string;
}

export function PriceSparkline({
  symbol,
  marketData,
  width = 80,
  height = 24,
  className = ''
}: PriceSparklineProps) {
  const history = usePriceHistory(symbol, marketData);

  const { path, color } = useMemo(() => {
    if (history.length < 2) {
      return { path: '', color: '#6b7280' };
    }

    const prices = history.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const points = history.map((point, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((point.price - minPrice) / priceRange) * height;
      return `${x},${y}`;
    });

    const pathString = `M ${points.join(' L ')}`;

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const lineColor = lastPrice >= firstPrice ? '#10b981' : '#ef4444';

    return { path: pathString, color: lineColor };
  }, [history, width, height]);

  if (history.length < 2) {
    return <div className={className} style={{ width, height }} />;
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
