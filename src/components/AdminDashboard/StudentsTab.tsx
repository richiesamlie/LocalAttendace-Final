

interface StudentItem {
  id: string;
  name: string;
  classId: string;
  className: string;
}

interface StudentsTabProps {
  students: StudentItem[];
  searchTerm: string;
}

export default function StudentsTab({ students, searchTerm }: StudentsTabProps) {
  const filtered = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
            <th className="pb-3 font-medium">ID</th>
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Class</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.map(s => (
            <tr key={`${s.classId}-${s.id}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-3 font-mono text-xs text-slate-500">{s.id}</td>
              <td className="py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
              <td className="py-3 text-slate-600 dark:text-slate-300">
                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-xs">
                  {s.className}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
