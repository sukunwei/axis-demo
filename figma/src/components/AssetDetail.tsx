import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { usePriceHistory } from '../hooks/usePriceHistory';
import type { MarketData } from '../types/market';

interface AssetDetailProps {
  symbol: string;
  marketData: Map<string, MarketData>;
  onBack: () => void;
}

export function AssetDetail({ symbol, marketData, onBack }: AssetDetailProps) {
  const data = marketData.get(symbol);
  const history = usePriceHistory(symbol, data);

  const chartData = useMemo(() => {
    return history.map(point => ({
      timestamp: point.timestamp,
      price: point.price,
      time: new Date(point.timestamp).toLocaleTimeString()
    }));
  }, [history]);

  const priceChange = data ? data.price - data.dayOpen : 0;
  const isPositive = priceChange >= 0;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-gray-400">No data available for {symbol}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-white via-gray-50 to-blue-50/30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
            {symbol.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{symbol}</h1>
            <div className="text-sm text-gray-600">Perpetual Future</div>
          </div>
        </div>
      </div>

      {/* Price Summary */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-white via-blue-50/20 to-white">
        <div className="flex items-baseline gap-4 mb-6">
          <AnimatedNumber
            value={data.price}
            decimals={data.price < 1 ? 4 : 2}
            prefix="$"
            className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
          />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            isPositive
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {isPositive ? (
              <TrendingUpIcon className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDownIcon className="w-4 h-4 text-red-600" />
            )}
            <AnimatedNumber
              value={data.changePercent}
              decimals={2}
              suffix="%"
              className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">24h High</div>
            <AnimatedNumber
              value={data.dayHigh}
              decimals={data.dayHigh < 1 ? 4 : 2}
              prefix="$"
              className="text-lg font-semibold text-green-600 font-mono"
            />
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">24h Low</div>
            <AnimatedNumber
              value={data.dayLow || data.price}
              decimals={data.dayLow < 1 ? 4 : 2}
              prefix="$"
              className="text-lg font-semibold text-red-600 font-mono"
            />
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">24h Open</div>
            <AnimatedNumber
              value={data.dayOpen || data.price}
              decimals={data.dayOpen < 1 ? 4 : 2}
              prefix="$"
              className="text-lg font-semibold text-gray-900 font-mono"
            />
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">24h Volume</div>
            <AnimatedNumber
              value={data.volume24h}
              decimals={0}
              prefix="$"
              className="text-lg font-semibold text-blue-600 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="flex-1 p-6 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Price Chart</h2>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#111827',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#059669' : '#dc2626'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            Collecting price data...
          </div>
        )}
      </div>
    </div>
  );
}
