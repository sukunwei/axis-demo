import { WebSocketServer, WebSocket as WS } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8080;
const BATCH_WINDOW_MS = 75; // Batch updates within 75ms
const RING_BUFFER_SIZE = 10000; // Keep last 10k updates for backfill
const STALE_THRESHOLD_MS = 10000; // 10 seconds without update = stale

interface MarketData {
  symbol: string;
  price: number;
  prevPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume24h: number;
  changePercent: number;
  lastUpdate: number;
}

interface RingBufferEntry {
  seq: number;
  symbol: string;
  data: MarketData;
  timestamp: number;
}

interface ClientMetadata {
  connectedAt: number;
  lastSeq: number;
}

// Market data store
const marketData = new Map<string, MarketData>();
const ringBuffer: RingBufferEntry[] = [];
let sequenceNumber = 0;

// Client tracking
const clients = new Map<WS, ClientMetadata>();

// Pending updates batch
let pendingBatch = new Map<string, MarketData>();
let batchTimer: NodeJS.Timeout | null = null;

// Hyperliquid WebSocket connection
let hlSocket: WS | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// Available symbols - will be fetched dynamically from Hyperliquid
let TRACKED_SYMBOLS: string[] = [];

// Fetch available markets from Hyperliquid API
async function fetchAvailableMarkets(): Promise<string[]> {
  try {
    console.log('Fetching available markets from Hyperliquid...');

    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' })
    });

    const data = await response.json();

    if (data && data.universe) {
      const symbols = data.universe.map((asset: any) => asset.name);
      console.log(`✅ Fetched ${symbols.length} markets from Hyperliquid`);
      return symbols;
    }

    console.warn('No markets found, using fallback list');
    return getFallbackSymbols();
  } catch (err) {
    console.error('Error fetching markets from Hyperliquid:', err);
    return getFallbackSymbols();
  }
}

// Fallback symbols in case API fetch fails
function getFallbackSymbols(): string[] {
  return [
    'BTC', 'ETH', 'SOL', 'ARB', 'MATIC', 'AVAX', 'OP', 'ATOM', 'DOGE', 'LTC',
    'BCH', 'LINK', 'UNI', 'XRP', 'ADA', 'DOT', 'TRX', 'SHIB', 'PEPE', 'WIF',
    'BONK', 'APT', 'SUI', 'SEI', 'TIA', 'ORDI', 'RNDR', 'INJ', 'FTM', 'IMX'
  ];
}

function connectToHyperliquid(): void {
  if (hlSocket && hlSocket.readyState === WS.OPEN) {
    console.log('Already connected to Hyperliquid');
    return;
  }

  console.log('Connecting to Hyperliquid WebSocket...');
  hlSocket = new WS('wss://api.hyperliquid.xyz/ws');

  hlSocket.on('open', () => {
    console.log('Connected to Hyperliquid');
    reconnectAttempts = 0;

    // Subscribe to allMids - gets all markets automatically
    const subscription = {
      method: 'subscribe',
      subscription: {
        type: 'allMids'
      }
    };
    hlSocket!.send(JSON.stringify(subscription));
    console.log('✅ Subscribed to allMids (all markets)');
  });

  hlSocket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.channel === 'allMids' && message.data) {
        // Process all markets from Hyperliquid
        Object.entries(message.data.mids).forEach(([symbol, price]) => {
          updateMarketData(symbol, { price: parseFloat(price as string) });
        });
      }
    } catch (err) {
      console.error('Error processing Hyperliquid message:', err);
    }
  });

  hlSocket.on('error', (err) => {
    console.error('Hyperliquid WebSocket error:', err);
  });

  hlSocket.on('close', () => {
    console.log('Disconnected from Hyperliquid');
    scheduleReconnect();
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const delay = Math.min(
    1000 * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  reconnectAttempts++;

  console.log(`Reconnecting to Hyperliquid in ${delay}ms (attempt ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToHyperliquid();
  }, delay);
}

function updateMarketData(symbol: string, update: { price?: number; volume?: number; side?: string }): void {
  const now = Date.now();
  const existing = marketData.get(symbol) || {
    symbol,
    price: 0,
    prevPrice: 0,
    dayOpen: 0,
    dayHigh: 0,
    dayLow: 0,
    volume24h: 0,
    changePercent: 0,
    lastUpdate: now
  };

  if (existing.dayOpen === 0 && update.price) {
    existing.dayOpen = update.price;
  }

  if (update.price) {
    existing.prevPrice = existing.price;
    existing.price = update.price;
    existing.dayHigh = Math.max(existing.dayHigh || update.price, update.price);
    existing.dayLow = existing.dayLow === 0 ? update.price : Math.min(existing.dayLow, update.price);
    existing.changePercent = existing.dayOpen ? ((update.price - existing.dayOpen) / existing.dayOpen) * 100 : 0;
  }

  if (update.volume) {
    existing.volume24h += update.volume;
  }

  existing.lastUpdate = now;
  marketData.set(symbol, existing);

  addToBatch(symbol, existing);

  sequenceNumber++;
  ringBuffer.push({
    seq: sequenceNumber,
    symbol,
    data: { ...existing },
    timestamp: now
  });

  if (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }
}

function addToBatch(symbol: string, data: MarketData): void {
  pendingBatch.set(symbol, data);

  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      flushBatch();
    }, BATCH_WINDOW_MS);
  }
}

function flushBatch(): void {
  if (pendingBatch.size === 0) {
    batchTimer = null;
    return;
  }

  const updates = Array.from(pendingBatch.values());
  pendingBatch.clear();
  batchTimer = null;

  const message = JSON.stringify({
    type: 'batch',
    seq: sequenceNumber,
    data: updates,
    timestamp: Date.now()
  });

  clients.forEach((metadata, ws) => {
    if (ws.readyState === WS.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Error sending to client:', err);
      }
    }
  });
}

function getBackfill(fromSeq: number): MarketData[] {
  const backfillData = new Map<string, MarketData>();

  for (let i = ringBuffer.length - 1; i >= 0; i--) {
    const entry = ringBuffer[i];
    if (entry.seq <= fromSeq) break;

    if (!backfillData.has(entry.symbol)) {
      backfillData.set(entry.symbol, entry.data);
    }
  }

  return Array.from(backfillData.values());
}

function getSnapshot(): MarketData[] {
  return Array.from(marketData.values());
}

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Trading WebSocket Server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  clients.set(ws, {
    connectedAt: Date.now(),
    lastSeq: 0
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'subscribe') {
        const lastSeq = message.lastSeq || 0;

        let responseData;
        if (lastSeq === 0) {
          responseData = getSnapshot();
        } else {
          responseData = getBackfill(lastSeq);
        }

        ws.send(JSON.stringify({
          type: 'snapshot',
          seq: sequenceNumber,
          data: responseData,
          timestamp: Date.now()
        }));

        clients.get(ws)!.lastSeq = sequenceNumber;
      }
    } catch (err) {
      console.error('Error processing client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('Client WebSocket error:', err);
  });
});

setInterval(() => {
  const now = Date.now();
  const isStale = Array.from(marketData.values()).some(
    data => now - data.lastUpdate > STALE_THRESHOLD_MS
  );

  const connectionState = {
    type: 'connection_state',
    state: hlSocket && hlSocket.readyState === WS.OPEN
      ? (isStale ? 'stale' : 'connected')
      : 'disconnected',
    timestamp: now
  };

  clients.forEach((metadata, ws) => {
    if (ws.readyState === WS.OPEN) {
      try {
        ws.send(JSON.stringify(connectionState));
      } catch (err) {
        console.error('Error sending connection state:', err);
      }
    }
  });
}, 5000);

async function initializeServer(): Promise<void> {
  // Fetch available markets from Hyperliquid
  TRACKED_SYMBOLS = await fetchAvailableMarkets();

  console.log(`Tracking ${TRACKED_SYMBOLS.length} symbols from Hyperliquid`);

  // Connect to Hyperliquid WebSocket
  connectToHyperliquid();
}

server.listen(PORT, async () => {
  console.log(`WebSocket server listening on port ${PORT}`);
  await initializeServer();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  if (hlSocket) hlSocket.close();
  wss.close();
  server.close();
});
