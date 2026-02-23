import { useState } from 'react';
import { useStore } from '../store';
import { exportMonthlyReportToExcel } from '../utils/excel';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Download, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const students = useStore((state) => state.students);
  const records = useStore((state) => state.records);

  const handleExport = () => {
    exportMonthlyReportToExcel(month, students, records);
  };

  // Calculate summary for the selected month
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const summary = students.map(student => {
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
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:text-white"
          />
          <button
            onClick={handleExport}
            disabled={students.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
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
