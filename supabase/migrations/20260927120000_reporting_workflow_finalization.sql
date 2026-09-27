-- Finalize the school-wide configurable reporting template.
-- Existing report templates, report batches, snapshots, and delivery history
-- remain intact.

alter table public.report_templates
  add column main_report_label_en text
    not null
    default 'Main report'
    check (length(trim(main_report_label_en)) > 0),
  add column main_report_label_ar text
    default 'التقرير الرئيسي',
  add column main_report_help_en text
    default 'Describe what was covered and the group''s progress.',
  add column main_report_help_ar text
    default 'اذكر ما تمت تغطيته وتقدم الصف أو المجموعة.',
  add column performance_enabled boolean
    not null
    default true,
  add column performance_label_en text
    not null
    default 'Performance'
    check (length(trim(performance_label_en)) > 0),
  add column performance_label_ar text
    default 'الأداء',
  add column student_comments_enabled boolean
    not null
    default true,
  add column student_comment_label_en text
    not null
    default 'Additional student comment'
    check (length(trim(student_comment_label_en)) > 0),
  add column student_comment_label_ar text
    default 'ملاحظة إضافية للطالب',
  add column student_comment_help_en text
    default 'Add a comment only when this student needs an individual note.',
  add column student_comment_help_ar text
    default 'أضف ملاحظة فقط عندما يحتاج هذا الطالب إلى ملاحظة فردية.';

-- The old schema allowed multiple active templates because there was no
-- administrator-facing template editor. Preserve every row but retain only
-- the most recently updated active row when legacy duplicates exist.
with ranked_active as (
  select
    id,
    row_number() over (
      partition by school_id
      order by updated_at desc, created_at desc, id
    ) as active_rank
  from public.report_templates
  where is_active
)
update public.report_templates template
set is_active = false
from ranked_active ranked
where template.id = ranked.id
  and ranked.active_rank > 1;

create unique index report_templates_one_active_per_school_idx
  on public.report_templates (school_id)
  where is_active;
