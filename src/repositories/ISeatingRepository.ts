export interface ISeatingRepository {
  getAll(classId: string): Promise<Record<string, string>>;
  updateSeat(classId: string, seatId: string, studentId: string | null): Promise<{ success: boolean }>;
  saveLayout(classId: string, layout: Record<string, string>): Promise<{ success: boolean }>;
  clear(classId: string): Promise<{ success: boolean }>;
}
