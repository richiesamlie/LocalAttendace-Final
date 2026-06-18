import { describe, it, expect } from 'vitest';
import { sanitizeUrlForLog } from '../../../src/middleware/performance';

process.env.DEFAULT_ADMIN_PASSWORD ??= 'test-default-admin-password';

describe('URL sanitization for performance logs (F-023)', () => {
  it('passes short paths through unchanged', () => {
    expect(sanitizeUrlForLog('/api/students')).toBe('/api/students');
    expect(sanitizeUrlForLog('/api/health')).toBe('/api/health');
  });

  it('strips query strings entirely', () => {
    expect(sanitizeUrlForLog('/api/students?search=John%20Doe')).toBe('/api/students');
    expect(sanitizeUrlForLog('/api/classes?page=2&limit=50')).toBe('/api/classes');
  });

  it('handles URLs with both query and long paths', () => {
    const longUrl = `/api/students/${'a'.repeat(100)}?search=${'b'.repeat(50)}`;
    const result = sanitizeUrlForLog(longUrl);
    expect(result).not.toContain('search=');
    expect(result).not.toContain('b'.repeat(50));
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it('caps URL length to prevent log line bloat', () => {
    const huge = `/api/${'x'.repeat(200)}`;
    const result = sanitizeUrlForLog(huge);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain('…');
  });

  it('returns / for empty or undefined input', () => {
    expect(sanitizeUrlForLog('')).toBe('/');
    expect(sanitizeUrlForLog(undefined as unknown as string)).toBe('/');
  });

  it('handles paths with no query string', () => {
    expect(sanitizeUrlForLog('/api/classes/abc123def')).toBe('/api/classes/abc123def');
  });

  it('preserves method-relevant info (route paths, not params)', () => {
    const result = sanitizeUrlForLog('/api/teachers/t-12345/sessions');
    // The path structure should be visible (so devs can grep)
    expect(result.startsWith('/api/teachers/')).toBe(true);
    expect(result.endsWith('/sessions')).toBe(true);
  });

  it('does not leak PII strings in any case', () => {
    const piiStrings = ['john.doe@school.com', '+1-555-1234', 'JohnDoe', 'parentphone123'];
    for (const pii of piiStrings) {
      const url = `/api/search?q=${encodeURIComponent(pii)}`;
      const result = sanitizeUrlForLog(url);
      expect(result).not.toContain(pii);
    }
  });
});