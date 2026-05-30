/**
 * Deterministic mock feed for 200+ symbols.
 * Seeded PRNG for reproducible price sequences across restarts.
 * Supports TICK_HZ and SYMBOLS_PER_TICK environment variables.
 */

export type TickHandler = (symbol: string, price: number) => void;
export type OrderBookHandler = (symbol: string, bids: [number, number][], asks: [number, number][]) => void;

interface MockSymbol {
  symbol: string;
  price: number;
  volatility: number;
}

// Seeded pseudo-random (mulberry32)
function makeRng(seed: number) {
  return function rng(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIXED_SEED = 42;
const rng = makeRng(FIXED_SEED);

function rand(): number {
  return rng();
}

function srandsym(): { price: number; volatility: number } {
  return {
    price: parseFloat((rand() * 100 + 0.001).toFixed(4)),
    volatility: parseFloat((0.0005 + rand() * 0.002).toFixed(4)),
  };
}

const TOP_TIERS: Array<{ symbol: string; price: number; volatility: number }> = [
  { symbol: 'BTC', price: 67_000, volatility: 0.0005 },
  { symbol: 'ETH', price: 3_500, volatility: 0.0008 },
  { symbol: 'SOL', price: 180, volatility: 0.001 },
  { symbol: 'BNB', price: 600, volatility: 0.0006 },
  { symbol: 'XRP', price: 0.62, volatility: 0.0009 },
  { symbol: 'ADA', price: 0.48, volatility: 0.001 },
  { symbol: 'AVAX', price: 38, volatility: 0.001 },
  { symbol: 'DOGE', price: 0.14, volatility: 0.0012 },
  { symbol: 'DOT', price: 7.5, volatility: 0.001 },
  { symbol: 'LINK', price: 14, volatility: 0.0009 },
  { symbol: 'MATIC', price: 0.72, volatility: 0.001 },
  { symbol: 'SHIB', price: 0.000022, volatility: 0.0015 },
  { symbol: 'LTC', price: 82, volatility: 0.0008 },
  { symbol: 'UNI', price: 9.5, volatility: 0.001 },
  { symbol: 'ATOM', price: 8.2, volatility: 0.0009 },
  { symbol: 'XLM', price: 0.11, volatility: 0.001 },
  { symbol: 'ETC', price: 26, volatility: 0.001 },
  { symbol: 'FIL', price: 5.2, volatility: 0.001 },
  { symbol: 'APT', price: 9.1, volatility: 0.001 },
  { symbol: 'ARB', price: 1.05, volatility: 0.0012 },
  { symbol: 'OP', price: 2.4, volatility: 0.0012 },
  { symbol: 'NEAR', price: 6.8, volatility: 0.001 },
  { symbol: 'ICP', price: 12, volatility: 0.001 },
  { symbol: 'VET', price: 0.033, volatility: 0.001 },
  { symbol: 'ALGO', price: 0.17, volatility: 0.001 },
  { symbol: 'FTM', price: 0.72, volatility: 0.001 },
  { symbol: 'AAVE', price: 92, volatility: 0.0009 },
  { symbol: 'GRT', price: 0.22, volatility: 0.001 },
  { symbol: 'SAND', price: 0.42, volatility: 0.001 },
  { symbol: 'MANA', price: 0.38, volatility: 0.001 },
];

const PREFIXES = ['X', 'Z', 'W', 'Q', 'K', 'P', 'M', 'N', 'R', 'S', 'T', 'Y', 'J', 'L', 'H'];
const NAMES = ['FI', 'GO', 'HU', 'NX', 'ZO', 'WA', 'VE', 'RI', 'DI', 'FA', 'BA', 'CU', 'DU', 'EX', 'GY'];

function generateAltcoins(): Array<{ symbol: string; price: number; volatility: number }> {
  const alts: Array<{ symbol: string; price: number; volatility: number }> = [];
  let idx = 0;
  for (let i = 0; i < 170; i++) {
    const p = PREFIXES[i % PREFIXES.length];
    const n = NAMES[idx % NAMES.length];
    idx++;
    if (i % 7 === 0) idx++;
    const { price, volatility } = srandsym();
    alts.push({ symbol: `${p}${n}${i}`, price, volatility });
  }
  return alts;
}

const ALL_SYMBOLS: MockSymbol[] = [...TOP_TIERS, ...generateAltcoins()];

export class MockFeed {
  private symbols: MockSymbol[];
  private tickHz: number;
  private symbolsPerTick: number;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onUpdate: TickHandler;
  private onOrderBook: OrderBookHandler | null = null;
  private running = false;

  constructor(onUpdate: TickHandler, onOrderBook?: OrderBookHandler) {
    this.onUpdate = onUpdate;
    this.onOrderBook = onOrderBook ?? null;
    this.tickHz = Number(process.env.TICK_HZ ?? 5);
    this.symbolsPerTick = Number(process.env.SYMBOLS_PER_TICK ?? 30);
    this.symbols = ALL_SYMBOLS.map((s) => ({ ...s }));
  }

  /** Bootstrap: emit all symbols once so aggregator.state is populated before first flush */
  bootstrap(): Array<{ symbol: string; price: number }> {
    return this.symbols.map((s) => {
      this.onUpdate(s.symbol, s.price);
      return { symbol: s.symbol, price: s.price };
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.tickHz;
    this.interval = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }

  private tick(): void {
    const shuffled = [...this.symbols].sort(() => rand() - 0.5);
    const batch = shuffled.slice(0, this.symbolsPerTick);
    for (const sym of batch) {
      const drift = (rand() - 0.5) * 2 * sym.volatility;
      sym.price = parseFloat((sym.price * (1 + drift)).toFixed(sym.price < 1 ? 6 : 2));
      this.onUpdate(sym.symbol, sym.price);
      // Emit fake order book if handler is registered
      if (this.onOrderBook) {
        const book = this.generateFakeBook(sym.price);
        const bids = book.filter((_, i) => i % 2 === 0);
        const asks = book.filter((_, i) => i % 2 === 1);
        this.onOrderBook(sym.symbol, bids, asks);
      }
    }
  }

  /** Generate a deterministic fake order book around a mid price (8 levels each side) */
  private generateFakeBook(midPrice: number): [number, number][] {
    const levels: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const offset = midPrice * (0.0001 * (i + 1));
      const bidPx = parseFloat((midPrice - offset).toFixed(midPrice < 1 ? 6 : 2));
      const askPx = parseFloat((midPrice + offset).toFixed(midPrice < 1 ? 6 : 2));
      const bidSz = parseFloat((rand() * 10 + 0.1).toFixed(4));
      const askSz = parseFloat((rand() * 10 + 0.1).toFixed(4));
      levels.push([bidPx, bidSz], [askPx, askSz]);
    }
    return levels.sort((a, b) => a[0] - b[0]);
  }

  getSymbols(): string[] {
    return this.symbols.map((s) => s.symbol);
  }
}
