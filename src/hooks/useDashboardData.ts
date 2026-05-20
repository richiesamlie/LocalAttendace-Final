import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { format, isBefore, setHours, setMinutes, isAfter, parseISO } from 'date-fns';
import { parseTime } from '../components/Timetable/timetableUtils';

export function useDashboardData(currentTime: Date) {
  const [resolvedRole, setResolvedRole] = useState<{ key: string; role: string } | null>(null);

  const currentClassId = useStore((state) => state.currentClassId);
  const currentClass = useStore((state) => state.classes.find(c => c.id === state.currentClassId));
  const teacherId = useStore((state) => state.teacherId);
  const isAdmin = useStore((state) => state.isAdmin);

  const roleLookupKey = currentClassId && teacherId ? `${currentClassId}:${teacherId}` : '';

  useEffect(() => {
    if (!roleLookupKey || isAdmin) return;

    const classId = currentClassId;
    if (!classId) return;

    let cancelled = false;
    import('../lib/api').then(({ api }) => {
      api.getClassTeachers(classId).then(teachers => {
        if (cancelled) return;
        const me = teachers.find(t => t.teacher_id === teacherId);
        setResolvedRole({ key: roleLookupKey, role: me?.role || 'teacher' });
      }).catch(() => {
        if (cancelled) return;
        setResolvedRole({ key: roleLookupKey, role: 'teacher' });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [roleLookupKey, currentClassId, teacherId, isAdmin]);

  const userRole = useMemo(() => {
    if (isAdmin) return 'administrator';
    if (!roleLookupKey) return 'teacher';
    if (resolvedRole?.key === roleLookupKey) return resolvedRole.role;
    return 'teacher';
  }, [isAdmin, roleLookupKey, resolvedRole]);

  const todayStr = format(currentTime, 'yyyy-MM-dd');
  const currentDayOfWeek = currentTime.getDay();
  const allRecords = useStore((state) => state.records);
  const students = useStore((state) => state.students);
  const dailyNotes = useStore((state) => state.dailyNotes);
  const events = useStore((state) => state.events);
  const timetable = useStore((state) => state.timetable || []);
  const todayNote = dailyNotes[todayStr];

  const todaysClasses = useMemo(() =>
    timetable
      .filter(slot => slot.dayOfWeek === currentDayOfWeek)
      .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime)),
    [timetable, currentDayOfWeek]
  );

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => e.date === todayStr || isAfter(parseISO(e.date), new Date()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3),
    [events, todayStr]
  );

  const activeStudents = useMemo(() =>
    students.filter(s => !s.isArchived),
    [students]
  );

  const records = useMemo(() =>
    allRecords.filter(r => r.date === todayStr),
    [allRecords, todayStr]
  );

  const targetTime = useMemo(() => {
    if (todaysClasses.length === 0) return setMinutes(setHours(new Date(), 8), 15);
    const earliest = todaysClasses.reduce((min, slot) => {
      const t = parseTime(slot.startTime);
      return t < min ? t : min;
    }, parseTime(todaysClasses[0].startTime));
    const h = Math.floor(earliest / 60);
    const m = earliest % 60;
    return setMinutes(setHours(new Date(), h), m);
  }, [todaysClasses]);

  const presentCount = useMemo(() => records.filter(r => r.status === 'Present').length, [records]);
  const absentCount  = useMemo(() => records.filter(r => r.status === 'Absent').length,  [records]);
  const sickCount    = useMemo(() => records.filter(r => r.status === 'Sick').length,    [records]);
  const lateCount    = useMemo(() => records.filter(r => r.status === 'Late').length,    [records]);

  const greeting = useMemo(() => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, [currentTime]);

  const firstClassTime = useMemo(() => {
    if (todaysClasses.length === 0) return '8:15 AM';
    const mins = parseTime(todaysClasses[0].startTime);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  }, [todaysClasses]);

  const isBeforeTarget = isBefore(currentTime, targetTime);
  const isAttendanceDone = records.length === activeStudents.length && activeStudents.length > 0;

  const todayHoliday = useMemo(() =>
    events.find(e => e.date === todayStr && e.type === 'Holiday'),
    [events, todayStr]
  );

  return {
    currentClass,
    userRole,
    todayStr,
    todayNote,
    todaysClasses,
    upcomingEvents,
    activeStudents,
    records,
    presentCount,
    absentCount,
    sickCount,
    lateCount,
    greeting,
    firstClassTime,
    isBeforeTarget,
    isAttendanceDone,
    todayHoliday,
    students,
  };
}
