import { describe, it, expect } from 'vitest';
import { validateExcelFile, validateSheetCellCount } from '../excel';

describe('Excel import guardrails', () => {
  describe('validateExcelFile', () => {
    it('rejects file larger than 5 MB', () => {
      const file = { size: 6 * 1024 * 1024 } as File;
      expect(() => validateExcelFile(file)).toThrow('File size exceeds 5 MB limit');
    });

    it('rejects empty file', () => {
      const file = { size: 0 } as File;
      expect(() => validateExcelFile(file)).toThrow('File is empty');
    });

    it('accepts file under 5 MB', () => {
      const file = { size: 1 * 1024 * 1024 } as File;
      expect(() => validateExcelFile(file)).not.toThrow();
    });

    it('accepts file exactly at 5 MB', () => {
      const file = { size: 5 * 1024 * 1024 } as File;
      expect(() => validateExcelFile(file)).not.toThrow();
    });
  });

  describe('validateSheetCellCount', () => {
    it('rejects sheet with more than 50000 cells', () => {
      // 500 cols x 101 rows = 50500 cells
      const sheet = { '!ref': 'A1:SN101' } as any;
      expect(() => validateSheetCellCount(sheet)).toThrow(/cell limit/);
    });

    it('accepts sheet within cell limit', () => {
      // 10 cols x 100 rows = 1000 cells
      const sheet = { '!ref': 'A1:J100' } as any;
      expect(() => validateSheetCellCount(sheet)).not.toThrow();
    });

    it('accepts sheet with no !ref', () => {
      const sheet = {} as any;
      expect(() => validateSheetCellCount(sheet)).not.toThrow();
    });

    it('uses custom maxCells when provided', () => {
      // 10 cols x 6 rows = 60 cells, but maxCells = 50
      const sheet = { '!ref': 'A1:J6' } as any;
      expect(() => validateSheetCellCount(sheet, 50)).toThrow(/exceeding the 50 cell limit/);
    });

    it('accepts sheet exactly at custom maxCells', () => {
      const sheet = { '!ref': 'A1:J5' } as any; // 10 cols x 5 rows = 50
      expect(() => validateSheetCellCount(sheet, 50)).not.toThrow();
    });
  });
});