import { useMemo } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon, DollarSignIcon } from 'lucide-react';
import type { MarketData } from '../types/market';

interface MarketOverviewProps {
  marketData: Map<string, MarketData>;
}

export function MarketOverview({ marketData }: MarketOverviewProps) {
  const stats = useMemo(() => {
    const data = Array.from(marketData.values());

    const gainers = data.filter(d => d.changePercent > 0).length;
    const losers = data.filter(d => d.changePercent < 0).length;
    const totalVolume = data.reduce((sum, d) => sum + d.volume24h, 0);
    const avgChange = data.reduce((sum, d) => sum + d.changePercent, 0) / data.length;

    const topGainer = data.reduce((max, d) =>
      d.changePercent > max.changePercent ? d : max
    , data[0] || { symbol: '-', changePercent: 0 });

    const topLoser = data.reduce((min, d) =>
      d.changePercent < min.changePercent ? d : min
    , data[0] || { symbol: '-', changePercent: 0 });

    return {
      gainers,
      losers,
      totalVolume,
      avgChange,
      topGainer,
      topLoser,
      total: data.length
    };
  }, [marketData]);

  return (
    <div className="grid grid-cols-4 gap-4 p-4 bg-gradient-to-br from-gray-50 via-white to-gray-50 border-b border-gray-200">
      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <TrendingUpIcon className="w-4 h-4 text-green-600" />
          </div>
          <span className="text-xs text-gray-600">Gainers</span>
        </div>
        <div className="text-2xl font-bold text-green-600">{stats.gainers}</div>
        <div className="text-xs text-gray-600 mt-1">
          Top: {stats.topGainer.symbol} +{stats.topGainer.changePercent.toFixed(2)}%
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <TrendingDownIcon className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-xs text-gray-600">Losers</span>
        </div>
        <div className="text-2xl font-bold text-red-600">{stats.losers}</div>
        <div className="text-xs text-gray-600 mt-1">
          Top: {stats.topLoser.symbol} {stats.topLoser.changePercent.toFixed(2)}%
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <DollarSignIcon className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-xs text-gray-600">24h Volume</span>
        </div>
        <AnimatedNumber
          value={stats.totalVolume}
          decimals={0}
          prefix="$"
          className="text-2xl font-bold text-gray-900"
        />
        <div className="text-xs text-gray-600 mt-1">
          Across {stats.total} markets
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <ActivityIcon className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-xs text-gray-600">Avg Change</span>
        </div>
        <AnimatedNumber
          value={stats.avgChange}
          decimals={2}
          suffix="%"
          className={`text-2xl font-bold ${
            stats.avgChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        />
        <div className="text-xs text-gray-600 mt-1">
          Market sentiment
        </div>
      </div>
    </div>
  );
}
