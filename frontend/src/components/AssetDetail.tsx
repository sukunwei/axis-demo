import { observer } from 'mobx-react-lite';
import { useStore } from '../stores/useStore';
import { ArrowLeftIcon } from 'lucide-react';
import { PriceCell } from './cells/PriceCell';
import { ChangeCell } from './cells/ChangeCell';

interface AssetDetailProps {
  symbol: string;
  onBack: () => void;
}

export const AssetDetail = observer(function AssetDetail({ symbol, onBack }: AssetDetailProps) {
  const { marketStore } = useStore();
  const asset = marketStore.getAsset(symbol);

  if (!asset) {
    return (
      <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          Symbol not found: {symbol}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Symbol Info */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
              {symbol.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">{symbol}</h2>
              <div className="flex items-center gap-2 mt-1">
                <PriceCell symbol={symbol} decimals={4} prefix="" />
                <ChangeCell symbol={symbol} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Day Open</div>
            <div className="font-mono tabular-nums text-zinc-100">${asset.dayOpen.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Day High</div>
            <div className="font-mono tabular-nums text-zinc-100">${asset.dayHigh.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Day Low</div>
            <div className="font-mono tabular-nums text-zinc-100">${asset.dayLow.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">24h Volume</div>
            <div className="font-mono tabular-nums text-zinc-100">{asset.volume24h.toLocaleString()}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Last Price</div>
            <div className="font-mono tabular-nums text-zinc-100">${asset.price.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Change</div>
            <div className={`font-mono tabular-nums ${asset.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Sparkline placeholder */}
        <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 mb-3">Price Chart (24h)</div>
          <div className="h-32 flex items-center justify-center text-zinc-600">
            <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                points={generateSparkline(asset.price, 20)}
                className="text-blue-500"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});

function generateSparkline(currentPrice: number, points: number): string {
  const w = 200;
  const h = 60;
  const now = Date.now();
  const step = 3600000 / points;
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    const t = now - (points - i - 1) * step;
    const price = currentPrice * (0.95 + 0.1 * Math.sin(t / 3600000) + (Math.random() - 0.5) * 0.02);
    const x = (i / (points - 1)) * w;
    const y = h - ((price - currentPrice * 0.9) / (currentPrice * 0.2)) * h;
    pts.push(`${x},${Math.max(5, Math.min(h - 5, y))}`);
  }
  return pts.join(' ');
}