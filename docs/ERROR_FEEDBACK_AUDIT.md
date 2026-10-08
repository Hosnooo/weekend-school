# Weekend School — user-facing error guidance audit

## Standard for all workflows

1. Describe **what failed**, without blaming users or exposing SQL, stack traces, UUIDs, private account data or provider details.
2. If the input can be fixed, identify the **field, student, teaching date, record or action** and explain the next step.
3. Distinguish validation, conflicting records/dates, stale edits, no permission, finalized/sent lock, and actual technical failures. Do not describe an infrastructure failure as a user mistake.
4. Keep the entered values in place after failure. Never silently reopen teacher submissions or change report/data state as part of displaying an error.
5. Show errors beside the relevant form/action in both English and Arabic. A server action must return a limited, safe error code, not the raw database message.
6. Check all states: blank/invalid fields, overlapping dates, stale versions, missing permissions, absent parent addresses, sent reports, disabled records and network/server errors.

## Implemented in this pass

- Shared `ActionState` carries serializable Zod issues; `FormFeedback` lists bilingual, field-specific corrective text for student, guardian, teacher, class, and settings forms.
- Known database codes get classified safely; unknown failures have a distinct, honest retry/escalation message. Teacher subject overlap and protected submitted history have targeted guidance.
- Administrator inline report attendance identifies the student and whether one field is blank, a number is invalid, or attended sessions exceed the total; stale rosters and locked/sent reports use distinct guidance.
- Class Report Cycle actions return safe reasons for missing approved sources, unresolved attendance conflicts, sent/delivery locks, concurrent changes, and permissions; list and workspace surfaces display these reasons.
- Teaching Update save form displays coverage/attendance field issues. Submission exceptions return to the editor with recovery instructions rather than throwing a generic error page.
- Tests added for input interpretation and safe code-to-message classification.

## Follow-up audit (not silently considered completed)

- Direct `FormData` actions without `useActionState` (archive/restore/destructive operations, some teacher/guardian status toggles, export generation and admin account invitations) need a persistent inline error contract instead of bare throws or redirects.
- Login/password-reset flows, CSV import previews and direct attendance conflict resolution already have their own error surfaces; review every provider and permission error against this same checklist.
- Improve first-invalid-field focus and inline `aria-describedby` associations, not only the summary list.
- End-to-end tests should simulate invalid submissions and actual delivery failures using isolated fixtures; avoid sending real parent emails or modifying production data.

This inventory is a progress log, not a claim that all app error surfaces have been exercised interactively.
