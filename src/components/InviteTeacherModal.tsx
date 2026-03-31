import React, { useState, useEffect } from 'react';
import { UserPlus, X, Search, UserCircle, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface InviteTeacherModalProps {
  classId: string;
  className: string;
  onClose: () => void;
}

export default function InviteTeacherModal({ classId, className, onClose }: InviteTeacherModalProps) {
  const [teachers, setTeachers] = useState<Array<{ id: string; username: string; name: string }>>([]);
  const [classTeachers, setClassTeachers] = useState<Array<{ teacher_id: string; role: string; username: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'add'>('current');

  useEffect(() => {
    Promise.all([
      api.getAllTeachers(),
      api.getClassTeachers(classId)
    ]).then(([allTeachers, currentTeachers]) => {
      setTeachers(allTeachers);
      setClassTeachers(currentTeachers);
      setLoading(false);
    }).catch(() => {
      setTeachers([]);
      setClassTeachers([]);
      setLoading(false);
    });
  }, [classId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleAdd = async (teacherId: string) => {
    setAdding(teacherId);
    try {
      await api.addTeacherToClass(classId, teacherId);
      toast.success('Teacher added to class');
      const updated = await api.getClassTeachers(classId);
      setClassTeachers(updated);
    } catch {
      toast.error('Failed to add teacher');
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (teacherId: string) => {
    try {
      await api.removeTeacherFromClass(classId, teacherId);
      toast.success('Teacher removed');
      const updated = await api.getClassTeachers(classId);
      setClassTeachers(updated);
    } catch {
      toast.error('Failed to remove teacher');
    }
  };

  const classTeacherIds = new Set(classTeachers.map(t => t.teacher_id));
  const availableTeachers = teachers.filter(t => !classTeacherIds.has(t.id));

  const query = searchQuery.toLowerCase();
  const filteredCurrent = classTeachers.filter(t =>
    t.name.toLowerCase().includes(query) || t.username.toLowerCase().includes(query)
  );
  const filteredAvailable = availableTeachers.filter(t =>
    t.name.toLowerCase().includes(query) || t.username.toLowerCase().includes(query)
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} />

      {/* Right Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-500" />
              Class Teachers
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{className}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => { setActiveTab('current'); setSearchQuery(''); }}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === 'current'
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Current ({classTeachers.length})
          </button>
          <button
            onClick={() => { setActiveTab('add'); setSearchQuery(''); }}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === 'add'
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Add Teacher ({availableTeachers.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500">Loading teachers...</span>
            </div>
          ) : activeTab === 'current' ? (
            filteredCurrent.length === 0 ? (
              <div className="text-center py-16">
                <UserCircle className="w-14 h-14 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No teachers match your search' : 'No teachers in this class yet'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                  >
                    Add a teacher
                  </button>
                )}
              </div>
            ) : (
              filteredCurrent.map((t) => (
                <div key={t.teacher_id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">@{t.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      t.role === 'owner'
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    )}>
                      {t.role === 'owner' ? 'Owner' : 'Teacher'}
                    </span>
                    {t.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(t.teacher_id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            filteredAvailable.length === 0 ? (
              <div className="text-center py-16">
                <UserCircle className="w-14 h-14 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No teachers match your search' : 'All teachers are already in this class'}
                </p>
              </div>
            ) : (
              filteredAvailable.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">@{t.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(t.id)}
                    disabled={adding === t.id}
                    className="px-4 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {adding === t.id ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Adding...
                      </span>
                    ) : 'Add'}
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </>
  );
}
