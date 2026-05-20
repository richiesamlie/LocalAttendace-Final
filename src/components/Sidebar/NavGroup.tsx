import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NavGroupProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function NavGroup({ title, icon, children, defaultExpanded = false }: NavGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="mb-1">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          {title}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1 relative before:absolute before:inset-y-0 before:left-[26px] before:w-px before:bg-slate-200 dark:before:bg-slate-800 pl-11 pr-2">
          {children}
        </div>
      )}
    </div>
  );
}
