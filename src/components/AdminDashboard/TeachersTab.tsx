import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

export default function TeachersTab() {
  const [bulkInput, setBulkInput] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('password123');

  const registerMutation = useMutation({
    mutationFn: ({ username, name, password }: { username: string; name: string; password: string }) => 
      api.registerTeacher(username, password, name),
  });

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    const lines = bulkInput.split('\n').filter(line => line.trim());
    const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 2) {
        results.failed++;
        results.errors.push(`"${line}" - needs username,name`);
        continue;
      }
      const [username, name] = parts;
      try {
        await registerMutation.mutateAsync({ username, name, password: defaultPassword });
        results.success++;
      } catch (err: unknown) {
        results.failed++;
        const message = err instanceof Error ? err.message : 'failed';
        results.errors.push(`"${username}" - ${message}`);
      }
    }

    if (results.success > 0) {
      toast.success(`Added ${results.success} teacher(s)`);
      setBulkInput('');
    }
    if (results.errors.length > 0) {
      toast.error(`${results.failed} failed: ${results.errors[0]}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Bulk Add Teachers
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Enter one teacher per line: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">username,name</code>
        </p>
        
        <form onSubmit={handleBulkAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Password for All New Teachers
            </label>
            <input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="w-full max-w-xs px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter default password"
              aria-label="Default password for new teachers"
            />
          </div>
          
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="johnsmith,John Smith&#10;jane Doe,jane@example.com"
            className="w-full h-40 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
          />
          
          <button
            type="submit"
            disabled={registerMutation.isPending || !bulkInput.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {registerMutation.isPending ? (
              <>Adding...</>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Teachers
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Important</p>
            <p className="mt-1">Each teacher has their own separate classes and data. They cannot see or modify other teachers&apos; data.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
