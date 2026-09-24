export type TeacherListItem = {
  id: string;
  email: string | null;
  accountProfileId: string | null;
  authUserId: string | null;
  displayName: string;
  preferredLanguage: 'en' | 'ar';
  isActive: boolean;
  assignmentCount: number;
};
