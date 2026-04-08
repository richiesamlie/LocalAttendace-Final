import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, CheckSquare, FileSpreadsheet, Moon, Sun, CalendarDays, LayoutGrid, Shuffle, Settings as SettingsIcon, Clock, ChevronDown, ChevronRight, Wrench, BookOpen, UserCircle, Timer, Plus, Edit2, Trash2, Shield, WifiOff } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store';
import { useLogout } from '../hooks/useData';
import toast from 'react-hot-toast';

function ClassSwitcher() {
  const classes = useStore((state) => state.classes);
  const currentClassId = useStore((state) => state.currentClassId);
  const setCurrentClass = useStore((state) => state.setCurrentClass);
  const addClass = useStore((state) => state.addClass);
  const removeClass = useStore((state) => state.removeClass);
  const updateClassName = useStore((state) => state.updateClassName);
  const teacherId = useStore((state) => state.teacherId);
  
  const isHomeroomTeacher = classes.some(c => c.role === 'owner');
  const [isEditing, setIsEditing] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Class</h3>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Manage Classes"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {!isEditing ? (
        <select
          value={currentClassId || ''}
          onChange={(e) => setCurrentClass(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
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
                      className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateClass(c.id)}
                    />
                    <button onClick={() => handleUpdateClass(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded">
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm truncate text-slate-700 dark:text-slate-300">{c.name}</span>
                    <button 
                      onClick={() => { setEditingId(c.id); setEditingName(c.name); }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {classes.length > 1 && (
                      <button 
                        onClick={() => {
                          const name = c.name;
                          const classId = c.id;
                          toast((t) => (
                            <div>
                              <p className="font-medium">Delete "{name}"?</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All data for this class will be lost.</p>
                              <div className="flex gap-2 mt-3">
                                <button
                                  className="px-3 py-1 text-sm bg-rose-600 text-white rounded hover:bg-rose-700"
                                  onClick={() => { removeClass(classId); toast.dismiss(t.id); }}
                                >
                                  Delete
                                </button>
                                <button
                                  className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                                  onClick={() => { toast.dismiss(t.id); }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ), { duration: 8000 });
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
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
              disabled={isHomeroomTeacher}
              className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onKeyDown={(e) => e.key === 'Enter' && !isHomeroomTeacher && handleAddClass()}
            />
            <button 
              onClick={handleAddClass}
              disabled={!newClassName.trim() || isHomeroomTeacher}
              title={isHomeroomTeacher ? "You already manage a Homeroom class." : "Add new class"}
              className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavGroup({ title, icon, children, defaultExpanded = false }: { title: string, icon: React.ReactNode, children: React.ReactNode, defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="mb-1">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          {title}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1 relative before:absolute before:inset-y-0 before:left-[26px] before:w-px before:bg-slate-200 dark:before:bg-slate-800 pl-11 pr-2">
          {children}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, subItem = false }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, subItem?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl font-medium transition-all",
        subItem ? "px-3 py-2 text-sm" : "px-4 py-3",
        active 
          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" 
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface SidebarProps {
  currentPage: string;
  navigate: (page: string) => void;
  isMobileMenuOpen: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  logoutMutation: any;
}

export default function Sidebar({
  currentPage,
  navigate,
  isMobileMenuOpen,
  theme,
  toggleTheme,
  logoutMutation
}: SidebarProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pingInterval = setInterval(async () => {
      if (!navigator.onLine) {
         setIsOnline(false);
         return;
      }
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (err) {
        setIsOnline(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  return (
    <aside className={cn(
      "w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0",
      isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Teacher<br/>Assistant</h1>
          </div>
          <div className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-fit border shadow-sm transition-colors",
            isOnline 
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30"
              : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/30"
          )}>
            <span className="relative flex h-2 w-2">
              {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", isOnline ? "bg-emerald-500" : "bg-rose-500")}></span>
            </span>
            {isOnline ? 'Server Online' : 'Server Offline'}
            {!isOnline && <WifiOff className="w-3.5 h-3.5 ml-1 opacity-70" />}
          </div>
        </div>
      </div>
      
      <ClassSwitcher />

      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto custom-scrollbar pb-4">
        <NavItem 
          icon={<Home className="w-5 h-5" />} 
          label="Dashboard" 
          active={currentPage === 'dashboard'} 
          onClick={() => navigate('dashboard')} 
        />

        <div className="my-2 border-t border-slate-100 dark:border-slate-800/60" />

        <NavGroup title="Students & Records" icon={<Users className="w-5 h-5" />} defaultExpanded={true}>
          <NavItem 
            icon={<CheckSquare className="w-4 h-4" />} 
            label="Take Attendance" 
            active={currentPage === 'attendance'} 
            onClick={() => navigate('attendance')} 
            subItem
          />
          <NavItem 
            icon={<UserCircle className="w-4 h-4" />} 
            label="Student Roster" 
            active={currentPage === 'roster'} 
            onClick={() => navigate('roster')} 
            subItem
          />
          <NavItem 
            icon={<FileSpreadsheet className="w-4 h-4" />} 
            label="Monthly Reports" 
            active={currentPage === 'reports'} 
            onClick={() => navigate('reports')} 
            subItem
          />
        </NavGroup>

        <NavGroup title="Schedule & Planning" icon={<CalendarDays className="w-5 h-5" />} defaultExpanded={true}>
          <NavItem 
            icon={<Clock className="w-4 h-4" />} 
            label="Daily Timetable" 
            active={currentPage === 'timetable'} 
            onClick={() => navigate('timetable')} 
            subItem
          />
          <NavItem 
            icon={<BookOpen className="w-4 h-4" />} 
            label="Calendar Events" 
            active={currentPage === 'schedule'} 
            onClick={() => navigate('schedule')} 
            subItem
          />
        </NavGroup>

        <NavGroup title="Classroom Tools" icon={<Wrench className="w-5 h-5" />} defaultExpanded={false}>
          <NavItem 
            icon={<LayoutGrid className="w-4 h-4" />} 
            label="Visual Seating" 
            active={currentPage === 'seating'} 
            onClick={() => navigate('seating')} 
            subItem
          />
          <NavItem 
            icon={<Shuffle className="w-4 h-4" />} 
            label="Random Picker" 
            active={currentPage === 'picker'} 
            onClick={() => navigate('picker')} 
            subItem
          />
          <NavItem 
            icon={<Users className="w-4 h-4" />} 
            label="Smart Groups" 
            active={currentPage === 'groups'} 
            onClick={() => navigate('groups')} 
            subItem
          />
          <NavItem 
            icon={<Timer className="w-4 h-4" />} 
            label="Exam Timer" 
            active={currentPage === 'timer'} 
            onClick={() => navigate('timer')} 
            subItem
          />
        </NavGroup>

        <div className="my-2 border-t border-slate-100 dark:border-slate-800/60" />

        <NavItem 
          icon={<SettingsIcon className="w-5 h-5" />} 
          label="Settings & Backup" 
          active={currentPage === 'settings'} 
          onClick={() => navigate('settings')} 
        />

        <NavItem 
          icon={<Shield className="w-5 h-5" />} 
          label="Admin Dashboard" 
          active={currentPage === 'admin'} 
          onClick={() => navigate('admin')} 
        />

        <NavItem 
          icon={<Clock className="w-5 h-5" />} 
          label="Gatekeeper" 
          active={currentPage === 'gatekeeper'} 
          onClick={() => navigate('gatekeeper')} 
        />
      </nav>

      <div className="p-4 mt-auto space-y-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{useStore((state) => state.teacherName) || 'Teacher'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Logged in</p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'light' ? (
            <><Moon className="w-4 h-4" /> Dark Mode</>
          ) : (
            <><Sun className="w-4 h-4" /> Light Mode</>
          )}
        </button>
        {showLogoutConfirm ? (
          <div className="flex flex-col gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/50">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 text-center">Log out?</p>
            <div className="flex gap-2">
              <button
                onClick={() => logoutMutation.mutate()}
                className="flex-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 transition-colors"
              >
                Yes, log out
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Log Out
          </button>
        )}
      </div>
    </aside>
  );
}
