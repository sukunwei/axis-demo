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
