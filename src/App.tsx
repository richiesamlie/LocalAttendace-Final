import React, { useState, useEffect } from 'react';
import { Home, Users, CheckSquare, FileSpreadsheet, Menu, X, Moon, Sun, CalendarDays, LayoutGrid, Shuffle, Settings as SettingsIcon, Clock, ChevronDown, ChevronRight, Wrench, BookOpen, UserCircle } from 'lucide-react';
import { cn } from './utils/cn';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import TakeAttendance from './components/TakeAttendance';
import Roster from './components/Roster';
import Reports from './components/Reports';
import Schedule from './components/Schedule';
import Timetable from './components/Timetable';
import SeatingChart from './components/SeatingChart';
import RandomPicker from './components/RandomPicker';
import GroupGenerator from './components/GroupGenerator';
import Settings from './components/Settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard navigate={setCurrentPage} />;
      case 'attendance': return <TakeAttendance />;
      case 'roster': return <Roster />;
      case 'timetable': return <Timetable />;
      case 'schedule': return <Schedule />;
      case 'seating': return <SeatingChart />;
      case 'picker': return <RandomPicker />;
      case 'groups': return <GroupGenerator />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      default: return <Dashboard navigate={setCurrentPage} />;
    }
  };

  const navigate = (page: string) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans text-slate-900 dark:text-slate-50 transition-colors">
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Teacher<br/>Assistant</h1>
          </div>
        </div>
        
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
          </NavGroup>

          <div className="my-2 border-t border-slate-100 dark:border-slate-800/60" />

          <NavItem 
            icon={<SettingsIcon className="w-5 h-5" />} 
            label="Settings & Backup" 
            active={currentPage === 'settings'} 
            onClick={() => navigate('settings')} 
          />
        </nav>

        <div className="p-4 mt-auto space-y-4 border-t border-slate-100 dark:border-slate-800">
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
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8 w-full overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
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
