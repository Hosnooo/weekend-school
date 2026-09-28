# Flexible Teaching Updates and Class Report Cycles Design

**Date:** 2026-09-27
**Baseline:** `main` at `756b0d8`
**Status:** Approved design direction

## Purpose

Replace the rigid one-submission-per-week Teacher workflow with flexible dated Teaching Updates, make Groups an organizational tool rather than an assignment boundary, and make Admin reporting a Class-level end-to-end cycle that produces one coherent student report across Subjects before Guardian delivery.

The redesign must preserve the strong boundaries already established in the application: school scoping, RLS, independent Teacher records, dated history, immutable finalized reports, EN/AR support, RTL, mobile usability, and reversible unsent workflows.

## Core terminology

### Teaching Assignment

A Teaching Assignment grants a Teacher authority for a **Class + Subject** over a dated assignment interval.

Teachers are no longer assigned to Subject Groups. Groups do not grant or restrict teaching authority.

Example:

`Ahmed -> Level 1 -> Quran -> starts 2026-09-01`

### Subject Group

A Subject Group is an organizational subdivision inside a Class Subject.

Example:

`Level 1 -> Quran -> Group A / Group B / Group C`

Groups organize students and Teaching Updates, but do not define Teacher permission boundaries.

### Teaching Update

A Teaching Update is source information entered for a Class Subject, optionally organized by Group, covering user-selected teaching dates.

It replaces the user-facing concept of a fixed weekly submission.

### Report Cycle

A Report Cycle is an Admin-owned **Class + reporting period** workspace.

Example:

`Level 1 -> 2026-09-01 through 2026-09-30`

A Report Cycle collects eligible submitted Teaching Updates across Subjects, lets Admin include/exclude sources, produces complete student reports, supports preview, then sends them to Guardians and tracks delivery.

---

## 1. Teaching assignments become Subject-only

### Required behavior

- A Teacher assignment is scoped to:
  - school;
  - Teacher;
  - Class Subject;
  - starts_on;
  - optional ends_on.
- Admin assignment UI must not offer Group selection.
- Effective teaching authorization must ignore Group membership in the assignment.
- Any active Teacher of a Class Subject can work with any Group belonging to that Class Subject.

### Safe migration rule

Do **not** aggressively rewrite or delete historical assignment rows just to remove the old `subject_group_id` column.

For this implementation:

- existing group-scoped assignment rows remain historical data;
- authorization treats any effective assignment for the Class Subject as Subject-wide authority;
- all new assignment writes use `subject_group_id = null`;
- new application/RPC writes must reject creation of new Group-scoped teaching assignments;
- effective-context queries deduplicate by Teacher + Class Subject.

A later cleanup migration may physically remove the legacy column only after production data is known to be normalized. That physical cleanup is not required for this redesign.

---

## 2. Teachers can manage Groups for Subjects they teach

An active Teacher assigned to a Class Subject may manage the Group structure for that Subject.

### Teacher capabilities

Teacher may:

- see all active Groups for the assigned Subject;
- create a Group;
- rename a Group;
- archive a Group;
- restore an archived Group when allowed by the existing archive model;
- see students participating in the Subject;
- move a student from one Group to another;
- place an ungrouped participating student into a Group;
- remove a student from a Group back to ungrouped;
- see current Group membership and historical dated membership.

Admin retains the same or broader authority.

### Boundaries

Teacher may not:

- move a student to another Class;
- change whether a student participates in another Subject;
- modify another Class Subject;
- create or end their own Teaching Assignment;
- rewrite historical membership periods that have already supported finalized reports.

Operational Teacher Group changes should use dated membership history rather than destructive replacement. Historical report/source relationships must remain valid after later Group changes.

Hard destructive deletion remains an Admin archive/destructive-delete concern. Teacher-facing “remove Group” behavior is archive, not history destruction.

---

## 3. Flexible Teaching Update date coverage

Teaching Updates are not daily, weekly, or monthly by definition.

A Teaching Update supports:

1. **Range coverage**
   - one day: start = end;
   - consecutive days;
   - one week;
   - multiple weeks;
   - any custom continuous period.

2. **Specific-date coverage**
   - one or more non-consecutive dates;
   - for example Sep 20, Sep 22, Sep 27.

The UI should offer simple controls such as:

- Single day
- Date range
- Specific dates

The underlying model must retain enough information to distinguish a continuous range from a set of specific dates.

### Future dates

A future-dated Teaching Update may be created and remain OPEN/DRAFT.

Submission is blocked until **all dates covered by the update have occurred** in the school timezone.

### Overlap and duplicates

Overlapping Teaching Updates are allowed.

The system shows a non-blocking warning when another active/submitted update for the same Class Subject + Group/whole-Subject scope overlaps the selected coverage.

Example:

> Another Quran · Group A update overlaps Sep 5–7. Continue if this is intentional.

No uniqueness rule may prevent legitimate multiple sessions or overlapping summaries.

---

## 4. Teaching Update scope and content

A Teaching Update belongs to one Class Subject and may be:

- whole-Subject; or
- one Subject Group.

Groups are an organizational scope, not an authorization boundary.

The update continues to support the existing teaching content:

- progress EN/AR;
- default performance;
- per-student performance override;
- attendance;
- per-student comments EN/AR;
- roster rows based on the relevant Class Subject/Group participation.

Teacher-created updates are owned by the creating Teacher while OPEN.

Submitted updates become report-source records rather than “parent reports.”

---

## 5. Teacher and Admin can create Teaching Updates

### Teacher-created update

From My Teaching, Teacher chooses:

- assigned Class Subject;
- optional Group;
- date mode and coverage;
- teaching content.

Teacher may create as many legitimate updates as needed.

### Admin-created request

Admin has a Teaching Updates workspace and may request an update for a Class Subject and coverage.

Admin may optionally prefill teaching content and include an Admin note/instruction.

The note is metadata and remains distinguishable from Teacher-authored report content.

### Subject request expansion by Groups

When Admin requests a Subject update:

- if the Subject currently has N active Groups, create N linked request items, one for each Group;
- if the Subject has no active Groups, create one whole-Subject request;
- all items share a request-set identifier so Admin sees one request summary;
- Groups created later are **not** silently added to the existing request set.

Example:

`Level 1 · Quran · Sep 1–7`

with three Groups becomes:

- Group A -> Waiting for Teacher
- Group B -> Waiting for Teacher
- Group C -> Waiting for Teacher

Admin summary:

`Quran · Sep 1–7 -> 1/3 completed`

### Multiple Teachers

All active Teachers assigned to the Class Subject can see an Admin-created open request.

One completed submission is enough for that request item.

The submit operation must be atomic:

- first valid submission wins;
- the row records the completing Teacher;
- a racing second submit receives an “already completed” result and refreshes;
- other Teachers then see who completed it.

The implementation may allow shared draft visibility, but it must not silently overwrite concurrent changes. Use the existing server-action/RPC pattern and an updated-at/version check where necessary.

---

## 6. Teaching Update lifecycle

The user-facing lifecycle is:

`OPEN -> SUBMITTED`

or:

`OPEN -> DISMISSED`

A submitted update can become editable again only through reopen:

`SUBMITTED -> OPEN`

### OPEN

- editable;
- save draft;
- Teacher-created item may be dismissed by its Teacher or Admin;
- Admin-requested item may be dismissed by an eligible Teacher only with a required reason;
- Admin may dismiss any OPEN item;
- dismissal preserves audit information.

### SUBMITTED

- read-only;
- eligible as a Report Cycle source;
- cannot be dismissed directly;
- may be reopened only if it is not locked by a finalized Report Cycle.

### DISMISSED

Preserve:

- original creator;
- creation timestamp;
- dismissing actor;
- dismissal timestamp;
- required reason where applicable.

Dismissed items do not appear in normal active workload or report-source eligibility, but remain available in history.

### Finalized/sent source lock

Once a Teaching Update is referenced by a finalized Report Cycle, it is historical evidence and cannot be edited, reopened, dismissed, or deleted.

A correction after sending is represented by a new Teaching Update and, when necessary, a new report revision. Existing sent artifacts are never rewritten.

---

## 7. Teacher workspace

My Teaching becomes a Teaching Update work center rather than an automatically generated “this week” slot.

### Main sections

**Needs attention**
- Admin-requested OPEN items;
- Teacher drafts.

**Recent**
- recently SUBMITTED updates;
- clear indication when included in a finalized/sent report.

**History**
- Submitted;
- Dismissed;
- filters by date, Class, Subject, Group, status.

### Primary actions

- Add Teaching Update
- Continue
- Submit
- Reopen when allowed
- Dismiss
- View
- Manage Groups for an assigned Subject

The old `/my-groups` compatibility route may redirect into the appropriate My Teaching/Group-management surface rather than reintroducing a separate legacy model.

---

## 8. Admin Teaching Updates workspace

Create a first-class Admin Teaching Updates page separate from parent report composition.

It answers: **What source information are Teachers providing?**

### Capabilities

- filter by Teacher, Class, Subject, Group, dates, status;
- see Teacher-created and Admin-requested updates;
- Request Teaching Update;
- see linked request-set completion such as `2/3 Groups complete`;
- open/view/edit Admin prefill;
- reopen where allowed;
- dismiss where allowed;
- see overlap warnings and historical state.

Admin may also expose “Request Teaching Update” contextually from a Teacher or Class Subject screen, but all entry points use the same backend action.

---

## 9. Report Cycle is Class + custom period

Only Admin creates/finalizes/sends parent-facing Report Cycles.

New parent-report workflow uses `scope_type = CLASS`.

Existing historical SUBJECT/GROUP report batches remain readable. Do not destructively rewrite already-finalized report history.

Admin creates:

- Class;
- period start;
- period end;
- report template.

The period is independent of Teacher update frequency.

Examples:

- one week;
- one month;
- term;
- arbitrary custom dates.

---

## 10. Automatic source eligibility with Admin override

When a Report Cycle is created/opened:

- find all SUBMITTED Teaching Updates for students/Class Subjects in that Class whose coverage overlaps the cycle period;
- select all matching sources by default;
- flag sources whose coverage only partially overlaps the cycle;
- allow Admin to exclude/re-include individual source updates before finalization;
- never include OPEN or DISMISSED updates.

This is the approved “automatic with override” behavior.

Existing `report_section_approvals` and `report_section_sources` should be reused where practical rather than creating a parallel reporting engine.

Source selection becomes immutable once the cycle is finalized.

---

## 11. Reports UI is one end-to-end workspace

Delivery remains inside **Reports**, not a separate top-level product area.

A Report Cycle workspace has clear stages:

1. **Sources**
   - Subjects and Groups;
   - submitted source updates;
   - missing/waiting requests;
   - include/exclude;
   - partial-overlap warning;
   - request another Teaching Update.

2. **Student Reports**
   - generated student report content;
   - Admin editing;
   - attendance/performance/comments;
   - conflict resolution.

3. **Preview**
   - exact Guardian-facing report;
   - student-by-student preview;
   - recipient/Guardian context;
   - email wrapper/template preview.

4. **Send**
   - recipient count;
   - missing-email warnings;
   - final confirmation;
   - send/retry controls.

5. **Delivery Status**
   - pending;
   - sent;
   - delivered when provider data supports it;
   - failed;
   - retry/resend;
   - timestamp;
   - report revision used.

The existing delivery-status route may remain as a compatibility/deep-link route, but delivery is presented as part of the Report Cycle experience and is not a separate top-level navigation concept.

---

## 12. Report dashboard statuses

Reports dashboard should present lifecycle-oriented statuses, derived from persisted report/delivery state rather than duplicating conflicting status fields.

Suggested user-facing states:

- Collecting updates
- In review
- Ready to preview
- Ready to send
- Sent
- Delivery issue

A finalized unsent cycle is Ready to send.

A sent cycle with failed recipient deliveries is Delivery issue without changing the finalized report content.

---

## 13. Preview is required before first send

Admin must have a clear Preview step immediately before Send.

The preview should use the same finalized/generated report snapshot and email rendering path that delivery will use as closely as possible.

Admin can preview:

- one Student report;
- Guardian recipient context;
- email subject/body wrapper.

Sending must not silently regenerate different report content after the Admin preview/finalization boundary.

---

## 14. Historical and audit guarantees

The redesign must preserve:

- existing Teacher business-record identity;
- school scoping on every new school-owned row;
- RLS;
- dated Teaching Assignments;
- dated Group membership;
- old weekly submissions;
- existing finalized report snapshots;
- report revisions;
- delivery attempts/history.

Do not hard-delete records merely because the user-facing terminology changes.

Legacy weekly submissions are migrated logically to Teaching Updates. Their original IDs must remain usable by existing `report_section_sources`.

---

## 15. Low-risk database migration strategy

To avoid an aggressive rewrite, the first implementation should **evolve** the current tables.

### Keep physical `weekly_submissions` identity initially

Do not rename/drop the table in the same migration that changes workflow semantics.

Add the flexible Teaching Update fields to the existing table so existing foreign keys from `report_section_sources` continue to work.

Recommended additions:

- `coverage_kind` (`RANGE` or `DATES`);
- `period_start`;
- `period_end`;
- request-set identifier;
- creator metadata (new rows record the acting Profile; legacy rows never infer a missing Profile actor from name/email);
- optional Admin note;
- dismissal metadata;
- optimistic concurrency/version metadata if needed.

Add a child table for specific non-consecutive dates.

Backfill legacy rows as a continuous seven-day range:

- `period_start = week_start`;
- `period_end = week_start + 6 days`;
- `coverage_kind = RANGE`.

Keep `week_start` as a compatibility column during this change and stop using it as the business identity.

Drop/replace the one-Teacher-context-week uniqueness rule so legitimate overlap is possible.

### Nullable completing Teacher for Admin requests

Admin-created waiting items need to exist before a Teacher completes them.

The existing `teacher_id` may become nullable for Admin-requested OPEN rows, with constraints/RPC rules requiring a Teacher on SUBMITTED rows.

Teacher-created rows set `teacher_id` immediately.

All authorization must be expressed through Class Subject assignment, not Group assignment.

---

## 16. Security rules

Every new mutation must be enforced in the database/RPC layer, not only hidden in UI.

Teacher may mutate a Teaching Update or Group only when:

- current user resolves to an active Teacher business record;
- Teacher has an effective Teaching Assignment for that Class Subject at the relevant date;
- row belongs to current school.

Admin mutations require active Admin capability and same school.

A Teacher must never gain cross-school visibility or authority through Group management or shared Admin requests.

---

## 17. EN/AR, RTL, mobile

All new labels, validation, empty states, warnings, dialogs, statuses, and actions require English and Arabic translations.

Teacher and Admin creation flows must remain usable at 360px width and in RTL.

Date-selection UI should favor simple native/accessibility-friendly controls over an elaborate custom calendar unless the existing design system already provides one.

---

## 18. Explicit non-goals

This redesign does not:

- create a full timetable/scheduling subsystem;
- require Admin to schedule every Teacher update;
- make Groups permission boundaries;
- allow Teachers to change Class enrollment;
- allow Teachers to send Guardian reports;
- auto-add newly created Groups to old Admin requests;
- hard-block overlapping Teaching Updates;
- rewrite finalized/sent report history;
- require a physical rename of every legacy `weekly_*` database object in this implementation.

---

## 19. Acceptance scenarios

### A. Teacher creates two updates in one week

Quran meets Saturday and Sunday.

Teacher creates:
- Sep 26;
- Sep 27.

Both are valid. Neither is blocked because another update exists in the same week.

### B. Teacher creates a multi-week summary

Teacher creates a RANGE update Sep 1–14.

It submits after Sep 14 and is eligible for a Sep 1–30 Report Cycle.

### C. Teacher chooses non-consecutive dates

Teacher creates DATES update Sep 20, Sep 22, Sep 27.

The system retains exactly those dates.

### D. Future request

Admin requests Sep 28–Oct 2.

It appears OPEN immediately. Submission is rejected until Oct 2 has occurred in school timezone.

### E. Subject request with Groups

Quran has Groups A, B, C.

Admin requests Quran Sep 1–7.

The system creates three linked OPEN items.

Ahmed submits Group A. Omar sees Group A completed by Ahmed; B and C remain open.

### F. Duplicate warning

An existing Quran Group A update covers Sep 5–7.

Teacher creates another covering Sep 6.

UI warns but allows continuation.

### G. Teacher reorganizes Groups

Teacher assigned to Level 1 Quran moves Sara from Group A to Group B effective today.

Historical Group A membership remains dated. Previously finalized reports remain unchanged.

### H. Monthly Report Cycle

Admin creates Level 1 Sep 1–30.

All overlapping submitted Teaching Updates are preselected.

Admin excludes one accidental duplicate, reviews student reports, previews Guardian output, finalizes, sends, and sees delivery status inside the same Report Cycle.

### I. Correction after sending

A mistake is found after delivery.

The original source and sent report remain immutable.

A new correcting Teaching Update and report revision are created rather than mutating sent history.
