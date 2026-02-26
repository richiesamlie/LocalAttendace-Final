import React, { useState } from 'react';
import { useStore } from '../store';
import { Shuffle, User, Trophy } from 'lucide-react';
import { cn } from '../utils/cn';

export default function RandomPicker() {
  const students = useStore((state) => state.students);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const pickRandom = () => {
    if (students.length === 0) return;
    setIsSpinning(true);
    
    // Simulate spinning effect
    let spins = 0;
    const maxSpins = 20;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * students.length);
      setSelectedStudent(students[randomIndex].id);
      spins++;
      
      if (spins >= maxSpins) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  const selected = students.find(s => s.id === selectedStudent);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Random Student Picker</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Fairly select students for participation or tasks.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-50 dark:opacity-20">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-100 dark:bg-indigo-900 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-100 dark:bg-emerald-900 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full">
          <div className={cn(
            "w-48 h-48 rounded-full flex items-center justify-center mb-8 shadow-xl border-4 transition-all duration-200",
            isSpinning ? "border-indigo-400 dark:border-indigo-500 scale-95" : selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 scale-100" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 scale-100"
          )}>
            {selected ? (
              <div className="text-center p-4">
                <Trophy className={cn("w-12 h-12 mx-auto mb-2", isSpinning ? "text-indigo-400" : "text-emerald-500")} />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                  {selected.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  Roll: {selected.rollNumber}
                </p>
              </div>
            ) : (
              <User className="w-20 h-20 text-slate-300 dark:text-slate-600" />
            )}
          </div>

          <button
            onClick={pickRandom}
            disabled={isSpinning || students.length === 0}
            className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Shuffle className={cn("w-6 h-6", isSpinning && "animate-spin")} />
            {isSpinning ? 'Picking...' : 'Pick Random Student'}
          </button>

          {students.length === 0 && (
            <p className="mt-6 text-rose-500 dark:text-rose-400 font-medium">
              Please add students to the roster first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
