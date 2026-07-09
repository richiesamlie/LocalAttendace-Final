// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from './useTimer';
import { useStopwatch } from './useStopwatch';

describe('exam timer persistence', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const localStorageMock: Storage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores countdown timer from persisted running state', () => {
    const now = Date.now();
    window.localStorage.setItem(
      'ta-exam-timer-state',
      JSON.stringify({
        timerDuration: 3600,
        timerRemaining: 3600,
        isTimerRunning: true,
        endAtMs: now + 45_000,
      })
    );

    const { result } = renderHook(() => useTimer(3600));

    expect(result.current.isTimerRunning).toBe(true);
    expect(result.current.timerRemaining).toBeLessThanOrEqual(45);
    expect(result.current.timerRemaining).toBeGreaterThan(40);
  });

  it('stops an expired countdown timer on restore', () => {
    const now = Date.now();
    window.localStorage.setItem(
      'ta-exam-timer-state',
      JSON.stringify({
        timerDuration: 300,
        timerRemaining: 300,
        isTimerRunning: true,
        endAtMs: now - 1_000,
      })
    );

    const { result } = renderHook(() => useTimer(300));

    expect(result.current.isTimerRunning).toBe(false);
    expect(result.current.timerRemaining).toBe(0);
  });

  it('restores stopwatch from persisted running state', () => {
    const now = Date.now();
    window.localStorage.setItem(
      'ta-exam-stopwatch-state',
      JSON.stringify({
        accumulatedMs: 2_000,
        isRunning: true,
        startedAtMs: now - 3_000,
      })
    );

    const { result } = renderHook(() => useStopwatch());

    expect(result.current.isStopwatchRunning).toBe(true);
    expect(result.current.stopwatchTime).toBeGreaterThanOrEqual(4_900);
    expect(result.current.stopwatchTime).toBeLessThanOrEqual(5_100);
  });
});
