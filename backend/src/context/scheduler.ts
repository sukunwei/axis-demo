import { fetchFedRss } from './fedRss.js';
import { setContextCache } from './contextCache.js';

const FED_RSS_INTERVAL_MS = Number(process.env.CONTEXT_FED_RSS_MS ?? 900_000);

export function startContextScheduler(): void {
  refreshContext();
  setInterval(refreshContext, FED_RSS_INTERVAL_MS);
}

async function refreshContext(): Promise<void> {
  try {
    const items = await fetchFedRss();
    setContextCache(items);
  } catch (err) {
    console.error('[context] Fed RSS refresh failed', err);
  }
}
