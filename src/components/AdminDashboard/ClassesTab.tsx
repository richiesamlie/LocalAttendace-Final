

interface ClassItem {
  id: string;
  name: string;
  students?: any[];
}

interface ClassesTabProps {
  classes: ClassItem[];
  searchTerm: string;
}

export default function ClassesTab({ classes, searchTerm }: ClassesTabProps) {
  const filtered = classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
            <th className="pb-3 font-medium">ID</th>
            <th className="pb-3 font-medium">Class Name</th>
            <th className="pb-3 font-medium">Students</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.map(c => (
            <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-3 font-mono text-xs text-slate-500">{c.id}</td>
              <td className="py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
              <td className="py-3 text-slate-600 dark:text-slate-300">{(c.students || []).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
