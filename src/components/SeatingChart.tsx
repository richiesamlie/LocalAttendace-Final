import React, { useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils/cn';
import { LayoutGrid, User, X, Flag } from 'lucide-react';

export default function SeatingChart() {
  const students = useStore((state) => state.students);
  const seatingLayout = useStore((state) => state.seatingLayout);
  const updateSeat = useStore((state) => state.updateSeat);
  const setSeatingLayout = useStore((state) => state.setSeatingLayout);
  const clearSeatingLayout = useStore((state) => state.clearSeatingLayout);

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<string | null>(null);

  const totalSeats = students.length;
  const cols = Math.ceil(Math.sqrt(totalSeats)) || 1;
  const rows = Math.ceil(totalSeats / cols) || 1;

  // Find students who haven't been seated yet
  const seatedStudentIds = Object.values(seatingLayout);
  const unseatedStudents = students.filter(s => !seatedStudentIds.includes(s.id));

  const handleSeatClick = (seatId: string) => {
    if (selectedStudent) {
      // Place selected student in this seat
      updateSeat(seatId, selectedStudent);
      setSelectedStudent(null);
    } else {
      // If no student selected, clicking a seated student removes them
      if (seatingLayout[seatId]) {
        updateSeat(seatId, null);
      }
    }
  };

  const clearAllSeats = () => {
    if (confirm('Are you sure you want to clear all seats?')) {
      clearSeatingLayout();
    }
  };

  const autoFillSeats = () => {
    let unseated = [...unseatedStudents];
    if (unseated.length === 0) return;

    const newLayout = { ...seatingLayout };
    
    // Shuffle students to ensure different ones get picked first if there are constraints
    const shuffledUnseated = [...unseated].sort(() => Math.random() - 0.5);
    const flagged = shuffledUnseated.filter(s => s.isFlagged);
    const unflagged = shuffledUnseated.filter(s => !s.isFlagged);

    const isAdjacentToFlagged = (r: number, c: number, layout: Record<string, string>) => {
      const adjacentOffsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      
      for (const [dr, dc] of adjacentOffsets) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const adjIndex = nr * cols + nc;
          if (adjIndex < totalSeats) {
            const adjSeatId = `seat-${adjIndex}`;
            const adjStudentId = layout[adjSeatId];
            if (adjStudentId) {
              const adjStudent = students.find(s => s.id === adjStudentId);
              if (adjStudent?.isFlagged) {
                return true;
              }
            }
          }
        }
      }
      return false;
    };

    // Get all available seats
    const availableSeats: {r: number, c: number, id: string}[] = [];
    for (let i = 0; i < totalSeats; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const seatId = `seat-${i}`;
      if (!newLayout[seatId]) {
        availableSeats.push({r, c, id: seatId});
      }
    }

    // Shuffle available seats
    const shuffledSeats = availableSeats.sort(() => Math.random() - 0.5);

    // Try to place flagged students first to ensure they are separated
    for (const student of flagged) {
      let placed = false;
      // Find a random seat that is not adjacent to another flagged student
      for (let i = 0; i < shuffledSeats.length; i++) {
        const seat = shuffledSeats[i];
        if (!newLayout[seat.id] && !isAdjacentToFlagged(seat.r, seat.c, newLayout)) {
          newLayout[seat.id] = student.id;
          placed = true;
          break;
        }
      }
      // If we couldn't find a safe seat, just put them in any available seat
      if (!placed) {
        for (let i = 0; i < shuffledSeats.length; i++) {
          const seat = shuffledSeats[i];
          if (!newLayout[seat.id]) {
            newLayout[seat.id] = student.id;
            break;
          }
        }
      }
    }

    // Place unflagged students in remaining seats
    for (const student of unflagged) {
      for (let i = 0; i < shuffledSeats.length; i++) {
        const seat = shuffledSeats[i];
        if (!newLayout[seat.id]) {
          newLayout[seat.id] = student.id;
          break;
        }
      }
    }
    
    setSeatingLayout(newLayout);
  };

  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    setDraggedStudent(studentId);
    e.dataTransfer.setData('studentId', studentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSeat = (e: React.DragEvent, seatId: string) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    if (studentId) {
      updateSeat(seatId, studentId);
    }
    setDraggedStudent(null);
  };

  const handleDropOnUnseated = (e: React.DragEvent) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    if (studentId) {
      // Find the seat this student is currently in and remove them
      const seatId = Object.keys(seatingLayout).find(key => seatingLayout[key] === studentId);
      if (seatId) {
        updateSeat(seatId, null);
      }
    }
    setDraggedStudent(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visual Seating Chart</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Arrange student seating. Select a student, then click a seat to place them.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={autoFillSeats}
            disabled={unseatedStudents.length === 0}
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
          >
            Auto-Fill
          </button>
          <button
            onClick={clearAllSeats}
            disabled={seatedStudentIds.length === 0}
            className="px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unseated Students Sidebar */}
        <div 
          className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 flex flex-col h-[600px]"
          onDragOver={handleDragOver}
          onDrop={handleDropOnUnseated}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Unseated</span>
            <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {unseatedStudents.length}
            </span>
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {unseatedStudents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                <User className="w-8 h-8 opacity-50" />
                <p className="text-sm text-center">All students are seated</p>
              </div>
            ) : (
              unseatedStudents.map(student => (
                <button
                  key={student.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, student.id)}
                  onClick={() => setSelectedStudent(selectedStudent === student.id ? null : student.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between cursor-grab active:cursor-grabbing",
                    selectedStudent === student.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700",
                    draggedStudent === student.id ? "opacity-50" : "opacity-100"
                  )}
                >
                  <div className="truncate pr-2 pointer-events-none">
                    <div className="font-medium text-slate-900 dark:text-white truncate flex items-center gap-2">
                      {student.name}
                      {student.isFlagged && <Flag className="w-3 h-3 text-rose-500 fill-rose-500" />}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">Roll: {student.rollNumber}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Seating Grid */}
        <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 overflow-x-auto">
          <div className="min-w-max flex flex-col items-center">
            {/* Teacher Desk Indicator */}
            <div className="w-64 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl mb-12 flex items-center justify-center text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest text-sm shadow-inner">
              Teacher's Desk
            </div>

            {/* Grid */}
            <div 
              className="grid gap-4"
              style={{ 
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` 
              }}
            >
              {Array.from({ length: totalSeats }).map((_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const seatId = `seat-${i}`;
                const studentId = seatingLayout[seatId];
                const student = students.find(s => s.id === studentId);

                return (
                  <button
                    key={seatId}
                    onClick={() => handleSeatClick(seatId)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnSeat(e, seatId)}
                    draggable={!!student}
                    onDragStart={(e) => student && handleDragStart(e, student.id)}
                    className={cn(
                      "w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center p-2 transition-all relative group",
                      student
                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:border-rose-300 dark:hover:border-rose-700 cursor-grab active:cursor-grabbing"
                        : selectedStudent || draggedStudent
                          ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-dashed"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 border-dashed",
                      draggedStudent === student?.id ? "opacity-50" : "opacity-100"
                    )}
                  >
                    {student ? (
                      <>
                        <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mb-1 pointer-events-none">{student.rollNumber}</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white text-center line-clamp-2 leading-tight pointer-events-none flex items-center gap-1">
                          {student.name}
                          {student.isFlagged && <Flag className="w-3 h-3 text-rose-500 fill-rose-500" />}
                        </div>
                        <div 
                          className="absolute inset-0 bg-rose-500/10 dark:bg-rose-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSeat(seatId, null);
                          }}
                        >
                          <X className="w-6 h-6 text-rose-600 dark:text-rose-400 pointer-events-none" />
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-300 dark:text-slate-600 pointer-events-none">
                        <LayoutGrid className="w-6 h-6 opacity-50" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
