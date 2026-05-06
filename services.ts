/**
 * Service Layer - Re-export Module
 * 
 * This file re-exports all services from the modular structure in src/services/.
 * 
 * This maintains backward compatibility with existing imports like:
 *   import { teacherService, classService } from './services';
 * 
 * The services have been split from a monolithic 724-line file into
 * individual modules for better maintainability.
 */

export { teacherService } from './src/services/teacher.service';
export { sessionService } from './src/services/session.service';
export { classService } from './src/services/class.service';
export { studentService } from './src/services/student.service';
export { recordService } from './src/services/record.service';
export { noteService } from './src/services/note.service';
export { eventService } from './src/services/event.service';
export { timetableService } from './src/services/timetable.service';
export { seatingService } from './src/services/seating.service';
export { settingService } from './src/services/setting.service';
export { inviteService } from './src/services/invite.service';

// Re-export utilities
export { isPostgres, type ClassSummary } from './src/services/utils';
