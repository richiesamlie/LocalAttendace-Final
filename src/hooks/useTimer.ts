import { useState, useEffect, useRef } from 'react';

export function useTimer(initialDuration = 60 * 60) {
  const [timerDuration, setTimerDuration] = useState(initialDuration);
  const [timerRemaining, setTimerRemaining] = useState(initialDuration);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInputHours, setTimerInputHours] = useState('1');
  const [timerInputMinutes, setTimerInputMinutes] = useState('0');
  const [timerInputSeconds, setTimerInputSeconds] = useState('0');

  const timerIntervalRef = useRef<number | null>(null);
  const timerRemainingRef = useRef(timerRemaining);

  useEffect(() => {
    timerRemainingRef.current = timerRemaining;
  }, [timerRemaining]);

  useEffect(() => {
    if (isTimerRunning && timerRemainingRef.current > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        timerRemainingRef.current -= 1;
        setTimerRemaining(timerRemainingRef.current);
        if (timerRemainingRef.current <= 0) {
          setIsTimerRunning(false);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
      }, 1000);
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
  }, [isTimerRunning]);

  const handleSetTimer = () => {
    const h = parseInt(timerInputHours) || 0;
    const m = parseInt(timerInputMinutes) || 0;
    const s = parseInt(timerInputSeconds) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;
    
    if (totalSeconds > 0) {
      setTimerDuration(totalSeconds);
      setTimerRemaining(totalSeconds);
      setIsTimerRunning(false);
    }
  };

  const toggleTimer = () => {
    if (timerRemaining > 0) {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerRemaining(timerDuration);
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
