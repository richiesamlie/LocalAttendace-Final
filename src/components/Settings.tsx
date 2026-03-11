import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store';
import { Download, Upload, HardDrive, Cloud, AlertTriangle, CheckCircle2, Trash2, Lock, Unlock, ShieldAlert, Archive } from 'lucide-react';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const clearAllData = useStore((state) => state.clearAllData);
  const updateAdminPassword = useStore((state) => state.updateAdminPassword);

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isInternalSite, setIsInternalSite] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isMassiveBackingUp, setIsMassiveBackingUp] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    // Check if it's an IP address (internal network) or the AI Studio preview environment
    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
    const isPreview = hostname.includes('run.app');
    setIsInternalSite(isIP || isPreview);
  }, []);

  // We need to access the raw state to export it
  const handleExportBackup = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch database');
      
      const data = await response.json();
      const jsonString = JSON.stringify(data, null, 2);
      
      // Create a blob and download it
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LocalAttendance_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export database backup.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate that it looks like our state
      if (!data['teacher-assistant-storage']) {
        throw new Error('Invalid backup file format.');
      }

      // Send to server
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });

      if (!response.ok) throw new Error('Failed to save to server');

      setImportStatus('success');
      
      // Force reload to apply new state
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error('Import failed:', error);
      setImportStatus('error');
      setErrorMessage(error.message || 'Failed to import backup file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetData = () => {
    const isConfirmed = window.confirm(
      "WARNING: This will permanently delete ALL classes, students, attendance records, and settings.\n\n" +
      "This action cannot be undone. Are you sure you want to reset the app for a new academic year?"
    );
    
    if (isConfirmed) {
      const doubleCheck = window.confirm(
        "Are you absolutely sure? We recommend downloading a backup first."
      );
      
      if (doubleCheck) {
        clearAllData();
        alert("All data has been cleared. The app is ready for a new academic year.");
        window.location.reload();
      }
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

  const handleMassiveBackup = async () => {
    setIsMassiveBackingUp(true);
    try {
      // Fetch latest from server to avoid internet lag/sync issues
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch database');
      const data = await response.json();
      
      let state = useStore.getState();
      
      // Try to use the server state if available and valid
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
      
      // Helper to determine semester
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings & Data Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your database backups and cloud sync options.</p>
      </div>

      {/* Cloud Sync Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Google Drive Sync</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-relaxed">
              Because this is a secure, local-only application, it does not connect directly to the internet to sync your data. 
              However, you can easily sync your database to Google Drive (or OneDrive/Dropbox) using their desktop apps.
            </p>
            
            <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">How to set up automatic cloud sync:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>Download and install <strong>Google Drive for Desktop</strong> on your computer.</li>
                <li>Close the Local Attendance app (close the terminal window).</li>
                <li>Move the entire <code>LocalAttendance</code> folder into your Google Drive folder on your computer.</li>
                <li>Run the <code>start-app.bat</code> file from its new location inside Google Drive.</li>
              </ol>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 italic">
                That's it! Every time you take attendance, the <code>database.json</code> file will automatically sync to your Google Drive in the background.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Backup Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manual Database Backup</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-relaxed">
              Download a complete copy of your database file. You can use this to move your data to another computer or keep a safe backup on a USB drive.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download Backup (.json)
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportBackup}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Restore Backup
                </button>
              </div>
            </div>

            {importStatus === 'success' && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Backup Restored Successfully</h4>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">The application will reload in a moment to apply your data.</p>
                </div>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-rose-800 dark:text-rose-300">Restore Failed</h4>
                  <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-rose-100 dark:border-rose-900/30 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-400">Admin Danger Zone</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-relaxed">
              Advanced administrative actions. These features are locked to prevent accidental data loss or misuse.
            </p>

            <div className="mt-6 space-y-4">
               <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Change Admin Password</h3>
                  <div className="space-y-3">
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                    />
                    <input 
                      type="password" 
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                    />
                    <button
                      onClick={handleUpdatePassword}
                      className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>

                {isInternalSite && (
                  <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
                    <h3 className="text-sm font-medium text-amber-900 dark:text-amber-400 mb-1">Massive Semester Backup</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-500 mb-4">
                      Export all class data, timetables, and student monthly records organized by semester.
                    </p>
                    <button
                      onClick={handleMassiveBackup}
                      disabled={isMassiveBackingUp}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-medium shadow-sm hover:bg-amber-700 transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Archive className={`w-5 h-5 ${isMassiveBackingUp ? 'animate-pulse' : ''}`} />
                      {isMassiveBackingUp ? 'Generating Backup...' : 'Download Massive Backup'}
                    </button>
                  </div>
                )}

                <div className="p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-2xl">
                  <h3 className="text-sm font-medium text-rose-900 dark:text-rose-400 mb-1">Reset Academic Year</h3>
                  <p className="text-sm text-rose-700 dark:text-rose-500 mb-4">
                    Permanently delete all classes, students, attendance records, seating charts, and events.
                  </p>
                  <button
                    onClick={handleResetData}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-medium shadow-sm hover:bg-rose-700 transition-colors w-full sm:w-auto"
                  >
                    <Trash2 className="w-5 h-5" />
                    Reset Academic Year
                  </button>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
