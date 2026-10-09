// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStudentForm } from '../useStudentForm';
import { Student } from '../../types/store';

describe('useStudentForm', () => {
  const mockStudent: Student = {
    id: 'student-123',
    name: 'Original Name',
    rollNumber: '01',
    parentName: 'Original Parent',
    parentPhone: '08123456789',
    isFlagged: false,
    isArchived: false,
  };

  it('correctly passes updated fields from StudentRow to updateStudent callback', () => {
    const addStudentMock = vi.fn();
    const updateStudentMock = vi.fn();

    const { result } = renderHook(() =>
      useStudentForm('class-1', addStudentMock, updateStudentMock)
    );

    // Enter edit mode
    act(() => {
      result.current.startEditStudent(mockStudent);
    });

    expect(result.current.editingId).toBe('student-123');

    // Simulate StudentRow saving updated data from its local input state
    act(() => {
      result.current.saveEditStudent('student-123', {
        name: 'Edited Name',
        rollNumber: '99',
        parentName: 'New Parent',
        parentPhone: '0899999999',
        isFlagged: true,
      });
    });

    // Expect updateStudent to be called with the EDITED data, not the stale original data
    expect(updateStudentMock).toHaveBeenCalledTimes(1);
    expect(updateStudentMock).toHaveBeenCalledWith('student-123', {
      name: 'Edited Name',
      rollNumber: '99',
      parentName: 'New Parent',
      parentPhone: '0899999999',
      isFlagged: true,
    });

    // Expect editingId to be reset to null
    expect(result.current.editingId).toBeNull();
  });

  it('prevents saving empty name or roll number during edit', () => {
    const addStudentMock = vi.fn();
    const updateStudentMock = vi.fn();

    const { result } = renderHook(() =>
      useStudentForm('class-1', addStudentMock, updateStudentMock)
    );

    act(() => {
      result.current.startEditStudent(mockStudent);
    });

    // Empty name
    act(() => {
      result.current.saveEditStudent('student-123', {
        name: '   ',
        rollNumber: '01',
      });
    });

    expect(updateStudentMock).not.toHaveBeenCalled();
    expect(result.current.editingId).toBe('student-123');

    // Empty roll number
    act(() => {
      result.current.saveEditStudent('student-123', {
        name: 'Valid Name',
        rollNumber: '   ',
      });
    });

    expect(updateStudentMock).not.toHaveBeenCalled();
    expect(result.current.editingId).toBe('student-123');
  });

  it('resets editingId on cancelEdit', () => {
    const addStudentMock = vi.fn();
    const updateStudentMock = vi.fn();

    const { result } = renderHook(() =>
      useStudentForm('class-1', addStudentMock, updateStudentMock)
    );

    act(() => {
      result.current.startEditStudent(mockStudent);
    });
    expect(result.current.editingId).toBe('student-123');

    act(() => {
      result.current.cancelEdit();
    });
    expect(result.current.editingId).toBeNull();
  });
});
