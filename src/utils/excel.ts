import * as ExcelJS from 'exceljs';
import { Student, AttendanceRecord, TimetableSlot, CalendarEvent } from '../store';
import { format, getDaysInMonth, parseISO, startOfMonth, addDays, addMonths, isWeekend } from 'date-fns';

/** Derive a stable student ID from classId + rollNumber so re-imports don't create duplicates */
function deriveStudentId(classId: string, rollNumber: string): string {
  const raw = `${classId}:${rollNumber}`;
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(raw)))
    : Buffer.from(raw).toString('base64');
  return `std_${encoded.replace(/[/+=]/g, '_')}`;
}

/**
 * Guardrails for Excel file import to mitigate DoS risks (zip bombs, oversized files).
 */
const MAX_EXCEL_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_EXCEL_CELLS = 50_000; // ~5000 rows × 10 cols as practical upper bound

export function validateExcelFile(file: File): void {
  if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds ${MAX_EXCEL_FILE_SIZE_BYTES / 1024 / 1024} MB limit. Please use a smaller file.`);
  }
  if (file.size === 0) {
    throw new Error('File is empty.');
  }
}

function columnLettersToNumber(col: string): number {
  let result = 0;
  for (const c of col.toUpperCase()) {
    result = result * 26 + (c.charCodeAt(0) - 64);
  }
  return result;
}

function parseRefCell(ref: string): { col: number; row: number } {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return { col: 1, row: 1 };
  return { col: columnLettersToNumber(m[1]), row: Number(m[2]) };
}

export function validateSheetCellCount(
  sheet: { ['!ref']?: string; rowCount?: number; columnCount?: number },
  maxCells: number = MAX_EXCEL_CELLS,
): void {
  let totalCells = 0;

  if (typeof sheet.rowCount === 'number' && typeof sheet.columnCount === 'number') {
    totalCells = Math.max(0, sheet.rowCount) * Math.max(0, sheet.columnCount);
  } else if (sheet['!ref']) {
    const parts = sheet['!ref'].split(':');
    const start = parseRefCell(parts[0]);
    const end = parseRefCell(parts[1] || parts[0]);
    const cols = Math.max(1, end.col - start.col + 1);
    const rows = Math.max(1, end.row - start.row + 1);
    totalCells = cols * rows;
  } else {
    return;
  }

  if (totalCells > maxCells) {
    throw new Error(`Sheet has ${totalCells.toLocaleString()} cells, exceeding the ${maxCells.toLocaleString()} cell limit. Please reduce the data size.`);
  }
}

type CellRichTextPart = { text?: unknown };
type CellObject = {
  result?: unknown;
  text?: unknown;
  richText?: CellRichTextPart[];
  hyperlink?: unknown;
};

function normalizeCellValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    const v = value as CellObject;
    if (v?.result !== undefined && v?.result !== null) return normalizeCellValue(v.result);
    if (v?.text !== undefined && v?.text !== null) return String(v.text);
    if (v?.richText && Array.isArray(v.richText)) return v.richText.map((r) => String(r.text || '')).join('');
    if (v?.hyperlink) return String(v.text || v.hyperlink);
  }
  return String(value);
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch starts at 1899-12-30 for most modern files
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = serial * 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + ms);
}

async function loadFirstWorksheet(file: File): Promise<ExcelJS.Worksheet> {
  validateExcelFile(file);
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets.length) {
    throw new Error('The Excel file contains no sheets.');
  }

  const worksheet = workbook.worksheets[0];
  validateSheetCellCount({ rowCount: worksheet.rowCount, columnCount: worksheet.columnCount });
  return worksheet;
}

function worksheetToObjects(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  for (let c = 1; c <= worksheet.columnCount; c++) {
    const hv = normalizeCellValue(headerRow.getCell(c).value);
    headers.push(hv ? String(hv).trim() : `Column ${c}`);
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const obj: Record<string, unknown> = {};
    let hasAny = false;

    for (let c = 1; c <= headers.length; c++) {
      const v = normalizeCellValue(row.getCell(c).value);
      obj[headers[c - 1]] = v;
      if (v !== null && String(v).trim() !== '') hasAny = true;
    }

    if (hasAny) rows.push(obj);
  }

  return rows;
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const data = await workbook.xlsx.writeBuffer();
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setWorksheetColumns(worksheet: ExcelJS.Worksheet, widths: number[]): void {
  worksheet.columns = widths.map(w => ({ width: w }));
}

function addObjectWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  data: Record<string, unknown>[],
  columnWidths?: number[],
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) {
    worksheet.addRow([]);
    return worksheet;
  }

  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);
  for (const item of data) {
    worksheet.addRow(headers.map(h => item[h] ?? ''));
  }

  if (columnWidths?.length) {
    setWorksheetColumns(worksheet, columnWidths);
  } else {
    const autoWidths = headers.map(h => {
      let max = h.length;
      for (const item of data) {
        const text = item[h] == null ? '' : String(item[h]);
        if (text.length > max) max = text.length;
      }
      return Math.min(Math.max(max + 2, 5), 50);
    });
    setWorksheetColumns(worksheet, autoWidths);
  }

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return worksheet;
}

export function importStudentsFromExcel(file: File, classId: string): Promise<Student[]> {
  return (async () => {
    const worksheet = await loadFirstWorksheet(file);
    const json = worksheetToObjects(worksheet);

    if (!json.length) {
      throw new Error('The Excel sheet is empty or contains no readable data.');
    }

    const students: Student[] = [];
    const rollNumbers = new Set<string>();
    const errors: string[] = [];

    for (let index = 0; index < json.length; index++) {
      const row = json[index] as Record<string, unknown>;
      const rowNum = index + 2;
      const name = row['Name'] || row['name'] || row['Student Name'];
      const rollNumberRaw = row['Roll Number'] || row['rollNumber'] || row['Roll'] || row['ID'];

      if (!name || String(name).trim() === '') {
        errors.push(`Row ${rowNum}: Missing student name. Please ensure the 'Name' column is filled.`);
        continue;
      }

      const rollNumber = rollNumberRaw !== undefined && rollNumberRaw !== null
        ? String(rollNumberRaw).trim()
        : `${index + 1}`;

      if (rollNumbers.has(rollNumber)) {
        errors.push(`Row ${rowNum}: Duplicate Roll Number '${rollNumber}' found. Roll numbers must be unique.`);
        continue;
      }
      rollNumbers.add(rollNumber);

      students.push({
        id: deriveStudentId(classId, rollNumber),
        name: String(name).trim(),
        rollNumber,
      });
    }

    if (errors.length > 0) {
      const errorMsg = `Import failed with ${errors.length} error(s):\n\n`
        + errors.slice(0, 10).join('\n')
        + (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
      throw new Error(errorMsg);
    }

    return students;
  })();
}

export interface ExportOptions {
  includeRollNumber: boolean;
  includeName: boolean;
  includeParentName: boolean;
  includeParentPhone: boolean;
  includeDailyStatus: boolean;
  includeSummary: boolean;
  includeReasons: boolean;
}

export function exportMonthlyReportToExcel(
  monthString: string,
  students: Student[],
  records: AttendanceRecord[],
  className: string = 'Class',
  options: ExportOptions = {
    includeRollNumber: true,
    includeName: true,
    includeParentName: false,
    includeParentPhone: false,
    includeDailyStatus: true,
    includeSummary: true,
    includeReasons: true,
  },
): void {
  const monthDate = parseISO(`${monthString}-01`);
  const daysInMonth = getDaysInMonth(monthDate);
  const start = startOfMonth(monthDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => addDays(start, i));

  const recordsByStudent = new Map<string, Map<string, { status: string; reason?: string | null }>>();
  for (const r of records) {
    if (!recordsByStudent.has(r.studentId)) recordsByStudent.set(r.studentId, new Map());
    const studentRecordMap = recordsByStudent.get(r.studentId);
    if (studentRecordMap) {
      studentRecordMap.set(r.date, { status: r.status, reason: r.reason });
    }
  }

  const data = students.map(student => {
    const row: Record<string, string | number> = {};

    if (options.includeRollNumber) row['Roll Number'] = student.rollNumber;
    if (options.includeName) row['Name'] = student.name;
    if (options.includeParentName) row['Parent Name'] = student.parentName || '-';
    if (options.includeParentPhone) row['Parent Phone'] = student.parentPhone || '-';

    let present = 0;
    let absent = 0;
    let sick = 0;
    let late = 0;

    const studentRecords = recordsByStudent.get(student.id);

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const record = studentRecords?.get(dateStr);
      let statusStr = '-';

      if (record) {
        switch (record.status) {
          case 'Present': statusStr = 'P'; present++; break;
          case 'Absent': statusStr = 'A'; absent++; break;
          case 'Sick': statusStr = 'S'; sick++; break;
          case 'Late': statusStr = 'L'; late++; break;
        }
        if (options.includeReasons && record.reason) {
          statusStr += ` (${record.reason})`;
        }
      }

      if (options.includeDailyStatus) {
        row[format(day, 'dd/MM')] = statusStr;
      }
    });

    if (options.includeSummary) {
      row['Total Present'] = present;
      row['Total Absent'] = absent;
      row['Total Sick'] = sick;
      row['Total Late'] = late;
    }

    return row;
  });

  const workbook = new ExcelJS.Workbook();
  const ws = addObjectWorksheet(workbook, format(monthDate, 'MMM yyyy'), data);
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  void downloadWorkbook(workbook, `${safeClassName}_Attendance_Report_${monthString}.xlsx`);
}

export function generateTemplate(): void {
  const data = [
    { 'Roll Number': '1', 'Name': 'Alice Smith' },
    { 'Roll Number': '2', 'Name': 'Bob Jones' },
  ];

  const workbook = new ExcelJS.Workbook();
  addObjectWorksheet(workbook, 'Students', data, [15, 30]);
  void downloadWorkbook(workbook, 'Student_Roster_Template.xlsx');
}

export function exportTimetableToExcel(
  timetable: TimetableSlot[],
  startDateStr: string,
  duration: 'weekly' | 'month' | 'semester',
  className: string = 'Class',
): void {
  const workbook = new ExcelJS.Workbook();
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (duration === 'weekly') {
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      const classesForDay = timetable
        .filter(slot => slot.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      const data = classesForDay.map(slot => ({
        'Time': `${slot.startTime} - ${slot.endTime}`,
        'Subject': slot.subject,
        'Lesson / Topic': slot.lesson || '',
        'Notes / Progress': '',
      }));

      addObjectWorksheet(workbook, DAYS[dayOfWeek], data, [15, 20, 30, 30]);
    }
  } else if (duration === 'month') {
    const startDate = parseISO(`${startDateStr}-01`);
    const endDate = addMonths(startDate, 1);
    let currentDate = startDate;
    const weeks: Record<string, Record<string, unknown>[]> = {};

    while (currentDate < endDate) {
      if (!isWeekend(currentDate)) {
        const dayOfWeek = currentDate.getDay();
        const weekNum = Math.ceil(currentDate.getDate() / 7);
        const weekName = `Week ${weekNum}`;
        if (!weeks[weekName]) weeks[weekName] = [];

        const classesForDay = timetable
          .filter(slot => slot.dayOfWeek === dayOfWeek)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        classesForDay.forEach(slot => {
          weeks[weekName].push({
            'Date': format(currentDate, 'yyyy-MM-dd'),
            'Day': format(currentDate, 'EEEE'),
            'Time': `${slot.startTime} - ${slot.endTime}`,
            'Subject': slot.subject,
            'Lesson / Topic': slot.lesson || '',
            'Notes / Progress': '',
          });
        });
      }
      currentDate = addDays(currentDate, 1);
    }

    Object.keys(weeks).forEach(weekName => {
      addObjectWorksheet(workbook, weekName, weeks[weekName], [12, 10, 15, 20, 30, 30]);
    });
  } else {
    const startDate = parseISO(`${startDateStr}-01`);
    const endDate = addMonths(startDate, 6);
    let currentDate = startDate;
    const months: Record<string, Record<string, unknown>[]> = {};

    while (currentDate < endDate) {
      if (!isWeekend(currentDate)) {
        const dayOfWeek = currentDate.getDay();
        const monthName = format(currentDate, 'MMM yyyy');
        if (!months[monthName]) months[monthName] = [];

        const classesForDay = timetable
          .filter(slot => slot.dayOfWeek === dayOfWeek)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        classesForDay.forEach(slot => {
          months[monthName].push({
            'Date': format(currentDate, 'yyyy-MM-dd'),
            'Day': format(currentDate, 'EEEE'),
            'Time': `${slot.startTime} - ${slot.endTime}`,
            'Subject': slot.subject,
            'Lesson / Topic': slot.lesson || '',
            'Notes / Progress': '',
          });
        });
      }
      currentDate = addDays(currentDate, 1);
    }

    Object.keys(months).forEach(monthName => {
      addObjectWorksheet(workbook, monthName, months[monthName], [12, 10, 15, 20, 30, 30]);
    });
  }

  if (!workbook.worksheets.length) {
    workbook.addWorksheet('Empty');
  }

  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  const fileName = duration === 'weekly'
    ? `${safeClassName}_Weekly_Timetable_Template.xlsx`
    : `${safeClassName}_Lesson_Plan_${duration}_${startDateStr}.xlsx`;
  void downloadWorkbook(workbook, fileName);
}

export function exportScheduleToExcel(events: CalendarEvent[], className: string = 'Class'): void {
  const workbook = new ExcelJS.Workbook();

  const groupedEvents: Record<string, CalendarEvent[]> = {};
  events.forEach(e => {
    const month = e.date.substring(0, 7);
    if (!groupedEvents[month]) groupedEvents[month] = [];
    groupedEvents[month].push(e);
  });

  const months = Object.keys(groupedEvents).sort();
  if (months.length === 0) {
    workbook.addWorksheet('Schedule');
  } else {
    months.forEach(month => {
      const monthEvents = groupedEvents[month].sort((a, b) => a.date.localeCompare(b.date));
      const data = monthEvents.map(e => ({
        'Date (YYYY-MM-DD)': e.date,
        'Title': e.title,
        'Type': e.type,
        'Description': e.description || '',
      }));

      const sheetName = format(parseISO(`${month}-01`), 'MMM yyyy');
      addObjectWorksheet(workbook, sheetName, data, [18, 30, 15, 50]);
    });
  }

  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  void downloadWorkbook(workbook, `${safeClassName}_Class_Schedule.xlsx`);
}

export function importScheduleFromExcel(file: File): Promise<CalendarEvent[]> {
  return (async () => {
    const worksheet = await loadFirstWorksheet(file);
    const json = worksheetToObjects(worksheet);

    if (!json.length) {
      throw new Error('The Excel sheet is empty or contains no readable data.');
    }

    const events: CalendarEvent[] = [];
    const errors: string[] = [];

    for (let index = 0; index < json.length; index++) {
      const row = json[index] as Record<string, unknown>;
      const rowNum = index + 2;

      const rawDate = row['Date (YYYY-MM-DD)'] || row['Date'] || row['date'];
      if (!rawDate || String(rawDate).trim() === '') {
        errors.push(`Row ${rowNum}: Missing date. Please ensure the 'Date' column is filled.`);
        continue;
      }

      let dateStr: string;
      if (typeof rawDate === 'number') {
        dateStr = format(excelSerialToDate(rawDate), 'yyyy-MM-dd');
      } else if (rawDate instanceof Date) {
        dateStr = format(rawDate, 'yyyy-MM-dd');
      } else {
        dateStr = String(rawDate).trim();
      }

      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          } else if (parts[0].length === 4) {
            dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        errors.push(`Row ${rowNum}: Invalid date format '${dateStr}'. Please use YYYY-MM-DD format.`);
        continue;
      }

      const title = row['Title'] || row['title'];
      if (!title || String(title).trim() === '') {
        errors.push(`Row ${rowNum}: Missing event title. Please ensure the 'Title' column is filled.`);
        continue;
      }

      const rawType = row['Type'] || row['type'];
      if (!rawType || String(rawType).trim() === '') {
        errors.push(`Row ${rowNum}: Missing event type. Please ensure the 'Type' column is filled.`);
        continue;
      }

      const typeStr = String(rawType).trim();
      const validTypes: CalendarEvent['type'][] = ['Classwork', 'Test', 'Exam', 'Other'];
      const matchedType = validTypes.find((t) => t.toLowerCase() === typeStr.toLowerCase());

      if (!matchedType) {
        errors.push(`Row ${rowNum}: Invalid event type '${typeStr}'. Valid types are: Classwork, Test, Exam, Other.`);
        continue;
      }

      const description = row['Description'] || row['description'];
      events.push({
        id: `evt_import_${Date.now()}_${index}`,
        date: dateStr,
        title: String(title).trim(),
        type: matchedType,
        description: description ? String(description) : '',
      });
    }

    if (errors.length > 0) {
      const errorMsg = `Import failed with ${errors.length} error(s):\n\n`
        + errors.slice(0, 10).join('\n')
        + (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
      throw new Error(errorMsg);
    }

    return events;
  })();
}

export function generateAttendanceTemplate(): void {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Attendance Import');
  ws.addRow(['Roll Number', 'Student Name', 'Date', 'Status', 'Reason']);
  ws.addRow(['001', 'John Smith', '2024-03-15', 'Present', '']);
  ws.addRow(['002', 'Jane Doe', '2024-03-15', 'Absent', 'Sick']);
  ws.addRow(['003', 'Bob Wilson', '2024-03-15', 'Late', 'Traffic']);
  setWorksheetColumns(ws, [15, 25, 15, 12, 30]);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  void downloadWorkbook(workbook, 'Attendance_Import_Template.xlsx');
}

export function importAttendanceFromExcel(file: File, _classId: string, students: Student[]): Promise<AttendanceRecord[]> {
  return (async () => {
    const worksheet = await loadFirstWorksheet(file);
    const json = worksheetToObjects(worksheet);

    if (!json.length) {
      throw new Error('The Excel sheet is empty.');
    }

    const studentMap = new Map<string, Student>();
    students.forEach(s => {
      studentMap.set(s.rollNumber.toLowerCase(), s);
      studentMap.set(s.name.toLowerCase(), s);
    });

    const records: AttendanceRecord[] = [];
    const errors: string[] = [];
    const validStatuses = ['Present', 'Absent', 'Sick', 'Late'];

    for (let index = 0; index < json.length; index++) {
      const row = json[index] as Record<string, unknown>;
      const rowNum = index + 2;

      const rollNumberRaw = row['Roll Number'] || row['rollNumber'] || row['Roll'] || row['ID'];
      const nameRaw = row['Student Name'] || row['name'] || row['Name'];
      const dateRaw = row['Date'] || row['date'];
      const statusRaw = row['Status'] || row['status'];
      const reason = row['Reason'] || row['reason'] || '';

      if (!dateRaw) {
        errors.push(`Row ${rowNum}: Missing date.`);
        continue;
      }

      let dateStr: string;
      if (dateRaw instanceof Date) {
        dateStr = format(dateRaw, 'yyyy-MM-dd');
      } else if (typeof dateRaw === 'number') {
        dateStr = format(excelSerialToDate(dateRaw), 'yyyy-MM-dd');
      } else {
        const parsed = new Date(String(dateRaw));
        if (isNaN(parsed.getTime())) {
          errors.push(`Row ${rowNum}: Invalid date '${dateRaw}'. Use YYYY-MM-DD format.`);
          continue;
        }
        dateStr = format(parsed, 'yyyy-MM-dd');
      }

      if (!statusRaw || !validStatuses.includes(String(statusRaw))) {
        errors.push(`Row ${rowNum}: Invalid status '${statusRaw}'. Valid: Present, Absent, Sick, Late.`);
        continue;
      }

      let student: Student | undefined;
      if (rollNumberRaw) student = studentMap.get(String(rollNumberRaw).trim().toLowerCase());
      if (!student && nameRaw) student = studentMap.get(String(nameRaw).trim().toLowerCase());

      if (!student) {
        errors.push(`Row ${rowNum}: Student not found. Use roll number or exact name.`);
        continue;
      }

      records.push({
        studentId: student.id,
        date: dateStr,
        status: statusRaw as AttendanceRecord['status'],
        reason: String(reason).trim() || undefined,
      });
    }

    if (errors.length > 0) {
      const errorMsg = `Import failed with ${errors.length} error(s):\n\n`
        + errors.slice(0, 10).join('\n')
        + (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
      throw new Error(errorMsg);
    }

    return records;
  })();
}

export function exportClassData(
  className: string,
  students: Student[],
  records: AttendanceRecord[],
  events: CalendarEvent[],
  timetable: TimetableSlot[],
  dailyNotes: Record<string, string>,
): void {
  const workbook = new ExcelJS.Workbook();

  const wsStudents = workbook.addWorksheet('Students');
  wsStudents.addRow(['Roll Number', 'Name', 'Parent Name', 'Parent Phone', 'Flagged']);
  students.forEach(s => wsStudents.addRow([s.rollNumber, s.name, s.parentName || '', s.parentPhone || '', s.isFlagged ? 'Yes' : 'No']));

  const studentMap = new Map(students.map(s => [s.id, s]));
  const wsRecords = workbook.addWorksheet('Attendance');
  wsRecords.addRow(['Student Name', 'Roll Number', 'Date', 'Status', 'Reason']);
  records.forEach(r => {
    const student = studentMap.get(r.studentId);
    wsRecords.addRow([student?.name || 'Unknown', student?.rollNumber || '', r.date, r.status, r.reason || '']);
  });

  const wsEvents = workbook.addWorksheet('Events');
  wsEvents.addRow(['Date', 'Title', 'Type', 'Description']);
  events.forEach(e => wsEvents.addRow([e.date, e.title, e.type, e.description || '']));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wsTimetable = workbook.addWorksheet('Timetable');
  wsTimetable.addRow(['Day', 'Start Time', 'End Time', 'Subject', 'Lesson']);
  timetable.forEach(t => wsTimetable.addRow([dayNames[t.dayOfWeek] || t.dayOfWeek, t.startTime, t.endTime, t.subject, t.lesson]));

  const wsNotes = workbook.addWorksheet('Daily Notes');
  wsNotes.addRow(['Date', 'Note']);
  Object.entries(dailyNotes).forEach(([date, note]) => wsNotes.addRow([date, note]));

  void downloadWorkbook(workbook, `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Export.xlsx`);
}
