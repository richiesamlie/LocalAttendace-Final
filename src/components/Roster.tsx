import React, { useState, useRef } from 'react';
import { useStore, Student } from '../store';
import { importStudentsFromExcel, generateTemplate, exportClassData } from '../utils/excel';
import { Upload, Download, Plus, Trash2, Edit2, X, Check, Flag, Search, MoreVertical, FileSpreadsheet, RefreshCcw, CheckSquare, Square } from 'lucide-react';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

export default function Roster() {
  const students = useStore((state) => state.students);
  const currentClassId = useStore((state) => state.currentClassId);
  const setStudents = useStore((state) => state.setStudents);
  const addStudent = useStore((state) => state.addStudent);
  const removeStudent = useStore((state) => state.removeStudent);
  const updateStudent = useStore((state) => state.updateStudent);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  // Archive confirmation via toast
  React.useEffect(() => {
    if (!archiveConfirmId) return;
    const student = students.find(s => s.id === archiveConfirmId);
    if (!student) { setArchiveConfirmId(null); return; }
    const toastId = toast(
      (t) => (
        <div>
          <p className="font-medium">Archive "{student.name}"?</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">They will be hidden from attendance and reports but their records will be preserved.</p>
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1 text-sm bg-rose-600 text-white rounded hover:bg-rose-700"
              onClick={() => { removeStudent(archiveConfirmId); toast.dismiss(t.id); setArchiveConfirmId(null); }}
            >
              Archive
            </button>
            <button
              className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
              onClick={() => { toast.dismiss(t.id); setArchiveConfirmId(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 10000 }
    );
    return () => toast.dismiss(toastId);
  }, [archiveConfirmId, students, removeStudent]);

  // States for adding/editing
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editIsFlagged, setEditIsFlagged] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentClassId) {
      toast.error('Please create or select a class from the sidebar first before importing students.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const importedStudents = await importStudentsFromExcel(file, currentClassId);
      // Replace the roster automatically to avoid confirm prompt issues in iframe
      await setStudents(importedStudents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error importing students. Please ensure it is a valid Excel file.');
      console.error(error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startAddStudent = () => {
    if (!currentClassId) {
      toast.error('Please create or select a class from the sidebar first before adding students.');
      return;
    }
    setIsAdding(true);
    setEditName('');
    setEditRoll('');
    setEditParentName('');
    setEditParentPhone('');
    setEditIsFlagged(false);
    setEditingId(null);
  };

  const saveAddStudent = () => {
    if (!editName.trim() || !editRoll.trim()) return;
    addStudent({
      id: `std_${Date.now()}`,
      name: editName,
      rollNumber: editRoll,
      parentName: editParentName,
      parentPhone: editParentPhone,
      isFlagged: editIsFlagged,
    });
    setIsAdding(false);
  };

  const startEditStudent = (student: Student) => {
    setEditingId(student.id);
    setEditName(student.name);
    setEditRoll(student.rollNumber);
    setEditParentName(student.parentName || '');
    setEditParentPhone(student.parentPhone || '');
    setEditIsFlagged(student.isFlagged || false);
    setIsAdding(false);
  };

  const saveEditStudent = () => {
    if (!editingId || !editName.trim() || !editRoll.trim()) return;
    updateStudent(editingId, { 
      name: editName, 
      rollNumber: editRoll,
      parentName: editParentName,
      parentPhone: editParentPhone,
      isFlagged: editIsFlagged
    });
    setEditingId(null);
  };

  const toggleFlag = (student: Student) => {
    updateStudent(student.id, { isFlagged: !student.isFlagged });
  };

  const filteredStudents = students.filter(student => 
    (showArchived ? true : !student.isArchived) &&
    (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.parentName && student.parentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (student.parentPhone && student.parentPhone.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = [...selectedIds];
    try {
      const results = await Promise.allSettled(idsToDelete.map(id => removeStudent(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        toast.success(`Deleted ${idsToDelete.length} student(s)`);
      } else {
        toast.success(`Deleted ${idsToDelete.length - failed} student(s), ${failed} failed`);
      }
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    } catch {
      toast.error('Failed to delete students');
    }
  };

  const handleExportClass = () => {
    const state = useStore.getState();
    const currentClass = state.classes.find(c => c.id === state.currentClassId);
    if (!currentClass) {
      toast.error('No class selected');
      return;
    }
    exportClassData(
      currentClass.name,
      state.students,
      state.records,
      state.events,
      state.timetable,
      state.dailyNotes,
    );
    toast.success('Class data exported');
  };

  return (
    <>
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Roster</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your class list. Import from Excel for easy setup.</p>
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

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
              showArchived 
                ? "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </button>
          
          <div className="relative">
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => {
                handleFileUpload(e);
                setShowMoreMenu(false);
              }}
            />
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel Tools</span>
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      generateTemplate();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    Download Template
                  </button>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-colors text-left disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {isImporting ? 'Importing...' : 'Import from Excel'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExportClass}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Class
          </button>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <span className="text-sm font-medium text-rose-700 dark:text-rose-400">{selectedIds.size} selected</span>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={startAddStudent}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Student</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Roll No</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parent Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parent Phone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isAdding && (
                <tr className="bg-indigo-50/50 dark:bg-indigo-900/10">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Roll No"
                      value={editRoll}
                      onChange={(e) => setEditRoll(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                      autoFocus
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Student Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Parent Name"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditIsFlagged(!editIsFlagged)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          editIsFlagged 
                            ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50" 
                            : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        )}
                        title={editIsFlagged ? "Remove Flag" : "Flag Student"}
                      >
                        <Flag className={cn("w-5 h-5", editIsFlagged && "fill-current")} />
                      </button>
                      <button
                        onClick={saveAddStudent}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setIsAdding(false)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              
              {filteredStudents.map((student, index) => (
                <tr key={student.id} className={cn(
                  "hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-colors",
                  student.isArchived ? "opacity-60 bg-slate-50 dark:bg-slate-800/40" : 
                  (index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30")
                )}>
                  {editingId === student.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editRoll}
                          onChange={(e) => setEditRoll(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editParentName}
                          onChange={(e) => setEditParentName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editParentPhone}
                          onChange={(e) => setEditParentPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditIsFlagged(!editIsFlagged)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              editIsFlagged 
                                ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50" 
                                : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                            )}
                            title={editIsFlagged ? "Remove Flag" : "Flag Student"}
                          >
                            <Flag className={cn("w-5 h-5", editIsFlagged && "fill-current")} />
                          </button>
                      <button
                        onClick={saveEditStudent}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-5 h-5" />
                      </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => !student.isArchived && toggleSelect(student.id)}
                          disabled={student.isArchived}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {selectedIds.has(student.id) ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400">{student.rollNumber}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className={student.isArchived ? "line-through text-slate-500" : ""}>{student.name}</span>
                          {student.isFlagged && <Flag className="w-3 h-3 text-rose-500 fill-rose-500" />}
                          {student.isArchived && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">Archived</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.parentName || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{student.parentPhone || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {student.isArchived ? (
                            <button
                              onClick={() => updateStudent(student.id, { isArchived: false })}
                              className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex items-center gap-1"
                              title="Restore Student"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleFlag(student)}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  student.isFlagged 
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50" 
                                    : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                                )}
                                title={student.isFlagged ? "Remove Flag" : "Flag Student"}
                              >
                                <Flag className={cn("w-4 h-4", student.isFlagged && "fill-current")} />
                              </button>
                              <button
                                onClick={() => startEditStudent(student)}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                title="Edit Student"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setArchiveConfirmId(student.id);
                                }}
                                title="Archive Student"
                                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredStudents.length === 0 && !isAdding && students.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No students found matching "{searchQuery}".
                  </td>
                </tr>
              )}
              {students.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Upload className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your roster is empty</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Get started by adding students manually or importing an Excel file.
                      </p>
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={startAddStudent}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                          Add Manually
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Import Excel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Bulk Delete Confirmation Modal */}
    {showBulkDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Students</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Are you sure you want to delete <strong>{selectedIds.size} student(s)</strong>? Their attendance records and data will be permanently removed.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
            >
              Delete {selectedIds.size} Student(s)
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
