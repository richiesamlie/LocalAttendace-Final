import { TimetableSlot } from '../../store';
import { cn } from '../../utils/cn';
import { Edit2, Trash2 } from 'lucide-react';
import { getSubjectColor, parseTime, DAYS, WORK_DAYS } from './timetableUtils';

const DAYS_MAP = DAYS as string[];

interface WeekViewProps {
  timetable: TimetableSlot[];
  onEdit: (slot: TimetableSlot) => void;
  onDelete: (id: string) => void;
  onLessonChange: (id: string, lesson: string) => void;
}

export default function WeekView({ timetable, onEdit, onDelete, onLessonChange }: WeekViewProps) {
  const timeSlots = Array.from(new Set(timetable.map(s => s.startTime))).sort((a, b) => parseTime(a) - parseTime(b));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="p-4 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-500 dark:text-slate-400 text-sm text-center">
              Time
            </div>
            {WORK_DAYS.map(day => (
              <div key={day} className="p-4 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white text-center last:border-r-0">
                {DAYS_MAP[day]}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {timeSlots.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                No classes scheduled yet. Switch to a day view to add classes.
              </div>
            ) : (
              timeSlots.map(time => (
                <div key={time} className="grid grid-cols-6">
                  <div className="p-4 border-r border-slate-100 dark:border-slate-800/50 text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/20">
                    {time}
                  </div>
                  {WORK_DAYS.map(day => {
                    const slot = timetable.find(s => s.dayOfWeek === day && s.startTime === time);

                    if (!slot) {
                      return (
                        <div
                          key={`${day}-${time}`}
                          className="p-2 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 bg-slate-50/30 dark:bg-slate-900/30"
                        />
                      );
                    }

                    const slotColor = getSubjectColor(slot.subject);

                    return (
                      <div
                        key={slot.id}
                        className="p-2 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 relative group"
                      >
                        <div
                          className={cn(
                            "h-full rounded-xl border p-3 flex flex-col transition-all hover:shadow-md cursor-pointer",
                            slotColor.bg,
                            slotColor.text,
                            slotColor.border
                          )}
                          onClick={() => onEdit(slot)}
                        >
                          <div className="font-bold text-sm mb-1 leading-tight line-clamp-2">
                            {slot.subject || 'Unassigned'}
                          </div>
                          <div className="text-xs opacity-80 font-medium mb-2">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <textarea
                            defaultValue={slot.lesson || ''}
                            placeholder="Add topic..."
                            rows={2}
                            onBlur={(e) => {
                              if (e.target.value !== slot.lesson) {
                                onLessonChange(slot.id, e.target.value);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full mt-auto pt-1.5 min-h-0 bg-transparent border-t border-current text-xs opacity-80 placeholder:text-current focus:opacity-100 focus:outline-none resize-none"
                          />

                          {/* Quick actions overlay */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-sm p-1 backdrop-blur-sm">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(slot); }}
                              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                              className="p-1 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
