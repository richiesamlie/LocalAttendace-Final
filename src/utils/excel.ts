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
  
  // Print setup
  worksheet['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  worksheet['!margins'] = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }];

  XLSX.writeFile(workbook, 'Student_Roster_Template.xlsx');
}

export function exportTimetableToExcel(
  timetable: TimetableSlot[],
  startDateStr: string, // 'YYYY-MM'
  duration: 'weekly' | 'month' | 'semester'
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

  const fileName = duration === 'weekly' ? 'Weekly_Timetable_Template.xlsx' : `Lesson_Plan_${duration}_${startDateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportScheduleToExcel(events: CalendarEvent[]) {
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
