export type AppRole = 'ADMIN' | 'TEACHER';

export type NavigationItem = {
  href: string;
  messageKey:
    | 'dashboard'
    | 'groups'
    | 'students'
    | 'teachers'
    | 'reports'
    | 'settings'
    | 'myGroups'
    | 'history';
};

const adminNavigation: readonly NavigationItem[] = [
  {href: '/dashboard', messageKey: 'dashboard'},
  {href: '/groups', messageKey: 'groups'},
  {href: '/students', messageKey: 'students'},
  {href: '/teachers', messageKey: 'teachers'},
  {href: '/reports', messageKey: 'reports'},
  {href: '/settings', messageKey: 'settings'}
];

const teacherNavigation: readonly NavigationItem[] = [
  {href: '/my-groups', messageKey: 'myGroups'},
  {href: '/history', messageKey: 'history'}
];

export function getNavigationItems(role: AppRole): readonly NavigationItem[] {
  return role === 'ADMIN' ? adminNavigation : teacherNavigation;
}
