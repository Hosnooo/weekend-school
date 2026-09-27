import 'server-only';

import {
  listTeachingAssignments,
  listTeachingClassSubjects
} from '@/features/teaching-assignments/teaching-assignment.repository';
import {expandEffectiveTeachingContexts} from '@/features/teaching-assignments/teaching-assignment.service';
import type {EffectiveTeachingContext} from '@/features/teaching-assignments/teaching-assignment.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {toDatabasePayload} from './weekly-update.model';
import type {WeeklyUpdateInput} from './weekly-update.schemas';
import type {
  HistoryItem,
  RosterStudent,
  TeachingCard,
  TeachingContext,
  WeeklySubmission
} from './weekly-update.types';

const contextKey = (teacherId: string, classSubjectId: string, subjectGroupId: string | null) =>
  `${teacherId}:${classSubjectId}:${subjectGroupId ?? 'whole'}`;
const sameContext = (context: TeachingContext, classSubjectId: string, subjectGroupId: string | null) =>
  context.classSubjectId === classSubjectId && context.subjectGroupId === subjectGroupId;

function toContext(context: EffectiveTeachingContext): TeachingContext {
  return {...context};
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function loadEffectiveContextsForTeachers(schoolId: string, teacherIds: string[], onDate: string) {
  if (teacherIds.length === 0) return [];
  const classSubjects = await listTeachingClassSubjects(schoolId);
  const assignments = await Promise.all(teacherIds.map((teacherId) =>
    listTeachingAssignments(schoolId, teacherId)
  ));
  return teacherIds.flatMap((teacherId, index) =>
    expandEffectiveTeachingContexts({teacherId, assignments: assignments[index] ?? [], classSubjects, onDate})
  );
}

async function loadWeeklyContexts(schoolId: string, teacherId: string, weekStart: string) {
  const [classSubjects, assignments] = await Promise.all([
    listTeachingClassSubjects(schoolId),
    listTeachingAssignments(schoolId, teacherId)
  ]);
  const contexts = new Map<string, EffectiveTeachingContext>();
  for (let day = 0; day < 7; day++) {
    for (const context of expandEffectiveTeachingContexts({
      teacherId,
      assignments,
      classSubjects,
      onDate: addDays(weekStart, day)
    })) {
      contexts.set(contextKey(context.teacherId, context.classSubjectId, context.subjectGroupId), context);
    }
  }
  return [...contexts.values()];
}

async function loadRoster(
  classSubjectId: string,
  subjectGroupId: string | null,
  onDate: string
): Promise<RosterStudent[]> {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.rpc('get_weekly_submission_roster', {
    p_class_subject_id: classSubjectId,
    p_subject_group_id: subjectGroupId,
    p_on_date: onDate
  });
  if (error) throw error;
  return (data as Array<{
    student_id: string;
    first_name_en: string;
    last_name_en: string;
    first_name_ar: string | null;
    last_name_ar: string | null;
  }>).map((row) => ({
    id: row.student_id,
    nameEn: `${row.first_name_en} ${row.last_name_en}`,
    nameAr: row.first_name_ar && row.last_name_ar ? `${row.first_name_ar} ${row.last_name_ar}` : null
  }));
}

type HistoricalContextRow = {
  class_subject_id: string;
  subject_group_id: string | null;
  class_name_en: string;
  class_name_ar: string | null;
  subject_name_en: string;
  subject_name_ar: string | null;
  group_name_en: string | null;
  group_name_ar: string | null;
};

async function loadHistoricalContext(submissionId: string, teacherId: string): Promise<TeachingContext | null> {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.rpc('get_weekly_submission_context', {p_submission_id: submissionId});
  if (error) throw error;
  const row = (data as HistoricalContextRow[] | null)?.[0];
  if (!row) return null;
  return {
    teacherId,
    classSubjectId: row.class_subject_id,
    subjectGroupId: row.subject_group_id,
    classNameEn: row.class_name_en,
    classNameAr: row.class_name_ar,
    subjectNameEn: row.subject_name_en,
    subjectNameAr: row.subject_name_ar,
    groupNameEn: row.group_name_en,
    groupNameAr: row.group_name_ar
  };
}

export async function getSchoolTimezone(schoolId: string) {
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('schools').select('timezone').eq('id', schoolId).single();
  if (error) throw error;
  return data.timezone as string;
}

export async function canTeachWeeklyContext(
  schoolId: string,
  teacherId: string,
  classSubjectId: string,
  subjectGroupId: string | null,
  weekStart: string
) {
  const contexts = await loadWeeklyContexts(schoolId, teacherId, weekStart);
  return contexts.some((context) => sameContext(context, classSubjectId, subjectGroupId));
}

export async function listMyTeaching(
  schoolId: string,
  teacherIds: string[],
  onDate: string,
  weekStart: string
): Promise<TeachingCard[]> {
  const db = await createServerSupabaseClient();
  const contexts = await loadEffectiveContextsForTeachers(schoolId, teacherIds, onDate);
  if (contexts.length === 0) return [];
  const {data, error} = await db.from('weekly_submissions')
    .select('id,teacher_id,class_subject_id,subject_group_id,status')
    .eq('school_id', schoolId)
    .in('teacher_id', teacherIds)
    .eq('week_start', weekStart);
  if (error) throw error;
  const submissions = new Map((data as Array<{
    id: string;
    teacher_id: string;
    class_subject_id: string;
    subject_group_id: string | null;
    status: 'DRAFT' | 'SUBMITTED';
  }>).map((row) => [contextKey(row.teacher_id, row.class_subject_id, row.subject_group_id), row]));

  return Promise.all(contexts.map(async (context) => {
    const submission = submissions.get(contextKey(context.teacherId, context.classSubjectId, context.subjectGroupId));
    const roster = await loadRoster(context.classSubjectId, context.subjectGroupId, weekStart);
    return {
      ...toContext(context),
      studentCount: roster.length,
      weekStart,
      submissionId: submission?.id ?? null,
      status: submission?.status ?? 'MISSING'
    };
  }));
}

export async function listTeacherHistory(schoolId: string, teacherIds: string[]): Promise<HistoryItem[]> {
  if (teacherIds.length === 0) return [];
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('weekly_submissions')
    .select('id,teacher_id,week_start,submitted_at')
    .eq('school_id', schoolId)
    .in('teacher_id', teacherIds)
    .eq('status', 'SUBMITTED')
    .order('week_start', {ascending: false});
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const history = await Promise.all((data as Array<{
    id: string;
    teacher_id: string;
    week_start: string;
    submitted_at: string | null;
  }>).map(async (row): Promise<HistoryItem | null> => {
    const context = await loadHistoricalContext(row.id, row.teacher_id);
    return context ? {...context, id: row.id, weekStart: row.week_start, submittedAt: row.submitted_at} : null;
  }));
  return history.filter((item): item is HistoryItem => item !== null);
}

export async function getWeeklySubmission(
  schoolId: string,
  teacherId: string,
  classSubjectId: string,
  subjectGroupId: string | null,
  weekStart: string
): Promise<WeeklySubmission | null> {
  const contexts = await loadWeeklyContexts(schoolId, teacherId, weekStart);
  const effective = contexts.find((context) => sameContext(context, classSubjectId, subjectGroupId));
  if (!effective) return null;
  const roster = await loadRoster(classSubjectId, subjectGroupId, weekStart);
  const db = await createServerSupabaseClient();
  let query = db.from('weekly_submissions')
    .select('id,status,progress_en,progress_ar,default_performance,weekly_submission_students(student_id,attendance_status,performance_override,comment_en,comment_ar)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('class_subject_id', classSubjectId)
    .eq('week_start', weekStart);
  query = subjectGroupId === null ? query.is('subject_group_id', null) : query.eq('subject_group_id', subjectGroupId);
  const {data, error} = await query.maybeSingle();
  if (error) throw error;
  const submission = data as unknown as null | {
    id: string;
    status: 'DRAFT' | 'SUBMITTED';
    progress_en: string | null;
    progress_ar: string | null;
    default_performance: WeeklySubmission['defaultPerformance'];
    weekly_submission_students: Array<{
      student_id: string;
      attendance_status: WeeklySubmission['attendance'][number]['status'];
      performance_override: WeeklySubmission['defaultPerformance'];
      comment_en: string | null;
      comment_ar: string | null;
    }>;
  };
  const students = submission?.weekly_submission_students ?? [];
  return {
    ...toContext(effective),
    id: submission?.id ?? '',
    weekStart,
    status: submission?.status ?? 'DRAFT',
    progressEn: submission?.progress_en ?? null,
    progressAr: submission?.progress_ar ?? null,
    defaultPerformance: submission?.default_performance ?? null,
    roster,
    attendance: students.map((row) => ({studentId: row.student_id, status: row.attendance_status})),
    exceptions: students.flatMap((row) => row.performance_override || row.comment_en || row.comment_ar ? [{
      studentId: row.student_id,
      performanceOverride: row.performance_override,
      commentEn: row.comment_en,
      commentAr: row.comment_ar
    }] : [])
  };
}

export async function getWeeklySubmissionById(schoolId: string, teacherIds: string[], id: string) {
  if (teacherIds.length === 0) return null;
  const db = await createServerSupabaseClient();
  const {data, error} = await db.from('weekly_submissions')
    .select('teacher_id,class_subject_id,subject_group_id,week_start')
    .eq('school_id', schoolId)
    .in('teacher_id', teacherIds)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getWeeklySubmission(
    schoolId,
    data.teacher_id as string,
    data.class_subject_id as string,
    data.subject_group_id as string | null,
    data.week_start as string
  );
}

export async function saveWeeklyUpdate(input: WeeklyUpdateInput) {
  const db = await createServerSupabaseClient();
  const payload = toDatabasePayload(input.attendance, input.exceptions);
  const {data, error} = await db.rpc('save_weekly_submission', {
    p_teacher_id: input.teacherId,
    p_submission_id: input.submissionId,
    p_class_subject_id: input.classSubjectId,
    p_subject_group_id: input.subjectGroupId,
    p_week_start: input.weekStart,
    p_progress_en: input.progressEn ?? '',
    p_progress_ar: input.progressAr ?? '',
    p_default_performance: input.defaultPerformance,
    p_attendance: payload.attendance,
    p_exceptions: payload.exceptions,
    p_submit: input.intent === 'submit'
  });
  if (error) throw error;
  return data as string;
}


export async function reopenWeeklySubmission(
  submissionId: string
) {
  const db = await createServerSupabaseClient();

  const {error} = await db.rpc(
    'reopen_weekly_submission',
    {
      p_submission_id: submissionId
    }
  );

  if (error) throw error;
}
