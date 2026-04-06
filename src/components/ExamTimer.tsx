import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer, Clock } from 'lucide-react';
import { cn } from '../utils/cn';

export default function ExamTimer() {
  const [activeTab, setActiveTab] = useState<'timer' | 'stopwatch'>('timer');
  
  // Timer State
  const [timerDuration, setTimerDuration] = useState(60 * 60); // Default 60 minutes
  const [timerRemaining, setTimerRemaining] = useState(60 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInputHours, setTimerInputHours] = useState('1');
  const [timerInputMinutes, setTimerInputMinutes] = useState('0');
  const [timerInputSeconds, setTimerInputSeconds] = useState('0');

  // Stopwatch State
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);

  // Refs for intervals
  const timerIntervalRef = useRef<number | null>(null);
  const stopwatchIntervalRef = useRef<number | null>(null);
  const timerRemainingRef = useRef(timerRemaining);
  const stopwatchStartRef = useRef<number>(0);
  const stopwatchAccumRef = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    timerRemainingRef.current = timerRemaining;
  }, [timerRemaining]);

  // --- Timer Logic (ref-based to avoid interval recreation) ---
  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
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

  // --- Stopwatch Logic (Date.now() delta to prevent drift) ---
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
      // Pausing: accumulate elapsed time
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

  // --- Formatting Helpers ---
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStopwatch = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10); // Get 2 digits for ms

    let timeString = '';
    if (h > 0) {
      timeString += `${h.toString().padStart(2, '0')}:`;
    }
    timeString += `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    return { main: timeString, ms: milliseconds.toString().padStart(2, '0') };
  };

  // Calculate progress circle
  const progressPercentage = timerDuration > 0 ? ((timerDuration - timerRemaining) / timerDuration) * 100 : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  // Determine color based on time remaining
  const getTimerColor = () => {
    if (timerRemaining === 0) return "text-rose-500 stroke-rose-500";
    if (timerDuration > 0 && timerRemaining <= timerDuration * 0.1) return "text-amber-500 stroke-amber-500"; // Last 10%
    return "text-indigo-600 dark:text-indigo-400 stroke-indigo-600 dark:stroke-indigo-400";
  };

  const timerColorClass = getTimerColor();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exam Timer</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Keep track of time during exams, quizzes, or activities.</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit mx-auto sm:mx-0">
        <button
          onClick={() => setActiveTab('timer')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
            activeTab === 'timer'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Timer className="w-4 h-4" />
          Countdown Timer
        </button>
        <button
          onClick={() => setActiveTab('stopwatch')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
            activeTab === 'stopwatch'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Clock className="w-4 h-4" />
          Stopwatch
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-8 sm:p-12 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-50 dark:opacity-20">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-100 dark:bg-indigo-900 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-100 dark:bg-emerald-900 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          
          {activeTab === 'timer' ? (
            <>
              {/* Timer Display */}
              <div className="relative w-72 h-72 flex items-center justify-center mb-10">
                {/* SVG Progress Circle */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 260 260">
                  {/* Background Circle */}
                  <circle
                    cx="130"
                    cy="130"
                    r={radius}
                    className="stroke-slate-100 dark:stroke-slate-800"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="130"
                    cy="130"
                    r={radius}
                    className={cn("transition-all duration-1000 ease-linear", timerColorClass.split(' ')[1])}
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                
                {/* Time Text */}
                <div className="flex flex-col items-center justify-center">
                  <span className={cn(
                    "font-mono font-bold tracking-tighter transition-colors",
                    timerRemaining >= 3600 ? "text-5xl" : "text-7xl",
                    timerColorClass.split(' ')[0]
                  )}>
                    {formatTime(timerRemaining)}
                  </span>
                  {timerRemaining === 0 && (
                    <span className="text-rose-500 font-bold uppercase tracking-widest mt-2 animate-pulse">
                      Time's Up!
                    </span>
                  )}
                </div>
              </div>

              {/* Timer Controls */}
              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={toggleTimer}
                  disabled={timerRemaining === 0}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                    isTimerRunning 
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  )}
                >
                  {isTimerRunning ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </button>
                
                <button
                  onClick={resetTimer}
                  className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm transition-all active:scale-95"
                >
                  <RotateCcw className="w-7 h-7" />
                </button>
              </div>

              {/* Set Timer Inputs */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 text-center uppercase tracking-wider">Set Custom Time</h3>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={timerInputHours}
                      onChange={(e) => setTimerInputHours(e.target.value)}
                      className="w-16 h-16 text-center text-2xl font-mono font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium uppercase tracking-wider">Hours</span>
                  </div>
                  <span className="text-2xl font-bold text-slate-300 dark:text-slate-600 pb-6">:</span>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerInputMinutes}
                      onChange={(e) => setTimerInputMinutes(e.target.value)}
                      className="w-16 h-16 text-center text-2xl font-mono font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium uppercase tracking-wider">Mins</span>
                  </div>
                  <span className="text-2xl font-bold text-slate-300 dark:text-slate-600 pb-6">:</span>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerInputSeconds}
                      onChange={(e) => setTimerInputSeconds(e.target.value)}
                      className="w-16 h-16 text-center text-2xl font-mono font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium uppercase tracking-wider">Secs</span>
                  </div>
                </div>
                <button
                  onClick={handleSetTimer}
                  className="w-full py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-medium shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                >
                  Apply New Time
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Stopwatch Display */}
              <div className="w-72 h-72 flex items-center justify-center mb-10 bg-slate-50 dark:bg-slate-800/50 rounded-full border-8 border-slate-100 dark:border-slate-800 shadow-inner">
                <div className="flex items-baseline justify-center font-mono tracking-tighter">
                  <span className="text-6xl font-bold text-slate-900 dark:text-white">
                    {formatStopwatch(stopwatchTime).main}
                  </span>
                  <span className="text-3xl font-bold text-slate-400 dark:text-slate-500 ml-1">
                    .{formatStopwatch(stopwatchTime).ms}
                  </span>
                </div>
              </div>

              {/* Stopwatch Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleStopwatch}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                    isStopwatchRunning 
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50" 
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  {isStopwatchRunning ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                </button>
                
                <button
                  onClick={resetStopwatch}
                  className="w-20 h-20 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm transition-all active:scale-95"
                >
                  <RotateCcw className="w-8 h-8" />
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
