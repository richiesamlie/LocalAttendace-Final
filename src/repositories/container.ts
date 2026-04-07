import { type DatabaseType } from './types';
import {
  SQLiteClassRepository,
  SQLiteStudentRepository,
  SQLiteRecordRepository,
  SQLiteEventRepository,
  SQLiteTimetableRepository,
  SQLiteSeatingRepository,
  SQLiteNoteRepository,
} from './index';
import {
  PostgreSQLClassRepository,
  PostgreSQLStudentRepository,
  PostgreSQLRecordRepository,
  PostgreSQLEventRepository,
  PostgreSQLTimetableRepository,
  PostgreSQLSeatingRepository,
  PostgreSQLNoteRepository,
} from './index';
import type {
  IClassRepository,
  IStudentRepository,
  IRecordRepository,
  IEventRepository,
  ITimetableRepository,
  ISeatingRepository,
  INoteRepository,
} from './index';

export interface RepositoryContainer {
  classRepository: IClassRepository;
  studentRepository: IStudentRepository;
  recordRepository: IRecordRepository;
  eventRepository: IEventRepository;
  timetableRepository: ITimetableRepository;
  seatingRepository: ISeatingRepository;
  noteRepository: INoteRepository;
}

export function createRepositoryContainer(dbType: DatabaseType = 'sqlite'): RepositoryContainer {
  switch (dbType) {
    case 'sqlite':
      return {
        classRepository: new SQLiteClassRepository(),
        studentRepository: new SQLiteStudentRepository(),
        recordRepository: new SQLiteRecordRepository(),
        eventRepository: new SQLiteEventRepository(),
        timetableRepository: new SQLiteTimetableRepository(),
        seatingRepository: new SQLiteSeatingRepository(),
        noteRepository: new SQLiteNoteRepository(),
      };
    case 'postgres':
      return {
        classRepository: new PostgreSQLClassRepository(),
        studentRepository: new PostgreSQLStudentRepository(),
        recordRepository: new PostgreSQLRecordRepository(),
        eventRepository: new PostgreSQLEventRepository(),
        timetableRepository: new PostgreSQLTimetableRepository(),
        seatingRepository: new PostgreSQLSeatingRepository(),
        noteRepository: new PostgreSQLNoteRepository(),
      };
    default:
      throw new Error(`Unknown database type: ${dbType}`);
  }
}

// Default container with SQLite
export const repositories = createRepositoryContainer('sqlite');
