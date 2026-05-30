import { XMLParser } from 'fast-xml-parser';
import { normalizeFedItem } from './normalize.js';
import type { ContextItem } from './types.js';

const FEED_URLS = [
  'https://www.federalreserve.gov/feeds/press_monetary.xml',
  'https://www.federalreserve.gov/feeds/press_all.xml',
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

export async function fetchFedRss(): Promise<ContextItem[]> {
  const results: ContextItem[] = [];
  const seen = new Set<string>();

  for (const url of FEED_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parser.parse(xml);
      const items: unknown[] = parsed?.rss?.channel?.item ?? [];

      for (const raw of items) {
        const item = normalizeFedItem(raw as Record<string, string>);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          results.push(item);
        }
      }
    } catch {
      // single feed failure — continue with others
    }
  }

  // newest first
  results.sort((a, b) => b.ts - a.ts);
  return results;
}
