import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('API contract alignment', () => {
  const apiClientPath = path.join(process.cwd(), 'src', 'lib', 'api.ts');
  const apiReferencePath = path.join(process.cwd(), 'API_REFERENCE.md');
  const validationPath = path.join(process.cwd(), 'src', 'lib', 'validation.ts');

  it('uses /admin/settings endpoints in client API', () => {
    const content = readFileSync(apiClientPath, 'utf-8');
    expect(content).toContain("getSettings: () => fetchApi<Record<string, string>>('/admin/settings')");
    expect(content).toContain("saveSetting: (key: string, value: string) => fetchApi<{success: boolean}>('/admin/settings'");
    expect(content).not.toContain("getSettings: () => fetchApi<Record<string, string>>('/settings')");
    expect(content).not.toContain("saveSetting: (key: string, value: string) => fetchApi<{success: boolean}>('/settings'");
  });

  it('documents /admin/settings endpoints in API reference', () => {
    const content = readFileSync(apiReferencePath, 'utf-8');
    expect(content).toContain('### GET /admin/settings');
    expect(content).toContain('### POST /admin/settings');
    expect(content).not.toContain('### GET /settings');
    expect(content).not.toContain('### POST /settings');
  });

  it('documents student sync request body as { students: [...] }', () => {
    const content = readFileSync(apiReferencePath, 'utf-8');
    expect(content).toContain('### POST /classes/:classId/students/sync');
    expect(content).toContain('"students": [');
  });

  it('schema table in API reference stays in sync with validation.ts exports', () => {
    const validationContent = readFileSync(validationPath, 'utf-8');
    const apiRefContent = readFileSync(apiReferencePath, 'utf-8');

    const expectedSchemas = [
      'loginSchema',
      'classSchema',
      'studentSchema',
      'attendanceRecordSchema',
      'attendanceRecordsPayloadSchema',
      'eventSchema',
      'timetableSlotSchema',
      'timetableSlotUpdateSchema',
      'teacherSchema',
      'settingSchema',
      'dailyNotePayloadSchema',
      'seatingSeatUpdatePayloadSchema',
      'seatingLayoutPayloadSchema',
      'classUpdateSchema',
      'classTeacherAddSchema',
      'classTeacherRoleUpdateSchema',
      'classInviteCreateSchema',
      'inviteRedeemSchema',
      'sessionRevokeSchema',
      'studentUpdateSchema',
      'studentSyncPayloadSchema',
    ];

    const exportedSchemas = expectedSchemas.filter(name =>
      validationContent.includes(`export const ${name}`) ||
      validationContent.includes(`export function ${name}`)
    );

    for (const schema of exportedSchemas) {
      const docPattern = new RegExp(`\`\${schema}\``);
      if (!apiRefContent.match(docPattern)) {
        expect(apiRefContent).toContain(`\`${schema}\``);
      }
    }

    expect(exportedSchemas.length).toBeGreaterThan(0);
  });

  it('invite create docs use expiresInHours (not expiresIn)', () => {
    const content = readFileSync(apiReferencePath, 'utf-8');
    expect(content).not.toContain('"expiresIn"');
    expect(content).toContain('expiresInHours');
  });
});
