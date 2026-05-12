import { describe, it, expect } from 'vitest';
import * as ExcelJS from 'exceljs';
import {
  importStudentsFromExcel,
  importScheduleFromExcel,
  importAttendanceFromExcel,
} from '../excel';
import type { Student } from '../../store';

async function makeExcelFile(headers: string[], rows: Array<Array<string | number>>): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Sheet1');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));

  const data = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(data as ArrayBuffer);

  return {
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as unknown as File;
}

describe('Excel regression harness (part 29)', () => {
  it('imports students with stable IDs and roll numbers', async () => {
    const file = await makeExcelFile(
      ['Roll Number', 'Name'],
      [
        ['001', 'Alice'],
        ['002', 'Bob'],
      ],
    );

    const students = await importStudentsFromExcel(file, 'class-a');

    expect(students).toHaveLength(2);
    expect(students[0]).toMatchObject({ rollNumber: '001', name: 'Alice' });
    expect(students[1]).toMatchObject({ rollNumber: '002', name: 'Bob' });
    expect(students[0].id).toContain('std_');
  });

  it('rejects duplicate student roll number in import', async () => {
    const file = await makeExcelFile(
      ['Roll Number', 'Name'],
      [
        ['001', 'Alice'],
        ['001', 'Bob'],
      ],
    );

    await expect(importStudentsFromExcel(file, 'class-a')).rejects.toThrow(/Duplicate Roll Number/);
  });

  it('imports schedule rows and normalizes event type', async () => {
    const file = await makeExcelFile(
      ['Date', 'Title', 'Type', 'Description'],
      [['2026-05-12', 'Math Quiz', 'exam', 'Chapter 2']],
    );

    const events = await importScheduleFromExcel(file);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: '2026-05-12',
      title: 'Math Quiz',
      type: 'Exam',
      description: 'Chapter 2',
    });
  });

  it('imports attendance by matching roll number to existing students', async () => {
    const students: Student[] = [
      { id: 's1', name: 'Alice', rollNumber: '001' },
      { id: 's2', name: 'Bob', rollNumber: '002' },
    ];

    const file = await makeExcelFile(
      ['Roll Number', 'Student Name', 'Date', 'Status', 'Reason'],
      [['001', 'Alice', '2026-05-12', 'Late', 'Traffic']],
    );

    const records = await importAttendanceFromExcel(file, 'class-a', students);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      studentId: 's1',
      date: '2026-05-12',
      status: 'Late',
      reason: 'Traffic',
    });
  });
});
