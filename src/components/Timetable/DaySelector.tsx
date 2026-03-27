import { DAYS, WORK_DAYS } from './timetableUtils';
import { cn } from '../../utils/cn';

const DAYS_MAP = DAYS as string[];

interface DaySelectorProps {
  selectedDay: number;
  onSelect: (day: number) => void;
}

export default function DaySelector({ selectedDay, onSelect }: DaySelectorProps) {
  return (
    <div className="flex justify-center sm:justify-start overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 inline-flex gap-1 shadow-sm">
        {WORK_DAYS.map(day => (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={cn(
              "px-6 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all text-sm",
              selectedDay === day
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {DAYS_MAP[day]}
          </button>
        ))}
      </div>
    </div>
  );
}
