import 'server-only';

import {todayInTimeZone} from '@/features/weekly-updates/weekly-update.model';
import {createServerSupabaseClient} from '@/lib/supabase/server';

import {schoolWeekForDate, summarizeGroupSubmissions} from './dashboard.model';

export async function getDashboardSummary(schoolId: string, now = new Date()) {
  const db = await createServerSupabaseClient();
  const {data: school, error: schoolError} = await db
    .from('schools')
    .select('name_en,name_ar,timezone')
    .eq('id', schoolId)
    .single();
  if (schoolError) throw schoolError;

  const week = schoolWeekForDate(todayInTimeZone(school.timezone, now));
  const [students, teachers, activeGroups, submissions] = await Promise.all([
    db.from('students').select('id', {count: 'exact', head: true}).eq('school_id', schoolId).eq('is_active', true),
    db.from('profiles').select('id', {count: 'exact', head: true}).eq('school_id', schoolId).eq('role', 'TEACHER').eq('is_active', true),
    db.from('groups').select('id,name_en,name_ar').eq('school_id', schoolId).eq('is_active', true).order('name_en'),
    db.from('sessions').select('group_id').eq('school_id', schoolId).eq('status', 'SUBMITTED').gte('session_date', week.start).lte('session_date', week.end)
  ]);
  if (students.error) throw students.error;
  if (teachers.error) throw teachers.error;
  if (activeGroups.error) throw activeGroups.error;
  if (submissions.error) throw submissions.error;

  const activity = summarizeGroupSubmissions(
    activeGroups.data.map((group) => ({id: group.id, nameEn: group.name_en, nameAr: group.name_ar})),
    submissions.data
  );
  return {
    schoolNameEn: school.name_en,
    schoolNameAr: school.name_ar,
    studentCount: students.count ?? 0,
    teacherCount: teachers.count ?? 0,
    groupCount: activity.groups.length,
    ...week,
    ...activity
  };
}
