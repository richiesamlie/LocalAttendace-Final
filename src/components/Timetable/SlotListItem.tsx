import { Clock, BookOpen, FileText, Edit2, Trash2 } from 'lucide-react';
import { TimetableSlot } from '../../store';
import { cn } from '../../utils/cn';
import { getSubjectColor } from './timetableUtils';

export interface SlotListItemProps {
  slot: TimetableSlot;
  onEdit: (slot: TimetableSlot) => void;
  onDelete: (id: string) => void;
  onLessonChange: (id: string, lesson: string) => void;
}

export default function SlotListItem({ slot, onEdit, onDelete, onLessonChange }: SlotListItemProps) {
  const slotColor = getSubjectColor(slot.subject);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 group transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50 relative overflow-hidden">
      {/* Accent line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", slotColor.solid)} />

      <div className="flex items-center gap-3 sm:w-48 shrink-0 pl-2">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", slotColor.lightBg, slotColor.text)}>
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
            {slot.startTime} - {slot.endTime}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
            Time
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className={cn("font-medium", slot.subject ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500 italic")}>
              {slot.subject || 'Unassigned Subject'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Subject</div>
          </div>
        </div>

        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="w-full min-w-0">
            <input
              type="text"
              defaultValue={slot.lesson || ''}
              placeholder="Add lesson topic..."
              onBlur={(e) => {
                if (e.target.value !== slot.lesson) {
                  onLessonChange(slot.id, e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-300 dark:focus:border-indigo-700 rounded-md -ml-2 px-2 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-0 transition-colors truncate"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 ml-0.5">Lesson / Topic</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 sm:opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(slot)}
          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="Edit Class"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(slot.id)}
          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          title="Remove Class"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
