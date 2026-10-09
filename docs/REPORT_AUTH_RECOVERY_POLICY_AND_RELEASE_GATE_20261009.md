# Weekend School — Auth recovery decision and production release gate

**October 9, 2026 | PR #36 | Draft, not deployed**

## Purpose

Keep distinct: (a) recovering a user identity and its school-specific role links;
(b) restoring live authenticated sessions; and (c) full Supabase-managed
disaster recovery. A successful local UI smoke check only demonstrates (a)
for the tested users.

## Verified

- Application/public-data restore and pending migrations preserved the existing
  report records (3 class draft cycles, 21 old draft reports, 87 attendance pairs,
  13 saved comments, 10 approvals, zero delivery rows).
- Restore of **6 auth.users, 6 auth.identities and 6 public.profiles** succeeded
  in a disposable local Supabase project with compatible core Auth columns.
- Existing linked Admin and Teacher-only identities both performed **fresh**
  local GoTrue sign-ins using **temporary local-only passwords**. Admin browser
  edited, saved and reloaded bilingual report content and previewed email; a
  Teacher-only identity could not access the Administrator editor.
- The full 29-report preview parity and actual SQL Admin save/finalization
  with transaction rollback passed separately. All were local only.

## Read-only production inventory, October 9

| Table | Count |
|---|---:|
| auth.users | 6 |
| auth.identities | 6 |
| public.profiles | 6 |
| auth.sessions | 8 |
| auth.refresh_tokens | 31 |
| auth.flow_state | 7 |
| auth.one_time_tokens | 3 |
| auth.mfa_amr_claims | 8 |
| auth.mfa_factors | 0 |
| auth.mfa_challenges | 0 |
| auth.mfa_recovery_code_sets | 0 |
| auth.mfa_recovery_codes | 0 |
| auth.schema_migrations | 82 |
| storage.buckets / objects | 0 / 0 |

Session-token and flow-state counts are a moving snapshot, **not** a requirement
to make old tokens usable after recovery. MFA AMR claims do not imply enrolled
MFA factors; in the observed inventory there are zero enrolled factors.

## Completed offline backup inventory — October 9, 2026

The operator ran `sha256sum --check --status SHA256SUMS` successfully and
`scripts/audit-private-auth-dump.py` against the private verified
`report-upgrade-20261009T082214Z/data.sql` backup on Linux.

**Actual Auth COPY row counts from the private backup match read-only production**
for every populated Auth data table listed below:

| Managed Auth data table | Backup COPY rows | Production read-only rows |
|---|---:|---:|
| `auth.users` | 6 | 6 |
| `auth.identities` | 6 | 6 |
| `auth.sessions` | 8 | 8 |
| `auth.refresh_tokens` | 31 | 31 |
| `auth.flow_state` | 7 | 7 |
| `auth.one_time_tokens` | 3 | 3 |
| `auth.mfa_amr_claims` | 8 | 8 |

The following other Auth COPY tables were recorded as **0** in the backup:
`audit_log_entries`, `custom_oauth_providers`, `instances`,
`mfa_challenges`, `mfa_factors`, `mfa_recovery_code_sets`,
`mfa_recovery_codes`, `oauth_authorizations`, `oauth_client_states`,
`oauth_clients`, `oauth_consents`, `saml_providers`,
`saml_relay_states`, `scim_tokens`, `scim_users`,
`sso_domains`, `sso_providers`, `webauthn_challenges`,
and `webauthn_credentials`. No MFA factors or registered credentials
were found in the checked snapshot.

**Important distinction:** Production has 82 `auth.schema_migrations` rows,
but **the Auth schema migration table is not present in the data-only dump**.
This means the backup is not a self-contained replay of the managed Auth
schema/version history. Recovery must provision a compatible managed Auth
environment and revalidate schema compatibility; copying its migration-history
rows across independently versioned deployments is not a safe substitute.
The working core identity/role-link restore and local browser smoke covered
users/identities only and intentionally excluded saved sessions/tokens.

A separate read-only production recheck confirmed the application counts remain:
3 draft cycles; 21 old draft V2 reports; 10 approvals; 87 Admin attendance
pairs; 13 comment rows; **zero delivery rows**; zero Storage buckets/objects.
Neither of the pending application migration versions
`20261009090000` or `20261009091000` is in production
`supabase_migrations.schema_migrations` as of this check.

The backup inventory requirement is **complete**. It does **not** independently
prove compatible managed Auth platform configuration or reusability of archived
tokens in a different Supabase project. That separate disaster-recovery problem
must not be conflated with the normal PR #36 rollout.

## Authentication continuity for the planned PR #36 release

**Default requirement: preserve existing passwords and active sessions.**

PR #36 is an in-place application/database update against the **same production
Supabase project**. The two report/attendance migrations target application
tables and functions in `public`, not `auth.users`, `auth.sessions`,
`auth.refresh_tokens` or password hashes. We should:

1. Keep the current production Supabase project URL, signing-key setup, Auth
   credentials and client/session-cookie settings stable.
2. Do **not** replay Auth backups, reset passwords, call global sign-out, revoke
   refresh tokens, rotate JWT keys or migrate Auth users as part of this release.
3. Back up production immediately before DDL, apply the two approved
   **forward-only report migrations** in place, and deploy the compatible app
   once after explicit authorization.
4. Test an existing already-signed-in browser session after deployment and
   normal session refresh, plus fresh sign-in with an existing password where
   permitted. Never expose or collect account credentials in logs or tickets.
5. If session behavior changes unexpectedly, stop delivery and investigate
   cookie, redirect, Auth configuration and signing-key changes before any
   password resets or large-scale sign-outs.

Existing sign-in continuity is the **intended release behavior**, not proof
that a specific browser session will survive every unrelated cookie or
client-side app bug; postdeployment smoke checks remain necessary.

## Separate disaster-recovery policy — only if the Auth project itself is lost

For true restoration to a *different* or rebuilt Supabase Auth service, aim
to preserve users' IDs, profile/role links, password hashes and, **if safely
feasible**, active sessions. Restoration of active sessions depends on a
compatible managed Auth schema and configuration (including token-signing
keys, session lifecycle and refresh-token state). The six-user smoke test did
not test those conditions: it used disposable passwords, restored only core
users/identities, and deliberately omitted live sessions/refresh tokens.

Never copy production-valid session/refresh credentials into an unrelated
online test instance. Recovery of old sessions must instead be planned and
verified using a secured compatible disaster-recovery procedure and controls
for signing-key access. If continuity cannot be guaranteed in an actual
outage, a fresh login may be needed; **a password reset is not inherently
required** where the original password hashes are recovered correctly.

This additional disaster-recovery rehearsal remains optional for the
in-place PR #36 release, subject to the school's broader resilience policy.
It is not an authorization to force sign-outs or reset passwords during
deployment. Supabase reference:
https://supabase.com/docs/guides/auth/sessions

## Offline, private backup inventory

After checkout, the operator can check the verified backup without opening any
secrets or uploading data:

```bash
cd ~/projects/weekend-school-attendance-review
BACKUP_DIR="$HOME/weekend-school-secure-backups/report-upgrade-20261009T082214Z"
(cd "$BACKUP_DIR" && sha256sum --check --status SHA256SUMS)
python3 scripts/audit-private-auth-dump.py "$BACKUP_DIR/data.sql"
```

Report only the **table-name and count lines**. This tool neither modifies
the backup nor reconnects to production. Counts must be compared with a
read-only production inventory taken near the maintenance window.

## Release checklist — do not execute without a separate approval

- [x] Unit, static, pgTAP, actual-public-data migration, output parity,
      SQL save/finalization and rollback, core Auth and UI browser checks
- [x] Compare the offline backup's **all managed Auth-table counts** against
      the read-only inventory; document schema/version-specific omissions
- [x] Release policy: preserve the existing production Auth project, password
      hashes and sessions; do not trigger session revocation/key rotation/reset
- [ ] Verify existing signed-in browser remains authenticated after deployment
- [ ] Set release window, avoid concurrent report edits, take a fresh
      timestamped checksum-verified backup, confirm production row counts
- [ ] Run approved **forward-only** migrations once
- [ ] Deploy approved build once
- [ ] Confirm Admin/Teacher sign-in, Editor save, report preview and
      Guardian-email preview **without delivery**
- [ ] Re-enable/send guardian reports only after **separate authorization**

**Current release status: DRAFT / HOLD.** No production migration, merge,
deployment, or report delivery is implied by this document.
