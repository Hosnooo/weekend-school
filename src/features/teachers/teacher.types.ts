export type TeacherListItem = {
  id: string;
  authUserId: string;
  displayName: string;
  preferredLanguage: 'en' | 'ar';
  isActive: boolean;
  assignedGroups: Array<{id: string; nameEn: string; nameAr: string | null}>;
};
