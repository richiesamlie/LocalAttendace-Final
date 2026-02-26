import React, { useState, useEffect } from 'react';
import { Home, Users, CheckSquare, FileSpreadsheet, Menu, X, Moon, Sun, CalendarDays, LayoutGrid, Shuffle, Settings as SettingsIcon } from 'lucide-react';
import { cn } from './utils/cn';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import TakeAttendance from './components/TakeAttendance';
import Roster from './components/Roster';
import Reports from './components/Reports';
import Schedule from './components/Schedule';
import SeatingChart from './components/SeatingChart';
import RandomPicker from './components/RandomPicker';
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
      case 'schedule': return <Schedule />;
      case 'seating': return <SeatingChart />;
      case 'picker': return <RandomPicker />;
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
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            icon={<Home className="w-5 h-5" />} 
            label="Dashboard" 
            active={currentPage === 'dashboard'} 
            onClick={() => navigate('dashboard')} 
          />
          <NavItem 
            icon={<CheckSquare className="w-5 h-5" />} 
            label="Take Attendance" 
            active={currentPage === 'attendance'} 
            onClick={() => navigate('attendance')} 
          />
          <NavItem 
            icon={<Users className="w-5 h-5" />} 
            label="Student Roster" 
            active={currentPage === 'roster'} 
            onClick={() => navigate('roster')} 
          />
          <NavItem 
            icon={<CalendarDays className="w-5 h-5" />} 
            label="Class Schedule" 
            active={currentPage === 'schedule'} 
            onClick={() => navigate('schedule')} 
          />
          <NavItem 
            icon={<LayoutGrid className="w-5 h-5" />} 
            label="Visual Seating" 
            active={currentPage === 'seating'} 
            onClick={() => navigate('seating')} 
          />
          <NavItem 
            icon={<Shuffle className="w-5 h-5" />} 
            label="Random Picker" 
            active={currentPage === 'picker'} 
            onClick={() => navigate('picker')} 
          />
          <NavItem 
            icon={<FileSpreadsheet className="w-5 h-5" />} 
            label="Monthly Reports" 
            active={currentPage === 'reports'} 
            onClick={() => navigate('reports')} 
          />
          <NavItem 
            icon={<SettingsIcon className="w-5 h-5" />} 
            label="Settings & Backup" 
            active={currentPage === 'settings'} 
            onClick={() => navigate('settings')} 
          />
        </nav>

        <div className="p-4 mt-auto space-y-4">
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
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">
              All data is saved locally on your device for privacy and portability.
            </p>
          </div>
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

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
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
