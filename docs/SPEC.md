# Weekend School Management App — MVP Technical Specification

## 1. Goal

Build a minimal, modern, bilingual English/Arabic web application for a weekend school.

The application must allow:

1. Administrators to manage teachers, students, guardians, groups, and settings.
2. Teachers to record a weekly group update with minimal effort.
3. Teachers to mark attendance.
4. Teachers to enter one shared performance/progress value for the group and override only individual students when necessary.
5. Teachers to add optional individual parent-facing comments.
6. Administrators to generate reports for students.
7. Reports to support English, Arabic, or bilingual output.
8. Reports to be emailed to parents/guardians.
9. Automatic scheduled report emailing to be supported after manual sending is proven reliable.
10. The architecture to remain simple and modular so additional features can be introduced later without rebuilding the application.

The primary design principle is:

**Teachers enter shared information once and only record exceptions for individual students.**

---

# 2. Explicit Non-Goals for MVP

Do NOT implement the following in the initial release:

* Parent accounts
* Parent portal
* Student accounts
* Chat/messaging
* Homework management
* Online registration
* Payments
* Certificates
* SMS
* WhatsApp
* AI-generated comments
* AI translation
* Complex analytics
* Teacher performance analytics
* Native iOS application
* Native Android application
* Push notifications
* Multiple schools/organizations exposed in the UI
* Complex academic grading
* Calendar system
* File uploads
* Learning-management-system features

The database may be designed to accommodate future expansion, but these features must not appear in the MVP.

---

# 3. Recommended Technology Stack

Use one full-stack TypeScript application.

## Core

* Next.js using App Router
* TypeScript with strict mode
* React
* Tailwind CSS
* shadcn/ui or similarly lightweight accessible primitives

## Database and Authentication

* Supabase
* PostgreSQL
* Supabase Authentication
* PostgreSQL Row Level Security

## Internationalization

* next-intl
* English: `en`
* Arabic: `ar`

Arabic must use:

```text
lang="ar"
dir="rtl"
```

English must use:

```text
lang="en"
dir="ltr"
```

Use CSS logical properties where possible rather than hardcoded left/right rules.

## Validation

* Zod

Use the same validation concepts on client and server where appropriate.

## Email

* Brevo
* React Email

Email integration must live behind an application service interface so the provider can be replaced later.

## Hosting

Recommended:

* Vercel — web application
* Supabase — database/authentication
* Brevo — email

Do not tightly couple business logic to Vercel or Brevo.

---

# 4. Architectural Principle

Use a modular monolith.

Do NOT create:

* microservices
* separate frontend repository
* separate backend repository
* GraphQL
* unnecessary queues
* Kubernetes
* event buses

Architecture:

```text
Browser
   │
   ▼
Next.js Application
   │
   ├── UI
   ├── Server Actions
   ├── Route Handlers
   ├── Domain Services
   │
   ▼
Supabase/PostgreSQL
   │
   ├── Authentication
   └── Row Level Security

Next.js Services
   │
   ├── Report Generator
   └── Email Provider
```

The application should be simple physically but modular logically.

---

# 5. Roles

MVP has only two authenticated roles.

## Admin

Can:

* manage school settings
* create/edit/deactivate teachers
* create/edit/deactivate students
* manage guardians
* create/edit groups
* assign teachers
* assign students
* view all submitted weekly updates
* generate reports
* preview reports
* send reports
* view report/email status

## Teacher

Can:

* view only assigned groups
* see students belonging to assigned groups
* create/edit their own draft weekly updates
* mark attendance
* enter group progress
* enter default group performance
* override performance for specific students
* add optional student comments
* submit an update
* view previously submitted updates for their assigned groups

Teachers MUST NOT be able to:

* view unrelated groups
* manage users
* change school settings
* send reports
* access students outside their assigned groups

Authorization must be enforced server-side and at the database/RLS level.

Never rely only on hiding UI buttons.

---

# 6. School Model

Create a `schools` table even though the MVP contains only one school.

Reason:

Adding this now is inexpensive and avoids a difficult database migration later.

Do not expose multi-school management in the MVP interface.

Every school-owned entity should contain `school_id`.

---

# 7. Database Model

Use UUID primary keys.

Every appropriate table should include:

```text
id
created_at
updated_at
```

Use timestamps with timezone.

## schools

```text
id
name_en
name_ar
timezone
default_language
created_at
updated_at
```

Default timezone should be configurable.

---

## profiles

Corresponds to authenticated Supabase users.

```text
id
school_id
auth_user_id
display_name
role
preferred_language
is_active
created_at
updated_at
```

Role enum:

```text
ADMIN
TEACHER
```

Preferred language:

```text
en
ar
```

---

## students

```text
id
school_id
first_name_en
last_name_en
first_name_ar nullable
last_name_ar nullable
is_active
created_at
updated_at
```

Arabic names are optional.

Do not require duplicate Arabic information.

---

## guardians

```text
id
school_id
name
email
report_language
is_active
created_at
updated_at
```

Report language enum:

```text
en
ar
both
```

---

## student_guardians

Many-to-many relationship.

```text
student_id
guardian_id
receives_reports
is_primary
```

A guardian may have multiple children.

A student may have multiple guardians.

---

# 8. Groups and Subgroups

Do not create completely separate systems for classes and subgroups.

Use one hierarchical `groups` table.

## groups

```text
id
school_id
name_en
name_ar nullable
parent_group_id nullable
is_active
created_at
updated_at
```

A top-level group:

```text
Level 3
```

A subgroup could later be:

```text
Reading A
```

with:

```text
parent_group_id = Level 3
```

This gives:

```text
Level 3
├── Reading A
├── Reading B
└── Reading C
```

without requiring a separate subgroup architecture.

---

## group_teachers

```text
group_id
teacher_profile_id
assignment_type
```

Initial assignment types:

```text
PRIMARY
ASSISTANT
```

The MVP interface may initially use only PRIMARY.

---

## group_memberships

```text
id
group_id
student_id
starts_on
ends_on nullable
created_at
```

Do not store `group_id` directly on the student.

Membership history should be preserved.

This makes student transfers easier later.

---

# 9. Weekly Sessions / Updates

Create a session representing the teacher's weekly class update.

## sessions

```text
id
school_id
group_id
session_date
status
created_by
submitted_at nullable
created_at
updated_at
```

Status:

```text
DRAFT
SUBMITTED
```

There should normally be one update per group/session date.

Prevent accidental duplicate sessions.

---

# 10. Shared Group Progress

## group_progress

```text
id
session_id
progress_en nullable
progress_ar nullable
default_performance nullable
created_at
updated_at
```

The teacher should NOT be required to enter both languages.

At least one progress text may be entered.

Performance values for MVP:

```text
EXCELLENT
GOOD
DEVELOPING
NEEDS_SUPPORT
```

The database stores keys, never translated labels.

Example:

```text
GOOD
```

UI displays:

English:

```text
Good
```

Arabic:

```text
جيد
```

---

# 11. Attendance

## attendance

```text
id
session_id
student_id
status
created_at
updated_at
```

Statuses:

```text
PRESENT
ABSENT
LATE
EXCUSED
```

Teacher UX must include:

```text
[ Mark all present ]
```

Then teacher changes only exceptions.

---

# 12. Student-Level Exceptions

## student_progress

```text
id
session_id
student_id
performance_override nullable
comment_en nullable
comment_ar nullable
created_at
updated_at
```

This is deliberately sparse.

Most students should have NO `student_progress` record for most sessions.

If there is no individual performance override:

```text
effective performance =
group_progress.default_performance
```

If an override exists:

```text
effective performance =
student_progress.performance_override
```

This is the central teacher-efficiency rule.

---

# 13. Language Rules

There are three separate concepts.

## A. User interface language

Stored on profile:

```text
preferred_language
```

Controls application interface only.

---

## B. Parent report preference

Stored on guardian:

```text
report_language
```

Possible values:

```text
en
ar
both
```

---

## C. Teacher-authored content

Progress and comments have:

```text
*_en
*_ar
```

Neither translation should automatically be invented.

### Fallback rule

If a report requests Arabic but Arabic content does not exist:

display the available English content.

If English is requested but only Arabic exists:

display Arabic.

For bilingual reports:

* show both when both exist
* show the available version once when only one exists

Do NOT automatically translate content in MVP.

This can be added later.

---

# 14. Translation Structure

Create:

```text
messages/en.json
messages/ar.json
```

Do not hardcode visible interface strings inside components.

Example:

```json
{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "attendance.title": "Attendance",
  "attendance.present": "Present",
  "attendance.absent": "Absent"
}
```

Arabic equivalents:

```json
{
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "attendance.title": "الحضور",
  "attendance.present": "حاضر",
  "attendance.absent": "غائب"
}
```

Translation keys should be semantic and stable.

---

# 15. Frontend Information Architecture

## Admin navigation

Keep navigation to:

```text
Dashboard
Groups
Students
Teachers
Reports
Settings
```

Do not add more top-level navigation for MVP.

---

## Teacher navigation

```text
My Groups
History
```

Settings/language can be accessible through the user menu.

---

# 16. Admin Dashboard

Keep the dashboard intentionally minimal.

Example:

```text
Weekend School

Students        126
Teachers         10
Groups             8

This Week

6 of 8 groups submitted

✓ Level 1
✓ Level 2
○ Level 3
✓ Level 4

[ View Groups ]
[ Reports ]
```

No charts are required.

Admin primarily needs to answer:

1. Which groups have submitted?
2. Which groups have not?
3. Are reports ready?
4. Did emails send successfully?

---

# 17. Teacher Homepage

Example:

```text
My Groups

Level 1
18 students
Last update: September 13

[ Update This Week ]

Level 4
16 students
Last update: September 13

[ Update This Week ]
```

Teacher should not see administrative clutter.

---

# 18. Weekly Update UX

This is the most important screen in the entire application.

Optimize this before optimizing anything else.

Layout:

```text
Level 1
September 20, 2026

ATTENDANCE

[ Mark All Present ]

✓ Ahmad
✓ Sara
✓ Omar
○ Yousef


GROUP PROGRESS

What did the group cover?

[                               ]
[                               ]


DEFAULT PERFORMANCE

○ Excellent
● Good
○ Developing
○ Needs Support


INDIVIDUAL EXCEPTIONS
Optional

Ahmad                       [ + ]
Sara                        [ + ]
Omar                        [ + ]
Yousef                      [ + ]


[ Save Draft ]     [ Submit ]
```

Clicking `+` opens a small inline section or dialog:

```text
Sara

Performance override
[ Excellent ▼ ]

Parent-facing comment
English
[                         ]

Arabic
[                         ]

[ Save ]
```

The teacher does not need to open every student.

---

# 19. Autosave

Draft updates should autosave where practical.

At minimum:

* navigating away should not silently lose work
* save state must be visible
* manual Save Draft must always be available

Possible states:

```text
Saving…
Saved
Unable to save
```

Do not implement complicated offline synchronization in MVP.

---

# 20. Mobile Design

Teacher screens must be designed mobile-first.

Required usable widths:

```text
360px+
```

Desktop administration should also work normally.

No native mobile application is required.

The web application should be installable as a shortcut from a phone if the browser supports it.

PWA functionality is optional and should not delay MVP.

---

# 21. Reports

Reports are generated from SUBMITTED sessions only.

Never include draft information in parent reports.

Report should contain:

```text
School name
Reporting period
Student name
Group
Attendance summary
Group progress
Effective performance
Individual parent-facing comments, when present
```

Do not include internal metadata.

---

# 22. Effective Performance Rule

For each session:

```text
student override
       ↓ if absent
group default performance
       ↓ if absent
not rated
```

Do not invent a performance value.

For the overall/current performance displayed on a report:

Use the latest effective non-null performance within the reporting period.

Do not calculate averages across ordinal labels.

---

# 23. Attendance Summary

Example:

```text
Present: 3
Absent: 1
Late: 0
Excused: 0
Sessions: 4
```

The rendered report may display the information more simply:

```text
Attendance: 3 of 4 sessions attended
```

Do not treat EXCUSED as PRESENT.

---

# 24. Report Snapshot

Reports must be immutable snapshots once generated/sent.

Create:

## reports

```text
id
school_id
student_id
period_start
period_end
language
status
snapshot_json
generated_at
sent_at nullable
created_at
```

Status:

```text
DRAFT
READY
SENT
FAILED
```

`snapshot_json` should store the data used to create the report.

This prevents historical reports from changing when a teacher later edits a record.

---

# 25. Report Rendering

Implement report rendering as a separate service.

Conceptual interface:

```ts
renderStudentReport(reportSnapshot, language)
```

Returns rendered HTML.

Do not scatter report formatting throughout pages.

MVP output:

* responsive HTML preview
* email-compatible HTML

PDF is NOT required for initial implementation.

Design the service so a PDF renderer can be added later.

---

# 26. Report Screen

Admin sees:

```text
September 2026 Reports

126 students

118 Ready
6 Missing data
2 Missing guardian email

[ Generate Reports ]

[ Preview ]

[ Send Ready Reports ]
```

Admin should be able to preview individual reports before sending.

---

# 27. Email Sending

Implement behind an interface such as:

```ts
interface EmailProvider {
  sendReportEmail(input: ReportEmailInput): Promise<EmailResult>
}
```

Brevo is the initial pilot implementation so a verified Gmail sender can deliver to real recipients without a purchased domain.

Do not call Brevo directly from UI components.

---

# 28. Email Delivery Tracking

Create:

## email_deliveries

```text
id
school_id
report_id
guardian_id
recipient_email
provider
provider_message_id nullable
status
error_message nullable
sent_at nullable
created_at
updated_at
```

Status:

```text
PENDING
SENT
DELIVERED
FAILED
BOUNCED
```

MVP must at minimum track:

```text
PENDING
SENT
FAILED
```

Provider webhook support for DELIVERED/BOUNCED can be added either during MVP or immediately afterward if straightforward.

---

# 29. Manual Before Automatic

Initial production workflow:

```text
Teacher submits updates
        ↓
Admin generates reports
        ↓
Admin previews reports
        ↓
Admin clicks Send
        ↓
Parents receive email
```

Only after this is reliable should scheduled delivery be enabled.

---

# 30. Automatic Reports

Design support for:

```text
report_frequency
report_send_day
report_send_time
```

Do not make the schedule logic inseparable from the report generator.

Preferred design:

```text
Report Generator
      ↓
Report Sender
      ↓
Scheduler triggers them
```

A scheduled task can later call the same services used by the manual admin button.

There must be no duplicate sending.

Use an idempotency rule based on:

```text
student
reporting period
guardian
```

---

# 31. Student Management Screen

Student list:

```text
Search...

Ahmed Ali        Level 2
Sara Mohammed    Level 2
Omar Hassan      Level 3

[ + Add Student ]
```

Student form:

```text
English first name *
English last name *

Arabic first name
Arabic last name

Group *

Guardian name *
Guardian email *

Report language
○ English
○ العربية
○ Both

[ Save ]
```

Keep advanced fields out of MVP.

---

# 32. Teacher Management

Admin can:

```text
Add Teacher
Name
Email
Preferred language
Assigned groups
```

Teacher invitations should use Supabase Auth.

Do not implement a custom password system.

---

# 33. Group Management

Example:

```text
Level 1
Teacher: Fatima
18 students

[ Edit ]
[ Students ]
[ Weekly History ]
```

Group creation:

```text
English name *
Arabic name

Teacher
Parent group optional

[ Create ]
```

---

# 34. UI Design Rules

Visual design should be minimal.

Use:

* generous whitespace
* clear typography
* large touch targets
* one primary action per page
* cards only when useful
* restrained borders
* responsive tables/lists
* accessible form labels
* consistent status badges

Avoid:

* gradients everywhere
* excessive animation
* dashboard clutter
* tiny text
* nested navigation
* modal-heavy workflows
* overly decorative UI

---

# 35. Arabic / RTL Requirements

RTL support must be treated as a first-class requirement.

Test:

* navigation
* forms
* dropdowns
* dialogs
* tables
* icons
* date displays
* teacher weekly update
* report preview
* emails

Do not implement RTL by simply applying `text-align: right`.

The entire document direction must change.

Use logical spacing utilities/properties wherever possible.

Directional icons such as arrows must mirror where appropriate.

---

# 36. Dates

Store actual dates/timestamps independent of display language.

Formatting must depend on locale.

Do not persist formatted date strings.

Example:

Database:

```text
2026-09-20
```

English display:

```text
September 20, 2026
```

Arabic display should use the configured Arabic locale representation.

---

# 37. Security

Required:

* Supabase Authentication
* Row Level Security
* server-side authorization checks
* environment variables for secrets
* no service-role key exposed to browser
* validated form input
* normalized/validated email addresses
* no cross-school access
* no teacher access to unrelated groups
* submitted report data excluded from public unauthenticated endpoints

Do not put sensitive information in URLs.

---

# 38. Auditability

At minimum preserve:

```text
created_at
updated_at
created_by
submitted_at
generated_at
sent_at
```

Do not build a full audit-log system yet.

The schema should not destroy historical session/report information when students move groups.

Prefer deactivation over deletion for records with history.

---

# 39. Delete Behavior

Avoid hard deletion for:

* teachers
* students
* groups
* guardians with historical reports

Use `is_active`.

Actual destructive deletion should be limited to accidental empty/unreferenced records.

---

# 40. Suggested Source Structure

```text
src/
├── app/
│   └── [locale]/
│       ├── (auth)/
│       │   └── login/
│       │
│       └── (protected)/
│           ├── dashboard/
│           ├── groups/
│           ├── students/
│           ├── teachers/
│           ├── reports/
│           └── settings/
│
├── features/
│   ├── auth/
│   ├── groups/
│   ├── students/
│   ├── teachers/
│   ├── sessions/
│   ├── attendance/
│   ├── progress/
│   ├── reports/
│   └── email/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── i18n/
│   ├── validation/
│   └── dates/
│
└── messages/
    ├── en.json
    └── ar.json

supabase/
└── migrations/

tests/
├── unit/
├── integration/
└── e2e/

docs/
├── SPEC.md
├── IMPLEMENTATION_PLAN.md
├── DECISIONS.md
└── PROGRESS.md
```

Prefer focused feature files rather than large universal files.

---

# 41. Backend Organization

The backend is contained within the same Next.js project but business logic must remain independent from React components.

Example:

```text
features/reports/
├── report.repository.ts
├── report.service.ts
├── report.renderer.ts
├── report.schemas.ts
└── report.types.ts
```

UI:

```text
features/reports/components/
```

Business logic should not live inside page components.

---

# 42. Server Actions vs Route Handlers

Use Server Actions for authenticated application mutations when appropriate.

Examples:

```text
createStudent
updateStudent
createGroup
saveWeeklyUpdate
submitWeeklyUpdate
generateReports
sendReport
```

Use Route Handlers for:

```text
email provider webhooks
scheduled jobs
external integrations
```

Do not create unnecessary REST endpoints merely because a traditional backend would.

---

# 43. Validation

Every mutation must validate input using Zod.

Example:

```ts
const studentSchema = z.object({
  firstNameEn: z.string().trim().min(1),
  lastNameEn: z.string().trim().min(1),
  firstNameAr: z.string().trim().optional(),
  lastNameAr: z.string().trim().optional(),
});
```

Client validation improves UX.

Server validation remains authoritative.

---

# 44. Testing Requirements

Do not consider the project complete without tests.

## Unit tests

Test:

* language fallback
* effective performance
* report data aggregation
* attendance calculation
* report snapshot generation
* duplicate-send prevention

## Authorization integration tests

Test:

* admin can access all school groups
* teacher can access assigned group
* teacher cannot access another teacher's group
* teacher cannot access unrelated student
* teacher cannot send parent reports

## End-to-end tests

At minimum:

### Flow 1 — English

```text
Admin logs in
→ creates teacher
→ creates student + guardian
→ creates group
→ assigns student
→ teacher records weekly update
→ teacher submits
→ admin generates report
→ admin previews report
```

### Flow 2 — Arabic

```text
Teacher selects Arabic
→ application switches RTL
→ teacher records update
→ Arabic labels work
→ Arabic report renders correctly
```

### Flow 3 — Student exception

```text
Default group performance = GOOD
Student A has no override
Student B override = EXCELLENT

Report A → GOOD
Report B → EXCELLENT
```

### Flow 4 — Authorization

```text
Teacher A attempts to access Teacher B group
→ access denied
```

---

# 45. Accessibility

Use semantic HTML.

Required:

* visible labels
* keyboard-accessible controls
* appropriate focus states
* adequate contrast
* no color-only status communication
* accessible dialogs/dropdowns
* useful error messages

---

# 46. Error Handling

User-facing errors should be simple.

Example:

```text
We couldn't save the update. Please try again.
```

Do not show database errors or stack traces.

Log technical details server-side.

---

# 47. Empty States

Every major screen needs a useful empty state.

Example:

```text
No groups assigned yet.
```

Admin:

```text
No students yet.
Add your first student to get started.
```

Do not display blank tables.

---

# 48. Seed Data

Provide development seed data:

```text
1 school
1 admin
2 teachers
3 groups
10–20 students
guardians
several submitted sessions
```

Include English and Arabic examples.

This allows immediate UI testing.

---

# 49. Environment Configuration

Provide:

```text
.env.example
```

Include placeholders for:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
BREVO_API_KEY
EMAIL_FROM
CRON_SECRET
```

Never commit real secrets.

---

# 50. Documentation

README must contain:

```text
Project purpose
Prerequisites
Installation
Environment variables
Supabase setup
Database migration
Seed instructions
Development command
Testing commands
Production build command
Deployment notes
```

---

# 51. Future Extension Points

The architecture should make these possible without implementing them:

```text
subjects
homework
assessments
parent portal
student portal
payments
registration
certificates
SMS
WhatsApp
attachments
AI translation
AI report drafting
multiple schools
mobile apps
```

Do not create unused abstractions for all of these.

Apply YAGNI.

Only preserve clean boundaries where future functionality is reasonably obvious.

---

# 52. Frontend Definition of Done

Frontend MVP is complete when:

* Admin can navigate all administrative sections.
* Teacher sees only relevant teacher screens.
* Weekly update works well on mobile.
* English interface works.
* Arabic RTL interface works.
* User language persists.
* forms have loading/error/success states
* tables/lists work on small screens
* report preview works in all language modes
* no untranslated application strings remain
* no obvious accessibility issues remain

---

# 53. Backend Definition of Done

Backend MVP is complete when:

* authentication works
* authorization works
* RLS works
* student CRUD works
* guardian CRUD works
* teacher management works
* groups work
* memberships work
* sessions work
* attendance works
* group progress works
* student overrides work
* report snapshots work
* email sending works
* duplicate sending is prevented
* automated tests pass
* database migrations reproduce the environment from zero

---

# 54. Overall Definition of Done

This exact workflow must succeed:

```text
ADMIN
creates teacher
      ↓
creates student
      ↓
adds guardian email
      ↓
creates group
      ↓
assigns teacher + student

TEACHER
logs in
      ↓
opens group
      ↓
marks all present
      ↓
changes absent students
      ↓
writes one shared progress update
      ↓
sets default performance
      ↓
adds individual exception if required
      ↓
submits

ADMIN
opens reports
      ↓
generates reporting period
      ↓
previews student report
      ↓
sends ready reports

PARENT
receives appropriate
English / Arabic / bilingual report
```

---

# 55. Implementation Strategy for Codex

DO NOT attempt to implement the entire project in one unreviewed change.

Use phases.

## Phase 1 — Foundation

Implement:

* Next.js project
* Supabase connection
* schema/migrations
* authentication
* profiles
* roles
* English/Arabic infrastructure
* protected layout
* base navigation

Verify and commit.

---

## Phase 2 — School Administration

Implement:

* students
* guardians
* teachers
* groups
* group memberships
* teacher assignments

Verify and commit.

---

## Phase 3 — Teacher Workflow

Implement:

* My Groups
* session creation
* attendance
* Mark All Present
* group progress
* default performance
* student exceptions
* drafts
* submission

This phase receives the greatest UX attention.

Verify mobile layout and RTL.

Commit.

---

## Phase 4 — Reports

Implement:

* reporting periods
* report aggregation
* immutable snapshots
* English renderer
* Arabic renderer
* bilingual renderer
* admin report listing
* preview

Verify and commit.

---

## Phase 5 — Email

Implement:

* provider abstraction
* Brevo
* React Email templates
* send one report
* bulk send
* delivery state
* failure handling
* duplicate-send prevention

Verify and commit.

---

## Phase 6 — Hardening

Implement/test:

* RLS tests
* authorization tests
* RTL
* accessibility
* loading states
* empty states
* error handling
* responsive layouts
* database constraints
* seed data
* README

Run complete test suite and production build.

---

# 56. Instructions for Codex

Before changing code:

1. Read this entire specification.
2. Create `AGENTS.md`.
3. Create `docs/IMPLEMENTATION_PLAN.md`.
4. Create `docs/DECISIONS.md`.
5. Create `docs/PROGRESS.md`.
6. Break implementation into reviewable phases.
7. Work on one phase at a time.
8. Run tests before and after meaningful changes.
9. Commit working checkpoints frequently.
10. Do not silently change product requirements.
11. Record architectural decisions in `docs/DECISIONS.md`.
12. Keep `docs/PROGRESS.md` updated after each completed phase.
13. Prefer simple solutions.
14. Avoid speculative features.
15. Never weaken authorization to make a test pass.
16. Never expose secrets to the client.
17. Never delete migrations already applied.
18. Preserve English and Arabic support in every new UI feature.
19. Test mobile layouts for teacher workflows.
20. Stop and report clearly if a requirement conflicts with an existing architectural decision.

Primary priorities, in order:

```text
1. Correctness
2. Security/privacy
3. Teacher ease of use
4. Arabic/English quality
5. Maintainability
6. Visual polish
7. Additional features
```

Do not sacrifice priorities 1–5 for feature quantity.
