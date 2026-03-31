import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { Search, Clock, CheckCircle2, UserCircle } from 'lucide-react';
import { cn } from '../utils/cn';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useMemo(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function Gatekeeper() {
  const classes = useStore((state) => state.classes);
  const setRecordForClass = useStore((state) => state.setRecordForClass);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  const today = new Date().toISOString().split('T')[0];

  // Flatten all students from all classes
  const allStudents = classes.flatMap(c => 
    (c.students || []).map(s => ({
      ...s,
      classId: c.id,
      className: c.name,
      records: c.records || []
    }))
  );

  const safeString = (val: any) => (val ? String(val).toLowerCase() : '');

  const filteredStudents = debouncedQuery.trim() === '' 
    ? [] 
    : allStudents.filter(student => {
        const query = debouncedQuery.toLowerCase().trim();
        return safeString(student.name).includes(query) ||
               safeString(student.rollNumber).includes(query) ||
               safeString(student.className).includes(query);
      }).slice(0, 20); // Limit to 20 results for performance

  const handleTagLate = (classId: string, studentId: string) => {
    setRecordForClass(classId, {
      studentId,
      date: today,
      status: 'Late',
      reason: 'Tagged by Gatekeeper'
    });
  };

  const getStudentStatus = (student: typeof allStudents[0]) => {
    const todayRecord = student.records.find(r => r.date === today && r.studentId === student.id);
    return todayRecord?.status;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-2 mb-8">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Gatekeeper</h1>
        <p className="text-slate-500 dark:text-slate-400">Search for students to quickly tag them as late.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by student name, roll number, or class..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-lg dark:text-white transition-all shadow-sm"
          autoFocus
        />
      </div>

      {searchQuery.trim() !== '' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          {filteredStudents.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map(student => {
                const status = getStudentStatus(student);
                const isLate = status === 'Late';
                const isPresent = status === 'Present';

                return (
                  <div key={`${student.classId}-${student.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">{student.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{student.rollNumber}</span>
                          <span>&bull;</span>
                          <span>{student.className}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      {isLate ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium border border-amber-200/50 dark:border-amber-500/20">
                          <CheckCircle2 className="w-4 h-4" />
                          Tagged Late
                        </div>
                      ) : isPresent ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200/50 dark:border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4" />
                          Already Present
                        </div>
                      ) : (
                        <button
                          onClick={() => handleTagLate(student.classId, student.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <Clock className="w-4 h-4" />
                          Tag Late
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No students found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
