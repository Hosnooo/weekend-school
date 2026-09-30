const schoolDateParts = new Intl.DateTimeFormat('en', {
  timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date());
const schoolDatePart = (type: Intl.DateTimeFormatPartTypes) =>
  Number(schoolDateParts.find((part) => part.type === type)?.value);
const currentSchoolWeek = new Date(Date.UTC(
  schoolDatePart('year'), schoolDatePart('month') - 1, schoolDatePart('day'), 12
));
export const schoolToday = currentSchoolWeek.toISOString().slice(0, 10);
currentSchoolWeek.setUTCDate(currentSchoolWeek.getUTCDate() - (currentSchoolWeek.getUTCDay() + 6) % 7);

export const redesign = {
  classId: '11000000-0000-0000-0000-000000000001',
  wholeClassSubjectId: '13000000-0000-0000-0000-000000000001',
  groupedSubjectId: '13000000-0000-0000-0000-000000000002',
  blueGroupId: '14000000-0000-0000-0000-000000000001',
  greenGroupId: '14000000-0000-0000-0000-000000000002',
  archiveStudentId: 'e0000000-0000-0000-0000-000000000013',
  happyWeek: '2026-09-08',
  arabicWeek: '2026-09-15',
  exceptionWeek: '2026-09-22',
  authorizationWeek: '2026-09-01',
  conflictWeek: currentSchoolWeek.toISOString().slice(0, 10)
} as const;
