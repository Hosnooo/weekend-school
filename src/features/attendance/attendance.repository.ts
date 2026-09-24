import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {AttendanceContext, OfficialAttendanceStatus} from './attendance.types';

export async function resolveAttendanceConflict(
  context: AttendanceContext,
  status: OfficialAttendanceStatus
) {
  const supabase = await createServerSupabaseClient();
  const {error} = await supabase.rpc('resolve_attendance_conflict', {
    p_class_subject_id: context.classSubjectId,
    p_subject_group_id: context.subjectGroupId,
    p_week_start: context.weekStart,
    p_student_id: context.studentId,
    p_status: status
  });

  if (error) {
    throw new Error(`Unable to resolve attendance conflict: ${error.message}`);
  }
}
