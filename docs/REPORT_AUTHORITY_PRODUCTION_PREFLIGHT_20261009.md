# Report authority release: production preflight

**Date:** 2026-10-09. **Environment:** existing production Supabase project; **READ ONLY**.  
**Release:** Draft PR #36 `review/admin-authoritative-reports-numeric-attendance-20261009` (not merged).  
**Privacy:** This document contains only aggregate counts, no student/guardian records.

## Test evidence (user's isolated local worktree)

- Focused Vitest: **52 / 52 passed**.
- Entire Vitest suite: **123 files, 523 / 523 tests passed**.
- Critical-error tests: **33 / 33 passed**.
- ESLint, TypeScript, Next.js production build: **passed**.
- Isolated disposable Supabase migration replay: **all migrations applied**, including `20261009090000_numeric_teacher_attendance.sql` and `20261009091000_admin_approved_reports_atomic.sql`.
- pgTAP: **34 files, 450 tests, PASS**.
- **Coverage gap:** These are primarily unit, schema-contract and disposable-seed regression tests. They do **not** constitute a proof of correct re-finalization against a restored production copy or complete end-to-end Admin/Teacher/browser behavior.

## Read-only production snapshot (queried October 9)

| Check | Count |
| --- | ---: |
| Open CLASS/DRAFT report cycles | 3 |
| Stored DRAFT V2 reports | 21 |
| Student report snapshot sections across those reports | 62 |
| Saved per-student Admin attended/total pairs | 87 |
| Rows with saved per-student Admin comments | 13 |
| Report approval contexts | 10 |
| Email delivery records | **0** |
| New numeric Teacher attendance migration applied | **No** |
| New atomic Admin approval migration applied | **No** |

### Group-aware snapshot reconciliation

Read-only comparison of each of the 62 saved V2 snapshot sections against an approval matched by **batch ID + class subject ID + subject group name** (with a school-scoped group ID lookup).

| Check | Count |
| --- | ---: |
| Snapshot sections with zero approval context matches | **0** |
| Snapshot sections with multiple matches | **0** |
| Sections with an Admin numeric attendance pair | **62** |
| Sections where stored attendance differs from saved Admin counts | **36** |
| Sections where stored shared English/Arabic progress differs from approved text | **18** |

**Interpretation:** Old DRAFT report snapshots are out of date. Administrator correction records still exist and must be used as the source of truth. Do **not** patch existing `snapshot_json` in place, bulk-clear overrides, or reinterpret historical binary Teacher entries as six sessions. A future finalized revision should be built from the live, cycle-specific, group-specific approved values. The 25 remaining saved attendance pairs are not automatically orphaned: the third cycle has no stored reports yet and must be separately included when verifying the live resolver.

**Limit:** This SQL comparison does not prove parity for saved comments/performance, behavior on partial-coverage sources, intentional blank overrides or rendering in guardian email. A restored-production dry run and field-by-field check are required.

## Preconditions to any production changes

1. **Confirm exclusive release window.** No Admin editing/finalization/delivery and no Teacher updates during snapshot/migration/data repair. Verify pending email jobs separately; zero delivery rows alone is not a job lock.
2. **Create a recoverable backup** of the production database using an independently verifiable Supabase/pg_dump backup facility. Keep it out of GitHub, PR comments, chat logs and other publicly accessible locations. Include all of: school/Student/Guardian membership state; report batches, section approvals, source inclusion, overrides, report snapshots/revisions, Teacher submissions and observations, weekly dates, and delivery queue/history. Verify the restore works in an isolated database **before any DDL**.
3. Run the exact preflight queries again and compare the counts + group-aware diff. Reconcile any changes from the 2026-10-09 baseline before proceeding.
4. Run migration and report-preview/finalization **against a restored or sanitized production fixture**, including the third cycle, cross-group shared class-subject, 87 saved attendance pairs, 13 comment overrides, 10 approvals, intentional blanks and both languages.
5. Validate each approved Student report field matches the Admin editor, live parent preview, V2 snapshot and rendered email. Do not send emails in the test.
6. Ensure finalization is revision-preserving; no modification of historical `reports.snapshot_json` rows. Newly generated revisions must be the only actionable versions for delivery.
7. Prepare a rollback plan: maintain the old application release, and know how to restore both schema and data from the verified backup. A database downgrade by dropping new columns is **not** acceptable because it risks losing post-deploy numeric submissions.
8. After sign-off, apply forward-only migrations **once**, deploy application **once**, verify read-only production counts and representative approved preview parity, then separately resume approval/finalization/delivery.

## Release decision

**HOLD / DRAFT.** Code/build/database test suites passed. Backup and verified restore not yet performed; production-like end-to-end parity not verified. No production database migration, data repair, merge, deployment, finalization or delivery has been performed as part of this work.

See [the full release contract](./REPORT_AUTHORITY_AND_NUMERIC_ATTENDANCE_RELEASE.md).
