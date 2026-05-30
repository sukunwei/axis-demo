import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { frameScheduler } from '../ws/frameScheduler';
import { marketStore } from '../stores/store-instances';
import type { ServerMessage } from '../lib/protocol';

describe('frameScheduler', () => {
  let requestResyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    frameScheduler.dispose();
    frameScheduler['pending'] = [];
    frameScheduler['rafId'] = null;
    frameScheduler['resyncInFlight'] = false;
    // Reset seq to 0 before each test
    marketStore.seq = 0;
    requestResyncSpy = vi.spyOn(marketStore, 'requestResync');
    vi.clearAllMocks();
  });

  afterEach(() => {
    frameScheduler.dispose();
    vi.useRealTimers();
    requestResyncSpy.mockRestore();
  });

  const snapshotMsg = (seq: number): ServerMessage =>
    ({ type: 'snapshot', seq, data: [] });

  const diffMsg = (fromSeq: number, toSeq: number, changes = []): ServerMessage =>
    ({ type: 'diff', fromSeq, toSeq, changes });

  describe('seq gap detection', () => {
    it('triggers resync when fromSeq > marketStore.seq (gap of 1)', async () => {
      // Simulate being at seq 5
      marketStore.seq = 5;
      requestResyncSpy.mockResolvedValue(undefined);

      // Gap of 1: expected seq 6, got fromSeq=6
      frameScheduler.enqueue(diffMsg(6, 7));

      await vi.waitFor(() => {
        expect(requestResyncSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('triggers resync when multiple packets are dropped (large gap)', async () => {
      marketStore.seq = 5;
      requestResyncSpy.mockResolvedValue(undefined);

      frameScheduler.enqueue(diffMsg(10, 11));

      await vi.waitFor(() => {
        expect(requestResyncSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('does NOT trigger resync when fromSeq equals current seq (no gap)', async () => {
      marketStore.seq = 5;

      // fromSeq == seq means this is the next expected packet
      frameScheduler.enqueue(diffMsg(5, 6));

      // No RAF is scheduled if there's no gap, so we advance timers
      await vi.advanceTimersByTimeAsync(100);

      expect(requestResyncSpy).not.toHaveBeenCalled();
    });

    it('triggers resync only once when gapped messages arrive in same frame', async () => {
      marketStore.seq = 5;
      requestResyncSpy.mockResolvedValue(undefined);

      // Multiple gapped diffs all in one batch
      frameScheduler.enqueue(diffMsg(7, 8));
      frameScheduler.enqueue(diffMsg(8, 9));
      frameScheduler.enqueue(diffMsg(9, 10));

      await vi.waitFor(() => {
        // Only one resync despite three gapped messages
        expect(requestResyncSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('clears resyncInFlight when snapshot arrives', async () => {
      marketStore.seq = 5;
      requestResyncSpy.mockResolvedValue(undefined);

      // Trigger gap
      frameScheduler.enqueue(diffMsg(10, 11));

      await vi.waitFor(() => {
        expect(frameScheduler['resyncInFlight']).toBe(true);
      });

      // Snapshot clears resyncInFlight
      marketStore.seq = 20;
      frameScheduler.enqueue(snapshotMsg(20));

      expect(frameScheduler['resyncInFlight']).toBe(false);
    });

    it('ignores diffs with fromSeq < current seq (stale/replay)', async () => {
      marketStore.seq = 10;

      // Stale diff — should be skipped
      frameScheduler.enqueue(diffMsg(5, 6));

      await vi.advanceTimersByTimeAsync(100);

      expect(requestResyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('normal sequential diffs', () => {
    it('applies diffs when fromSeq === seq without triggering resync', async () => {
      marketStore.seq = 1;
      requestResyncSpy.mockResolvedValue(undefined);

      frameScheduler.enqueue(diffMsg(1, 2));
      await vi.advanceTimersByTimeAsync(16);
      frameScheduler.enqueue(diffMsg(2, 3));
      await vi.advanceTimersByTimeAsync(16);

      expect(requestResyncSpy).not.toHaveBeenCalled();
      expect(marketStore.seq).toBe(3);
    });
  });
});
