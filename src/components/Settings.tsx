import React, { useRef, useState } from 'react';
import { Download, Upload, HardDrive, Cloud, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../lib/api';
import UpdateCard from './UpdateCard';

export default function Settings() {
  const isAdmin = useStore((state) => state.isAdmin);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Export the SQLite database via our backup API
  const handleExportBackup = async () => {
    try {
      setImportStatus('idle');
      const blob = await api.downloadDatabaseBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setImportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to download backup.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await api.restoreDatabaseBackup(file);

      setImportStatus('success');
      setTimeout(() => window.location.reload(), 1500);

    } catch (error: unknown) {
      console.error('Import failed:', error);
      setImportStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to import backup file.';
      setErrorMessage(message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings & Data Management</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">Manage your database backups and cloud sync options.</p>
      </div>

      {isAdmin && <UpdateCard />}

      {/* Cloud Sync Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center shrink-0">
            <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Cloud Backup Sync (Google Drive / OneDrive)</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2 leading-relaxed">
              Because this is a local-first application, it does not upload your data to external servers automatically.
              You can back up your database to Google Drive, OneDrive, or Dropbox using exported snapshot files.
            </p>
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <strong>Important:</strong> Do not run Teacher Assistant directly from inside a live cloud-sync folder.
              SQLite uses active write-ahead log files (<code>database.sqlite</code>, <code>-wal</code>, <code>-shm</code>) that can be corrupted if synced while the server is running.
            </div>
            
            <div className="mt-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">How to safely back up to the cloud:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>Keep Teacher Assistant installed in a normal local folder (outside Google Drive / OneDrive).</li>
                <li>Click <strong>Download Backup (.sqlite)</strong> below (or exit Teacher Assistant completely before copying <code>database.sqlite</code>).</li>
                <li>Save the exported backup snapshot into your Google Drive, OneDrive, or Dropbox folder.</li>
              </ol>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 italic">
                Each downloaded <code>.sqlite</code> snapshot is self-contained and safe to store or restore on any computer.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Backup Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
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
                className="flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors focus-ring"
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
                  aria-label="Import backup file"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus-ring"
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
