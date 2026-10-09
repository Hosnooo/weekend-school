import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/features/classes/teacher-subject-group-manager.tsx'
  ),
  'utf8'
);

describe('Teacher Subject Group management layout', () => {
  it('keeps the student roster primary and management/history secondary', () => {
    const rosterIndex = source.indexOf('teacher-group-roster');
    const settingsIndex = source.indexOf('teacher-group-settings');
    const historyIndex = source.indexOf('teacher-group-history');

    // The sections now compose shared style classes; retain ordering checks.
    expect(source).toContain('className="subsection teacher-group-roster"');
    expect(source).toContain('teacher-group-management teacher-group-settings');
    expect(source).toContain('teacher-group-management teacher-group-history');
    expect(rosterIndex).toBeGreaterThan(-1);
    expect(settingsIndex).toBeGreaterThan(rosterIndex);
    expect(historyIndex).toBeGreaterThan(settingsIndex);
    expect(source).toContain('studentsForGroup');
    expect(source).toContain("t('ungrouped')");
  });
});
