begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);

insert into public.students (id, school_id, first_name_en, last_name_en)
values ('e0000000-0000-0000-0000-000000000013',
  'a0000000-0000-0000-0000-000000000001', 'Transfer', 'Fixture');
insert into public.groups (id, school_id, name_en)
values
  ('d0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001', 'Transfer source'),
  ('d0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001', 'Transfer target');
insert into public.group_memberships (school_id, group_id, student_id, starts_on)
values ('a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000005',
  'e0000000-0000-0000-0000-000000000013', '2026-09-01');
insert into public.students (id, school_id, first_name_en, last_name_en)
values ('e0000000-0000-0000-0000-000000000014',
  'a0000000-0000-0000-0000-000000000001', 'Submitted', 'Fixture');
insert into public.group_memberships (school_id, group_id, student_id, starts_on)
values ('a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000005',
  'e0000000-0000-0000-0000-000000000014', '2026-09-01');

select throws_ok(
  $$insert into public.group_memberships (school_id, group_id, student_id, starts_on)
    values (
      'a0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000006',
      'e0000000-0000-0000-0000-000000000013',
      '2026-09-20'
    )$$,
  '23P01',
  'conflicting key value violates exclusion constraint "group_memberships_one_group_per_student"',
  'one student cannot hold overlapping group memberships'
);

select lives_ok(
  $$select public.move_student_group(
    'e0000000-0000-0000-0000-000000000013',
    'd0000000-0000-0000-0000-000000000006',
    '2026-09-22'
  )$$,
  'admin can transfer a student with one atomic operation'
);

select throws_ok(
  $$select public.move_student_group(
    'e0000000-0000-0000-0000-000000000014',
    'd0000000-0000-0000-0000-000000000002',
    '2026-09-01'
  )$$,
  '55000',
  'submitted session depends on target membership',
  'backdated transfer cannot add a student to an already submitted roster'
);

select throws_ok(
  $$update public.group_memberships
    set ends_on = '2026-09-01'
    where id = '90000000-0000-0000-0000-000000000001'$$,
  '55000',
  'submitted session depends on prior membership',
  'direct roster edits cannot remove a student from a submitted session'
);

select * from finish();
rollback;
