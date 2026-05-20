import { useState, useEffect } from 'react';
import { Home, Users, CheckSquare, FileSpreadsheet, Moon, Sun, CalendarDays, LayoutGrid, Shuffle, Settings as SettingsIcon, Clock, Wrench, BookOpen, UserCircle, Timer, Shield, WifiOff } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store';
import { api } from '../lib/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ClassSwitcher, NavGroup, NavItem } from './Sidebar/index';

interface SidebarProps {
  currentPage: string;
  navigate: (page: string) => void;
  isMobileMenuOpen: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  logoutMutation: { mutate: () => void };
}

export default function Sidebar({
  currentPage,
  navigate,
  isMobileMenuOpen,
  theme,
  toggleTheme,
  logoutMutation
}: SidebarProps) {
  const isOnline = useOnlineStatus();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const classes = useStore((state) => state.classes);
  const teacherName = useStore((state) => state.teacherName);
  const teacherId = useStore((state) => state.teacherId);
  const isAdmin = useStore((state) => state.isAdmin);
  const setAuth = useStore((state) => state.setAuth);
  const isHomeroomTeacher = classes.some((c) => c.role === 'owner');

  useEffect(() => {
    if (!teacherId || isAdmin) return;

    api.getMe()
      .then((me) => {
        if (me.isAdmin) {
          setAuth(teacherId, me.name, true);
        }
      })
      .catch(() => {
        // noop: keep current state if profile refresh fails
      });
  }, [teacherId, isAdmin, setAuth]);

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
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{teacherName || 'Teacher'}</p>
              {isAdmin ? (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                  Admin
                </span>
              ) : isHomeroomTeacher && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                  Homeroom
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isAdmin ? 'Administrator' : isHomeroomTeacher ? 'Homeroom Teacher' : 'Subject Teacher'}
            </p>
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

