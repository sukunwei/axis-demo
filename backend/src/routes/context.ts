import type { IncomingMessage, ServerResponse } from 'http';
import { getContextCache } from '../context/contextCache.js';

export function handleContext(_req: IncomingMessage, res: ServerResponse): void {
  const cache = getContextCache();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cache));
}
