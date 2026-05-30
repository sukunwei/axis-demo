import type { ContextItem } from './types.js';

export function normalizeFedItem(item: {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}): ContextItem | null {
  const title = item.title?.trim();
  if (!title) return null;

  return {
    id: item.guid?.trim() || item.link?.trim() || title,
    kind: 'macro',
    title,
    summary: item.description?.slice(0, 200).trim(),
    url: item.link?.trim(),
    symbols: ['BTC', 'ETH'], // macro defaults to major perps
    tags: ['fed', 'fomc'],
    ts: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
    source: 'fed_rss',
  };
}
