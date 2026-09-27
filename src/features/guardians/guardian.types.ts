export type GuardianListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  reportLanguage: 'en' | 'ar' | 'both';
  isActive: boolean;
};

export type StudentGuardianLink = GuardianListItem & {
  isPrimary: boolean;
  receivesReports: boolean;
};

export type GuardianStudentLink = {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  isActive: boolean;
  isPrimary: boolean;
  receivesReports: boolean;
};

export type GuardianDetail = GuardianListItem & {
  students: GuardianStudentLink[];
};
