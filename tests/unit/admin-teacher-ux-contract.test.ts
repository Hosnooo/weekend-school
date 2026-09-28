import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const routes = {
  administrators: 'src/app/[locale]/(protected)/(admin)/administrators/page.tsx',
  administratorNew: 'src/app/[locale]/(protected)/(admin)/administrators/new/page.tsx',
  administratorDetail: 'src/app/[locale]/(protected)/(admin)/administrators/[id]/page.tsx',
  administratorEdit: 'src/app/[locale]/(protected)/(admin)/administrators/[id]/edit/page.tsx',
  administratorAccess: 'src/app/[locale]/(protected)/(admin)/administrators/[id]/access/page.tsx',
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
    for (const path of [
      routes.administrators,
      routes.administratorNew,
      routes.administratorDetail,
      routes.administratorEdit,
      routes.administratorAccess,
      routes.teachingAssignments,
      routes.exports,
      routes.archives,
      routes.teachers,
      routes.teacherDetail,
      routes.teacherEdit,
      routes.teacherAccess,
      routes.teacherAssignments,
      routes.teacherProfile
    ]) {
      expect(existsSync(resolve(root, path)), `${path} should exist`).toBe(true);
    }
  });

  it('evaluates current teaching against today while keeping the weekly submission keyed to week start', () => {
    const myTeaching = source('src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx');
    expect(myTeaching).toMatch(
      /listMyTeaching\(\s*profile\.schoolId,\s*teacherIds,\s*today,\s*weekStart\s*\)/
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

  it('standardizes Administrators as a first-class People management surface', () => {
    const componentPath = 'src/features/administrators/administrator-management-list.tsx';
    expect(existsSync(resolve(root, routes.administratorDetail)), `${routes.administratorDetail} should exist`).toBe(true);
    expect(existsSync(resolve(root, routes.administratorAccess)), `${routes.administratorAccess} should exist`).toBe(true);
    expect(existsSync(resolve(root, componentPath)), `${componentPath} should exist`).toBe(true);
    if (!existsSync(resolve(root, componentPath))) return;

    const page = source(routes.administrators);
    const list = source(componentPath);
    expect(page).toContain('PageHeader');
    expect(page).toContain('AdministratorManagementList');
    expect(page).not.toContain('record-card');
    expect(page).not.toContain('<table');
    expect(page).not.toContain("locale === 'ar'");

    expect(list).toContain('DataTable');
    expect(list).toContain('DropdownMenu');
    expect(list).toContain("t('loginAccess')");
    expect(list).toContain("t('administratorActions'");
    expect(list).toContain('/edit');
    expect(list).toContain('/access');
    expect(list).not.toContain('row-actions');
  });

  it('separates Administrator detail, identity editing, login access, and lifecycle operations', () => {
    expect(existsSync(resolve(root, routes.administratorDetail))).toBe(true);
    expect(existsSync(resolve(root, routes.administratorAccess))).toBe(true);
    if (!existsSync(resolve(root, routes.administratorDetail)) || !existsSync(resolve(root, routes.administratorAccess))) return;

    const detail = source(routes.administratorDetail);
    const edit = source(routes.administratorEdit);
    const access = source(routes.administratorAccess);

    expect(detail).toContain('getAdministratorAccessStates');
    expect(detail).toContain("t('identityContact')");
    expect(detail).toContain("t('loginAccess')");
    expect(detail).toContain("t('lifecycle')");
    expect(detail).not.toContain('updateAdministratorDetailsAction');
    expect(detail).not.toContain('resendAdministratorAccessAction');

    expect(edit).toContain('updateAdministratorDetailsAction');
    expect(edit).not.toContain('resendAdministratorAccessAction');
    expect(edit).not.toContain('setAdministratorActiveAction');
    expect(edit).not.toContain('deleteAdministratorAction');

    expect(access).toContain('resendAdministratorAccessAction');
    expect(access).not.toContain('updateAdministratorDetailsAction');
    expect(access).not.toContain('setAdministratorActiveAction');
    expect(access).not.toContain('deleteAdministratorAction');
  });

  it('keeps last-active-Administrator blocking discoverable on the canonical Administrators surface', () => {
    const page = source(routes.administrators);
    const actions = source('src/features/administrators/administrator.actions.ts');
    const service = source('src/features/administrators/administrator.service.ts');

    expect(page).toContain("query.error === 'last-admin'");
    expect(page).toContain("t('lastAdministrator')");
    expect(service).toContain('Cannot remove the last active Administrator');
    expect(actions).toContain('isLastAdministratorError');
    expect(actions).toContain('/administrators');
    expect(actions).not.toContain('/settings/administrators');
    expect(actions).not.toContain('teacher_accounts');
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
  it('makes new Teaching Assignments Class Subject scoped with no Group selector', () => {
    const schema = source(
      'src/features/teaching-assignments/teaching-assignment.schemas.ts'
    );
    const workspace = source(
      'src/features/teaching-assignments/teaching-assignment-workspace.tsx'
    );
    const teacherForm = source('src/features/teachers/teacher-form.tsx');
    const repository = source(
      'src/features/teaching-assignments/teaching-assignment.repository.ts'
    );

    expect(schema).not.toContain('subjectGroupId');
    expect(workspace).not.toContain('name="subjectGroupId"');
    expect(teacherForm).not.toContain('name="subjectGroupId"');
    expect(workspace).not.toContain("t('scope')");
    expect(workspace).not.toContain('scopeFor');
    expect(teacherForm).not.toContain("t('scope')");

    expect(repository).toContain("rpc('save_teaching_assignment'");
  });

  it('gives an assigned Teacher Subject Group management without Admin Class controls', () => {
    const managerPath =
      'src/features/classes/teacher-subject-group-manager.tsx';

    expect(
      existsSync(resolve(root, managerPath)),
      `${managerPath} should exist`
    ).toBe(true);

    if (!existsSync(resolve(root, managerPath))) return;

    const manager = source(managerPath);
    const actions = source('src/features/classes/class.actions.ts');
    const repository = source('src/features/classes/class.repository.ts');
    const myTeaching = source(
      'src/app/[locale]/(protected)/(teacher)/my-teaching/page.tsx'
    );

    expect(myTeaching).toContain('TeacherSubjectGroupManager');

    for (const actionName of [
      'createTeacherSubjectGroupAction',
      'renameTeacherSubjectGroupAction',
      'archiveTeacherSubjectGroupAction',
      'restoreTeacherSubjectGroupAction',
      'moveTeacherSubjectGroupStudentAction',
      'removeTeacherSubjectGroupStudentAction'
    ]) {
      expect(actions).toContain(`function ${actionName}`);
      expect(manager).toContain(actionName);
    }

    for (const rpcName of [
      'teacher_create_subject_group',
      'teacher_rename_subject_group',
      'teacher_archive_subject_group',
      'teacher_restore_subject_group',
      'teacher_move_subject_group_student',
      'teacher_remove_subject_group_student'
    ]) {
      expect(repository).toContain(`'${rpcName}'`);
    }

    expect(manager).toContain("t('ungrouped')");
    expect(manager).toContain("t('membershipHistory')");
    expect(manager).toContain('currentGroupId');
    expect(manager).toContain('startsOn');
    expect(manager).toContain('endsOn');

    expect(repository).toContain('listTeacherSubjectGroupManagement');

    expect(manager).not.toContain('setDefaultGroupAction');
    expect(manager).not.toContain('setSubjectActiveAction');
    expect(manager).not.toContain('updateSubjectAction');
  });

});
