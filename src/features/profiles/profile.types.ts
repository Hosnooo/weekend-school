import type {Locale} from '@/i18n/config';

export type Profile = {
  id: string;
  schoolId: string;
  displayName: string;
  preferredLanguage: Locale;
  isActive: boolean;
};
