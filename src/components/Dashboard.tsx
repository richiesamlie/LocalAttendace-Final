import { useState, useEffect } from 'react';
import { useStore, EventType } from '../store';
import { format, isBefore, setHours, setMinutes, subDays, isAfter, parseISO } from 'date-fns';
import { Calendar, Users, FileSpreadsheet, Home, Clock, CheckCircle2, AlertCircle, FileText, BookOpen, PenTool, GraduationCap, Bell, Palmtree } from 'lucide-react';
import { cn } from '../utils/cn';

export default function Dashboard({ navigate }: { navigate: (page: string) => void }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const updateTimetableSlot = useStore((state) => state.updateTimetableSlot);
  
  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = format(currentTime, 'yyyy-MM-dd');
  const currentDayOfWeek = currentTime.getDay();
  const allRecords = useStore((state) => state.records);
  const records = allRecords.filter((r) => r.date === todayStr);
  const students = useStore((state) => state.students);
  const activeStudents = students.filter(s => !s.isArchived);
  const dailyNotes = useStore((state) => state.dailyNotes);
  const events = useStore((state) => state.events);
  const timetable = useStore((state) => state.timetable || []);
  const todayNote = dailyNotes[todayStr];

  const todaysClasses = timetable
    .filter(slot => slot.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => {
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
      return parseTime(a.startTime) - parseTime(b.startTime);
    });

  const targetTime = setMinutes(setHours(new Date(), 8), 15);
  const isBeforeTarget = isBefore(currentTime, targetTime);
  const isAttendanceDone = records.length === activeStudents.length && activeStudents.length > 0;

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'Classwork': return <BookOpen className="w-4 h-4" />;
      case 'Test': return <PenTool className="w-4 h-4" />;
      case 'Exam': return <GraduationCap className="w-4 h-4" />;
      case 'Holiday': return <Palmtree className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case 'Classwork': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'Test': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Exam': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      case 'Holiday': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const upcomingEvents = events
    .filter(e => e.date === todayStr || isAfter(parseISO(e.date), new Date()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const todayHoliday = events.find(e => e.date === todayStr && e.type === 'Holiday');

  const [activeTab, setActiveTab] = useState<'schedule' | 'events' | 'notes'>('schedule');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Good Morning, Teacher!</h1>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{format(currentTime, 'EEEE, MMMM do')}</p>
          <p className="text-2xl font-mono text-slate-900 dark:text-white">{format(currentTime, 'HH:mm:ss')}</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 dark:text-amber-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300">No students found</h3>
            <p className="text-amber-700 dark:text-amber-400/80 mt-1">Please import your student roster to start taking attendance.</p>
            <button
              onClick={() => navigate('roster')}
              className="mt-4 bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-xl font-medium hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
            >
              Go to Roster
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cn(
            "rounded-3xl p-8 shadow-sm border transition-colors",
            isAttendanceDone 
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50" 
              : isBeforeTarget 
                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50" 
                : "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50"
          )}>
            <div className="flex items-center gap-4 mb-6">
              {isAttendanceDone ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Clock className={cn("w-10 h-10", isBeforeTarget ? "text-indigo-500 dark:text-indigo-400" : "text-rose-500 dark:text-rose-400")} />
              )}
              <div>
                <h2 className={cn(
                  "text-xl font-semibold",
                  isAttendanceDone ? "text-emerald-900 dark:text-emerald-300" : isBeforeTarget ? "text-indigo-900 dark:text-indigo-300" : "text-rose-900 dark:text-rose-300"
                )}>
                  {isAttendanceDone ? "Attendance Complete" : "Daily Attendance"}
                </h2>
                <p className={cn(
                  "text-sm",
                  isAttendanceDone ? "text-emerald-700 dark:text-emerald-400/80" : isBeforeTarget ? "text-indigo-700 dark:text-indigo-400/80" : "text-rose-700 dark:text-rose-400/80"
                )}>
                  {isAttendanceDone 
                    ? "Great job! All students are accounted for today." 
                    : isBeforeTarget 
                      ? "It's before 8:15 AM. Perfect time to take attendance!" 
                      : "It's past 8:15 AM. Please complete attendance soon."}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                <span className="text-2xl font-bold text-slate-900 dark:text-white mr-2">{records.length} / {activeStudents.length}</span>
                Students recorded
              </div>
              <button
                onClick={() => navigate('attendance')}
                className={cn(
                  "px-6 py-3 rounded-xl font-medium text-white shadow-sm transition-transform hover:scale-105 active:scale-95",
                  isAttendanceDone ? "bg-emerald-600 hover:bg-emerald-700" : isBeforeTarget ? "bg-indigo-600 hover:bg-indigo-700" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                {isAttendanceDone ? "Review Attendance" : "Take Attendance"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Present</p>
                <p className="text-3xl font-light text-emerald-600 dark:text-emerald-400">{records.filter(r => r.status === 'Present').length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Absent</p>
                <p className="text-3xl font-light text-rose-600 dark:text-rose-400">{records.filter(r => r.status === 'Absent').length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sick</p>
                <p className="text-3xl font-light text-amber-600 dark:text-amber-400">{records.filter(r => r.status === 'Sick').length}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Late</p>
                <p className="text-3xl font-light text-orange-600 dark:text-orange-400">{records.filter(r => r.status === 'Late').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 md:col-span-2 overflow-hidden">
            <div className="flex border-b border-slate-100 dark:border-slate-800 overflow-x-auto hide-scrollbar bg-slate-50/50 dark:bg-slate-800/20">
              <button
                onClick={() => setActiveTab('schedule')}
                className={cn(
                  "px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors",
                  activeTab === 'schedule'
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <Clock className="w-4 h-4" /> Today's Classes
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={cn(
                  "px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors",
                  activeTab === 'events'
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <Calendar className="w-4 h-4" /> Upcoming Events
              </button>
              {todayNote && (
                <button
                  onClick={() => setActiveTab('notes')}
                  className={cn(
                    "px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors",
                    activeTab === 'notes'
                      ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <FileText className="w-4 h-4" /> Today's Notes
                </button>
              )}
            </div>

            <div className="p-6 sm:p-8">
              {activeTab === 'schedule' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Class Timetable</h3>
                    <button onClick={() => navigate('timetable')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      Manage Timetable
                    </button>
                  </div>
                  
                  {todayHoliday ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center shrink-0">
                        <Palmtree className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">No Classes Today</h4>
                        <p className="text-emerald-700 dark:text-emerald-400 mt-1">
                          Today is marked as an off day for: <strong>{todayHoliday.title}</strong>
                        </p>
                        {todayHoliday.description && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">{todayHoliday.description}</p>
                        )}
                      </div>
                    </div>
                  ) : todaysClasses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {todaysClasses.map(slot => (
                        <div key={slot.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                              {slot.startTime} - {slot.endTime}
                            </div>
                            <div className={cn("font-semibold truncate", slot.subject ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500 italic")}>
                              {slot.subject || 'Unassigned Subject'}
                            </div>
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
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full mt-1 bg-transparent border-0 p-0 text-sm text-slate-600 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 truncate"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No classes scheduled for today.</p>
                      <button onClick={() => navigate('timetable')} className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        Set up your timetable
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Events</h3>
                    <button onClick={() => navigate('schedule')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      View Calendar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {upcomingEvents.length > 0 ? (
                      upcomingEvents.map(event => {
                        const isEventToday = event.date === todayStr;
                        return (
                          <div key={event.id} className={cn("rounded-2xl p-4 border", getEventColor(event.type))}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 font-semibold mb-1 text-sm">
                                {getEventIcon(event.type)}
                                <span className="truncate">{event.title}</span>
                              </div>
                              {isEventToday && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-[10px] font-medium opacity-75 uppercase tracking-wider">{event.type}</div>
                              {!isEventToday && (
                                <div className="text-xs font-medium opacity-90">{format(parseISO(event.date), 'MMM d')}</div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-3 text-slate-500 dark:text-slate-400 text-sm italic text-center py-4">
                        No upcoming events scheduled.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'notes' && todayNote && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Daily Remarks</h3>
                    <button onClick={() => navigate('attendance')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      Edit Notes
                    </button>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-6 border border-amber-100 dark:border-amber-800/30">
                    <p className="text-amber-800 dark:text-amber-200/80 whitespace-pre-wrap leading-relaxed">{todayNote}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
