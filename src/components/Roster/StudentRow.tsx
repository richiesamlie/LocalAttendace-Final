import { useState } from 'react';
import { Flag, Edit2, Trash2, RefreshCcw, CheckSquare, Square, X, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { confirmToast } from '../../utils/confirmToast';
import { Student } from '../../store';

interface StudentRowProps {
  student: Student;
  index: number;
  editingId: string | null;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleFlag: (student: Student) => void;
  startEditStudent: (student: Student) => void;
  saveEditStudent: (id: string, data: { name: string; rollNumber: string; parentName: string; parentPhone: string; isFlagged: boolean }) => void;
  cancelEdit: () => void;
  removeStudent: (id: string) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
}

export default function StudentRow({
  student,
  index,
  editingId,
  selectedIds,
  toggleSelect,
  toggleFlag,
  startEditStudent,
  saveEditStudent,
  cancelEdit,
  removeStudent,
  updateStudent
}: StudentRowProps) {
  const isEditing = editingId === student.id;

  // Local state for editing to keep states isolated
  const [editName, setEditName] = useState(student.name);
  const [editRoll, setEditRoll] = useState(student.rollNumber);
  const [editParentName, setEditParentName] = useState(student.parentName || '');
  const [editParentPhone, setEditParentPhone] = useState(student.parentPhone || '');
  const [editIsFlagged, setEditIsFlagged] = useState(student.isFlagged || false);

  // Track previous student and editing state to adjust state during render
  const [prevStudent, setPrevStudent] = useState(student);
  const [prevIsEditing, setPrevIsEditing] = useState(isEditing);

  if (student !== prevStudent || isEditing !== prevIsEditing) {
    setPrevStudent(student);
    setPrevIsEditing(isEditing);
    if (isEditing) {
      setEditName(student.name);
      setEditRoll(student.rollNumber);
      setEditParentName(student.parentName || '');
      setEditParentPhone(student.parentPhone || '');
      setEditIsFlagged(student.isFlagged || false);
    }
  }

  const handleSave = () => {
    if (!editName.trim() || !editRoll.trim()) return;
    saveEditStudent(student.id, {
      name: editName,
      rollNumber: editRoll,
      parentName: editParentName,
      parentPhone: editParentPhone,
      isFlagged: editIsFlagged
    });
  };

  return (
    <tr className={cn(
      "hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-colors",
      student.isArchived ? "opacity-60 bg-slate-50 dark:bg-slate-800/40" : 
      (index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30")
    )}>
      {isEditing ? (
        <td colSpan={6} className="px-4 py-3 bg-indigo-50/60 dark:bg-indigo-900/20">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-24 shrink-0">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Roll No</label>
              <input
                type="text"
                value={editRoll}
                onChange={(e) => setEditRoll(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white w-full"
                aria-label="Roll number"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Student Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white w-full"
                aria-label="Student name"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Parent Name</label>
              <input
                type="text"
                value={editParentName}
                onChange={(e) => setEditParentName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white w-full"
                aria-label="Parent name"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Parent Phone</label>
              <input
                type="text"
                value={editParentPhone}
                onChange={(e) => setEditParentPhone(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:text-white w-full"
                aria-label="Parent phone"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
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
                onClick={handleSave}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                title="Save"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </td>
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
                      confirmToast(
                        `Archive "${student.name}"?`,
                        'They will be hidden from attendance and reports but their records will be preserved.',
                        () => removeStudent(student.id),
                        { duration: 10000, confirmLabel: 'Archive', isDangerous: true }
                      );
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
  );
}
