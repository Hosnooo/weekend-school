import type {AccountCapabilities} from '@/lib/auth/authorization';

export type AppRole='ADMIN'|'TEACHER';
export type NavigationMessageKey='dashboard'|'students'|'guardians'|'teachers'|'administrators'|'classesSubjects'|'teachingAssignments'|'reports'|'exportData'|'archives'|'settings'|'thisWeek'|'history'|'myProfile';
export type NavigationItem={href:string;messageKey:NavigationMessageKey};
export type NavigationSection={id:'administration'|'myTeaching';items:readonly NavigationItem[]};

const administrationItems:readonly NavigationItem[]=[
  {href:'/dashboard',messageKey:'dashboard'},
  {href:'/students',messageKey:'students'},
  {href:'/guardians',messageKey:'guardians'},
  {href:'/teachers',messageKey:'teachers'},
  {href:'/administrators',messageKey:'administrators'},
  {href:'/classes',messageKey:'classesSubjects'},
  {href:'/teaching-assignments',messageKey:'teachingAssignments'},
  {href:'/reports',messageKey:'reports'},
  {href:'/exports',messageKey:'exportData'},
  {href:'/archives',messageKey:'archives'},
  {href:'/settings',messageKey:'settings'}
];
const teachingItems:readonly NavigationItem[]=[
  {href:'/my-teaching',messageKey:'thisWeek'},
  {href:'/history',messageKey:'history'},
  {href:'/profile',messageKey:'myProfile'}
];

export function getNavigationSections(capabilities:AccountCapabilities):readonly NavigationSection[]{return[
  ...(capabilities.isAdmin?[{id:'administration' as const,items:administrationItems}]:[]),
  ...(capabilities.teacherIds.length>0?[{id:'myTeaching' as const,items:teachingItems}]:[])
];}

// Compatibility API retained for existing authorization/foundation callers. The rendered
// application navigation uses getNavigationSections() above.
const legacyAdminItems:readonly NavigationItem[]=[
  {href:'/dashboard',messageKey:'dashboard'},
  {href:'/classes',messageKey:'classesSubjects'},
  {href:'/students',messageKey:'students'},
  {href:'/teachers',messageKey:'teachers'},
  {href:'/reports',messageKey:'reports'},
  {href:'/settings',messageKey:'settings'}
];
const legacyTeacherItems:readonly NavigationItem[]=[
  {href:'/my-teaching',messageKey:'thisWeek'},
  {href:'/history',messageKey:'history'}
];
export function getNavigationItems(capabilities:AccountCapabilities):readonly NavigationItem[]{const items=[...(capabilities.isAdmin?legacyAdminItems:[]),...(capabilities.teacherIds.length>0?legacyTeacherItems:[])];return[...new Map(items.map((item)=>[item.href,item])).values()];}

export function getDefaultAuthenticatedRoute(capabilities:AccountCapabilities):'/dashboard'|'/my-teaching'|null{if(capabilities.isAdmin)return'/dashboard';if(capabilities.teacherIds.length>0)return'/my-teaching';return null;}
