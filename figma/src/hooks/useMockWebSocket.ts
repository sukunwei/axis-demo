import { useEffect, useState, useCallback } from 'react';
import type { MarketData, ConnectionState } from '../types/market';

const TRACKED_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'ARB', 'MATIC', 'AVAX', 'OP', 'ATOM', 'DOGE', 'LTC',
  'BCH', 'LINK', 'UNI', 'XRP', 'ADA', 'DOT', 'TRX', 'SHIB', 'PEPE', 'WIF',
  'BONK', 'APT', 'SUI', 'SEI', 'TIA', 'ORDI', 'RNDR', 'INJ', 'FTM', 'IMX',
  'GALA', 'SAND', 'MANA', 'AXS', 'BLUR', 'LDO', 'MKR', 'AAVE', 'CRV', 'SNX',
  'COMP', 'YFI', 'SUSHI', 'BAL', '1INCH', 'ENS', 'GRT', 'MASK', 'API3', 'ANKR',
  'STORJ', 'BAT', 'ZRX', 'LRC', 'CHZ', 'MINA', 'FLOW', 'ICP', 'ETC', 'XLM',
  'ALGO', 'VET', 'HBAR', 'THETA', 'FIL', 'EOS', 'ASTR', 'KAVA', 'ZIL', 'CELO',
  'ONE', 'QTUM', 'ZEN', 'RVN', 'BTG', 'WAVES', 'ICX', 'ONT', 'ZEC', 'DASH',
  'XTZ', 'NEAR', 'FET', 'AGIX', 'OCEAN', 'ROSE', 'IOTX', 'AUDIO', 'C98', 'DYDX',
  'GMX', 'PERP', 'LOOKS', 'MAGIC', 'RDNT', 'JOE', 'WOO', 'VELO', 'HFT', 'ID',
  'PENDLE', 'MEME', 'PEPE2', 'TURBO', 'SMOG', 'MYRO', 'WEN', 'BOME', 'SLERF',
  'POPCAT', 'MOG', 'DEGEN', 'BRETT', 'TOSHI', 'MOCHI', 'PONKE', 'MOTHER', 'DADDY', 'SIGMA',
  'RUNE', 'METIS', 'STRK', 'MANTA', 'DYM', 'ALT', 'JTO', 'PYTH', 'JUP', 'WLD',
  'XAI', 'PORTAL', 'PIXEL', 'AEVO', 'SAGA', 'OMNI', 'W', 'ENA', 'ETHFI', 'REZ',
  'NOT', 'IO', 'ZK', 'ZRO', 'LISTA', 'BLAST', 'TAIKO', 'EIGEN', 'BANANA', 'USUAL',
  'MOVE', 'PUFFER', 'VINE', 'BIO', 'ONDO', 'PENGU', 'HYPE', 'VIRTUAL', 'AI16Z', 'GRIFFAIN',
  'FARTCOIN', 'ZEREBRO', 'GOAT', 'ACT', 'PNUT', 'CHILLGUY', 'MOODENG', 'BULLY', 'FWOG', 'GIGA',
  'SPX', 'NEIRO', 'DOGS', 'HMSTR', 'CATI', 'GRASS', 'MAJOR', 'LUMIA', 'RARE',
  'RENDER', 'FXS', 'CVX', 'SPELL', 'ALCX', 'APE', 'SOS', 'LQTY',
  'TRIBE', 'OHM', 'KLIMA', 'BTRFLY', 'JPEG', 'NFTX', 'XEN', 'HEX', 'BONE', 'LEASH',
  'RSR', 'JASMY', 'GLMR', 'SFUND', 'PROM', 'QNT'
];

const BASE_PRICES: Record<string, number> = {
  BTC: 45000,
  ETH: 2800,
  SOL: 95,
  ARB: 1.2,
  MATIC: 0.85,
  AVAX: 35,
  OP: 2.5,
  ATOM: 12,
  DOGE: 0.08,
  LTC: 75
};

function generateMockData(): Map<string, MarketData> {
  const now = Date.now();
  const data = new Map<string, MarketData>();

  TRACKED_SYMBOLS.forEach(symbol => {
    const basePrice = BASE_PRICES[symbol] || Math.random() * 10 + 0.5;
    const dayChangePercent = (Math.random() - 0.5) * 20;
    const dayOpen = basePrice / (1 + dayChangePercent / 100);

    data.set(symbol, {
      symbol,
      price: basePrice,
      prevPrice: basePrice,
      dayOpen,
      dayHigh: basePrice * 1.05,
      dayLow: basePrice * 0.95,
      volume24h: Math.random() * 10000000,
      changePercent: dayChangePercent,
      lastUpdate: now
    });
  });

  return data;
}

export function useMockWebSocket() {
  const [marketData, setMarketData] = useState<Map<string, MarketData>>(generateMockData());
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');

  const updatePrices = useCallback(() => {
    setMarketData(prev => {
      const next = new Map(prev);
      const now = Date.now();

      // Update 10-30 random symbols each tick to simulate real-time updates
      const symbolsToUpdate = Math.floor(Math.random() * 20) + 10;
      const symbols = Array.from(next.keys());

      for (let i = 0; i < symbolsToUpdate; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const current = next.get(symbol);

        if (current) {
          // Small price change (-0.5% to +0.5%)
          const priceChange = (Math.random() - 0.5) * 0.01;
          const newPrice = current.price * (1 + priceChange);

          const updated: MarketData = {
            ...current,
            prevPrice: current.price,
            price: newPrice,
            dayHigh: Math.max(current.dayHigh, newPrice),
            dayLow: Math.min(current.dayLow, newPrice),
            changePercent: ((newPrice - current.dayOpen) / current.dayOpen) * 100,
            volume24h: current.volume24h + Math.random() * 10000,
            lastUpdate: now
          };

          next.set(symbol, updated);
        }
      }

      return next;
    });
  }, []);

  useEffect(() => {
    // Simulate connection state changes
    const connectionInterval = setInterval(() => {
      const random = Math.random();
      if (random > 0.98) {
        setConnectionState('reconnecting');
        setTimeout(() => setConnectionState('connected'), 2000);
      }
    }, 10000);

    // Update prices at ~5Hz (200ms interval)
    const priceInterval = setInterval(updatePrices, 200);

    return () => {
      clearInterval(connectionInterval);
      clearInterval(priceInterval);
    };
  }, [updatePrices]);

  const subscribe = useCallback(() => {
    console.log('Mock WebSocket: subscribe called');
  }, []);

  return {
    marketData,
    connectionState,
    subscribe
  };
}
