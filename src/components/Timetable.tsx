import React, { useState } from 'react';
import { useStore, TimetableSlot } from '../store';
import { Plus, Trash2, Clock, BookOpen, FileText, Edit2, X, Check, Download, Settings, LayoutGrid, List, Copy, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../utils/cn';
import { exportTimetableToExcel } from '../utils/excel';
import { format } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORK_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

const parseTime = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const modifier = match[3]?.toLowerCase();
  if (modifier === 'pm' && h < 12) h += 12;
  if (modifier === 'am' && h === 12) h = 0;
  return h * 60 + m;
};

// Helper function to get consistent colors for subjects
const getSubjectColor = (subject: string) => {
  if (!subject) return {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    text: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    solid: 'bg-slate-400',
    lightBg: 'bg-slate-100 dark:bg-slate-800'
  };

  const colors = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/50', solid: 'bg-blue-500', lightBg: 'bg-blue-100 dark:bg-blue-900/40' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', solid: 'bg-emerald-500', lightBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800/50', solid: 'bg-violet-500', lightBg: 'bg-violet-100 dark:bg-violet-900/40' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/50', solid: 'bg-amber-500', lightBg: 'bg-amber-100 dark:bg-amber-900/40' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/50', solid: 'bg-rose-500', lightBg: 'bg-rose-100 dark:bg-rose-900/40' },
    { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/50', solid: 'bg-cyan-500', lightBg: 'bg-cyan-100 dark:bg-cyan-900/40' },
    { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800/50', solid: 'bg-fuchsia-500', lightBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50', solid: 'bg-orange-500', lightBg: 'bg-orange-100 dark:bg-orange-900/40' },
    { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800/50', solid: 'bg-teal-500', lightBg: 'bg-teal-100 dark:bg-teal-900/40' },
    { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800/50', solid: 'bg-pink-500', lightBg: 'bg-pink-100 dark:bg-pink-900/40' }
  ];

  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function Timetable() {
  const timetable = useStore((state) => state.timetable || []);
  const addTimetableSlot = useStore((state) => state.addTimetableSlot);
  const updateTimetableSlot = useStore((state) => state.updateTimetableSlot);
  const removeTimetableSlot = useStore((state) => state.removeTimetableSlot);

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() === 0 || new Date().getDay() === 6 ? 1 : new Date().getDay());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'week'>('card');
  
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
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

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
    // If editing from week view, switch to the day of the slot
    if (viewMode === 'week') {
      setSelectedDay(slot.dayOfWeek);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ startTime: '08:00', endTime: '09:00', subject: '', lesson: '' });
  };

  const classes = useStore((state) => state.classes);
  const currentClassId = useStore((state) => state.currentClassId);

  const handleExport = (duration: 'weekly' | 'month' | 'semester') => {
    const currentClass = classes.find(c => c.id === currentClassId);
    const className = currentClass ? currentClass.name : 'Class';
    exportTimetableToExcel(timetable, exportMonth, duration, className);
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
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
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
                      onClick={() => handleExport('weekly')}
                      className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-medium shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm"
                    >
                      Export Weekly Template (No Dates)
                    </button>
                    <button
                      onClick={() => handleExport('month')}
                      className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-medium shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-sm"
                    >
                      Export 1 Month Plan (With Dates)
                    </button>
                    <button
                      onClick={() => handleExport('semester')}
                      className="w-full py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors text-sm"
                    >
                      Export Semester Plan (With Dates)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Generate an Excel file with your schedule. Monthly and Semester plans map out every specific date.
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
        {viewMode === 'week' ? (
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
                      {DAYS[day]}
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {/* Generate unique time slots across all days */}
                  {Array.from(new Set(timetable.map(s => s.startTime))).sort((a, b) => parseTime(a) - parseTime(b)).map(time => (
                    <div key={time} className="grid grid-cols-6">
                      <div className="p-4 border-r border-slate-100 dark:border-slate-800/50 text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/20">
                        {time}
                      </div>
                      {WORK_DAYS.map(day => {
                        const slot = timetable.find(s => s.dayOfWeek === day && s.startTime === time);
                        
                        if (!slot) {
                          return <div key={`${day}-${time}`} className="p-2 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 bg-slate-50/30 dark:bg-slate-900/30"></div>;
                        }

                        const slotColor = getSubjectColor(slot.subject);

                        return (
                          <div key={slot.id} className="p-2 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 relative group">
                            <div 
                              className={cn(
                                "h-full rounded-xl border p-3 flex flex-col transition-all hover:shadow-md cursor-pointer",
                                slotColor.bg,
                                slotColor.text,
                                slotColor.border
                              )}
                              onClick={() => startEdit(slot)}
                            >
                              <div className="font-bold text-sm mb-1 leading-tight line-clamp-2">{slot.subject || 'Unassigned'}</div>
                              <div className="text-xs opacity-80 font-medium mb-2">{slot.startTime} - {slot.endTime}</div>
                              <textarea 
                                defaultValue={slot.lesson || ''}
                                placeholder="Add topic..."
                                rows={2}
                                onBlur={(e) => {
                                  if (e.target.value !== slot.lesson) {
                                    updateTimetableSlot(slot.id, { lesson: e.target.value });
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full mt-auto pt-1.5 min-h-0 bg-transparent border-t border-current text-xs opacity-80 placeholder:text-current focus:opacity-100 focus:outline-none resize-none"
                              />
                              
                              {/* Quick actions overlay */}
                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-sm p-1 backdrop-blur-sm">
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEdit(slot); }}
                                  className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeTimetableSlot(slot.id); }}
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
                  ))}
                  
                  {timetable.length === 0 && (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                      No classes scheduled yet. Switch to a day view to add classes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : slotsForDay.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg text-slate-900 dark:text-white font-semibold">No classes scheduled</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">Click "Add Class" to build your timetable for {DAYS[selectedDay]}.</p>
            
            {selectedDay !== 1 && timetable.some(s => s.dayOfWeek === 1) && (
              <button
                onClick={() => {
                  const mondaySlots = timetable.filter(slot => slot.dayOfWeek === 1).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
                  mondaySlots.forEach(slot => {
                    addTimetableSlot({
                      id: crypto.randomUUID(),
                      dayOfWeek: selectedDay,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      subject: '',
                      lesson: ''
                    });
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Times from Monday
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {slotsForDay.map((slot, index) => {
              const slotColor = getSubjectColor(slot.subject);

              return (
                <div 
                  key={slot.id}
                  className="relative group bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50 overflow-hidden flex flex-col h-full"
                >
                  {/* Accent line */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl", slotColor.solid)}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide", slotColor.lightBg, slotColor.text)}>
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
                          updateTimetableSlot(slot.id, { lesson: e.target.value });
                        }
                      }}
                      className="w-full text-sm leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 pl-9 rounded-xl border border-transparent focus:border-indigo-300 dark:focus:border-indigo-700 focus:bg-white dark:focus:bg-slate-900 focus:ring-0 transition-colors resize-none placeholder:italic"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {slotsForDay.map((slot) => {
              const slotColor = getSubjectColor(slot.subject);
              
              return (
                <div 
                  key={slot.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 group transition-all hover:border-indigo-200 dark:hover:border-indigo-800/50 relative overflow-hidden"
                >
                  {/* Accent line */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", slotColor.solid)}></div>

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
                            updateTimetableSlot(slot.id, { lesson: e.target.value });
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
