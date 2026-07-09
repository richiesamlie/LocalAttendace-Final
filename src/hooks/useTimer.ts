import { useState, useEffect, useRef } from 'react';

const TIMER_STORAGE_KEY = 'ta-exam-timer-state';

interface PersistedTimerState {
  timerDuration: number;
  timerRemaining: number;
  isTimerRunning: boolean;
  endAtMs: number | null;
}

const readPersistedTimerState = (initialDuration: number): PersistedTimerState => {
  const fallback: PersistedTimerState = {
    timerDuration: initialDuration,
    timerRemaining: initialDuration,
    isTimerRunning: false,
    endAtMs: null,
  };

  const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTimerState>;
    const timerDuration =
      typeof parsed.timerDuration === 'number' && parsed.timerDuration > 0
        ? Math.floor(parsed.timerDuration)
        : fallback.timerDuration;
    const timerRemaining =
      typeof parsed.timerRemaining === 'number' && parsed.timerRemaining >= 0
        ? Math.floor(parsed.timerRemaining)
        : timerDuration;
    const isTimerRunning = parsed.isTimerRunning === true;
    const endAtMs =
      typeof parsed.endAtMs === 'number' && Number.isFinite(parsed.endAtMs)
        ? parsed.endAtMs
        : null;

    if (isTimerRunning && endAtMs !== null) {
      const nextRemaining = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
      return {
        timerDuration,
        timerRemaining: nextRemaining,
        isTimerRunning: nextRemaining > 0,
        endAtMs: nextRemaining > 0 ? endAtMs : null,
      };
    }

    return {
      timerDuration,
      timerRemaining: Math.min(timerRemaining, timerDuration),
      isTimerRunning: false,
      endAtMs: null,
    };
  } catch {
    return fallback;
  }
};

export function useTimer(initialDuration = 60 * 60) {
  const [initialState] = useState(() => readPersistedTimerState(initialDuration));
  const [timerDuration, setTimerDuration] = useState(initialState.timerDuration);
  const [timerRemaining, setTimerRemaining] = useState(initialState.timerRemaining);
  const [isTimerRunning, setIsTimerRunning] = useState(initialState.isTimerRunning);

  const initialHours = Math.floor(initialState.timerDuration / 3600);
  const initialMinutes = Math.floor((initialState.timerDuration % 3600) / 60);
  const initialSeconds = initialState.timerDuration % 60;
  const [timerInputHours, setTimerInputHours] = useState(String(initialHours));
  const [timerInputMinutes, setTimerInputMinutes] = useState(String(initialMinutes));
  const [timerInputSeconds, setTimerInputSeconds] = useState(String(initialSeconds));

  const timerIntervalRef = useRef<number | null>(null);
  const timerEndAtRef = useRef<number | null>(initialState.endAtMs);

  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
      if (timerEndAtRef.current === null) {
        timerEndAtRef.current = Date.now() + timerRemaining * 1000;
      }

      const tick = () => {
        if (timerEndAtRef.current === null) return;
        const nextRemaining = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
        setTimerRemaining(nextRemaining);
        if (nextRemaining <= 0) {
          setIsTimerRunning(false);
          timerEndAtRef.current = null;
        }
      };

      tick();
      timerIntervalRef.current = window.setInterval(() => {
        tick();
      }, 250);
    } else if (!isTimerRunning && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isTimerRunning, timerRemaining]);

  useEffect(() => {
    const payload: PersistedTimerState = {
      timerDuration,
      timerRemaining,
      isTimerRunning,
      endAtMs: isTimerRunning ? timerEndAtRef.current : null,
    };
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(payload));
  }, [timerDuration, timerRemaining, isTimerRunning]);

  const handleSetTimer = () => {
    const h = parseInt(timerInputHours) || 0;
    const m = parseInt(timerInputMinutes) || 0;
    const s = parseInt(timerInputSeconds) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;
    
    if (totalSeconds > 0) {
      setTimerDuration(totalSeconds);
      setTimerRemaining(totalSeconds);
      setIsTimerRunning(false);
      timerEndAtRef.current = null;
    }
  };

  const toggleTimer = () => {
    if (isTimerRunning) {
      if (timerEndAtRef.current !== null) {
        const nextRemaining = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
        setTimerRemaining(nextRemaining);
      }
      timerEndAtRef.current = null;
      setIsTimerRunning(false);
      return;
    }

    if (timerRemaining > 0) {
      timerEndAtRef.current = Date.now() + timerRemaining * 1000;
      setIsTimerRunning(true);
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerRemaining(timerDuration);
    timerEndAtRef.current = null;
  };

  return {
    timerDuration,
    timerRemaining,
    isTimerRunning,
    timerInputHours,
    setTimerInputHours,
    timerInputMinutes,
    setTimerInputMinutes,
    timerInputSeconds,
    setTimerInputSeconds,
    handleSetTimer,
    toggleTimer,
    resetTimer,
  };
}
