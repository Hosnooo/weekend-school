import type {AppRole} from '@/lib/auth/navigation';
import type {Locale} from '@/i18n/config';

export type Profile = {
  id: string;
  schoolId: string;
  displayName: string;
  role: AppRole;
  preferredLanguage: Locale;
  isActive: boolean;
};
