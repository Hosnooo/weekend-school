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

## Second pass — archive, export, administrator entry and recovery errors

- Export form now validates custom date order, required scope selections, and dataset selection **before** creating a download; server failures appear inline without leaking private error contents.
- Archive student-data download now shows an inline failure instead of silently rejecting a promise.
- Archive restore and permanent delete now distinguish confirmation mismatch, related-record restrictions, expired state, permissions and technical errors. No change to permanent-deletion safety rules.
- Administrator create/edit forms use server-validated inline `ActionState` errors to identify fields and keep typed values in place after a failed save. Access invitation operations continue to be separate.
- Password recovery has a distinct configuration/service-unavailable message without indicating whether an email is registered; per-address provider failures remain intentionally indistinguishable for account privacy.
- Targeted tests cover export form selection and archive error-code classification. No live data modifications or real emails.

### Remaining surfaces

- Teacher/guardian active-status toggles, archive actions launched outside the archive list, administrator access invitation specifics, CSV import failure recovery and remaining export API download responses still need focused tests.
- Provider errors should never reveal whether a login account exists. The password-recovery service intentionally reports the same public result for known and unknown email addresses.
- Full automated unit, browser and end-to-end tests remain a separate verification task; the Next.js preview build covers compilation and TypeScript but not runtime interaction.

## Third pass — lifecycle, CSV revalidation, and file-download responses

- Archiving and reactivating student, Teacher and Guardian records returns typed safe failure results for the interactive list, so users see a reason on the same page rather than a silent failure or raw server exception.
- The legacy Guardian list's native form receives an error redirect and displays a safe status message. Administrator lifecycle actions preserve their last-active-administrator restriction and now translate safe database codes for permissions and changed records.
- CSV roster preview distinguishes a malformed CSV from unavailable current school catalog data. Confirmation refreshes the catalog, and reports meaningful records-changed errors without accepting stale IDs.
- Export and roster download buttons now inspect authenticated HTTP responses. Expired requests, unavailable access and server failures cannot silently download HTML/error text as if it were a ZIP or CSV file.
- Browser downloads remain same-origin and require successful attachment responses. No database or schema changes.

Remaining: authenticated browser interaction tests, permission failure simulations, login/access invitation provider-specific codes, and reviewing the default failure paths in other direct actions.

## Access-link reliability

- Disconnecting a Teacher's login access now reports success/failure on that Teacher's access page, rather than swallowing a server failure and leaving the record unchanged without explanation.
- Invalid or stale access-link submissions direct the administrator to refresh the current record.

## Isolated failure-path verification suite — 2026-10-08

### Coverage

- `tests/unit/isolated-access-failures.test.ts`: new/existing Teacher and Administrator account invitation failures, cross-school authorization, rollback of newly created auth/profile records, rate limits and last-Administrator safeguards. The account/email adapters are mocked: **no email is sent and no Supabase project is accessed**.
- `tests/unit/isolated-guardian-unlink.test.ts`: exercises the actual unlink Server Action with mocked school-scoped repository and authentication; malformed IDs, `P0002` stale link, permission errors and successful revalidation are checked.
- `tests/e2e/guardian-stale-unlink.spec.ts`: Playwright scenario creates a disposable Guardian relationship **only in local Supabase**. After the student page is opened, a second actor removes the link directly in the local fixture; the first actor must receive an explanatory stale-link alert. Fixture cleanup is in a `finally` block. Both `playwright.config.ts` and the fixture independently refuse a hosted Supabase URL.
- Login/access pages classify rate limiting, missing email, account belonging to another school and stale records with bilingual corrective messages without displaying private provider details.

### Execution requirements and limitations

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run tests/unit/isolated-access-failures.test.ts tests/unit/isolated-guardian-unlink.test.ts --configLoader runner
# Playwright requires locally seeded Supabase plus .env.local credentials and browser installation
pnpm test:e2e -- --grep "isolated stale Student–Guardian"
```

The test container for this ChatGPT run has **no checked-out repository, no pnpm dependencies and no reachable package registry or local Supabase test database**. Do not claim these tests have executed successfully until the environment is available. A successful Vercel build checks compilation/TypeScript, **not** E2E or Vitest execution. Running them against the live school or using its service-role credentials is prohibited.

### Known limitations

- Sequential Administrator last-active checks are not an atomic concurrency guarantee if two administrators deactivate simultaneously; any change to those safeguards requires a separate database-level transaction design and local DB regression coverage.
- General report-review edits are not yet subject to an explicit optimistic-concurrency version check in every legacy path. Concurrent editing should be validated in isolated data before any changes to production behavior.

### Build gate

The project now executes five isolated/mock-only critical error test files in `pnpm run test:critical-errors` before `next build`. The Vercel preview build runs those tests automatically, so a green deployment means these tests executed, then Next.js/TypeScript compiled. Playwright still requires local seeded Supabase and must **not** be run against production.
