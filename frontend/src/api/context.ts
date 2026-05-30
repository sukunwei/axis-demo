export type ContextItem = {
  id: string;
  kind: 'macro';
  title: string;
  summary?: string;
  url?: string;
  symbols?: string[];
  tags?: string[];
  ts: number;
  source: 'fed_rss';
};

export interface ContextResponse {
  items: ContextItem[];
  updatedAt: number;
}

export async function fetchContext(): Promise<ContextResponse> {
  const res = await fetch('/context');
  if (!res.ok) throw new Error(`GET /context failed: ${res.status}`);
  return res.json() as Promise<ContextResponse>;
}
