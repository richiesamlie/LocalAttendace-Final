import React, { useState } from 'react';
import { useStore, EventType, CalendarEvent } from '../store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { Calendar as CalendarIcon, Plus, X, Trash2, BookOpen, PenTool, GraduationCap, Bell, Edit2 } from 'lucide-react';

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('Classwork');
  const [eventDesc, setEventDesc] = useState('');
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);

  const events = useStore((state) => state.events);
  const addEvent = useStore((state) => state.addEvent);
  const updateEvent = useStore((state) => state.updateEvent);
  const removeEvent = useStore((state) => state.removeEvent);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectedDateEvents = events.filter(e => e.date === selectedDate);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    
    if (isEditingEvent && selectedEvent) {
      updateEvent(selectedEvent.id, {
        title: eventTitle,
        type: eventType,
        description: eventDesc
      });
      setSelectedEvent(null);
      setIsEditingEvent(false);
    } else {
      addEvent({
        id: `evt_${Date.now()}`,
        date: selectedDate,
        title: eventTitle,
        type: eventType,
        description: eventDesc
      });
    }
    
    setEventTitle('');
    setEventDesc('');
    setIsAddingEvent(false);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEventTitle(event.title);
    setEventType(event.type);
    setEventDesc(event.description || '');
    setSelectedEvent(event);
    setIsEditingEvent(true);
    setIsAddingEvent(true);
  };

  const handleDeleteEvent = (id: string) => {
    removeEvent(id);
    setSelectedEvent(null);
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'Classwork': return <BookOpen className="w-4 h-4" />;
      case 'Test': return <PenTool className="w-4 h-4" />;
      case 'Exam': return <GraduationCap className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case 'Classwork': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'Test': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Exam': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Class Schedule</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage classwork, tests, and exams.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={format(currentDate, 'yyyy-MM')}
            onChange={(e) => setCurrentDate(parseISO(`${e.target.value}-01`))}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before start of month */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-transparent" />
            ))}
            
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = events.filter(e => e.date === dateStr);
              const isSelected = selectedDate === dateStr;
              const isTodayDate = isToday(day);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "aspect-square rounded-xl border p-2 flex flex-col items-start justify-start transition-all relative overflow-hidden",
                    isSelected 
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm" 
                      : isTodayDate
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isSelected ? "bg-indigo-500 text-white" : isTodayDate ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  <div className="mt-1 w-full flex flex-col gap-1">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={cn("text-[10px] px-1.5 py-0.5 rounded truncate w-full text-left border", getEventColor(e.type))}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Events Sidebar */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {format(parseISO(selectedDate), 'MMMM do, yyyy')}
            </h3>
            <button
              onClick={() => {
                setIsAddingEvent(true);
                setIsEditingEvent(false);
                setEventTitle('');
                setEventDesc('');
                setEventType('Classwork');
              }}
              className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {isAddingEvent && (
            <form onSubmit={handleAddEvent} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-900 dark:text-white text-sm">
                  {isEditingEvent ? 'Edit Event' : 'New Event'}
                </h4>
                <button type="button" onClick={() => {
                  setIsAddingEvent(false);
                  setIsEditingEvent(false);
                }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <input
                type="text"
                placeholder="Event Title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                autoFocus
                required
              />
              
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
              >
                <option value="Classwork">Classwork</option>
                <option value="Test">Test</option>
                <option value="Exam">Exam</option>
                <option value="Other">Other</option>
              </select>
              
              <textarea
                placeholder="Description (optional)"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white resize-none h-20"
              />
              
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
              >
                {isEditingEvent ? 'Update Event' : 'Save Event'}
              </button>
            </form>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {selectedDateEvents.length === 0 && !isAddingEvent ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                <CalendarIcon className="w-8 h-8 opacity-50" />
                <p className="text-sm">No events scheduled</p>
              </div>
            ) : (
              selectedDateEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={cn("w-full text-left rounded-2xl p-4 border relative group transition-all hover:shadow-md", getEventColor(event.type))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      {getEventIcon(event.type)}
                      <span>{event.title}</span>
                    </div>
                  </div>
                  <div className="text-xs font-medium opacity-75 mb-2 uppercase tracking-wider">{event.type}</div>
                  {event.description && (
                    <p className="text-sm opacity-90 whitespace-pre-wrap line-clamp-2">{event.description}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && !isEditingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={cn("p-6 border-b", getEventColor(selectedEvent.type).replace('bg-', 'bg-opacity-50 bg-'))}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded-xl">
                    {getEventIcon(selectedEvent.type)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-sm font-medium opacity-80 uppercase tracking-wider mt-1">
                      {selectedEvent.type} • {format(parseISO(selectedEvent.date), 'MMM do, yyyy')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
              {selectedEvent.description ? (
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedEvent.description}
                </p>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 italic text-sm">
                  No description provided.
                </p>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="flex items-center gap-2 px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl font-medium transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => handleEditEvent(selectedEvent)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition-colors shadow-sm text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
