/**
 * Validate a student's attendance correction as a single pair.
 * Blank + blank means "use teacher/source attendance"; one blank is invalid.
 */
export function attendanceInputIssue(formData: FormData) {
  for (const studentId of formData.getAll('studentId').map(String)) {
    const attended = String(formData.get(`attendanceAttended:${studentId}`) ?? '').trim();
    const total = String(formData.get(`attendanceTotal:${studentId}`) ?? '').trim();
    if (!attended && !total) continue;
    if (!attended || !total) return {studentId, reason: 'attendanceIncomplete' as const};
    const a = Number(attended);
    const t = Number(total);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(t) || a < 0 || t < 0) {
      return {studentId, reason: 'attendanceInvalid' as const};
    }
    if (a > t) return {studentId, reason: 'attendanceExceeds' as const};
  }
  return null;
}
