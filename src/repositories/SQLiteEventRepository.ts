import { api } from '../lib/api';
import type { IEventRepository } from './IEventRepository';
import type { CalendarEvent } from '../store';

export class SQLiteEventRepository implements IEventRepository {
  async getAll(classId: string): Promise<CalendarEvent[]> {
    return api.getEvents(classId);
  }

  async getById(eventId: string): Promise<CalendarEvent | null> {
    // Would need a new API endpoint for this
    return null;
  }

  async create(classId: string, events: CalendarEvent[]): Promise<{ success: boolean }> {
    return api.createEvents(classId, events);
  }

  async update(eventId: string, data: Partial<CalendarEvent>): Promise<{ success: boolean }> {
    return api.updateEvent(eventId, data);
  }

  async delete(eventId: string): Promise<{ success: boolean }> {
    return api.deleteEvent(eventId);
  }
}
