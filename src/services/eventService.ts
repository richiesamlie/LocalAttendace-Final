import { api } from '../lib/api';
import type { CalendarEvent } from '../store';

export const eventService = {
  async getAll(classId: string): Promise<CalendarEvent[]> {
    return api.getEvents(classId);
  },

  async create(classId: string, events: CalendarEvent[]): Promise<{ success: boolean }> {
    return api.createEvents(classId, events);
  },

  async update(eventId: string, data: Partial<CalendarEvent>): Promise<{ success: boolean }> {
    return api.updateEvent(eventId, data);
  },

  async delete(eventId: string): Promise<{ success: boolean }> {
    return api.deleteEvent(eventId);
  },
};
