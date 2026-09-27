import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';

import type {ReportTemplateInput} from './report-template.schemas';
import {
  defaultReportTemplateConfig,
  type ReportTemplateConfig
} from './report-template.types';

type ReportTemplateRow = {
  id: string;
  name: string;
  main_report_label_en: string;
  main_report_label_ar: string | null;
  main_report_help_en: string | null;
  main_report_help_ar: string | null;
  performance_enabled: boolean;
  performance_label_en: string;
  performance_label_ar: string | null;
  student_comments_enabled: boolean;
  student_comment_label_en: string;
  student_comment_label_ar: string | null;
  student_comment_help_en: string | null;
  student_comment_help_ar: string | null;
  intro_en: string | null;
  intro_ar: string | null;
  closing_en: string | null;
  closing_ar: string | null;
};

const columns = [
  'id',
  'name',
  'main_report_label_en',
  'main_report_label_ar',
  'main_report_help_en',
  'main_report_help_ar',
  'performance_enabled',
  'performance_label_en',
  'performance_label_ar',
  'student_comments_enabled',
  'student_comment_label_en',
  'student_comment_label_ar',
  'student_comment_help_en',
  'student_comment_help_ar',
  'intro_en',
  'intro_ar',
  'closing_en',
  'closing_ar'
].join(',');

function toConfig(row: ReportTemplateRow): ReportTemplateConfig {
  return {
    id: row.id,
    name: row.name,
    mainReportLabelEn: row.main_report_label_en,
    mainReportLabelAr: row.main_report_label_ar,
    mainReportHelpEn: row.main_report_help_en,
    mainReportHelpAr: row.main_report_help_ar,
    performanceEnabled: row.performance_enabled,
    performanceLabelEn: row.performance_label_en,
    performanceLabelAr: row.performance_label_ar,
    studentCommentsEnabled: row.student_comments_enabled,
    studentCommentLabelEn: row.student_comment_label_en,
    studentCommentLabelAr: row.student_comment_label_ar,
    studentCommentHelpEn: row.student_comment_help_en,
    studentCommentHelpAr: row.student_comment_help_ar,
    introEn: row.intro_en,
    introAr: row.intro_ar,
    closingEn: row.closing_en,
    closingAr: row.closing_ar
  };
}

function toRow(input: ReportTemplateInput) {
  return {
    name: input.name,
    main_report_label_en: input.mainReportLabelEn,
    main_report_label_ar: input.mainReportLabelAr,
    main_report_help_en: input.mainReportHelpEn,
    main_report_help_ar: input.mainReportHelpAr,
    performance_enabled: input.performanceEnabled,
    performance_label_en: input.performanceLabelEn,
    performance_label_ar: input.performanceLabelAr,
    student_comments_enabled: input.studentCommentsEnabled,
    student_comment_label_en: input.studentCommentLabelEn,
    student_comment_label_ar: input.studentCommentLabelAr,
    student_comment_help_en: input.studentCommentHelpEn,
    student_comment_help_ar: input.studentCommentHelpAr,
    intro_en: input.introEn,
    intro_ar: input.introAr,
    closing_en: input.closingEn,
    closing_ar: input.closingAr
  };
}

export async function getActiveReportTemplate(
  schoolId: string
): Promise<ReportTemplateConfig> {
  const db = await createServerSupabaseClient();

  const {data, error} = await db
    .from('report_templates')
    .select(columns)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return defaultReportTemplateConfig();

  return toConfig(data as unknown as ReportTemplateRow);
}

export async function saveActiveReportTemplate(
  schoolId: string,
  input: ReportTemplateInput
): Promise<void> {
  const db = await createServerSupabaseClient();

  const {data: active, error: activeError} = await db
    .from('report_templates')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (activeError) throw activeError;

  if (active) {
    const {error} = await db
      .from('report_templates')
      .update(toRow(input))
      .eq('school_id', schoolId)
      .eq('id', active.id);

    if (error) throw error;
    return;
  }

  const {data: existing, error: existingError} = await db
    .from('report_templates')
    .select('id')
    .eq('school_id', schoolId)
    .order('updated_at', {ascending: false})
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const {error} = await db
      .from('report_templates')
      .update({...toRow(input), is_active: true})
      .eq('school_id', schoolId)
      .eq('id', existing.id);

    if (error) throw error;
    return;
  }

  const {error} = await db.from('report_templates').insert({
    school_id: schoolId,
    ...toRow(input),
    is_active: true
  });

  if (error) throw error;
}
