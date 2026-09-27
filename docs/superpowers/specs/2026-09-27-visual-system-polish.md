# Weekend School — Visual System Polish

**Date:** 2026-09-27
**Status:** Approved
**Scope:** Presentation refinement only

## Goal

Improve the existing Weekend School interface so it feels calmer, cleaner,
more professional, and easier to scan without redesigning workflows or pages.

This refines the existing approved website UX design. It is not a second
website redesign.

## Visual direction

Use a restrained modern administration/SaaS style:

- clear typography hierarchy;
- strong record names and quiet metadata;
- slightly more compact controls;
- fewer nested borders and cards;
- deliberate spacing;
- subtle statuses and badges;
- consistent English and Arabic presentation.

The interface should feel professional and operational rather than decorative.

## Typography hierarchy

Create consistent styles for:

1. page titles;
2. section titles;
3. subsection titles;
4. record/entity names;
5. body text;
6. form labels;
7. metadata and secondary text;
8. table headings;
9. badges/status text.

Record information should read like:

    Ahmed Al-Hassan
    ahmed@example.test · +1 780 555 1234
    Archived

The name is primary. Email, phone, dates, groups, and similar information
are secondary metadata. Status is shown only when useful.

English should use a clean browser/system sans-serif stack without adding
an unnecessary font dependency.

Arabic should explicitly use the existing Noto Sans Arabic font and preserve
the same hierarchy under RTL.

## Spacing and density

- More breathing room between major sections.
- Less space inside individual rows and simple controls.
- Keep metadata close to the record it describes.
- Primary actions remain visually obvious.
- Secondary actions should be quieter.
- Inputs and selects may become slightly more compact while retaining
  accessible interaction sizes.

## Surfaces

Do not make every section a bordered card.

Prefer, in order:

1. typography;
2. whitespace;
3. subtle surface contrast;
4. dividers;
5. bordered cards only for genuine grouped content.

Avoid nested cards.

Dashboard summaries, dialogs, and genuinely grouped content may remain cards.

## Forms

Forms should be quieter and easier to scan:

- labels use moderate emphasis;
- hints and validation messages remain secondary;
- reduce unnecessary fieldset/card borders;
- preserve Save/Cancel clarity;
- preserve strong focus-visible behavior.

No form workflow changes are authorized.

## Lists and records

Management lists should emphasize:

1. record name;
2. supporting metadata;
3. state when relevant;
4. actions.

Rows should not feel oversized.

Do not convert all tables into cards.

Responsive list behavior already implemented must remain intact.

## Guardian selector reference

The Add Student Guardian section is the current reference example.

Guardian mode choices remain compact.

Existing Guardian options show:

- normal-size radio;
- Guardian name as primary text;
- email as muted secondary text;
- archived state only when relevant.

They must not look like large padded cards.

The Add Student order remains:

1. Student identity
2. Guardian
3. Enrollment

## Implementation scope

Primary implementation surface:

- `src/app/globals.css`

Shared UI components may change only when CSS alone is insufficient:

- PageHeader;
- FormField;
- DataTable;
- Badge/status presentation;
- other existing shared primitives directly responsible for typography
  or density.

Feature components may adopt shared metadata/record classes where required.

Do not perform page-by-page redesigns or unrelated refactors.

## Out of scope

Do not change:

- database schema;
- migrations;
- Supabase behavior;
- RLS;
- authorization;
- routes;
- navigation architecture;
- business logic;
- enrollment behavior;
- Guardian lifecycle rules;
- reports;
- Teacher workflows.

Do not add a dashboard template or large component framework.

## Colors

Keep the existing restrained color system.

Minor adjustments are allowed for:

- muted text;
- border subtlety;
- surface contrast;
- hover states;
- badge intensity.

Do not create a new branding system.

## RTL and responsive behavior

All directional CSS must use logical properties.

Verify representative screens in:

- English desktop;
- Arabic desktop;
- English narrow;
- Arabic narrow.

Do not add one-off left/right fixes.

## Verification

During implementation run focused checks only:

- visual/design-system contract tests;
- Student/Guardian UX contracts;
- lint;
- typecheck.

Manual local review:

1. Dashboard
2. Students
3. Add Student / Guardian selector
4. one Student detail
5. Classes
6. one Arabic screen

At the end of the entire batch:

- full local unit suite once;
- `git diff --check`;
- final diff review for accidental behavior changes.

Do not push during iteration.

GitHub CI should run only after the visual batch is accepted locally.

## Success criteria

The pass succeeds when:

- page hierarchy is clearer;
- names visually lead metadata;
- email/phone/date text is quieter;
- controls feel less bulky;
- nested borders/cards are reduced;
- English and Arabic both look intentional;
- existing behavior is unchanged;
- most improvement comes from shared styling rather than page-specific edits.
