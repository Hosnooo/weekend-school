begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into public.reports(id,school_id,student_id,period_start,period_end,language,status,snapshot_json)
values
 ('da000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','2026-10-01','2026-10-11','both','READY','{}'),
 ('da000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002','2026-10-01','2026-10-11','both','READY','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',true);
select lives_ok($probe$
 select public.reserve_report_delivery('da000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','brevo')
$probe$,'English-preferring guardian is eligible for bilingual reports');
select is((public.reserve_report_delivery('da000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','brevo')->>'should_send'),'false','Pending delivery is not automatically resent');
select is((public.reserve_report_delivery('da000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','brevo')->>'requires_reconciliation'),'true','Pending delivery requires reconciliation');
select lives_ok($probe$
 select public.reserve_report_delivery('da000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','brevo')
$probe$,'Arabic-preferring guardian is eligible for bilingual reports');
select * from finish();
rollback;
