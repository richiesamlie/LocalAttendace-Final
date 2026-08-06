import { cn } from '../utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700", className)} />
  );
}

export function AttendanceGridSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-20 h-3" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j}><Skeleton className="w-10 h-10 rounded-lg" /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
