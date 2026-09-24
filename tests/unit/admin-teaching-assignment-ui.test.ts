import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const teachersPagePath = resolve(root, 'src/app/[locale]/(protected)/(admin)/teachers/page.tsx');
const teacherRepositoryPath = resolve(root, 'src/features/teachers/teacher.repository.ts');
const assignmentsPagePath = resolve(root, 'src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx');

describe('administrator teaching assignment management', () => {
  it('does not expose Administrator profiles as Teacher candidates', () => {
    const pageSource = readFileSync(teachersPagePath, 'utf8');
    expect(pageSource).not.toContain('administratorCandidates');
    expect(pageSource).not.toContain('listTeachingCandidates');
  });

  it('builds teaching candidates only from active Teacher business records', () => {
    const source = readFileSync(teacherRepositoryPath, 'utf8');
    const start = source.indexOf('export async function listTeachingCandidates');
    const end = source.indexOf('export async function getTeacher', start);
    const candidateSource = source.slice(start, end);
    expect(candidateSource).toContain("from('teachers')");
    expect(candidateSource).toContain("eq('is_active', true)");
    expect(candidateSource).not.toContain("from('profiles')");
  });

  it('keeps the assignment page for actual Teacher records', () => {
    expect(existsSync(assignmentsPagePath)).toBe(true);
    const source = readFileSync(assignmentsPagePath, 'utf8');
    expect(source).toContain('listTeachingCandidates');
  });
});
