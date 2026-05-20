import React, { useState, useRef } from 'react';
import { useStore, Student } from '../store';
import { Upload, Download, Plus, Trash2, Search, FileSpreadsheet, CheckSquare, Square, Flag, Check, X } from 'lucide-react';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { useClickOutside } from '../hooks/useClickOutside';
import { getExcelUtils } from '../utils/excelLoader';
import { useCurrentClassName } from '../hooks/useCurrentClass';
import { useStudentForm } from '../hooks/useStudentForm';
import StudentRow from './Roster/StudentRow';

export default function Roster() {
  const students = useStore((state) => state.students);
  const currentClassId = useStore((state) => state.currentClassId);
  const setStudents = useStore((state) => state.setStudents);
  const addStudent = useStore((state) => state.addStudent);
  const removeStudent = useStore((state) => state.removeStudent);
  const updateStudent = useStore((state) => state.updateStudent);
  
  const className = useCurrentClassName();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(moreMenuRef, () => setShowMoreMenu(false), showMoreMenu);

  const {
    isAdding,
    editingId,
    addName, setAddName,
    addRoll, setAddRoll,
    addParentName, setAddParentName,
    addParentPhone, setAddParentPhone,
    addIsFlagged, setAddIsFlagged,
    startAddStudent,
    saveAddStudent,
    startEditStudent,
    saveEditStudent,
    cancelAdd,
    cancelEdit
  } = useStudentForm(currentClassId, addStudent, updateStudent);

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
      const { importStudentsFromExcel } = await getExcelUtils();
      const importedStudents = await importStudentsFromExcel(file, currentClassId);

      await setStudents(importedStudents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error importing students. Please ensure it is a valid Excel file.');
      console.error(error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleFlag = (student: Student) => {
    updateStudent(student.id, { isFlagged: !student.isFlagged });
  };

  const filteredStudents = students
    .filter(student => 
      (showArchived ? true : !student.isArchived) &&
      (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.parentName && student.parentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (student.parentPhone && student.parentPhone.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' }));

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

  const handleExportClass = async () => {
    const state = useStore.getState();
    if (!state.currentClassId) {
      toast.error('No class selected');
      return;
    }
    const { exportClassData } = await getExcelUtils();
    exportClassData(
      className,
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
              aria-label="Upload Excel file"
            />
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel Tools</span>
            </button>

            {showMoreMenu && (
              <div ref={moreMenuRef} className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 space-y-1">
                  <button
                    onClick={async () => {
                      const { generateTemplate } = await getExcelUtils();
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
                  <td className="px-6 py-4" />
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Roll No"
                      value={addRoll}
                      onChange={(e) => setAddRoll(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                      autoFocus
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Student Name"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Parent Name"
                      value={addParentName}
                      onChange={(e) => setAddParentName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={addParentPhone}
                      onChange={(e) => setAddParentPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setAddIsFlagged(!addIsFlagged)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          addIsFlagged 
                            ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50" 
                            : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        )}
                        title={addIsFlagged ? "Remove Flag" : "Flag Student"}
                      >
                        <Flag className={cn("w-5 h-5", addIsFlagged && "fill-current")} />
                      </button>
                      <button
                        onClick={saveAddStudent}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={cancelAdd}
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
                <StudentRow
                  key={student.id}
                  student={student}
                  index={index}
                  editingId={editingId}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  toggleFlag={toggleFlag}
                  startEditStudent={startEditStudent}
                  saveEditStudent={saveEditStudent}
                  cancelEdit={cancelEdit}
                  removeStudent={removeStudent}
                  updateStudent={updateStudent}
                />
              ))}
              {filteredStudents.length === 0 && !isAdding && students.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No students found matching &quot;{searchQuery}&quot;.
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
