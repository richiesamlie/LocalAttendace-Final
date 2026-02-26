import React, { useState } from 'react';
import { useStore, TimetableSlot } from '../store';
import { Plus, Trash2, Clock, BookOpen, FileText, Edit2, X, Check, Download, Settings, LayoutGrid, List } from 'lucide-react';
import { cn } from '../utils/cn';
import { exportTimetableToExcel } from '../utils/excel';
import { format } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORK_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

export default function Timetable() {
  const timetable = useStore((state) => state.timetable || []);
  const addTimetableSlot = useStore((state) => state.addTimetableSlot);
  const updateTimetableSlot = useStore((state) => state.updateTimetableSlot);
  const removeTimetableSlot = useStore((state) => state.removeTimetableSlot);

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() === 0 || new Date().getDay() === 6 ? 1 : new Date().getDay());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  // Export states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [formData, setFormData] = useState({
    startTime: '08:00',
    endTime: '09:00',
    subject: '',
    lesson: ''
  });

  const slotsForDay = timetable
    .filter(slot => slot.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleSave = () => {
    if (!formData.subject.trim() || !formData.startTime || !formData.endTime) return;

    if (editingId) {
      updateTimetableSlot(editingId, formData);
      setEditingId(null);
    } else {
      addTimetableSlot({
        id: crypto.randomUUID(),
        dayOfWeek: selectedDay,
        ...formData
      });
      setIsAdding(false);
    }
    
    setFormData({ startTime: '08:00', endTime: '09:00', subject: '', lesson: '' });
  };

  const startEdit = (slot: TimetableSlot) => {
    setFormData({
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      lesson: slot.lesson
    });
    setEditingId(slot.id);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ startTime: '08:00', endTime: '09:00', subject: '', lesson: '' });
  };

  const handleExport = (duration: 'month' | 'semester') => {
    exportTimetableToExcel(timetable, exportMonth, duration);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Class Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your weekly timetable, subjects, and lessons.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={timetable.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Plan
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Export Lesson Plan
                  </h3>
                  <button onClick={() => setShowExportMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Month</label>
                    <input
                      type="month"
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleExport('month')}
                      className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-medium shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm"
                    >
                      Export 1 Month Plan
                    </button>
                    <button
                      onClick={() => handleExport('semester')}
                      className="w-full py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors text-sm"
                    >
                      Export Semester Plan (6 Months)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Generates an Excel file with your weekly schedule mapped out for every day.
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ startTime: '08:00', endTime: '09:00', subject: '', lesson: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex justify-center sm:justify-start overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 inline-flex gap-1 shadow-sm">
          {WORK_DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all text-sm",
                selectedDay === day
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {DAYS[day]}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/30 p-5 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Edit Class' : `Add Class for ${DAYS[selectedDay]}`}
            </h3>
            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
              <input
                type="text"
                placeholder="e.g., Mathematics"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Lesson / Topic</label>
              <input
                type="text"
                placeholder="e.g., Algebra Ch. 3"
                value={formData.lesson}
                onChange={(e) => setFormData({ ...formData, lesson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.subject.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Save Class
            </button>
          </div>
        </div>
      )}

      {/* Schedule List */}
      <div className="mt-8">
        {slotsForDay.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg text-slate-900 dark:text-white font-semibold">No classes scheduled</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Click "Add Class" to build your timetable for {DAYS[selectedDay]}.</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {slotsForDay.map((slot, index) => {
              // Generate a consistent color based on the subject name
              const colors = [
                'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 
                'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500'
              ];
              const colorIndex = slot.subject.length % colors.length;
              const accentColor = colors[colorIndex];

              return (
                <div 
                  key={slot.id}
                  className="relative group bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50 overflow-hidden flex flex-col h-full"
                >
                  {/* Accent line */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl", accentColor)}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold tracking-wide">
                      <Clock className="w-3.5 h-3.5" />
                      {slot.startTime} - {slot.endTime}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(slot)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
                        title="Edit Class"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeTimetableSlot(slot.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"
                        title="Remove Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{slot.subject}</h3>
                  </div>
                  
                  <div className="mt-auto pt-4">
                    {slot.lesson ? (
                      <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <FileText className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                        <p className="text-sm leading-relaxed line-clamp-3">{slot.lesson}</p>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl">
                        No lesson topic specified
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {slotsForDay.map((slot) => (
              <div 
                key={slot.id}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 group transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50"
              >
                <div className="flex items-center gap-3 sm:w-48 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
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
                      <div className="font-medium text-slate-900 dark:text-white">{slot.subject}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Subject</div>
                    </div>
                  </div>
                  
                  {slot.lesson && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-slate-700 dark:text-slate-300">{slot.lesson}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Lesson / Topic</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(slot)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Edit Class"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeTimetableSlot(slot.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    title="Remove Class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
