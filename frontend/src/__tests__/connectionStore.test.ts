import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionStore } from '../stores/connectionStore';

describe('ConnectionStore', () => {
  let store: ConnectionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ConnectionStore();
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  describe('connectionState transitions', () => {
    it('starts as disconnected', () => {
      expect(store.connectionState).toBe('disconnected');
    });

    it('setConnected → connected', () => {
      store.setConnected();
      expect(store.connectionState).toBe('connected');
    });

    it('setReconnecting → reconnecting', () => {
      store.setReconnecting();
      expect(store.connectionState).toBe('reconnecting');
    });

    it('setStale → stale', () => {
      store.setConnected();
      store.setStale();
      expect(store.connectionState).toBe('stale');
    });

    it('setDisconnected → disconnected', () => {
      store.setDisconnected();
      expect(store.connectionState).toBe('disconnected');
    });

    it('touch transitions from stale to connected', () => {
      store.setStale();
      store.touch();
      expect(store.connectionState).toBe('connected');
    });

    it('touch does not downgrade connected', () => {
      store.setConnected();
      store.touch();
      expect(store.connectionState).toBe('connected');
    });
  });

  describe('lastMessageAt', () => {
    it('touch updates lastMessageAt', () => {
      vi.advanceTimersByTime(1000);
      store.touch();
      expect(store.lastMessageAt).toBeGreaterThan(0);
    });
  });

  describe('stale detection', () => {
    it('marks stale after 5s of no messages while connected', () => {
      store.setConnected();
      vi.advanceTimersByTime(6000);
      expect(store.connectionState).toBe('stale');
    });

    it('stale check does not fire when paused', () => {
      store.setConnected();
      (store as unknown as { paused: boolean }).paused = true;
      vi.advanceTimersByTime(20_000);
      expect(store.connectionState).toBe('connected');
    });
  });

  describe('paused flag', () => {
    it('can be set and read', () => {
      expect(store.paused).toBe(false);
      (store as unknown as { paused: boolean }).paused = true;
      expect(store.paused).toBe(true);
    });
  });

  describe('dispose', () => {
    it('clears stale timer without crashing', () => {
      store.setConnected();
      vi.advanceTimersByTime(6_000);
      expect(store.connectionState).toBe('stale');
      store.dispose();
      // After dispose, advancing time should not throw or change state
      vi.advanceTimersByTime(20_000);
      expect(store.connectionState).toBe('stale'); // state unchanged after dispose
    });
  });
});