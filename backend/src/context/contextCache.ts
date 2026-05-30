import type { ContextItem } from './types.js';

interface Cache {
  items: ContextItem[];
  updatedAt: number;
}

let cache: Cache = { items: [], updatedAt: 0 };

export function getContextCache(): Cache {
  return cache;
}

export function setContextCache(items: ContextItem[]): void {
  cache = { items, updatedAt: Date.now() };
}
