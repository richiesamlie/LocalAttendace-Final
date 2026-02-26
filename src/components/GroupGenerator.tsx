import React, { useState } from 'react';
import { useStore, Student } from '../store';
import { Users, Shuffle, Download, UserPlus, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

export default function GroupGenerator() {
  const students = useStore((state) => state.students);
  const [groups, setGroups] = useState<Student[][]>([]);
  const [groupCount, setGroupCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateGroups = () => {
    if (students.length === 0) return;
    
    setIsGenerating(true);
    
    // Small delay for animation effect
    setTimeout(() => {
      const newGroups: Student[][] = Array.from({ length: Math.max(1, groupCount) }, () => []);
      
      // Shuffle array function
      const shuffle = (array: Student[]) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
      };

      // Separate flagged and unflagged students
      const flagged = shuffle(students.filter(s => s.isFlagged));
      const unflagged = shuffle(students.filter(s => !s.isFlagged));

      let currentGroup = 0;

      // Distribute flagged students first to keep them separated as much as possible
      flagged.forEach(student => {
        newGroups[currentGroup].push(student);
        currentGroup = (currentGroup + 1) % groupCount;
      });

      // Distribute the rest
      unflagged.forEach(student => {
        newGroups[currentGroup].push(student);
        currentGroup = (currentGroup + 1) % groupCount;
      });

      setGroups(newGroups);
      setIsGenerating(false);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Group Generator</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Randomly divide your class into groups. Flagged students are automatically separated.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <span className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
              Number of Groups:
            </span>
            <input
              type="number"
              min="1"
              max={Math.max(1, students.length)}
              value={groupCount}
              onChange={(e) => setGroupCount(parseInt(e.target.value) || 1)}
              className="w-16 px-3 py-2 text-center bg-transparent outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>
          
          <button
            onClick={generateGroups}
            disabled={isGenerating || students.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Shuffle className={cn("w-4 h-4", isGenerating && "animate-spin")} />
            {isGenerating ? 'Generating...' : 'Generate Groups'}
          </button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No students available</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Add students in the Roster tab to generate groups.</p>
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map((group, index) => (
            <div 
              key={index} 
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 border-b border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-300">Group {index + 1}</h3>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-1 rounded-md">
                  {group.length} students
                </span>
              </div>
              <ul className="divide-y divide-slate-50 dark:divide-slate-800/50 flex-1 p-2">
                {group.map(student => (
                  <li key={student.id} className="px-3 py-2 flex items-center justify-between group">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {student.name}
                    </span>
                    {student.isFlagged && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Flagged Student" />
                    )}
                  </li>
                ))}
                {group.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-slate-400 italic">
                    Empty group
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center border-dashed">
          <p className="text-slate-500 dark:text-slate-400">Click "Generate Groups" to randomly divide your {students.length} students.</p>
        </div>
      )}
    </div>
  );
}
