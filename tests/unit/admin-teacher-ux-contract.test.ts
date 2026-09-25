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
  teachers: 'src/app/[locale]/(protected)/(admin)/teachers/page.tsx',
  teacherDetail: 'src/app/[locale]/(protected)/(admin)/teachers/[id]/page.tsx',
  teacherEdit: 'src/app/[locale]/(protected)/(admin)/teachers/[id]/edit/page.tsx',
  teacherAccess: 'src/app/[locale]/(protected)/(admin)/teachers/[id]/access/page.tsx',
  teacherAssignments: 'src/app/[locale]/(protected)/(admin)/teachers/[id]/assignments/page.tsx',
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
    const teacherEdit = source(routes.teacherEdit);
    expect(teacherEdit).toContain('TeacherForm');
    expect(teacherEdit).not.toContain('TeachingAssignmentWorkspace');
    expect(teacherEdit).not.toContain('listTeachingAssignments');
    expect(teacherEdit).not.toContain('resendTeacherAccessAction');
    expect(teacherEdit).not.toContain('unlinkTeacherAccessAction');
  });

  it('uses the canonical assignment workspace for Teacher coverage management', () => {
    const assignmentPage = source(routes.teacherAssignments);
    expect(assignmentPage).toContain('TeachingAssignmentWorkspace');

    const workspacePath = resolve(root, 'src/features/teaching-assignments/teaching-assignment-workspace.tsx');
    expect(existsSync(workspacePath)).toBe(true);
    if (existsSync(workspacePath)) {
      const workspace = readFileSync(workspacePath, 'utf8');
      expect(workspace).toContain('updateTeachingAssignmentMutationAction');
      expect(workspace).toContain('deleteTeachingAssignmentAction');
      expect(workspace).toContain('Tabs');
      expect(workspace).toContain("value: 'current'");
      expect(workspace).toContain("value: 'upcoming'");
      expect(workspace).toContain("value: 'past'");
    }
  });

  it('standardizes the Teacher list around management columns and one overflow action', () => {
    const componentPath = 'src/features/teachers/teacher-management-list.tsx';
    expect(existsSync(resolve(root, componentPath)), `${componentPath} should exist`).toBe(true);
    if (!existsSync(resolve(root, componentPath))) return;

    const list = source(componentPath);
    expect(source(routes.teachers)).toContain('TeacherManagementList');
    expect(list).toContain('DataTable');
    expect(list).toContain('DropdownMenu');
    expect(list).toContain("t('loginAccess')");
    expect(list).toContain("t('teachingCoverage')");
    expect(list).toContain("t('teacherActions'");
    expect(list).toContain('/edit');
    expect(list).toContain('/access');
    expect(list).toContain('/assignments');
    expect(list).not.toContain('row-actions');
  });

  it('separates read-only Teacher detail, identity edit, login access, and teaching coverage', () => {
    expect(existsSync(resolve(root, routes.teacherDetail))).toBe(true);
    expect(existsSync(resolve(root, routes.teacherAccess))).toBe(true);
    if (!existsSync(resolve(root, routes.teacherDetail)) || !existsSync(resolve(root, routes.teacherAccess))) return;

    const detail = source(routes.teacherDetail);
    const access = source(routes.teacherAccess);
    const edit = source(routes.teacherEdit);

    expect(detail).toContain('getTeacher');
    expect(detail).toContain('getTeacherAccessStates');
    expect(detail).toContain('listTeachingAssignments');
    expect(detail).toContain("t('identityContact')");
    expect(detail).toContain("t('loginAccess')");
    expect(detail).toContain("t('teachingSummary')");
    expect(detail).toContain("t('lifecycle')");
    expect(detail).not.toContain('TeacherForm');

    expect(edit).toContain('TeacherForm');
    expect(edit).not.toContain('resendTeacherAccessAction');
    expect(edit).not.toContain('unlinkTeacherAccessAction');

    expect(access).toContain('resendTeacherAccessAction');
    expect(access).toContain('unlinkTeacherAccessAction');
    expect(access).not.toContain('TeacherForm');
    expect(access).not.toContain('TeachingAssignmentWorkspace');
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
});
