import { Clock, Edit2, Trash2, FileText } from 'lucide-react';
import { TimetableSlot } from '../../store';
import { cn } from '../../utils/cn';
import { getSubjectColor } from './timetableUtils';

export interface SlotCardProps {
  slot: TimetableSlot;
  onEdit: (slot: TimetableSlot) => void;
  onDelete: (id: string) => void;
  onLessonChange: (id: string, lesson: string) => void;
}

export default function SlotCard({ slot, onEdit, onDelete, onLessonChange }: SlotCardProps) {
  const slotColor = getSubjectColor(slot.subject);

  return (
    <div className="relative group bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50 overflow-hidden flex flex-col h-full">
      {/* Accent line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl", slotColor.solid)} />

      <div className="flex justify-between items-start mb-4">
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide", slotColor.lightBg, slotColor.text)}>
          <Clock className="w-3.5 h-3.5" />
          {slot.startTime} - {slot.endTime}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(slot)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
            title="Edit Class"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(slot.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
            title="Remove Class"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <h3 className={cn("text-xl font-bold leading-tight", slot.subject ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500 italic")}>
          {slot.subject || 'Unassigned Subject'}
        </h3>
      </div>

      <div className="mt-auto pt-4 relative group/lesson">
        <div className="absolute top-4 left-3 text-slate-400 dark:text-slate-500 z-10 pointer-events-none">
          <FileText className="w-4 h-4 mt-1 shrink-0" />
        </div>
        <textarea
          defaultValue={slot.lesson || ''}
          placeholder="Add lesson topic..."
          rows={2}
          onBlur={(e) => {
            if (e.target.value !== slot.lesson) {
              onLessonChange(slot.id, e.target.value);
            }
          }}
          className="w-full text-sm leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 pl-9 rounded-xl border border-transparent focus:border-indigo-300 dark:focus:border-indigo-700 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 transition-colors resize-none placeholder:italic"
        />
      </div>
    </div>
  );
}
