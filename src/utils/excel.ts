import * as XLSX from 'xlsx';
import { Student, AttendanceRecord, TimetableSlot, CalendarEvent } from '../store';
import { format, getDaysInMonth, parseISO, startOfMonth, addDays, addMonths, isWeekend } from 'date-fns';

/** Derive a stable student ID from classId + rollNumber so re-imports don't create duplicates */
function deriveStudentId(classId: string, rollNumber: string): string {
  return `std_${btoa(`${classId}:${rollNumber}`).replace(/[/+=]/g, '_')}`;
}

export function importStudentsFromExcel(file: File, classId: string): Promise<Student[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames.length) {
          throw new Error("The Excel file contains no sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        if (!json || json.length === 0) {
          throw new Error("The Excel sheet is empty or contains no readable data.");
        }

        const students: Student[] = [];
        const rollNumbers = new Set<string>();
        const errors: string[] = [];

        for (let index = 0; index < json.length; index++) {
          const row: any = json[index];
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
            rollNumber: rollNumber,
          });
        }
        
        if (errors.length > 0) {
          const errorMsg = `Import failed with ${errors.length} error(s):\n\n` + 
            errors.slice(0, 10).join('\n') + 
            (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
          reject(new Error(errorMsg));
        } else {
          resolve(students);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(new Error("Failed to read the file."));
    reader.readAsBinaryString(file);
  });
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
    includeReasons: true
  }
) {
  // monthString is 'YYYY-MM'
  const monthDate = parseISO(`${monthString}-01`);
  const daysInMonth = getDaysInMonth(monthDate);
  const start = startOfMonth(monthDate);

  const days = Array.from({ length: daysInMonth }, (_, i) => addDays(start, i));
  
  const data = students.map(student => {
    const row: any = {};
    
    if (options.includeRollNumber) row['Roll Number'] = student.rollNumber;
    if (options.includeName) row['Name'] = student.name;
    if (options.includeParentName) row['Parent Name'] = student.parentName || '-';
    if (options.includeParentPhone) row['Parent Phone'] = student.parentPhone || '-';

    let present = 0;
    let absent = 0;
    let sick = 0;
    let late = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const record = records.find(r => r.studentId === student.id && r.date === dateStr);
      
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

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Auto-size columns
  if (data.length > 0) {
    const wscols = Object.keys(data[0]).map(key => {
      const maxContentLength = data.reduce((max, row) => {
        const content = row[key] ? String(row[key]) : '';
        return Math.max(max, content.length);
      }, key.length);
      return { wch: Math.min(Math.max(maxContentLength + 2, 5), 30) };
    });
    worksheet['!cols'] = wscols;
  }

  // Print setup
  worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
  
  // Freeze top row and first two columns
  worksheet['!views'] = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, format(monthDate, 'MMM yyyy'));
  
  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(workbook, `${safeClassName}_Attendance_Report_${monthString}.xlsx`);
}

export function generateTemplate() {
  const data = [
    { 'Roll Number': '1', 'Name': 'Alice Smith' },
    { 'Roll Number': '2', 'Name': 'Bob Jones' },
  ];
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  
  // Print setup
  worksheet['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  worksheet['!margins'] = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }];

  XLSX.writeFile(workbook, 'Student_Roster_Template.xlsx');
}

export function exportTimetableToExcel(
  timetable: TimetableSlot[],
  startDateStr: string, // 'YYYY-MM'
  duration: 'weekly' | 'month' | 'semester',
  className: string = 'Class'
) {
  const workbook = XLSX.utils.book_new();
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
        'Notes / Progress': ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
      worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
      worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

      XLSX.utils.book_append_sheet(workbook, worksheet, DAYS[dayOfWeek]);
    }
  } else if (duration === 'month') {
    const startDate = parseISO(`${startDateStr}-01`);
    const endDate = addMonths(startDate, 1);
    
    let currentDate = startDate;
    const weeks: Record<string, any[]> = {};
    
    while (currentDate < endDate) {
      if (!isWeekend(currentDate)) {
        const dayOfWeek = currentDate.getDay();
        // Calculate week of the month (1-5)
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
            'Notes / Progress': ''
          });
        });
      }
      currentDate = addDays(currentDate, 1);
    }
    
    Object.keys(weeks).forEach(weekName => {
      const worksheet = XLSX.utils.json_to_sheet(weeks[weekName]);
      worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
      worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
      worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, weekName);
    });
  } else {
    // semester
    const startDate = parseISO(`${startDateStr}-01`);
    const endDate = addMonths(startDate, 6);
    
    let currentDate = startDate;
    const months: Record<string, any[]> = {};
    
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
            'Notes / Progress': ''
          });
        });
      }
      currentDate = addDays(currentDate, 1);
    }
    
    Object.keys(months).forEach(monthName => {
      const worksheet = XLSX.utils.json_to_sheet(months[monthName]);
      worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
      worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      worksheet['!margins'] = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
      worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, monthName);
    });
  }

  if (workbook.SheetNames.length === 0) {
    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Empty');
  }

  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  const fileName = duration === 'weekly' ? `${safeClassName}_Weekly_Timetable_Template.xlsx` : `${safeClassName}_Lesson_Plan_${duration}_${startDateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportScheduleToExcel(events: CalendarEvent[], className: string = 'Class') {
  const workbook = XLSX.utils.book_new();

  // Group events by month (YYYY-MM)
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  events.forEach(e => {
    const month = e.date.substring(0, 7); // YYYY-MM
    if (!groupedEvents[month]) groupedEvents[month] = [];
    groupedEvents[month].push(e);
  });

  const months = Object.keys(groupedEvents).sort();

  if (months.length === 0) {
    // Empty sheet
    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');
  } else {
    months.forEach(month => {
      const monthEvents = groupedEvents[month].sort((a, b) => a.date.localeCompare(b.date));
      const data = monthEvents.map(e => ({
        'Date (YYYY-MM-DD)': e.date,
        'Title': e.title,
        'Type': e.type,
        'Description': e.description || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      const wscols = [
        { wch: 18 }, // Date
        { wch: 30 }, // Title
        { wch: 15 }, // Type
        { wch: 50 }  // Description
      ];
      worksheet['!cols'] = wscols;

      worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      worksheet['!margins'] = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
      worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

      // Sheet name: e.g., "Jan 2024"
      const sheetName = format(parseISO(`${month}-01`), 'MMM yyyy');
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
  }

  const safeClassName = className.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(workbook, `${safeClassName}_Class_Schedule.xlsx`);
}

export function importScheduleFromExcel(file: File): Promise<CalendarEvent[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames.length) {
          throw new Error("The Excel file contains no sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use raw: false to get formatted strings for dates if they are formatted as dates in Excel
        const json = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        
        if (!json || json.length === 0) {
          throw new Error("The Excel sheet is empty or contains no readable data.");
        }

        const events: CalendarEvent[] = [];
        const errors: string[] = [];

        for (let index = 0; index < json.length; index++) {
          const row: any = json[index];
          const rowNum = index + 2;
          
          // Find the date column (could be 'Date', 'Date (YYYY-MM-DD)', 'date')
          let dateStr = row['Date (YYYY-MM-DD)'] || row['Date'] || row['date'];
          
          if (!dateStr || String(dateStr).trim() === '') {
            errors.push(`Row ${rowNum}: Missing date. Please ensure the 'Date' column is filled.`);
            continue;
          }

          dateStr = String(dateStr).trim();

          // Basic cleanup if it's MM/DD/YYYY or similar
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // Assume MM/DD/YYYY to YYYY-MM-DD
              if (parts[2].length === 4) {
                dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              } else if (parts[0].length === 4) {
                // YYYY/MM/DD
                dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              }
            }
          }

          // Ensure it matches YYYY-MM-DD format roughly
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            errors.push(`Row ${rowNum}: Invalid date format '${dateStr}'. Please use YYYY-MM-DD format.`);
            continue;
          }

          const title = row['Title'] || row['title'];
          if (!title || String(title).trim() === '') {
            errors.push(`Row ${rowNum}: Missing event title. Please ensure the 'Title' column is filled.`);
            continue;
          }
          
          let type = row['Type'] || row['type'];
          if (!type || String(type).trim() === '') {
            errors.push(`Row ${rowNum}: Missing event type. Please ensure the 'Type' column is filled.`);
            continue;
          }
          
          type = String(type).trim();
          const validTypes = ['Classwork', 'Test', 'Exam', 'Other'];
          
          // Case-insensitive match for type
          const matchedType = validTypes.find(t => t.toLowerCase() === type.toLowerCase());
          
          if (!matchedType) {
            errors.push(`Row ${rowNum}: Invalid event type '${type}'. Valid types are: Classwork, Test, Exam, Other.`);
            continue;
          }

          events.push({
            id: `evt_import_${Date.now()}_${index}`,
            date: dateStr,
            title: String(title).trim(),
            type: matchedType as any,
            description: row['Description'] || row['description'] || ''
          });
        }
        
        if (errors.length > 0) {
          const errorMsg = `Import failed with ${errors.length} error(s):\n\n` + 
            errors.slice(0, 10).join('\n') + 
            (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
          reject(new Error(errorMsg));
        } else {
          resolve(events);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(new Error("Failed to read the file."));
    reader.readAsBinaryString(file);
  });
}

export function generateAttendanceTemplate(): void {
  const headers = ['Roll Number', 'Student Name', 'Date', 'Status', 'Reason'];
  const exampleRows = [
    ['001', 'John Smith', '2024-03-15', 'Present', ''],
    ['002', 'Jane Doe', '2024-03-15', 'Absent', 'Sick'],
    ['003', 'Bob Wilson', '2024-03-15', 'Late', 'Traffic'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Import');
  XLSX.writeFile(wb, 'Attendance_Import_Template.xlsx');
}

export function importAttendanceFromExcel(file: File, classId: string, students: Student[]): Promise<AttendanceRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames.length) {
          throw new Error("The Excel file contains no sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        if (!json || json.length === 0) {
          throw new Error("The Excel sheet is empty.");
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
          const row: any = json[index];
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
          } else {
            const parsed = new Date(dateRaw);
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
          if (rollNumberRaw) {
            student = studentMap.get(String(rollNumberRaw).trim().toLowerCase());
          }
          if (!student && nameRaw) {
            student = studentMap.get(String(nameRaw).trim().toLowerCase());
          }

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
          const errorMsg = `Import failed with ${errors.length} error(s):\n\n` + 
            errors.slice(0, 10).join('\n') + 
            (errors.length > 10 ? `\n...and ${errors.length - 10} more.` : '');
          reject(new Error(errorMsg));
        } else {
          resolve(records);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsBinaryString(file);
  });
}

export function exportClassData(
  className: string,
  students: Student[],
  records: AttendanceRecord[],
  events: CalendarEvent[],
  timetable: TimetableSlot[],
  dailyNotes: Record<string, string>,
): void {
  const wb = XLSX.utils.book_new();

  const studentsData = [
    ['Roll Number', 'Name', 'Parent Name', 'Parent Phone', 'Flagged'],
    ...students.map(s => [s.rollNumber, s.name, s.parentName || '', s.parentPhone || '', s.isFlagged ? 'Yes' : 'No']),
  ];
  const wsStudents = XLSX.utils.aoa_to_sheet(studentsData);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

  const recordsData = [
    ['Student Name', 'Roll Number', 'Date', 'Status', 'Reason'],
    ...records.map(r => {
      const student = students.find(s => s.id === r.studentId);
      return [student?.name || 'Unknown', student?.rollNumber || '', r.date, r.status, r.reason || ''];
    }),
  ];
  const wsRECORDS = XLSX.utils.aoa_to_sheet(recordsData);
  XLSX.utils.book_append_sheet(wb, wsRECORDS, 'Attendance');

  const eventsData = [
    ['Date', 'Title', 'Type', 'Description'],
    ...events.map(e => [e.date, e.title, e.type, e.description || '']),
  ];
  const wsEVENTS = XLSX.utils.aoa_to_sheet(eventsData);
  XLSX.utils.book_append_sheet(wb, wsEVENTS, 'Events');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timetableData = [
    ['Day', 'Start Time', 'End Time', 'Subject', 'Lesson'],
    ...timetable.map(t => [dayNames[t.dayOfWeek] || t.dayOfWeek, t.startTime, t.endTime, t.subject, t.lesson]),
  ];
  const wsTIMETABLE = XLSX.utils.aoa_to_sheet(timetableData);
  XLSX.utils.book_append_sheet(wb, wsTIMETABLE, 'Timetable');

  const notesData = [
    ['Date', 'Note'],
    ...Object.entries(dailyNotes).map(([date, note]) => [date, note]),
  ];
  const wsNOTES = XLSX.utils.aoa_to_sheet(notesData);
  XLSX.utils.book_append_sheet(wb, wsNOTES, 'Daily Notes');

  XLSX.writeFile(wb, `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Export.xlsx`);
}
