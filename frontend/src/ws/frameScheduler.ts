/**
 * Frame scheduler — collects diffs within the current animation frame,
 * then applies them all at once via runInAction.
 *
 * This is the critical piece that prevents MobX reaction storms:
 * without it, each WS message would trigger a separate store update.
 */

import type { ServerMessage } from '../lib/protocol';
import { marketStore, connectionStore } from '../stores/store-instances';

type PendingEntry = {
  msg: ServerMessage;
  resolve: () => void;
  gapped?: boolean;
};

export class FrameScheduler {
  private pending: PendingEntry[] = [];
  private rafId: number | null = null;
  private resyncInFlight = false;

  enqueue(msg: ServerMessage): void {
    if (msg.type === 'snapshot') {
      this.resyncInFlight = false;
    }
    this.pending.push({ msg, resolve: () => {} });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    this.rafId = null;
    if (this.pending.length === 0) return;

    const batch = this.pending;
    this.pending = [];

    let snapshotSeq = 0;
    let hasSnapshot = false;
    const allChanges: MarketDiff[] = [];

    for (const { msg } of batch) {
      if (msg.type === 'snapshot') {
        hasSnapshot = true;
        marketStore.applySnapshot(msg.data);
        snapshotSeq = msg.seq;
      } else if (msg.type === 'diff') {
        if (msg.fromSeq > marketStore.seq && msg.fromSeq > 0 && !this.resyncInFlight) {
          this.resyncInFlight = true;
          void marketStore.requestResync();
          continue;
        }
        if (msg.fromSeq < marketStore.seq) {
          continue;
        }
        allChanges.push(...msg.changes);
        marketStore.setSeq(msg.toSeq);
      }
    }

    if (allChanges.length > 0) {
      marketStore.applyDiffBatch(allChanges);
    }

    if (snapshotSeq > 0) {
      marketStore.setSeq(snapshotSeq);
    }

    if (hasSnapshot) {
      this.resyncInFlight = false;
    }

    connectionStore.touch();
  }

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pending = [];
  }
}

type MarketDiff = { symbol: string; price?: number; dayOpen?: number; dayHigh?: number; dayLow?: number; volume24h?: number; changePercent?: number; ts?: number };

export const frameScheduler = new FrameScheduler();