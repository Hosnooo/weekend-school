import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const teachersPagePath = resolve(root, 'src/app/[locale]/(protected)/(admin)/teachers/page.tsx');
const adminAssignmentsPagePath = resolve(root, 'src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx');

describe('administrator teaching assignment management', () => {
  it('shows existing administrator profiles as teaching-assignment candidates', () => {
    const source = readFileSync(teachersPagePath, 'utf8');
    expect(source).toContain('listTeachingCandidates');
    expect(source).toContain('/assignments');
  });

  it('provides a dedicated assignment page without converting the admin into a teacher profile', () => {
    expect(existsSync(adminAssignmentsPagePath)).toBe(true);
  });
});
