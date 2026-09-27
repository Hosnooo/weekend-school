import type {AccountCapabilities} from '@/lib/auth/authorization';

export type AppRole = 'ADMIN' | 'TEACHER';

export type NavigationMessageKey =
  | 'dashboard'
  | 'students'
  | 'guardians'
  | 'teachers'
  | 'administrators'
  | 'classesSubjects'
  | 'teachingAssignments'
  | 'reports'
  | 'deliveryStatus'
  | 'exportData'
  | 'archives'
  | 'schoolSettings'
  | 'settings'
  | 'thisWeek'
  | 'history'
  | 'myProfile';

export type NavigationSectionId =
  | 'overview'
  | 'people'
  | 'school'
  | 'reports'
  | 'data'
  | 'settings'
  | 'myTeaching';

export type NavigationItem = {href: string; messageKey: NavigationMessageKey};
export type NavigationSection = {id: NavigationSectionId; items: readonly NavigationItem[]};

const administratorSections: readonly NavigationSection[] = [
  {id: 'overview', items: [{href: '/dashboard', messageKey: 'dashboard'}]},
  {
    id: 'people',
    items: [
      {href: '/students', messageKey: 'students'},
      {href: '/teachers', messageKey: 'teachers'},
      {href: '/administrators', messageKey: 'administrators'}
    ]
  },
  {
    id: 'school',
    items: [
      {href: '/classes', messageKey: 'classesSubjects'},
      {href: '/teaching-assignments', messageKey: 'teachingAssignments'}
    ]
  },
  {
    id: 'reports',
    items: [
      {href: '/reports', messageKey: 'reports'},
      {href: '/reports/delivery-status', messageKey: 'deliveryStatus'}
    ]
  },
  {
    id: 'data',
    items: [
      {href: '/exports', messageKey: 'exportData'},
      {href: '/archives', messageKey: 'archives'}
    ]
  },
  {id: 'settings', items: [{href: '/settings', messageKey: 'schoolSettings'}]}
];

const teachingSection: NavigationSection = {
  id: 'myTeaching',
  items: [
    {href: '/my-teaching', messageKey: 'thisWeek'},
    {href: '/history', messageKey: 'history'},
    {href: '/profile', messageKey: 'myProfile'}
  ]
};

export function getNavigationSections(capabilities: AccountCapabilities): readonly NavigationSection[] {
  return [
    ...(capabilities.isAdmin ? administratorSections : []),
    ...(capabilities.teacherIds.length > 0 ? [teachingSection] : [])
  ];
}

// Compatibility API retained for existing authorization/foundation callers.
const legacyAdminItems: readonly NavigationItem[] = [
  {href: '/dashboard', messageKey: 'dashboard'},
  {href: '/classes', messageKey: 'classesSubjects'},
  {href: '/students', messageKey: 'students'},
  {href: '/teachers', messageKey: 'teachers'},
  {href: '/reports', messageKey: 'reports'},
  {href: '/settings', messageKey: 'settings'}
];
const legacyTeacherItems: readonly NavigationItem[] = [
  {href: '/my-teaching', messageKey: 'thisWeek'},
  {href: '/history', messageKey: 'history'}
];

export function getNavigationItems(capabilities: AccountCapabilities): readonly NavigationItem[] {
  const items = [
    ...(capabilities.isAdmin ? legacyAdminItems : []),
    ...(capabilities.teacherIds.length > 0 ? legacyTeacherItems : [])
  ];
  return [...new Map(items.map((item) => [item.href, item])).values()];
}

export function getDefaultAuthenticatedRoute(
  capabilities: AccountCapabilities
): '/dashboard' | '/my-teaching' | null {
  if (capabilities.isAdmin) return '/dashboard';
  if (capabilities.teacherIds.length > 0) return '/my-teaching';
  return null;
}
