import { useEffect, useRef, useState, useCallback } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';
import type { MarketData, ConnectionState } from '../types/market';

const WS_URL = 'wss://api.hyperliquid.xyz/ws';
const API_URL = 'https://api.hyperliquid.xyz/info';

interface UseWebSocketReturn {
  marketData: Map<string, MarketData>;
  connectionState: ConnectionState;
}

interface HyperliquidAllMidsMessage {
  channel: string;
  data: {
    mids: Record<string, string>;
  };
}

interface AssetInfo {
  name: string;
  szDecimals: number;
}

export function useWebSocket(): UseWebSocketReturn {
  const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const previousDataRef = useRef<Map<string, MarketData>>(new Map());
  const assetMapRef = useRef<Map<string, string>>(new Map()); // assetId -> symbol name

  const processHyperliquidData = useCallback((mids: Record<string, string>) => {
    const now = Date.now();

    setMarketData(prev => {
      const next = new Map(prev);

      Object.entries(mids).forEach(([assetId, priceStr]) => {
        const price = parseFloat(priceStr);

        // Get the symbol name from asset ID (e.g., "#1000" -> "BTC")
        const symbol = assetMapRef.current.get(assetId) || assetId;

        const prevData = prev.get(symbol) || previousDataRef.current.get(symbol);

        // Calculate change from previous data or use current as baseline
        const dayOpen = prevData?.dayOpen || price;
        const dayHigh = Math.max(prevData?.dayHigh || price, price);
        const dayLow = Math.min(prevData?.dayLow || price, price);
        const priceChange = price - dayOpen;
        const changePercent = dayOpen > 0 ? (priceChange / dayOpen) * 100 : 0;

        // Simulate volume based on price volatility
        const volatility = Math.abs(changePercent);
        const volume24h = Math.random() * 10000000 * (1 + volatility);

        next.set(symbol, {
          symbol,
          price,
          changePercent,
          dayHigh,
          dayLow,
          dayOpen,
          volume24h,
          timestamp: now
        });
      });

      previousDataRef.current = new Map(next);
      return next;
    });
  }, []);

  useEffect(() => {
    // Fetch asset metadata to map asset IDs to symbol names
    const fetchAssetMetadata = async () => {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });

        const data = await response.json();
        console.log('Asset metadata:', data);

        if (data.universe) {
          // Build mapping: assetId -> symbol name
          data.universe.forEach((asset: AssetInfo, index: number) => {
            const assetId = `#${1000 + index}`; // Asset IDs start from #1000
            assetMapRef.current.set(assetId, asset.name);
          });
          console.log('Asset map loaded:', assetMapRef.current.size, 'assets');
        }
      } catch (err) {
        console.error('Error fetching asset metadata:', err);
      }
    };

    fetchAssetMetadata();

    const ws = new ReconnectingWebSocket(WS_URL, [], {
      connectionTimeout: 5000,
      maxRetries: Infinity,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
    });

    wsRef.current = ws;

    ws.addEventListener('open', () => {
      console.log('WebSocket connected to Hyperliquid');
      setConnectionState('connected');

      // Subscribe to all mids (all market prices)
      const subscribeMsg = {
        method: 'subscribe',
        subscription: {
          type: 'allMids'
        }
      };
      console.log('Sending subscription:', subscribeMsg);
      ws.send(JSON.stringify(subscribeMsg));
    });

    ws.addEventListener('message', (event) => {
      try {
        const message: HyperliquidAllMidsMessage = JSON.parse(event.data);

        if (message.channel === 'allMids' && message.data?.mids) {
          processHyperliquidData(message.data.mids);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err, 'Raw data:', event.data);
      }
    });

    ws.addEventListener('close', (event) => {
      console.log('WebSocket disconnected:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setConnectionState('disconnected');
    });

    ws.addEventListener('error', (err) => {
      console.error('WebSocket error details:', {
        type: err.type,
        target: err.target,
        message: err.message,
        error: err
      });
      setConnectionState('reconnecting');
    });

    return () => {
      ws.close();
    };
  }, [processHyperliquidData]);

  return {
    marketData,
    connectionState
  };
}
