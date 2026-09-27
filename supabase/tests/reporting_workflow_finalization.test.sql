begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

select has_column(
  'public', 'report_templates', 'main_report_label_en',
  'report template has English main-report label'
);

select has_column(
  'public', 'report_templates', 'main_report_label_ar',
  'report template has Arabic main-report label'
);

select has_column(
  'public', 'report_templates', 'main_report_help_en',
  'report template has English main-report help'
);

select has_column(
  'public', 'report_templates', 'main_report_help_ar',
  'report template has Arabic main-report help'
);

select has_column(
  'public', 'report_templates', 'performance_enabled',
  'report template can enable or disable performance'
);

select has_column(
  'public', 'report_templates', 'performance_label_en',
  'report template has English performance label'
);

select has_column(
  'public', 'report_templates', 'performance_label_ar',
  'report template has Arabic performance label'
);

select has_column(
  'public', 'report_templates', 'student_comments_enabled',
  'report template can enable or disable student comments'
);

select has_column(
  'public', 'report_templates', 'student_comment_label_en',
  'report template has English student-comment label'
);

select has_column(
  'public', 'report_templates', 'student_comment_label_ar',
  'report template has Arabic student-comment label'
);

select has_column(
  'public', 'report_templates', 'student_comment_help_en',
  'report template has English student-comment help'
);

select has_column(
  'public', 'report_templates', 'student_comment_help_ar',
  'report template has Arabic student-comment help'
);

select has_index(
  'public',
  'report_templates',
  'report_templates_one_active_per_school_idx',
  'a school can have at most one active report template'
);

select * from finish();
rollback;
