import React, { useState } from 'react';
import { useStore, TimetableSlot } from '../../store';
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, Copy, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';

import DaySelector from './DaySelector';
import SlotForm from './SlotForm';
import SlotCard from './SlotCard';
import SlotListItem from './SlotListItem';
import WeekView from './WeekView';
import ExportMenu from './ExportMenu';

import { parseTime } from './timetableUtils';

export { DAYS, WORK_DAYS, parseTime, getSubjectColor } from './timetableUtils';

export type { TimetableSlot };

export default function Timetable() {
  const timetable = useStore((s) => s.timetable || []);
  const addTimetableSlot = useStore((s) => s.addTimetableSlot);
  const updateTimetableSlot = useStore((s) => s.updateTimetableSlot);
  const removeTimetableSlot = useStore((s) => s.removeTimetableSlot);
  const classes = useStore((s) => s.classes);
  const currentClassId = useStore((s) => s.currentClassId);

  const [selectedDay, setSelectedDay] = useState<number>(
    new Date().getDay() === 0 || new Date().getDay() === 6 ? 1 : new Date().getDay()
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'week'>('card');

  const editingSlot = editingId ? timetable.find(s => s.id === editingId) ?? null : null;
  const slotsForDay = timetable
    .filter(s => s.dayOfWeek === selectedDay)
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  const handleSave = (data: { startTime: string; endTime: string; subject: string; lesson: string }) => {
    if (editingId) {
      updateTimetableSlot(editingId, data);
      setEditingId(null);
    } else {
      addTimetableSlot({ id: crypto.randomUUID(), dayOfWeek: selectedDay, ...data });
      setIsAdding(false);
    }
  };

  const startEdit = (slot: TimetableSlot) => {
    setEditingId(slot.id);
    setIsAdding(false);
    if (viewMode === 'week') setSelectedDay(slot.dayOfWeek);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  const handleLessonChange = (id: string, lesson: string) => {
    updateTimetableSlot(id, { lesson });
  };

  const handleCopyFromMonday = () => {
    const mondaySlots = timetable
      .filter(s => s.dayOfWeek === 1)
      .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
    mondaySlots.forEach(slot => {
      addTimetableSlot({
        id: crypto.randomUUID(),
        dayOfWeek: selectedDay,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: '',
        lesson: '',
      });
    });
  };

  const currentClass = classes.find(c => c.id === currentClassId);
  const className = currentClass ? currentClass.name : 'Class';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Class Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage your weekly timetable, subjects, and lessons.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View mode toggle */}
          <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center shadow-sm">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'card'
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'list'
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5",
                viewMode === 'week'
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Week View"
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Week</span>
            </button>
          </div>

          <ExportMenu timetable={timetable} className={className} />

          <button
            onClick={() => { setIsAdding(true); setEditingId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <DaySelector selectedDay={selectedDay} onSelect={(d) => { setSelectedDay(d); setEditingId(null); setIsAdding(false); }} />

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <SlotForm
          mode={editingId ? 'edit' : 'add'}
          editingSlot={editingSlot}
          selectedDay={selectedDay}
          onSave={handleSave}
          onCancel={cancelEdit}
        />
      )}

      {/* Schedule Content */}
      <div className="mt-8">
        {viewMode === 'week' ? (
          <WeekView
            timetable={timetable}
            onEdit={startEdit}
            onDelete={removeTimetableSlot}
            onLessonChange={handleLessonChange}
          />
        ) : slotsForDay.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg text-slate-900 dark:text-white font-semibold">No classes scheduled</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">
              Click "Add Class" to build your timetable for {DAYS[selectedDay]}.
            </p>
            {selectedDay !== 1 && timetable.some(s => s.dayOfWeek === 1) && (
              <button
                onClick={handleCopyFromMonday}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Times from Monday
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(slotsForDay as TimetableSlot[]).map((slot) => {
              const card = <SlotCard slot={slot} onEdit={startEdit} onDelete={removeTimetableSlot} onLessonChange={handleLessonChange} />;
              return <React.Fragment key={slot.id}>{card}</React.Fragment>;
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {(slotsForDay as TimetableSlot[]).map((slot) => {
              const list = <SlotListItem slot={slot} onEdit={startEdit} onDelete={removeTimetableSlot} onLessonChange={handleLessonChange} />;
              return <React.Fragment key={slot.id}>{list}</React.Fragment>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
