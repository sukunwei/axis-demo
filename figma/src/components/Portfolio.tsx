import { useMemo } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import type { MarketData, Position } from '../types/market';

interface PortfolioProps {
  marketData: Map<string, MarketData>;
  onSelectSymbol: (symbol: string) => void;
}

// Mock positions - in a real app these would come from user data
const MOCK_POSITIONS = [
  { symbol: 'BTC', quantity: 0.5, avgCost: 45000 },
  { symbol: 'ETH', quantity: 5, avgCost: 2800 },
  { symbol: 'SOL', quantity: 100, avgCost: 95 },
  { symbol: 'ARB', quantity: 1000, avgCost: 1.2 },
  { symbol: 'MATIC', quantity: 5000, avgCost: 0.85 },
  { symbol: 'AVAX', quantity: 50, avgCost: 35 },
  { symbol: 'OP', quantity: 500, avgCost: 2.5 },
  { symbol: 'LINK', quantity: 200, avgCost: 14 },
  { symbol: 'UNI', quantity: 300, avgCost: 6.5 },
  { symbol: 'DOGE', quantity: 10000, avgCost: 0.08 }
];

export function Portfolio({ marketData, onSelectSymbol }: PortfolioProps) {
  // Calculate positions with current P&L
  const positions = useMemo((): Position[] => {
    return MOCK_POSITIONS.map(mock => {
      const current = marketData.get(mock.symbol);
      const currentPrice = current?.price || mock.avgCost;
      const marketValue = mock.quantity * currentPrice;
      const costBasis = mock.quantity * mock.avgCost;
      const unrealizedPnL = marketValue - costBasis;
      const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

      return {
        symbol: mock.symbol,
        quantity: mock.quantity,
        avgCost: mock.avgCost,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent
      };
    });
  }, [marketData]);

  // Calculate portfolio totals
  const portfolioStats = useMemo(() => {
    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.quantity * pos.currentPrice,
      0
    );
    const totalCost = positions.reduce(
      (sum, pos) => sum + pos.quantity * pos.avgCost,
      0
    );
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = (totalPnL / totalCost) * 100;

    return {
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent
    };
  }, [positions]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Portfolio Summary */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-white via-blue-50/30 to-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-sm font-medium text-gray-600 mb-2">Total Portfolio Value</h2>
            <div className="flex items-baseline gap-3">
              <AnimatedNumber
                value={portfolioStats.totalValue}
                decimals={2}
                prefix="$"
                className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-600 mb-1">Positions</div>
            <div className="text-2xl font-bold text-gray-900">{positions.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">Unrealized P&L</div>
            <div className="flex items-center gap-2">
              <AnimatedNumber
                value={portfolioStats.totalPnL}
                decimals={2}
                prefix="$"
                className={`text-xl font-bold ${
                  portfolioStats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              />
            </div>
            <AnimatedNumber
              value={portfolioStats.totalPnLPercent}
              decimals={2}
              prefix=""
              suffix="%"
              className={`text-sm ${
                portfolioStats.totalPnL >= 0 ? 'text-green-600/80' : 'text-red-600/80'
              }`}
            />
          </div>

          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">Cost Basis</div>
            <AnimatedNumber
              value={portfolioStats.totalCost}
              decimals={2}
              prefix="$"
              className="text-xl font-bold text-gray-900"
            />
            <div className="text-sm text-gray-600">Total invested</div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-1">Today's Change</div>
            <AnimatedNumber
              value={portfolioStats.totalPnL * 0.15}
              decimals={2}
              prefix="$"
              className={`text-xl font-bold ${
                portfolioStats.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            />
            <div className={`text-sm ${
              portfolioStats.totalPnL >= 0 ? 'text-green-500/70' : 'text-red-500/70'
            }`}>
              Last 24h
            </div>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
        <div>Symbol</div>
        <div className="text-right">Quantity</div>
        <div className="text-right">Avg Cost</div>
        <div className="text-right">Last Price</div>
        <div className="text-right">Unrealized P&L</div>
        <div className="text-right">P&L %</div>
      </div>

      {/* Positions List */}
      <div className="flex-1 overflow-y-auto">
        {positions.map((position) => (
          <div
            key={position.symbol}
            onClick={() => onSelectSymbol(position.symbol)}
            className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {position.symbol.charAt(0)}
              </div>
              <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {position.symbol}
              </span>
            </div>

            <div className="flex items-center justify-end text-gray-900 font-mono">
              <AnimatedNumber
                value={position.quantity}
                decimals={position.quantity < 1 ? 4 : 2}
              />
            </div>

            <div className="flex items-center justify-end text-gray-600 font-mono text-sm">
              <AnimatedNumber
                value={position.avgCost}
                decimals={position.avgCost < 1 ? 4 : 2}
                prefix="$"
              />
            </div>

            <div className="flex items-center justify-end font-mono">
              <AnimatedNumber
                value={position.currentPrice}
                decimals={position.currentPrice < 1 ? 4 : 2}
                prefix="$"
                className="text-gray-900"
              />
            </div>

            <div className="flex items-center justify-end font-mono">
              <AnimatedNumber
                value={position.unrealizedPnL}
                decimals={2}
                prefix="$"
                className={
                  position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }
              />
            </div>

            <div className="flex items-center justify-end font-mono">
              <AnimatedNumber
                value={position.unrealizedPnLPercent}
                decimals={2}
                suffix="%"
                className={
                  position.unrealizedPnLPercent >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
