/**
 * Service Layer Index
 * 
 * Re-exports all backend database services and frontend API client services.
 * 
 * Backend services (from services.ts):
 *   - Uses database directly (SQLite/PostgreSQL)
 *   - Used by API routes in src/routes/
 * 
 * Frontend services (existing):
 *   - Uses API client to communicate with backend
 *   - Used by React components
 */

// Backend database services
export { teacherService } from './teacher.service';
export { sessionService } from './session.service';
export { classService as classBackendService } from './class.service';
export { studentService as studentBackendService } from './student.service';
export { recordService as recordBackendService } from './record.service';
export { noteService as noteBackendService } from './note.service';
export { eventService as eventBackendService } from './event.service';
export { timetableService as timetableBackendService } from './timetable.service';
export { seatingService as seatingBackendService } from './seating.service';
export { settingService } from './setting.service';
export { inviteService } from './invite.service';

// Frontend API client services (existing)
export { classService, type ClassSummary } from './classService';
export { studentService } from './studentService';
export { recordService } from './recordService';
export { eventService } from './eventService';
export { timetableService } from './timetableService';
export { seatingService } from './seatingService';
export { noteService } from './noteService';

// Utilities
export { isPostgres } from './utils';

