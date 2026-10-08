import {describe, expect, it} from 'vitest';
import {validateExportDownloadForm} from '@/features/exports/export-form-validation';

function form(values: Record<string,string | string[]>) {
  const data = new FormData();
  for(const [key,value] of Object.entries(values)){
    for(const item of Array.isArray(value)?value:[value]) data.append(key,item);
  }
  return data;
}

describe('actionable export validation', () => {
  it('explains missing datasets and missing scope rather than starting a download', () => {
    expect(validateExportDownloadForm(form({periodPreset:'THIS_MONTH',scopeType:'SCHOOL'}))).toBe('datasets');
    expect(validateExportDownloadForm(form({periodPreset:'THIS_MONTH',scopeType:'GROUP',datasets:['REPORTS'],classId:'a'}))).toBe('scope');
  });
  it('requires a valid ordered pair of custom dates', () => {
    expect(validateExportDownloadForm(form({periodPreset:'CUSTOM',customStart:'2026-10-08',customEnd:'2026-10-07',scopeType:'SCHOOL',datasets:['STUDENTS']}))).toBe('period');
    expect(validateExportDownloadForm(form({periodPreset:'CUSTOM',customStart:'2026-10-07',customEnd:'2026-10-08',scopeType:'SCHOOL',datasets:['STUDENTS']}))).toBeNull();
  });
});
