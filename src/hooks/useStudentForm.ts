import { useState, useCallback } from 'react';
import { Student } from '../store';
import toast from 'react-hot-toast';

export function useStudentForm(
  currentClassId: string | null,
  addStudent: (student: Omit<Student, 'isArchived'>) => void,
  updateStudent: (id: string, updates: Partial<Student>) => void
) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add states
  const [addName, setAddName] = useState('');
  const [addRoll, setAddRoll] = useState('');
  const [addParentName, setAddParentName] = useState('');
  const [addParentPhone, setAddParentPhone] = useState('');
  const [addIsFlagged, setAddIsFlagged] = useState(false);

  // Edit states
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editIsFlagged, setEditIsFlagged] = useState(false);

  const startAddStudent = useCallback(() => {
    if (!currentClassId) {
      toast.error('Please create or select a class from the sidebar first before adding students.');
      return;
    }
    setAddName('');
    setAddRoll('');
    setAddParentName('');
    setAddParentPhone('');
    setAddIsFlagged(false);
    setIsAdding(true);
    setEditingId(null);
  }, [currentClassId]);

  const saveAddStudent = useCallback(() => {
    if (!addName.trim() || !addRoll.trim()) return;
    addStudent({
      id: `std_${Date.now()}`,
      name: addName,
      rollNumber: addRoll,
      parentName: addParentName,
      parentPhone: addParentPhone,
      isFlagged: addIsFlagged,
    });
    setIsAdding(false);
  }, [addName, addRoll, addParentName, addParentPhone, addIsFlagged, addStudent]);

  const startEditStudent = useCallback((student: Student) => {
    setEditingId(student.id);
    setEditName(student.name);
    setEditRoll(student.rollNumber);
    setEditParentName(student.parentName || '');
    setEditParentPhone(student.parentPhone || '');
    setEditIsFlagged(student.isFlagged || false);
    setIsAdding(false);
  }, []);

  const saveEditStudent = useCallback(() => {
    if (!editingId || !editName.trim() || !editRoll.trim()) return;
    updateStudent(editingId, { 
      name: editName, 
      rollNumber: editRoll,
      parentName: editParentName,
      parentPhone: editParentPhone,
      isFlagged: editIsFlagged
    });
    setEditingId(null);
  }, [editingId, editName, editRoll, editParentName, editParentPhone, editIsFlagged, updateStudent]);

  const cancelAdd = useCallback(() => setIsAdding(false), []);
  const cancelEdit = useCallback(() => setEditingId(null), []);

  return {
    isAdding,
    editingId,
    addName, setAddName,
    addRoll, setAddRoll,
    addParentName, setAddParentName,
    addParentPhone, setAddParentPhone,
    addIsFlagged, setAddIsFlagged,
    editName, setEditName,
    editRoll, setEditRoll,
    editParentName, setEditParentName,
    editParentPhone, setEditParentPhone,
    editIsFlagged, setEditIsFlagged,
    startAddStudent,
    saveAddStudent,
    startEditStudent,
    saveEditStudent,
    cancelAdd,
    cancelEdit
  };
}
