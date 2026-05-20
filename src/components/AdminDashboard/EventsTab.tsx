

interface EventItem {
  id: string;
  classId: string;
  className: string;
  date: string;
  title: string;
  type: string;
}

interface EventsTabProps {
  events: EventItem[];
  searchTerm: string;
}

export default function EventsTab({ events, searchTerm }: EventsTabProps) {
  const filtered = events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Class</th>
            <th className="pb-3 font-medium">Title</th>
            <th className="pb-3 font-medium">Type</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {filtered.map((e, i) => (
            <tr key={`${e.classId}-${e.id}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-3 text-slate-900 dark:text-white">{e.date}</td>
              <td className="py-3 text-slate-600 dark:text-slate-300">{e.className}</td>
              <td className="py-3 font-medium text-slate-900 dark:text-white">{e.title}</td>
              <td className="py-3 capitalize text-slate-600 dark:text-slate-400">{e.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
