export type GuardianListItem = {
  id: string;
  name: string;
  email: string;
  reportLanguage: 'en' | 'ar' | 'both';
  isActive: boolean;
};
