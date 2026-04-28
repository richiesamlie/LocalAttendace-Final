import React, { useState, useMemo, useRef } from 'react';
import { useStore, AttendanceStatus } from '../store';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import { Check, X, Thermometer, Clock, Calendar as CalendarIcon, Search, ChevronDown, ChevronRight, FileText, Upload, Download, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { generateAttendanceTemplate, importAttendanceFromExcel } from '../utils/excel';
import { AttendanceGridSkeleton } from './Skeleton';

export default function TakeAttendance() {
  const [activeTab, setActiveTab] = useState<'today' | 'past'>('today');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const date = activeTab === 'today' ? format(new Date(), 'yyyy-MM-dd') : selectedDate;
  
  const students = useStore((state) => state.students);
  const isLoading = useStore((state) => state.isLoading);
  const currentClassId = useStore((state) => state.currentClassId);
  const allRecords = useStore((state) => state.records);
  const records = useMemo(
    () => allRecords.filter((r) => r.date === date),
    [allRecords, date]
  );
  const setRecord = useStore((state) => state.setRecord);
  const markAllPresent = useStore((state) => state.markAllPresent);
  const undoLastAttendance = useStore((state) => state.undoLastAttendance);
  const lastAttendanceChange = useStore((state) => state.lastAttendanceChange);
  const dailyNotes = useStore((state) => state.dailyNotes);
  const setDailyNote = useStore((state) => state.setDailyNote);
  const todayNote = dailyNotes[date] || '';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentClassId) {
      toast.error('Please select a class first.');
      return;
    }

    setIsImporting(true);
    try {
      const importedRecords = await importAttendanceFromExcel(file, currentClassId, students);
      if (importedRecords.length === 0) {
        toast.error('No valid attendance records found in file.');
        return;
      }
      await api.saveRecords(importedRecords);
      toast.success(`Imported ${importedRecords.length} attendance record(s)`);
      const state = useStore.getState();
      await state.initializeStore();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error importing attendance');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    const existing = records.find(r => r.studentId === studentId);
    setRecord({
      studentId,
      date,
      status,
      reason: existing?.reason || '',
    });
  };

  const handleReasonChange = (studentId: string, reason: string) => {
    const existing = records.find(r => r.studentId === studentId);
    if (existing) {
      setRecord({
        ...existing,
        reason,
      });
    }
  };

  const markAllPresentHandler = () => {
    const unmarked = filteredStudents.filter(s => !records.some(r => r.studentId === s.id));
    if (unmarked.length === 0) {
      toast('All students are already marked present.');
      return;
    }
    markAllPresent(date);
  };

  const filteredStudents = useMemo(() =>
    students
      .filter(student =>
        !student.isArchived &&
        (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) =>
        a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [students, searchQuery]
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Take Attendance</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Record daily presence and reasons for absence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
            />
          </div>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing...' : 'Import Excel'}
            </button>
          </div>
          <button
            onClick={generateAttendanceTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          {activeTab === 'past' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none dark:text-white"
            />
          )}
          <button
            onClick={markAllPresentHandler}
            className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors"
          >
            Mark All Present
          </button>
          {lastAttendanceChange && activeTab === 'today' && (
            <button
              onClick={undoLastAttendance}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Undo Last
            </button>
          )}
        </div>
      </div>

      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('today')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeTab === 'today'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Today's Attendance
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
            activeTab === 'past'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          Past Data
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setIsNotesExpanded(!isNotesExpanded)}
            className="w-full flex items-center justify-between p-4 sm:p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                todayNote ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              )}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Daily Notes / Remarks</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {todayNote ? "You have notes for this day." : "Add general notes for this day (e.g., weather, events)."}
                </p>
              </div>
            </div>
            {isNotesExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </button>
          
          {isNotesExpanded && (
            <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <textarea
                key={`note-${date}`}
                defaultValue={todayNote}
                onBlur={(e) => setDailyNote(date, e.target.value)}
                placeholder="Add any general notes for today (e.g., 'Heavy rain, many students late')"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white resize-none h-24"
              />
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Roll No</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/3">Reason (if not present)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8"><AttendanceGridSkeleton /></td></tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Check className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900 dark:text-white">No students found</p>
                      <p className="text-sm">Please add students in the <span className="font-semibold text-indigo-600 dark:text-indigo-400">Student Roster</span> tab first.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No students match your search' : 'No students in this class'}
                  </td>
                </tr>
              ) : filteredStudents.map((student) => {
                const record = records.find(r => r.studentId === student.id);
                const status = record?.status;

                return (
                  <tr key={`${date}-${student.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{student.rollNumber}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <StatusButton
                          active={status === 'Present'}
                          onClick={() => handleStatusChange(student.id, 'Present')}
                          color="emerald"
                          icon={<Check className="w-4 h-4" />}
                          label="Present"
                        />
                        <StatusButton
                          active={status === 'Absent'}
                          onClick={() => handleStatusChange(student.id, 'Absent')}
                          color="rose"
                          icon={<X className="w-4 h-4" />}
                          label="Absent"
                        />
                        <StatusButton
                          active={status === 'Sick'}
                          onClick={() => handleStatusChange(student.id, 'Sick')}
                          color="amber"
                          icon={<Thermometer className="w-4 h-4" />}
                          label="Sick"
                        />
                        <StatusButton
                          active={status === 'Late'}
                          onClick={() => handleStatusChange(student.id, 'Late')}
                          color="orange"
                          icon={<Clock className="w-4 h-4" />}
                          label="Late"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {status && status !== 'Present' ? (
                        <input
                          type="text"
                          placeholder={`Reason for being ${status.toLowerCase()}...`}
                          defaultValue={record?.reason || ''}
                          onBlur={(e) => handleReasonChange(student.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all dark:text-white"
                        />
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-sm italic">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusButton({ 
  active, 
  onClick, 
  color, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  color: 'emerald' | 'rose' | 'amber' | 'orange';
  icon: React.ReactNode;
  label: string;
}) {
  const colorStyles = {
    emerald: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800",
    rose: "hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800",
    amber: "hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-800",
    orange: "hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-800",
  };

  const activeStyles = {
    emerald: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 shadow-inner",
    rose: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700 shadow-inner",
    amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shadow-inner",
    orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 shadow-inner",
  };

  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 transition-all",
        active ? activeStyles[color] : colorStyles[color]
      )}
    >
      {icon}
    </button>
  );
}
