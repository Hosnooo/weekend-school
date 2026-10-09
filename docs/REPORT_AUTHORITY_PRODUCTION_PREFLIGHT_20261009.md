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

## Verified restoration of production PUBLIC application data (October 9)

The operator exported the production database to a **private local folder outside Git**, with `roles.sql`, `schema.sql`, `data.sql`, and `SHA256SUMS`. Those exported files were not shared with the assistant. The isolated local restore runner verified all saved SHA256 checksums, then:

- Started a unique temporary Supabase PostgreSQL environment (review-only ports `5642x`).
- Imported the **actual production application schema** and 38 public-table COPY blocks from the original data export. The 33 Supabase-managed/non-public blocks were excluded from this **test copy only** because the local Auth schema differs.
- Validated **3 draft cycles, 21 draft V2 reports, 87 numeric Administrator corrections, 13 existing comment rows, 10 approval contexts and zero deliveries**.
- Applied both pending report-authority migrations to the real-data public-table clone.
- Compared pre-existing row counts and content hashes for report batches, approvals, report sources, Student overrides, reports, Teacher submissions and observations, dates, Students and groups, excluding only new columns; **PASS**, with original timestamps retained.
- Checked that saved Administrator approvals and existing nonempty Student text/comments remain authoritative after the upgrade; **PASS**.

**Scope limitation:** This verified PUBLIC application data restoration and additive migration value preservation. It is **not** a complete platform/Auth/Storage restore, a production deploy, or end-to-end finalization and guardian-email rendering. The full export remains private and unchanged. The timestamp-preservation migration change has passed the production-clone check but the standalone pgTAP run predates that tiny SQL change.

## Additional output-parity regression staged (requires verification)

After the last successful 450-test database run, a focused source review found that an Admin editing attendance while student comments were visible could unintentionally freeze inherited Teacher comments as Admin overrides. Draft PR #36 now stages a fix:
- Carry existing EN/AR comment authority flags into the Admin review workspace.
- Compare submitted comments against each editor's **originally displayed** comment, not the potentially newer Teacher source; unchanged inherited comments remain inherited, edited or deliberately cleared comments gain an explicit override.
- Persist those explicit flags atomically in the Admin RPC instead of marking every visible comment as overridden.
- Add unit checks for Teacher inheritance and rendering of approved bilingual fields, two groups sharing a subject, performance omission, comment visibility, and guardian email parity.

**These newest changes are NOT yet locally verified** by the user; repeat focused Vitest, TypeScript and disposable pgTAP, then (for release) restore and preservation check again because the migration SQL changed. This test coverage confirms output rendering for representative fixtures, not a complete browser-level dry-run against all three existing real cycles. No production migration, send or deploy.

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

**HOLD / DRAFT.** Code/build/database test suites passed. A private backup and production **public-data** restore / migration-preservation check passed. Full managed Auth/Storage restoration and production-like finalized-report / guardian-email parity remain unverified. No production database migration, data repair, merge, deployment, finalization or delivery has been performed as part of this work.

See [the full release contract](./REPORT_AUTHORITY_AND_NUMERIC_ATTENDANCE_RELEASE.md).
