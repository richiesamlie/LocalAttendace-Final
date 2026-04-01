import React, { useState, useEffect } from 'react';
import { UserPlus, X, Search, UserCircle, Loader2, Copy, Link, Trash2, Key, Shield, User, UserCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface InviteTeacherModalProps {
  classId: string;
  className: string;
  userRole: string;
  onClose: () => void;
}

type Tab = 'current' | 'add' | 'invites';

export default function InviteTeacherModal({ classId, className, userRole, onClose }: InviteTeacherModalProps) {
  const [teachers, setTeachers] = useState<Array<{ id: string; username: string; name: string }>>([]);
  const [classTeachers, setClassTeachers] = useState<Array<{ teacher_id: string; role: string; username: string; name: string }>>([]);
  const [invites, setInvites] = useState<Array<{code: string, role: string, created_by: string, created_at: string, expires_at: string, used_by: string | null, used_at: string | null}>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('current');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState('teacher');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const canManageTeachers = userRole === 'owner' || userRole === 'admin';
  const canManageRoles = userRole === 'owner';

  useEffect(() => {
    Promise.all([
      api.getAllTeachers(),
      api.getClassTeachers(classId),
      canManageTeachers ? api.getClassInvites(classId) : Promise.resolve([])
    ]).then(([allTeachers, currentTeachers, classInvites]) => {
      setTeachers(allTeachers);
      setClassTeachers(currentTeachers);
      setInvites(classInvites || []);
      setLoading(false);
    }).catch(() => {
      setTeachers([]);
      setClassTeachers([]);
      setInvites([]);
      setLoading(false);
    });
  }, [classId, canManageTeachers]);

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

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const result = await api.createInvite(classId, inviteRole, 48);
      await navigator.clipboard.writeText(result.inviteUrl);
      toast.success('Invite link copied to clipboard!');
      const updated = await api.getClassInvites(classId);
      setInvites(updated);
    } catch {
      toast.error('Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await api.deleteInvite(classId, code);
      toast.success('Invite revoked');
      setInvites(prev => prev.filter(i => i.code !== code));
    } catch {
      toast.error('Failed to revoke invite');
    }
  };

  const handleCopyInvite = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRoleChange = async (teacherId: string, newRole: string) => {
    setUpdatingRole(teacherId);
    try {
      await api.updateTeacherRole(classId, teacherId, newRole);
      toast.success(`Role updated to ${newRole}`);
      const updated = await api.getClassTeachers(classId);
      setClassTeachers(updated);
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingRole(null);
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

  const roleBadge = (role: string) => {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      owner: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: <Shield className="w-3 h-3" />, label: 'Owner' },
      admin: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: <UserCheck className="w-3 h-3" />, label: 'Admin' },
      teacher: { bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300", icon: <User className="w-3 h-3" />, label: 'Teacher' },
      assistant: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: <UserPlus className="w-3 h-3" />, label: 'Assistant' },
    };
    const c = config[role] || config.teacher;
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1", c.bg, c.text)}>
        {c.icon}{c.label}
      </span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col animate-in slide-in-from-right duration-300">
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
          {canManageTeachers && (
            <>
              <button
                onClick={() => { setActiveTab('add'); setSearchQuery(''); }}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                  activeTab === 'add'
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Add ({availableTeachers.length})
              </button>
              <button
                onClick={() => { setActiveTab('invites'); setSearchQuery(''); }}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                  activeTab === 'invites'
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Invites ({invites.filter(i => !i.used_by && new Date(i.expires_at) > new Date()).length})
              </button>
            </>
          )}
        </div>

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

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500">Loading...</span>
            </div>
          ) : activeTab === 'current' ? (
            filteredCurrent.length === 0 ? (
              <div className="text-center py-16">
                <UserCircle className="w-14 h-14 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No teachers match your search' : 'No teachers in this class yet'}
                </p>
                {!searchQuery && canManageTeachers && (
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
                    {canManageRoles && t.role !== 'owner' ? (
                      <select
                        value={t.role}
                        onChange={(e) => handleRoleChange(t.teacher_id, e.target.value)}
                        disabled={updatingRole === t.teacher_id}
                        className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="teacher">Teacher</option>
                        <option value="assistant">Assistant</option>
                      </select>
                    ) : (
                      roleBadge(t.role)
                    )}
                    {t.role !== 'owner' && canManageTeachers && (
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
          ) : activeTab === 'add' ? (
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
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-2">Create Invite Link</p>
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="flex-1 text-sm rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="assistant">Assistant</option>
                    {userRole === 'owner' && <option value="admin">Admin</option>}
                  </select>
                  <button
                    onClick={handleCreateInvite}
                    disabled={creatingInvite}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Create
                  </button>
                </div>
              </div>

              {invites.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No invite codes yet</p>
                </div>
              ) : (
                invites.map((inv) => {
                  const isExpired = new Date(inv.expires_at) < new Date();
                  const isUsed = !!inv.used_by;
                  const isActive = !isExpired && !isUsed;
                  return (
                    <div key={inv.code} className={cn(
                      "p-4 rounded-xl border transition-colors",
                      isActive ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 opacity-60"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{inv.code}</code>
                          {roleBadge(inv.role)}
                        </div>
                        <div className="flex items-center gap-1">
                          {isActive && (
                            <button
                              onClick={() => handleCopyInvite(inv.code)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                              title="Copy link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {isActive && (
                            <button
                              onClick={() => handleDeleteInvite(inv.code)}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              title="Revoke"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                        {isUsed && <span className="text-green-600 dark:text-green-400">Used</span>}
                        {isExpired && !isUsed && <span className="text-red-600 dark:text-red-400">Expired</span>}
                        {isActive && <span className="text-indigo-600 dark:text-indigo-400">Active</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
