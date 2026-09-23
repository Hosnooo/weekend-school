export type StudentListItem = {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  isActive: boolean;
  currentClass: {id: string; nameEn: string; nameAr: string | null} | null;
};
