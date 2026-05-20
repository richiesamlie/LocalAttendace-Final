

interface AttendanceRecord {
  date: string;
  className: string;
  studentId: string;
  status: string;
  classId: string;
}

interface AttendanceTabProps {
  attendance: AttendanceRecord[];
  searchTerm: string;
}

export default function AttendanceTab({ attendance, searchTerm }: AttendanceTabProps) {
  const filtered = attendance.filter(
    a => a.date.includes(searchTerm) || a.studentId.includes(searchTerm)
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Class</th>
            <th className="pb-3 font-medium">Student ID</th>
            <th className="pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.slice(0, 100).map((a, i) => (
            <tr key={`${a.classId}-${a.date}-${a.studentId}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-3 text-slate-900 dark:text-white">{a.date}</td>
              <td className="py-3 text-slate-600 dark:text-slate-300">{a.className}</td>
              <td className="py-3 font-mono text-xs text-slate-500">{a.studentId}</td>
              <td className="py-3">
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                  a.status === 'Present' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                  a.status === 'Absent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' :
                  'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                }`}>
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 100 && (
        <p className="text-xs text-slate-500 mt-4 text-center">Showing first 100 records. Use search to filter.</p>
      )}
    </div>
  );
}
