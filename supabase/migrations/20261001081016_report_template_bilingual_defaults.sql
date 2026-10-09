alter table public.report_templates
  alter column main_report_label_en drop not null,
  alter column performance_label_en drop not null,
  alter column student_comment_label_en drop not null,
  alter column email_subject_en drop not null,
  alter column performance_enabled set default false;

update public.report_templates
set performance_enabled = false
where is_active;

alter table public.report_templates
  drop constraint if exists report_templates_main_report_label_pair_check,
  drop constraint if exists report_templates_performance_label_pair_check,
  drop constraint if exists report_templates_student_comment_label_pair_check,
  drop constraint if exists report_templates_email_subject_pair_check;

alter table public.report_templates
  add constraint report_templates_main_report_label_pair_check check (
    nullif(btrim(main_report_label_en), '') is not null
    or nullif(btrim(main_report_label_ar), '') is not null
  ),
  add constraint report_templates_performance_label_pair_check check (
    not performance_enabled
    or nullif(btrim(performance_label_en), '') is not null
    or nullif(btrim(performance_label_ar), '') is not null
  ),
  add constraint report_templates_student_comment_label_pair_check check (
    not student_comments_enabled
    or nullif(btrim(student_comment_label_en), '') is not null
    or nullif(btrim(student_comment_label_ar), '') is not null
  ),
  add constraint report_templates_email_subject_pair_check check (
    nullif(btrim(email_subject_en), '') is not null
    or nullif(btrim(email_subject_ar), '') is not null
  );
