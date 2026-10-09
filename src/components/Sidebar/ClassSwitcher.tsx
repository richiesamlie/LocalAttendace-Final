import { useState } from 'react';
import { Settings as SettingsIcon, CheckSquare, Edit2, Trash2, Plus, X } from 'lucide-react';
import { useStore } from '../../store';
import { confirmToast } from '../../utils/confirmToast';

export function ClassSwitcher() {
  const classes = useStore((state) => state.classes);
  const currentClassId = useStore((state) => state.currentClassId);
  const setCurrentClass = useStore((state) => state.setCurrentClass);
  const addClass = useStore((state) => state.addClass);
  const removeClass = useStore((state) => state.removeClass);
  const updateClassName = useStore((state) => state.updateClassName);
  const isAdmin = useStore((state) => state.isAdmin);
  
  const isHomeroomTeacher = classes.some(c => c.role === 'owner');
  const canCreateClass = isAdmin || !isHomeroomTeacher;
  const [isEditing, setIsEditing] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(newClassName.trim());
      setNewClassName('');
      setIsEditing(false);
    }
  };

  const handleUpdateClass = (id: string) => {
    if (editingName.trim()) {
      updateClassName(id, editingName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="px-4 py-3 mb-2 border-b border-slate-100 dark:border-slate-800/60">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Current Class</h3>
        <button 
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
          title="Manage Classes"
          aria-label="Manage Classes"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {!isEditing ? (
        <select
          value={currentClassId || ''}
          onChange={(e) => setCurrentClass(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus-ring block p-2.5"
          aria-label="Select class"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {classes.length === 0 && <option value="" disabled>No classes found</option>}
        </select>
      ) : (
        <div className="space-y-3">
          <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {classes.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                {editingId === c.id ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus-ring"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateClass(c.id);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingName('');
                        }
                      }}
                      aria-label="Edit class name"
                    />
                    <button type="button" onClick={() => handleUpdateClass(c.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded focus-ring" title="Save" aria-label="Save class name">
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditingName(''); }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded focus-ring"
                      title="Cancel"
                      aria-label="Cancel editing class name"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate text-slate-700 dark:text-slate-300">{c.name}</span>
                    <button 
                      type="button"
                      onClick={() => { setEditingId(c.id); setEditingName(c.name); }}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded focus-ring"
                      title="Edit"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {classes.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => {
                          confirmToast(
                            `Delete "${c.name}"?`,
                            'All data for this class will be lost.',
                            () => removeClass(c.id),
                            { duration: 8000, confirmLabel: 'Delete', isDangerous: true }
                          );
                        }}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded focus-ring"
                        title="Delete"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="New class name..."
              aria-label="New class name"
              disabled={!canCreateClass}
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              onKeyDown={(e) => e.key === 'Enter' && canCreateClass && handleAddClass()}
            />
            <button 
              type="button"
              onClick={handleAddClass}
              disabled={!newClassName.trim() || !canCreateClass}
              title={!canCreateClass ? "You already manage a Homeroom class." : "Add new class"}
              aria-label="Add new class"
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
