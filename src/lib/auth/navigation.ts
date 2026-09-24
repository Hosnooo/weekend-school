import type {AccountCapabilities} from '@/lib/auth/authorization';

export type AppRole = 'ADMIN' | 'TEACHER';

export type NavigationItem = {
  href: string;
  messageKey:
    | 'dashboard'
    | 'classes'
    | 'students'
    | 'teachers'
    | 'reports'
    | 'settings'
    | 'myTeaching'
    | 'history';
};

const adminNavigation: readonly NavigationItem[] = [
  {href: '/dashboard', messageKey: 'dashboard'},
  {href: '/classes', messageKey: 'classes'},
  {href: '/students', messageKey: 'students'},
  {href: '/teachers', messageKey: 'teachers'},
  {href: '/reports', messageKey: 'reports'},
  {href: '/settings', messageKey: 'settings'}
];

const teacherNavigation: readonly NavigationItem[] = [
  {href: '/my-teaching', messageKey: 'myTeaching'},
  {href: '/history', messageKey: 'history'}
];

export function getNavigationItems(
  capabilities: AccountCapabilities
): readonly NavigationItem[] {
  return [
    ...(capabilities.isAdmin ? adminNavigation : []),
    ...(capabilities.teacherIds.length > 0 ? teacherNavigation : [])
  ];
}
