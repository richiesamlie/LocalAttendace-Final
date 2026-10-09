import { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  subItem?: boolean;
}

export function NavItem({ icon, label, active, onClick, subItem = false }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl font-medium transition-all min-h-[44px] focus-ring",
        subItem ? "px-3 py-2.5 text-sm" : "px-4 py-3",
        active 
          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold" 
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
