import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const routes = {
  administrators: 'src/app/[locale]/(protected)/(admin)/administrators/page.tsx',
  administratorEdit: 'src/app/[locale]/(protected)/(admin)/administrators/[id]/edit/page.tsx',
  teachingAssignments: 'src/app/[locale]/(protected)/(admin)/teaching-assignments/page.tsx',
  exports: 'src/app/[locale]/(protected)/(admin)/exports/page.tsx',
  archives: 'src/app/[locale]/(protected)/(admin)/archives/page.tsx',
  teacherProfile: 'src/app/[locale]/(protected)/(teacher)/profile/page.tsx'
} as const;

describe('administrator and teacher UX completion contract', () => {
  it('makes core administrator utilities first-class routes', () => {
    for (const path of Object.values(routes)) {
      expect(existsSync(resolve(root, path)), `${path} should exist`).toBe(true);
    }
  });

  it('evaluates current teaching against today while keeping the weekly submission keyed to week start', () => {
    const myTeaching = source('src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx');
    expect(myTeaching).toMatch(
      /listMyTeaching\(profile\.schoolId,\s*teacherIds,\s*today,\s*weekStart\)/
    );
  });

  it('keeps assignment management out of the general Teacher details form', () => {
    const teacherEdit = source('src/app/[locale]/(protected)/(admin)/teachers/[id]/edit/page.tsx');
    expect(teacherEdit).not.toContain('TeachingAssignmentEditor');
  });

  it('uses a dedicated assignment workspace with editable dates and lifecycle sections', () => {
    const assignmentPage = source('src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx');
    expect(assignmentPage).toContain('TeachingAssignmentWorkspace');

    const workspacePath = resolve(root, 'src/features/teaching-assignments/teaching-assignment-workspace.tsx');
    expect(existsSync(workspacePath)).toBe(true);
    if (existsSync(workspacePath)) {
      const workspace = readFileSync(workspacePath, 'utf8');
      expect(workspace).toContain('updateTeachingAssignmentAction');
      expect(workspace).toContain('currentAssignments');
      expect(workspace).toContain('upcomingAssignments');
      expect(workspace).toContain('pastAssignments');
      expect(workspace).toContain('endsOn');
    }
  });

  it('puts the most common administrator jobs directly on the dashboard', () => {
    const dashboard = source('src/app/[locale]/(protected)/(admin)/dashboard/page.tsx');
    for (const href of ['/students/new', '/teachers/new', '/teaching-assignments', '/classes/new', '/reports']) {
      expect(dashboard).toContain(`href=\"${href}\"`);
    }
  });

  it('supports editing and lifecycle actions for the current Class/Subject/Group model', () => {
    const actions = source('src/features/classes/class.actions.ts');
    for (const actionName of [
      'updateClassAction',
      'setClassActiveAction',
      'updateSubjectAction',
      'setSubjectActiveAction',
      'updateSubjectGroupAction',
      'setSubjectGroupActiveAction'
    ]) {
      expect(actions).toContain(`function ${actionName}`);
    }
  });

  it('surfaces Teacher login access separately from teaching coverage', () => {
    const teachers = source('src/app/[locale]/(protected)/(admin)/teachers/page.tsx');
    expect(teachers).toContain('currentTeaching');
    expect(teachers).toContain('loginAccess');
    expect(teachers).toContain('noLoginWarning');
  });
});
