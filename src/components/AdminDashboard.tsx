import React, { useState, useRef } from 'react';
import { Shield, Lock, Database, Users, Calendar, BookOpen, Clock, FileText, Archive, Trash2, Search, ChevronRight, Upload } from 'lucide-react';
import { useStore } from '../store';

type TabType = 'classes' | 'students' | 'attendance' | 'events' | 'timetables' | 'notes';

export default function AdminDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isMassiveBackingUp, setIsMassiveBackingUp] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const adminPassword = useStore((state) => state.adminPassword);
  const classes = useStore((state) => state.classes) || [];
  const clearAllData = useStore((state) => state.clearAllData);
  const updateAdminPassword = useStore((state) => state.updateAdminPassword);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPassword) {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Incorrect admin password');
    }
  };

  const handleMassiveBackup = async () => {
    setIsMassiveBackingUp(true);
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch database');
      const data = await response.json();
      
      let state = useStore.getState();
      
      if (data['teacher-assistant-storage']) {
        try {
          const parsedStorage = JSON.parse(data['teacher-assistant-storage']);
          if (parsedStorage && parsedStorage.state) {
            state = parsedStorage.state;
          }
        } catch (e) {
          console.warn('Could not parse server state, falling back to local state', e);
        }
      }
      
      const isSem1 = (dateStr: string) => {
        const month = new Date(dateStr).getMonth();
        return month >= 6 && month <= 11; // Jul (6) to Dec (11)
      };
      const isSem2 = (dateStr: string) => {
        const month = new Date(dateStr).getMonth();
        return month >= 0 && month <= 5; // Jan (0) to Jun (5)
      };

      const processClasses = (filterFn: (date: string) => boolean) => {
        return (state.classes || []).map((c: any) => ({
          ...c,
          records: (c.records || []).filter((r: any) => filterFn(r.date)),
          dailyNotes: Object.fromEntries(Object.entries(c.dailyNotes || {}).filter(([date]) => filterFn(date))),
          events: (c.events || []).filter((e: any) => filterFn(e.date))
        }));
      };

      const massiveBackup = {
        metadata: {
          exportDate: new Date().toISOString(),
          type: "Massive Semester Backup",
          version: "1.1"
        },
        data: {
          "Semester 1 (Jul-Dec)": {
            classes: processClasses(isSem1)
          },
          "Semester 2 (Jan-Jun)": {
            classes: processClasses(isSem2)
          }
        }
      };

      const jsonString = JSON.stringify(massiveBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Massive_Semester_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Massive backup failed:', error);
      alert('Failed to generate massive backup. Please check your connection.');
    } finally {
      setIsMassiveBackingUp(false);
    }
  };

  const handleUpdatePassword = () => {
    if (!newPassword || !confirmNewPassword) {
      alert('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert('New passwords do not match.');
      return;
    }
    updateAdminPassword(newPassword);
    setNewPassword('');
    setConfirmNewPassword('');
    alert('Admin password updated successfully.');
  };

  const handleImportMassiveBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.metadata || !parsed.data) {
          throw new Error('Invalid backup format');
        }

        const mergedClasses = new Map<string, any>();
        
        Object.values(parsed.data).forEach((semester: any) => {
          if (semester.classes && Array.isArray(semester.classes)) {
            semester.classes.forEach((c: any) => {
              if (mergedClasses.has(c.id)) {
                const existing = mergedClasses.get(c.id);
                existing.records = [...(existing.records || []), ...(c.records || [])];
                existing.events = [...(existing.events || []), ...(c.events || [])];
                existing.dailyNotes = { ...(existing.dailyNotes || {}), ...(c.dailyNotes || {}) };
              } else {
                mergedClasses.set(c.id, { ...c });
              }
            });
          }
        });

        const finalClasses = Array.from(mergedClasses.values());
        
        if (finalClasses.length === 0) {
          throw new Error('No classes found in backup');
        }

        if (window.confirm(`Found ${finalClasses.length} classes in backup. This will overwrite your current data. Continue?`)) {
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
          alert('Backup imported successfully!');
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import backup. Please ensure the file is a valid Massive Backup JSON.');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('WARNING: This will permanently delete ALL classes, students, attendance records, seating charts, and events.\n\nThis action cannot be undone. Are you absolutely sure?')) {
      if (window.confirm('FINAL WARNING: Type "YES" to confirm deletion of all data.')) {
        clearAllData();
        alert('All academic data has been reset.');
        window.location.reload();
      }
    }
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
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Class Name</th>
                  <th className="pb-3 font-medium">Students</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 font-mono text-xs text-slate-500">{c.id}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{(c.students || []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'students':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Class</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {allStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                  <tr key={`${s.classId}-${s.id}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 font-mono text-xs text-slate-500">{s.id}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-xs">
                        {s.className}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'attendance':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Student ID</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {allAttendance.filter(a => a.date.includes(searchTerm) || a.studentId.includes(searchTerm)).slice(0, 100).map((a, i) => (
                  <tr key={`${a.classId}-${a.date}-${a.studentId}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 text-slate-900 dark:text-white">{a.date}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{a.className}</td>
                    <td className="py-3 font-mono text-xs text-slate-500">{a.studentId}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        a.status === 'Present' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                        a.status === 'Absent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allAttendance.length > 100 && (
              <p className="text-xs text-slate-500 mt-4 text-center">Showing first 100 records. Use search to filter.</p>
            )}
          </div>
        );
      case 'events':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Class</th>
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {allEvents.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map((e, i) => (
                  <tr key={`${e.classId}-${e.id}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 text-slate-900 dark:text-white">{e.date}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">{e.className}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{e.title}</td>
                    <td className="py-3 capitalize text-slate-600 dark:text-slate-400">{e.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div className={`p-4 rounded-xl ${colors[color]}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active 
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' 
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
        {label}
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs ${
        active 
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}>
        {count}
      </span>
    </button>
  );
}
