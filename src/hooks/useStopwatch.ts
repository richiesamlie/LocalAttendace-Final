import { useState, useEffect, useRef } from 'react';

const STOPWATCH_STORAGE_KEY = 'ta-exam-stopwatch-state';

interface PersistedStopwatchState {
  accumulatedMs: number;
  isRunning: boolean;
  startedAtMs: number | null;
}

const readPersistedStopwatchState = (): PersistedStopwatchState => {
  const fallback: PersistedStopwatchState = {
    accumulatedMs: 0,
    isRunning: false,
    startedAtMs: null,
  };

  const raw = window.localStorage.getItem(STOPWATCH_STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedStopwatchState>;
    const accumulatedMs =
      typeof parsed.accumulatedMs === 'number' && parsed.accumulatedMs >= 0
        ? Math.floor(parsed.accumulatedMs)
        : 0;
    const isRunning = parsed.isRunning === true;
    const startedAtMs =
      typeof parsed.startedAtMs === 'number' && Number.isFinite(parsed.startedAtMs)
        ? parsed.startedAtMs
        : null;

    if (isRunning && startedAtMs !== null) {
      return { accumulatedMs, isRunning: true, startedAtMs };
    }

    return { accumulatedMs, isRunning: false, startedAtMs: null };
  } catch {
    return fallback;
  }
};

const persistStopwatchState = (state: PersistedStopwatchState) => {
  window.localStorage.setItem(STOPWATCH_STORAGE_KEY, JSON.stringify(state));
};

export function useStopwatch() {
  const [initialState] = useState(() => readPersistedStopwatchState());
  const initialTime =
    initialState.isRunning && initialState.startedAtMs !== null
      ? initialState.accumulatedMs + (Date.now() - initialState.startedAtMs)
      : initialState.accumulatedMs;

  const [stopwatchTime, setStopwatchTime] = useState(initialTime);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(initialState.isRunning);

  const stopwatchIntervalRef = useRef<number | null>(null);
  const stopwatchStartRef = useRef<number>(initialState.startedAtMs ?? 0);
  const stopwatchAccumRef = useRef<number>(initialState.accumulatedMs);

  useEffect(() => {
    if (isStopwatchRunning) {
      if (!stopwatchStartRef.current) {
        stopwatchStartRef.current = Date.now();
      }
      stopwatchIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - stopwatchStartRef.current;
        setStopwatchTime(stopwatchAccumRef.current + elapsed);
      }, 50);
    } else if (!isStopwatchRunning && stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
  }, [isStopwatchRunning]);

  const toggleStopwatch = () => {
    if (isStopwatchRunning) {
      stopwatchAccumRef.current += Date.now() - stopwatchStartRef.current;
      stopwatchStartRef.current = 0;
      setStopwatchTime(stopwatchAccumRef.current);
      persistStopwatchState({
        accumulatedMs: stopwatchAccumRef.current,
        isRunning: false,
        startedAtMs: null,
      });
      setIsStopwatchRunning(false);
      return;
    }

    stopwatchStartRef.current = Date.now();
    persistStopwatchState({
      accumulatedMs: stopwatchAccumRef.current,
      isRunning: true,
      startedAtMs: stopwatchStartRef.current,
    });
    setIsStopwatchRunning(true);
  };

  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    stopwatchAccumRef.current = 0;
    stopwatchStartRef.current = 0;
    setStopwatchTime(0);
    persistStopwatchState({
      accumulatedMs: 0,
      isRunning: false,
      startedAtMs: null,
    });
  };

  return {
    stopwatchTime,
    isStopwatchRunning,
    toggleStopwatch,
    resetStopwatch,
  };
}
