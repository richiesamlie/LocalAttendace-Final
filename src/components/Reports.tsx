import { useState } from 'react';
import { useStore } from '../store';
import { exportMonthlyReportToExcel, ExportOptions } from '../utils/excel';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Download, FileSpreadsheet, Search, Settings, X } from 'lucide-react';

export default function Reports() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeRollNumber: true,
    includeName: true,
    includeParentName: false,
    includeParentPhone: false,
    includeDailyStatus: true,
    includeSummary: true,
    includeReasons: true
  });

  const students = useStore((state) => state.students);
  const records = useStore((state) => state.records);

  const handleExport = () => {
    exportMonthlyReportToExcel(month, students, records, exportOptions);
    setShowExportOptions(false);
  };

  // Calculate summary for the selected month
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const summary = filteredStudents.map(student => {
    let present = 0, absent = 0, sick = 0, late = 0;
    
    daysInMonth.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const record = records.find(r => r.studentId === student.id && r.date === dateStr);
      if (record) {
        switch (record.status) {
          case 'Present': present++; break;
          case 'Absent': absent++; break;
          case 'Sick': sick++; break;
          case 'Late': late++; break;
        }
      }
    });

    return {
      ...student,
      present,
      absent,
      sick,
      late,
      total: present + absent + sick + late
    };
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">View attendance summary and export to Excel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
            />
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:text-white"
          />
          <div className="relative">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              disabled={students.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
            
            {showExportOptions && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Export Options
                  </h3>
                  <button onClick={() => setShowExportOptions(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {Object.entries({
                    includeRollNumber: 'Roll Number',
                    includeName: 'Student Name',
                    includeParentName: 'Parent Name',
                    includeParentPhone: 'Parent Phone',
                    includeDailyStatus: 'Daily Attendance Status',
                    includeSummary: 'Monthly Summary Totals',
                    includeReasons: 'Absence Reasons'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={exportOptions[key as keyof ExportOptions]}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                        <svg className="absolute w-5 h-5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{label}</span>
                    </label>
                  ))}
                  <button
                    onClick={handleExport}
                    className="w-full mt-4 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
                  >
                    Download File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Roll No</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider text-center">Present</th>
                <th className="px-6 py-4 text-xs font-semibold text-rose-600 dark:text-rose-500 uppercase tracking-wider text-center">Absent</th>
                <th className="px-6 py-4 text-xs font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-center">Sick</th>
                <th className="px-6 py-4 text-xs font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider text-center">Late</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Total Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{student.rollNumber}</td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                  <td className="px-6 py-4 text-center font-medium text-emerald-600 dark:text-emerald-400">{student.present}</td>
                  <td className="px-6 py-4 text-center font-medium text-rose-600 dark:text-rose-400">{student.absent}</td>
                  <td className="px-6 py-4 text-center font-medium text-amber-600 dark:text-amber-400">{student.sick}</td>
                  <td className="px-6 py-4 text-center font-medium text-orange-600 dark:text-orange-400">{student.late}</td>
                  <td className="px-6 py-4 text-center font-mono text-slate-500 dark:text-slate-400">{student.total}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No data to report</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Add students to the roster and take attendance to generate monthly reports.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
