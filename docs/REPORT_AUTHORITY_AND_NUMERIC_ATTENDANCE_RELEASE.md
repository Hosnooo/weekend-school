> **Historical review record (October 9, 2026).** Some checklists and
> test gaps described below were written **before** the successful restored-
> production test runs. The canonical current evidence is in
> [Auth recovery and release gate](./REPORT_AUTH_RECOVERY_POLICY_AND_RELEASE_GATE_20261009.md)
> and the latest PR #36 description. As of the final local test run,
> the 29-report content/email parity, actual SQL save/finalization/rollback,
> six-user core Auth restore, and Administrator/Teacher browser smoke **passed**.
> Full managed Auth session/configuration recovery was **not** rehearsed.
> Do not interpret this historical document's unchecked tests as newly
> required reruns unless the tested files or operational requirements change.
>
# Report authority and numeric attendance — coordinated release contract

Status: **IN PROGRESS / NOT APPROVED FOR PRODUCTION**  
Base: `main` at `46bfea9db8e5e6995343b80ea0dd8d75301d0f42`  
Review branch: `review/admin-authoritative-reports-numeric-attendance-20261009`

## User-facing requirements (all mandatory)

1. **No Present / Absent editing behavior anywhere in new Teacher submissions.** Teachers enter **attended sessions / total sessions**, e.g. 4 / 6, per student for each Teaching Update. Both are nonnegative integers, attended <= total. Teachers may use a class-wide total-session default and mark all attended, then adjust individual students.
2. **Administrator corrections are authoritative for their particular Report Cycle, class subject, group and student.** The Report Cycle editor, submitted/approved report views, live Parent Email Review, finalized snapshot and eventual sent email must resolve to the **same approved value** for attendance, shared report text (English/Arabic), individual text/comments, and performance.
3. **Teacher-submitted content is provenance, not a second competing approved report.** Keep original submissions immutable as the audit/source layer; the normal *approved-report* view must display the Administrator's authoritative version when approved. Where one Teaching Update is linked to several Report Cycles, show the associated cycle explicitly; do not globally rewrite every report for one Teacher submission.
4. **Administrators can VIEW and EDIT submitted content without entering a cycle by accident.** A direct read-only View action opens approved report detail. Edit links to the correct cycle/context and respects the existing immutable-after-delivery rules. Submitted Teaching Update view must show its source alongside any cycle-specific approved version without misleadingly labeling Teacher source text as final.
5. **Performance is optional from Teacher to email.** Teacher-wide and per-student performance selections are optional and may stay null. Admin may inherit the Teacher's rating, choose a specific different rating, or explicitly choose **Omit performance**, even if Teacher gave a rating. A null effective rating results in **no Performance section** in guardian preview/finalized email (not a "Not rated" placeholder). The school report template may disable the entire category, without destroying stored historical ratings or saved Admin choices. Explicit Admin omission is represented by `performance_overridden = true` with `performance = null`, distinct from inheritance (`false`, `null`).
6. **Preserve all production data and manual work.** Existing corrections, text, performance, comments, included source selections, dated roster history, report revisions and unsent draft report snapshots must not be lost.
7. **No sending, no production rewrites, no main merge until verification.** Keep CI manual-only; do not use Vercel deployments to test.

## Verified production audit baseline (read-only)

As of October 9, 2026 UTC:
- **3** Class Report Cycles, each `DRAFT`, period 2026-09-19 through 2026-10-04.
- **21** existing `DRAFT` V2 reports in the first two cycles, **0** email deliveries.
- **87** saved student attendance override pairs; **13** student comment override rows; **10** subject/context approval rows with shared approved text (4 + 3 + 3).
- Cycle 1: 24 saved numeric pairs (totals 2..6), 8 draft reports; cycle 2: 39 numeric pairs (totals 6), 13 draft reports; cycle 3: 24 numeric pairs (totals 6), no generated reports.
- A read-only unambiguous subject match identified **16 stale** attendance fields in cycle 1 and **13 stale** fields in cycle 2. Some subject/group contexts have identical `class_subject_id`; **never** repair using subject ID alone.
- In cycle 2, **13** subject snapshot sections had shared report text differing from approved text.
- Existing `weekly_submission_students.attendance_status` is a required enum and existing SQL RPCs persist `PRESENT`/`ABSENT`, not session counts.

### Immediate implications

- Do not confuse `reports.snapshot_json` (an immutable-at-finalization draft/revision snapshot) with `report_student_overrides` (current unsent-cycle Administrator corrections).
- Do not compare report snapshots by only student + subject: the context identity also requires `batch_id`, `class_subject_id`, and `subject_group_id`.
- Do not overwrite the original Teacher observation history when fixing an approved Report Cycle.
- Do not assume source observations supply the number of lessons from `coverage_kind=RANGE` or calendar days. Teacher provides the actual **total sessions held**.
- Do not convert unknown legacy Present/Absent observations into 6 sessions, or infer attendance in a reporting period from planned classes.

## Effective approval model

One shared resolver, consumed by editor/preview/finalization/email/submitted report display:

- Resolve an Admin approval by `(school, batch, classSubject, nullable group, student)`.
- If a field is explicitly approved/overridden by Admin, use that value, **including intentional blank**.
- Otherwise fall back to selected Teacher source data, never to an unrelated draft snapshot.
- Store explicit authority/override state separately from value-nullability. Null cannot simultaneously mean *clear* and *inherit*. Legacy saved non-null Administrator values remain authoritative by default.
- Preserve source-selection provenance and manual edits if a source is toggled or a new Teacher submission arrives. Source reset requires an explicit, separately confirmed action.
- Aggregate numeric Teacher sessions using actual coverage dates/session identity; overlapping or conflicting coverage must be surfaced for review, **not silently summed**. Admin's explicitly approved report pair wins even when source coverage is unresolved.
- Shared approved text must not revert when `partialCoverage` changes or `approveAllSubmittedSources` runs.
- Prefer one transaction for complete Admin editor saves, with optimistic revision/stale-editor checks. Do not silently create a partial state where only some student fields persisted.

## Numeric Teacher attendance model

- Use a **forward-only** migration with nullable integer `attendance_attended` and `attendance_total` (both null or both integers satisfying 0 <= attended <= total); deprecate the old status as a **legacy internal field**. Do not drop it until old RPCs and all read paths are migrated.
- For new numeric observations, both integers required before submission, allowed to remain blank in a draft. Historic enum observation may be read as 1/1 or 0/1 *only where it truly represents one recorded session*; unknown multi-session history is marked **legacy/incomplete** rather than silently reinterpreted.
- Update `save_teaching_update_draft` and `submit_teaching_update` atomically and under the same role/RLS protections. Cover UI Editor (including readonly submitted history), action schemas, repository payloads, conflict resolution, aggregate reporting, and older weekly-update references.
- Define a uniform empty numeric draft state and validation in English and Arabic. No new Teacher form displays Present/Absent selection or 'Mark all present' as a status operation; a shortcut to set attended = total is permitted.
- No invented total from date range, covered dates, or report period; Teacher supplies total for the covered update.

## Admin Submitted Reports navigation

- Teacher submission history and approved reports are *different objects*. Make the distinction visible.
- Admin Submitted Teaching Updates gets a read-only 'View submission' detail including Teacher original progress, student counts, numeric attendance, and any linked approved Report Cycles. Never require reopening a submitted Teacher update simply to view it.
- Admin Reports history has direct 'View report' to a report snapshot/preview and 'Edit report' to the matching **unsent** cycle/context; prevent edits after any report delivery begins.
- Teacher's original `SUBMITTED` record is not rewritten to contain Administrator edits. A cycle-specific approved report displays them, and any "approved version" shortcut from Teacher history must resolve the particular cycle.

## Safe repair of current three unsent cycles

1. Block **send/finalize** while upgrade/repair is in progress (application release gate, maintenance mode or confirmed no activity). No production changes until a verified backup exists.
2. Make a recoverable snapshot/export of these tables and references: `report_batches`, `report_section_approvals`, `report_section_sources`, `report_student_overrides`, `reports`, `weekly_submissions`, `weekly_submission_students`, `weekly_submission_dates`, and related student/group enrollment history. Validate row totals and restore procedure **before** applying DDL.
3. Stage new code and migration on a disposable local Supabase and use sanitized fixtures mimicking all three cycles and the duplicate class-subject group case.
4. Produce a **dry-run diff** for each current report/subject/group: old snapshot versus recalculated approved attendance/text/performance/comment. Verify every one of 87 numeric correction pairs resolves in the appropriate report context; account for students legitimately outside an included source.
5. Repair only unsent, unsuperceded report revisions. Prefer controlled re-finalization that stores a new revision and marks the previous one superseded rather than silently editing historical JSON; if batch state is `DRAFT`, preserve its approved fields and generate the current preview from the live resolver. Do **not** send automatically.
6. Confirm parity: edited values == live Parent Email Review == finalized snapshot == rendered email; old revisions/Teacher sources recoverable.
7. Merge after locally verified focused + regression tests and dry-run parity. Production migration first, app deployment once, then verify the three cycles read-only. Explicitly approve any proposed data repair transaction separately from the code rollout.

## Release acceptance tests

- [ ] Admin can select **Use Teacher rating**, a specific rating, or **Omit performance**; saved choice survives reload, preview, finalization and email.
- [ ] Empty Teacher rating with no Admin rating renders no Performance section in both languages; a rating renders it, and template-disabled Performance stays hidden without deleting saved values.
- [ ] Disabling Performance or student comments in the report template does not clear historical Admin performance or comment overrides.
- [ ] Existing baseline counts preserved (87 numeric Admin corrections, 13 comment override rows, all shared approvals, three cycles, 21 prior draft report rows; no email deliveries).
- [ ] Admin numeric overrides 4/6 stay 4/6 through save, reload, source-toggle, preview, finalize and email rendering.
- [ ] Same subject in two groups does **not** apply the wrong group's approved attendance or text.
- [ ] Admin edits of English/Arabic shared text, individual text/comments, performance and intentional blank stay authoritative.
- [ ] Updated Teacher data **never** silently rolls back an approved Admin edit.
- [ ] Numeric Teacher attendance handles 0/N, N/N, draft blank, invalid fraction, large value and calendar coverage.
- [ ] New Teacher workflow and reopened submitted form have **no Present/Absent selector**.
- [ ] Two overlapping numeric Teacher sources do not produce an inflated attendance count.
- [ ] Legacy records can still be read, with explicit provenance and no fabricated six-session data.
- [ ] Admin can View submitted Teacher source or approved report directly, Edit only when unsent, with no hidden destructive actions.
- [ ] Every finalized current report matches the current Admin-approved values (including text), and email preview matches rendered delivery.
- [ ] No unexpected Github Actions CI or Vercel production deployment occurs during review.

## In-progress safety marker

This document and review-branch changes are **not production-ready by themselves**. Do not merge or apply migrations simply because the UI compiles. The comprehensive session-count/RPC/data-repair tests and a verified production backup must pass first.
