import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { TimetableSlot } from '../../store';
import { DAYS } from './timetableUtils';

const DAYS_MAP = DAYS as string[];

interface SlotFormProps {
  mode: 'add' | 'edit';
  editingSlot?: TimetableSlot | null;
  selectedDay: number;
  onSave: (data: { startTime: string; endTime: string; subject: string; lesson: string }) => void;
  onCancel: () => void;
}

export default function SlotForm({ mode, editingSlot, selectedDay, onSave, onCancel }: SlotFormProps) {
  const [formData, setFormData] = useState({
    startTime: '08:00',
    endTime: '09:00',
    subject: '',
    lesson: '',
  });

  useEffect(() => {
    if (mode === 'edit' && editingSlot) {
      setFormData({
        startTime: editingSlot.startTime,
        endTime: editingSlot.endTime,
        subject: editingSlot.subject,
        lesson: editingSlot.lesson,
      });
    } else {
      setFormData({ startTime: '08:00', endTime: '09:00', subject: '', lesson: '' });
    }
  }, [mode, editingSlot]);

  const handleSave = () => {
    if (!formData.subject.trim() || !formData.startTime || !formData.endTime) return;
    onSave(formData);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/30 p-5 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {mode === 'edit' ? 'Edit Class' : `Add Class for ${DAYS_MAP[selectedDay]}`}
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Time</label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Subject</label>
          <input
            type="text"
            placeholder="e.g., Mathematics"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Lesson / Topic</label>
          <input
            type="text"
            placeholder="e.g., Algebra Ch. 3"
            value={formData.lesson}
            onChange={(e) => setFormData({ ...formData, lesson: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!formData.subject.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Save Class
        </button>
      </div>
    </div>
  );
}
