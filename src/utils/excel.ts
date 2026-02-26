import * as XLSX from 'xlsx';
import { Student, AttendanceRecord, TimetableSlot, CalendarEvent } from '../store';
import { format, getDaysInMonth, parseISO, startOfMonth, addDays, addMonths, isWeekend } from 'date-fns';

export function importStudentsFromExcel(file: File): Promise<Student[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        const students: Student[] = json.map((row: any, index) => ({
          id: `std_${Date.now()}_${index}`,
          name: row['Name'] || row['name'] || row['Student Name'] || `Student ${index + 1}`,
          rollNumber: String(row['Roll Number'] || row['rollNumber'] || row['Roll'] || row['ID'] || `${index + 1}`),
        }));
        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
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
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, format(monthDate, 'MMM yyyy'));
  
  XLSX.writeFile(workbook, `Attendance_Report_${monthString}.xlsx`);
}

export function generateTemplate() {
  const data = [
    { 'Roll Number': '1', 'Name': 'Alice Smith' },
    { 'Roll Number': '2', 'Name': 'Bob Jones' },
  ];
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, 'Student_Roster_Template.xlsx');
}

export function exportTimetableToExcel(
  timetable: TimetableSlot[],
  startDateStr: string, // 'YYYY-MM'
  duration: 'month' | 'semester'
) {
  const startDate = parseISO(`${startDateStr}-01`);
  const endDate = duration === 'month' 
    ? addMonths(startDate, 1) 
    : addMonths(startDate, 6); // 6 months for a semester

  const data: any[] = [];
  let currentDate = startDate;

  // Loop through every day until the end date
  while (currentDate < endDate) {
    if (!isWeekend(currentDate)) {
      const dayOfWeek = currentDate.getDay();
      
      // Find classes for this day
      const classesForDay = timetable
        .filter(slot => slot.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      classesForDay.forEach(slot => {
        data.push({
          'Date': format(currentDate, 'yyyy-MM-dd'),
          'Day': format(currentDate, 'EEEE'),
          'Time': `${slot.startTime} - ${slot.endTime}`,
          'Subject': slot.subject,
          'Lesson / Topic': slot.lesson || '',
          'Notes / Progress': '' // Blank column for teacher to write in
        });
      });
    }
    currentDate = addDays(currentDate, 1);
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Auto-size columns
  const wscols = [
    { wch: 12 }, // Date
    { wch: 10 }, // Day
    { wch: 15 }, // Time
    { wch: 20 }, // Subject
    { wch: 30 }, // Lesson
    { wch: 30 }  // Notes
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  const sheetName = duration === 'month' ? 'Monthly Plan' : 'Semester Plan';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const fileName = `Lesson_Plan_${duration}_${startDateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportScheduleToExcel(events: CalendarEvent[]) {
  const data = events.map(e => ({
    'Date (YYYY-MM-DD)': e.date,
    'Title': e.title,
    'Type': e.type,
    'Description': e.description || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Auto-size columns
  const wscols = [
    { wch: 18 }, // Date
    { wch: 30 }, // Title
    { wch: 15 }, // Type
    { wch: 50 }  // Description
  ];
  worksheet['!cols'] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');
  
  XLSX.writeFile(workbook, 'Class_Schedule.xlsx');
}

export function importScheduleFromExcel(file: File): Promise<CalendarEvent[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use raw: false to get formatted strings for dates if they are formatted as dates in Excel
        const json = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        
        const events: CalendarEvent[] = json.map((row: any, index) => {
          // Find the date column (could be 'Date', 'Date (YYYY-MM-DD)', 'date')
          let dateStr = row['Date (YYYY-MM-DD)'] || row['Date'] || row['date'];
          
          // Basic cleanup if it's MM/DD/YYYY or similar
          if (dateStr && dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // Assume MM/DD/YYYY to YYYY-MM-DD
              if (parts[2].length === 4) {
                dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              }
            }
          }

          // Ensure it matches YYYY-MM-DD format roughly
          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            // Fallback to today if invalid
            dateStr = format(new Date(), 'yyyy-MM-dd');
          }

          const title = row['Title'] || row['title'] || `Imported Event ${index + 1}`;
          
          let type = row['Type'] || row['type'] || 'Other';
          if (!['Classwork', 'Test', 'Exam', 'Other'].includes(type)) {
            type = 'Other';
          }

          return {
            id: `evt_import_${Date.now()}_${index}`,
            date: dateStr,
            title: String(title),
            type: type as any,
            description: row['Description'] || row['description'] || ''
          };
        });
        
        resolve(events);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
