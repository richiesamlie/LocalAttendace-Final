import React, { useState, useEffect } from 'react';
import { CheckSquare, Menu, X } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn } from './utils/cn';
import { useStore } from './store';
import { useAuth, useLogin, useLogout } from './hooks/useData';
import Dashboard from './components/Dashboard';
import TakeAttendance from './components/TakeAttendance';
import Roster from './components/Roster';
import Reports from './components/Reports';
import Schedule from './components/Schedule';
import Timetable from './components/Timetable';
import SeatingChart from './components/SeatingChart';
import RandomPicker from './components/RandomPicker';
import GroupGenerator from './components/GroupGenerator';
import ExamTimer from './components/ExamTimer';
import Settings from './components/Settings';
import AdminDashboard from './components/AdminDashboard';
import Gatekeeper from './components/Gatekeeper';
import Sidebar from './components/Sidebar';

function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(password, {
      onError: () => setError('Invalid password'),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <CheckSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teacher Assistant</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Sign in to manage your classes</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none",
                error ? "border-red-500" : "border-slate-200 dark:border-slate-800"
              )}
              placeholder="Enter password..."
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const isInitialized = useStore(state => state.isInitialized);
  const initializeStore = useStore(state => state.initializeStore);
  
  const authQuery = useAuth();
  const logoutMutation = useLogout();

  useEffect(() => {
    // Only fetch full data if authenticated
    if (!isInitialized && authQuery.data?.authenticated) {
      initializeStore();
    }
  }, [isInitialized, authQuery.data?.authenticated, initializeStore]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (authQuery.isLoading || (authQuery.data?.authenticated && !isInitialized)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading Teacher Assistant...</p>
      </div>
    );
  }

  if (!authQuery.data?.authenticated) {
    return <LoginScreen />;
  }

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
      case 'timer': return <ExamTimer />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      case 'admin': return <AdminDashboard />;
      case 'gatekeeper': return <Gatekeeper />;
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

      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white dark:border-slate-700 border' }} />

      <Sidebar 
        currentPage={currentPage}
        navigate={navigate}
        isMobileMenuOpen={isMobileMenuOpen}
        theme={theme}
        toggleTheme={toggleTheme}
        logoutMutation={logoutMutation}
      />

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
