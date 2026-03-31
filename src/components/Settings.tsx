import React, { useRef, useState } from 'react';
import { Download, Upload, HardDrive, Cloud, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Export the SQLite database via our new backup API
  const handleExportBackup = () => {
    window.location.href = '/api/database/backup';
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await fetch('/api/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Invalid SQLite Database or Server Error');
      }

      setImportStatus('success');
      setTimeout(() => window.location.reload(), 1500);

    } catch (error: any) {
      console.error('Import failed:', error);
      setImportStatus('error');
      setErrorMessage(error.message || 'Failed to import backup file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
              That's it! Every time you take attendance, the <code>database.sqlite</code> file will automatically sync to your Google Drive in the background.
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
                Download Backup (.sqlite)
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".sqlite"
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
    </div>
  );
}
