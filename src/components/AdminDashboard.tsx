import React, { useState, useRef, useCallback } from 'react';
import { Shield, Lock, Database, Users, Calendar, BookOpen, FileText, Archive, Trash2, Search, Upload, Activity, Server } from 'lucide-react';
import { useStore } from '../store';
import toast from 'react-hot-toast';
import StatCard from './AdminDashboard/StatCard';
import TabButton from './AdminDashboard/TabButton';
import { buildMassiveBackup, downloadJson, mergeBackupClasses } from './AdminDashboard/adminUtils';
import type { MassiveBackupPayload } from './AdminDashboard/adminUtils';
import TeachersTab from './AdminDashboard/TeachersTab';
import ClassesTab from './AdminDashboard/ClassesTab';
import StudentsTab from './AdminDashboard/StudentsTab';
import AttendanceTab from './AdminDashboard/AttendanceTab';
import EventsTab from './AdminDashboard/EventsTab';

type TabType = 'classes' | 'students' | 'attendance' | 'events' | 'timetables' | 'notes' | 'teachers';


interface AdminDashboardProps {
  navigate: (page: string) => void;
}

export default function AdminDashboard({ navigate }: AdminDashboardProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isMassiveBackingUp, setIsMassiveBackingUp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  const classes = useStore((state) => state.classes) || [];
  const clearAllData = useStore((state) => state.clearAllData);
  const updateAdminPassword = useStore((state) => state.updateAdminPassword);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsUnlocked(true);
        setError('');
      } else {
        setError('Incorrect admin password');
      }
    } catch {
      setError('Incorrect admin password');
    }
  };

  const handleMassiveBackup = useCallback(() => {
    setIsMassiveBackingUp(true);
    try {
      const state = useStore.getState();
      const backup = buildMassiveBackup(state.classes || []);
      downloadJson(backup, `Massive_Semester_Backup_${new Date().toISOString().split('T')[0]}.json`);
    } catch (error) {
      console.error('Massive backup failed:', error);
      toast.error('Failed to generate massive backup.');
    } finally {
      setIsMassiveBackingUp(false);
    }
  }, []);

  const handleUpdatePassword = () => {
    if (!newPassword || !confirmNewPassword) {
      toast.error('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    updateAdminPassword(newPassword);
    setNewPassword('');
    setConfirmNewPassword('');
    toast.success('Admin password updated successfully.');
  };

  const handleImportMassiveBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as MassiveBackupPayload;

        if (!parsed.metadata || !parsed.data) {
          throw new Error('Invalid backup format');
        }

        const finalClasses = mergeBackupClasses(parsed);
        
        if (finalClasses.length === 0) {
          throw new Error('No classes found in backup');
        }

        // Use toast confirmation instead of window.confirm to avoid blocking the main thread
        const importData = () => {
          useStore.setState({
            classes: finalClasses,
            currentClassId: finalClasses[0].id,
            students: finalClasses[0].students || [],
            records: finalClasses[0].records || [],
            events: finalClasses[0].events || [],
            dailyNotes: finalClasses[0].dailyNotes || {},
            timetable: finalClasses[0].timetable || [],
            seatingLayout: finalClasses[0].seatingLayout || {}
          });
          toast.success('Backup imported successfully!');
        };

        toast((t) => (
          <div>
            <p className="font-medium">Import {finalClasses.length} class(es)?</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This will overwrite your current data.</p>
            <div className="flex gap-2 mt-3">
              <button
                className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                onClick={() => { importData(); toast.dismiss(t.id); }}
              >
                Import
              </button>
              <button
                className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                onClick={() => { toast.dismiss(t.id); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 15000 });
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import backup. Please ensure the file is a valid Massive Backup JSON.');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    toast((t) => (
      <div>
        <p className="font-medium text-rose-600 dark:text-rose-400">Reset ALL Data?</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This will permanently delete ALL classes, students, attendance records, seating charts, and events. This cannot be undone.</p>
        <div className="flex gap-2 mt-3">
          <button
            className="px-3 py-1 text-sm bg-rose-600 text-white rounded hover:bg-rose-700"
            title="Confirm reset"
            onClick={() => {
              toast.dismiss(t.id);
              toast((t2) => (
                <div>
                  <p className="font-medium">Final confirmation</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Type YES in the field below to confirm.</p>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const input = form.elements.namedItem('confirm') as HTMLInputElement;
                    if (input.value === 'YES') {
                      await clearAllData();
                      toast.success('All academic data has been reset.');
                      toast.dismiss(t2.id);
                      window.location.reload();
                    } else {
                      toast.error('You must type YES to confirm.');
                    }
                  }}>
                    <input name="confirm" className="mt-2 w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm dark:bg-slate-800 dark:text-white" placeholder="Type YES..." autoFocus />
                    <div className="flex gap-2 mt-3">
                      <button type="submit" className="px-3 py-1 text-sm bg-rose-600 text-white rounded hover:bg-rose-700">Confirm</button>
                      <button type="button" className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600" onClick={() => toast.dismiss(t2.id)}>Cancel</button>
                    </div>
                  </form>
                </div>
              ), { duration: 30000 });
            }}
          >
            Yes, Reset Everything
          </button>
          <button
            className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
            onClick={() => { toast.dismiss(t.id); }}
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Admin Dashboard</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">Enter the admin password to access the database viewer and management tools.</p>
        
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Admin Password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2 text-left">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Lock className="w-5 h-5" />
            Unlock Dashboard
          </button>
        </form>
      </div>
  );
}

  const allStudents = classes.flatMap(c => (c.students || []).map(s => ({ ...s, classId: c.id, className: c.name })));
  const allAttendance = classes.flatMap(c => (c.records || []).map(r => ({ ...r, classId: c.id, className: c.name })));
  const allEvents = classes.flatMap(c => (c.events || []).map(e => ({ ...e, classId: c.id, className: c.name })));

  const totalStudents = allStudents.length;
  const totalEvents = allEvents.length;
  const totalAttendance = allAttendance.length;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'classes':
        return <ClassesTab classes={classes} searchTerm={searchTerm} />;
      case 'students':
        return <StudentsTab students={allStudents} searchTerm={searchTerm} />;
      case 'attendance':
        return <AttendanceTab attendance={allAttendance} searchTerm={searchTerm} />;
      case 'events':
        return <EventsTab events={allEvents} searchTerm={searchTerm} />;
      case 'teachers':
        return <TeachersTab />;
      default:
        return <div className="p-8 text-center text-slate-500">Select a tab to view data</div>;
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Admin Database Viewer
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">View and manage all application data across all classes.</p>
        </div>
        <button 
          onClick={() => setIsUnlocked(false)}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
        >
          <Lock className="w-4 h-4" />
          Lock Dashboard
        </button>
      </div>

      {/* Admin Tools Navigation */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" /> Admin Tools
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring tools dipindahkan dari sidebar ke dashboard admin.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => navigate('performance')}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Performance
          </button>
          <button
            onClick={() => navigate('profiler')}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Database className="w-4 h-4" />
            Query Profiler
          </button>
          <button
            onClick={() => navigate('resources')}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Server className="w-4 h-4" />
            Resources
          </button>
        </div>
      </div>

      {/* Admin Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" /> Database Management
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleMassiveBackup}
              disabled={isMassiveBackingUp}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-medium shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              <Archive className={`w-4 h-4 ${isMassiveBackingUp ? 'animate-pulse' : ''}`} />
              {isMassiveBackingUp ? 'Generating...' : 'Massive Backup'}
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportMassiveBackup}
              className="hidden"
              aria-label="Import backup file"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Import Backup
            </button>
            <button
              onClick={handleResetData}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-medium shadow-sm hover:bg-rose-700 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Reset Academic Year
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" /> Change Admin Password
          </h3>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input 
              type="password" 
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm"
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleUpdatePassword}
              className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen />} label="Total Classes" value={classes.length} color="indigo" />
        <StatCard icon={<Users />} label="Total Students" value={totalStudents} color="emerald" />
        <StatCard icon={<Calendar />} label="Total Events" value={totalEvents} color="amber" />
        <StatCard icon={<FileText />} label="Attendance Records" value={totalAttendance} color="rose" />
      </div>

      {/* Data Viewer */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row min-h-[500px]">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-1">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Data Tables</h3>
          <TabButton active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} icon={<BookOpen />} label="Classes" count={classes.length} />
          <TabButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users />} label="Students" count={totalStudents} />
          <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<FileText />} label="Attendance" count={totalAttendance} />
          <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={<Calendar />} label="Events" count={totalEvents} />
          
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3 mt-6">Management</h3>
          <TabButton active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} icon={<Shield />} label="Teachers" count={0} />
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

