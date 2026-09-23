# Repository Working Agreement

## Authority and scope

- `docs/SPEC.md` is the product source of truth. Do not add features that it does not request.
- Resolve ambiguity in this order: correctness, security/privacy, teacher ease of use, English/Arabic quality, maintainability, visual polish, then feature quantity.
- Implement one phase from `docs/IMPLEMENTATION_PLAN.md` at a time. Update `docs/PROGRESS.md` only from observed results.
- Record requirement interpretations and architectural changes in `docs/DECISIONS.md`; never silently change the product contract.

## Required workflow

- Use test-driven development for business rules, authorization helpers, validation, and regressions: observe a relevant failing test before adding production behavior.
- Before declaring a phase complete, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` and record the results in `docs/PROGRESS.md`. Database/RLS changes also require real `pnpm test:db`; release gates that change user workflows require the relevant `pnpm test:e2e` coverage.
- Keep applied Supabase migrations immutable. Correct an applied schema with a new migration.
- Prefer small, reviewable commits at working checkpoints. Never weaken authorization or RLS to make a test pass.
- Preserve unrelated user changes. Use archive/restore for normal lifecycle changes. Permanent deletion is an explicit admin-only workflow for archived records, must show dependent-data impact, may offer export first, and must be school-scoped and transactional.

## Architecture boundaries

- Keep one Next.js App Router application: React UI at the edge, feature services for business rules, repositories for persistence, and provider adapters for external services.
- Keep page and layout components thin. Business rules must not live in React components or route files.
- Use Server Actions for authenticated in-app mutations. Reserve Route Handlers for provider webhooks, scheduled jobs, and other external integrations.
- Organize domain code under `src/features/<feature>/`; shared infrastructure belongs under `src/lib/`; reusable presentational elements belong under `src/components/`.
- Do not introduce microservices, GraphQL, queues, event buses, custom password systems, or speculative abstractions.

## Security and data rules

- Treat server authorization and PostgreSQL RLS as separate, required layers.
- Every school-owned row carries `school_id`; every query and mutation is scoped to the authenticated profile's school.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, or `CRON_SECRET` through client code or a `NEXT_PUBLIC_` name.
- Validate every mutation on the server with Zod. Normalize emails before persistence.
- Use archive/restore for teachers, students, Classes, Subjects, Groups, guardians, and other school records in normal workflows. Permanent deletion is admin-only, requires an archived target when meaningful history exists, must preview dependent-data impact, and may remove dependent history only inside the same-school confirmed transaction.
- Reports use only submitted teacher sources and official attendance resolution. Finalized reports are immutable snapshots; corrections create revisions rather than silently mutating a finalized report.

## English and Arabic

- Put all visible application copy in `messages/en.json` and `messages/ar.json`; use stable semantic keys.
- Locale routes are `/en/...` and `/ar/...`. The root document must set matching `lang` and `dir` values.
- Use CSS logical properties and direction-aware icons. Do not approximate RTL with text alignment alone.
- Store dates and timestamps in canonical database types and format them for the active locale at display time.
- Never invent or automatically translate teacher-authored content. Apply the fallback rules in `docs/SPEC.md`.

## Code and tests

- TypeScript strict mode is mandatory. Prefer named domain types and explicit service interfaces over untyped objects.
- Keep files focused; colocate feature components, schemas, services, repositories, and tests where they change together.
- Unit-test pure rules. Integration-test database constraints, RLS, and server authorization. End-to-end-test the approved workflows in the current specification.
- Static SQL contract tests are never a substitute for the real PostgreSQL/RLS gate when database behavior changes.
- Teacher workflows are mobile-first at 360px and must be checked in both LTR and RTL.

## Standard commands

```text
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
