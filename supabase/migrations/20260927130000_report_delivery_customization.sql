alter table public.report_student_overrides
  add column if not exists performance_overridden boolean not null default false;

update public.report_student_overrides
set performance_overridden = true
where performance is not null
  and performance_overridden = false;

alter table public.report_templates
  add column if not exists email_subject_en text not null
    default 'Student report — {{student_name}}',
  add column if not exists email_subject_ar text
    default 'تقرير الطالب — {{student_name}}',
  add column if not exists email_greeting_en text
    default 'Dear Parent/Guardian,',
  add column if not exists email_greeting_ar text
    default 'ولي الأمر الكريم،',
  add column if not exists email_message_en text
    default 'Please find below {{student_name}}''s report for {{period_start}} to {{period_end}}.',
  add column if not exists email_message_ar text
    default 'يرجى الاطلاع أدناه على تقرير {{student_name}} للفترة من {{period_start}} إلى {{period_end}}.',
  add column if not exists email_closing_en text
    default 'Regards,',
  add column if not exists email_closing_ar text
    default 'مع التحية،',
  add column if not exists email_signoff_en text
    default '{{school_name}}',
  add column if not exists email_signoff_ar text
    default '{{school_name}}';
