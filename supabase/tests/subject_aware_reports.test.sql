begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_table('public','report_templates','report templates table exists');
select has_table('public','report_batches','report batches table exists');
select has_table('public','report_section_approvals','subject approval table exists');
select has_table('public','report_section_sources','approval source links table exists');
select has_table('public','report_student_overrides','student-specific report overrides table exists');

select has_column('public','reports','batch_id','reports link to a report batch');
select has_column('public','reports','revision','reports carry a revision number');
select has_column('public','reports','supersedes_report_id','report corrections link to the prior revision');
select has_column('public','reports','snapshot_version','reports record their immutable snapshot version');
select has_column('public','reports','finalized_at','reports record when the snapshot was finalized');

select has_function('public','finalize_report_batch','batch finalization is transactional');
select has_function('public','create_report_revision','report corrections create a new revision');
select has_trigger('public','reports','reports_finalized_snapshot_immutable','finalized report snapshots are database-immutable');

select * from finish();
rollback;
