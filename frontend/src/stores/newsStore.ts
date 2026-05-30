import { makeAutoObservable, runInAction } from 'mobx';
import { fetchContext, type ContextItem } from '../api/context';

export class NewsStore {
  items: ContextItem[] = [];
  loading = false;
  error: string | null = null;
  updatedAt = 0;

  constructor() {
    makeAutoObservable(this);
  }

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    try {
      const data = await fetchContext();
      runInAction(() => {
        this.items = data.items;
        this.updatedAt = data.updatedAt;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load news';
        this.loading = false;
      });
    }
  }
}
