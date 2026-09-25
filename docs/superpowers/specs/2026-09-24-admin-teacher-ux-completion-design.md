# Administrator and Teacher UX Completion Design

**Date:** 2026-09-24
**Status:** Approved for implementation

## Purpose

Complete the current Class -> Subject -> optional Group and independent-role architecture with a coherent administrator and teacher interface. This pass is not a visual-only redesign: implemented capabilities must be discoverable and usable, and known assignment/access defects must be corrected.

## Scope

### Application shell

Replace the flat horizontal navigation with a responsive sidebar. Administrator capabilities are grouped separately from personal teaching capabilities. A dual-capability login must clearly see both surfaces without role switching.

Administrator destinations are first-class: Dashboard, Students, Guardians, Teachers, Administrators, Classes & Subjects, Teaching Assignments, Reports, Export Data, Archives, and Settings. Teacher-only navigation is intentionally small: This Week, History, and My Profile.

Desktop uses a left sidebar. Mobile collapses the same hierarchy without removing actions. English and Arabic use equivalent information architecture, logical spacing, direction-correct layout, and bundled fonts.

### Administrator dashboard

The dashboard becomes an operational home rather than a read-only scorecard. It exposes shortcuts for Add Student, Add Teacher, Assign Teacher, Add Class, and Reports, plus attention states already derivable from school data such as missing weekly updates and attendance conflicts. Where account/assignment state is available, teachers lacking login access or teaching assignments should be visible rather than silently incomplete.

### Teacher records, login access, and assignments

The UI must visibly separate three independent concepts:

1. Teacher business record.
2. Optional Teacher account access.
3. Dated teaching assignments.

A Teacher may exist and be assigned without login access, but the administrator must see a clear warning that the Teacher cannot use My Teaching until an account is linked. Adding Teacher capability to an existing same-school login continues to preserve the existing password.

Teacher details and teaching assignments are managed on separate focused surfaces. The Teacher list summarizes active status, login/access status, and current teaching coverage. Normal actions are prominent; access/lifecycle/destructive actions are grouped separately.

### Teaching assignment workspace

Assignments are presented as Current, Upcoming, and Past. Administrators can add an assignment and edit its dates. An end date may be blank for ongoing assignments. Date ranges must be valid and overlapping duplicate coverage remains prohibited by the database.

Historical submitted weekly work is preserved. Date edits that would invalidate protected submitted history must be rejected rather than silently rewriting history. The UI must explain blocked changes.

My Teaching answers “what do I teach now?” using the school-local current date. The weekly submission itself remains keyed to the school week start. A midweek assignment therefore appears immediately in My Teaching while its update remains associated with that week.

### People management

Administrators are a first-class People destination rather than a hidden Settings subpage. Existing add/access/deactivate/reactivate/last-admin safeguards remain. Existing Administrator details can be edited without changing Teacher capability or account identity.

Students retain the existing effective-dated Class/Subject/Group rules, but Edit and Manage Enrollment must not be duplicate actions. Student detail should make identity, enrollment, guardians, and lifecycle clear.

Guardians remain independent records with clear edit and lifecycle controls.

### Class, Subject, and Group management

Classes, reusable Subjects, and Subject Groups must support normal lifecycle management, not creation only. Administrators can rename records and archive/restore them. Removing or permanently deleting a record must respect dependent enrollment, assignment, weekly-submission, reporting, and history data.

The Class detail surface should make subject/group structure and teacher coverage understandable, and provide a direct route into teaching assignment management.

### Archive and permanent deletion

Normal lifecycle for school records is Active -> Archived/Inactive -> Restore. The existing Student archive/delete workflow is retained.

Archive/restore is extended to Teacher, Guardian, Class, Subject, and Group records. For non-Student records, permanent deletion is allowed only for an archived record when dependency impact confirms that deletion is safe. If protected/dependent history exists, the UI shows the impact and blocks permanent deletion instead of hiding the lifecycle action or deleting history unexpectedly.

Student permanent deletion keeps its existing explicitly confirmed transactional cleanup behavior. Administrator deletion keeps its separate last-active-Administrator safeguards.

### Reports and data tools

The existing report batch and bulk-send capabilities remain, but the workflow is visually staged as Prepare -> Review -> Finalize -> Send. Bulk “Send ready reports” must be prominent and show its result.

Export Data and Archives become first-class Data & Tools destinations rather than controls buried under Settings. Existing period, scope, dataset, CSV, PDF, and protected-download behavior is preserved.

Initial roster CSV import is explicitly out of scope for this pass because the specification exists but the transactional import subsystem has not yet shipped.

### Teacher experience

The teacher-facing product is deliberately smaller than the administrator product. This Week shows the active Class / Subject / Group contexts, student count, and weekly status (Not started, Draft, Submitted) with one obvious next action. Empty states explain whether there is no current assignment rather than presenting an unexplained blank screen.

The weekly update stays mobile-first. Existing Mark all present, Present/Absent-only attendance, default performance, sparse student exceptions, Save Draft, and Submit behavior is retained and visually clarified. History remains read-only for submitted updates.

## Visual system

Use a consistent hierarchy for page titles, section headings, status badges, primary/secondary/danger buttons, cards, tables, forms, empty states, and breadcrumbs. Common actions must have comfortable targets instead of underlined text-only controls. Destructive actions must not share the same visual weight as ordinary editing.

Use the already installed Noto Sans Arabic package for Arabic. Use a reliable bundled/system English stack without remote font dependencies. Teacher workflows must remain usable at 360px and both LTR and RTL.

## Verification contract

The release requires lint, typecheck, unit/contract tests, production build, real PostgreSQL/RLS tests, and browser E2E. Regression coverage must include midweek teaching visibility, assignment date classification/editing, Admin/Teacher dual navigation, administrator discovery, data-tool discovery, lifecycle safety, and English/Arabic responsive flows.
