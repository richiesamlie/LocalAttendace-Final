import { useState, useEffect, useRef } from 'react';

export function useStopwatch() {
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);

  const stopwatchIntervalRef = useRef<number | null>(null);
  const stopwatchStartRef = useRef<number>(0);
  const stopwatchAccumRef = useRef<number>(0);

  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchStartRef.current = Date.now();
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
    }
    setIsStopwatchRunning(!isStopwatchRunning);
  };

  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    stopwatchAccumRef.current = 0;
    stopwatchStartRef.current = 0;
    setStopwatchTime(0);
  };

  return {
    stopwatchTime,
    isStopwatchRunning,
    toggleStopwatch,
    resetStopwatch,
  };
}
