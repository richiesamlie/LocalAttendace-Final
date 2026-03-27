import { useState } from 'react';
import { Download, Settings, X } from 'lucide-react';
import { TimetableSlot } from '../../store';
import { exportTimetableToExcel } from '../../utils/excel';
import { format } from 'date-fns';

interface ExportMenuProps {
  timetable: TimetableSlot[];
  className: string;
}

export default function ExportMenu({ timetable, className }: ExportMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const handleExport = (duration: 'weekly' | 'month' | 'semester') => {
    exportTimetableToExcel(timetable, exportMonth, duration, className);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={timetable.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        Export Plan
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Export Lesson Plan
            </h3>
            <button onClick={() => setShowMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Month</label>
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleExport('weekly')}
                className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-medium shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm"
              >
                Export Weekly Template (No Dates)
              </button>
              <button
                onClick={() => handleExport('month')}
                className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-medium shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm"
              >
                Export 1 Month Plan (With Dates)
              </button>
              <button
                onClick={() => handleExport('semester')}
                className="w-full py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors text-sm"
              >
                Export Semester Plan (With Dates)
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Generate an Excel file with your schedule. Monthly and Semester plans map out every specific date.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
