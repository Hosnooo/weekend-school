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

## Recovery decision for this report-authority release

**Prefer identity-preserving, fresh-session recovery**, subject to the school
operator's approval:

1. Secure a fresh, private, verified database backup and retain the previous
   backup outside Git and deployment artifacts.
2. In an isolated environment, restore the application schema, data, and core
   Auth users/identities with matching account IDs; verify every profile and
   Admin/Teacher school role link.
3. Recreate or explicitly verify Auth platform configuration (JWT secrets,
   OAuth/SMTP providers and redirect URLs, any active security factors), because
   database row recovery does not restore dashboard configuration or secrets.
4. In a genuine restoration scenario, **do not import active production
   auth.sessions, auth.refresh_tokens, one-time tokens or flow_state into the
   browser-test project**. Invalidate or let old sessions expire, then require
   new sign-in. Never copy valid refresh tokens to another online Auth instance.
5. If original password hashes are restorable in a compatible Auth stack,
   verify normal sign-in privately; otherwise use the controlled password-reset
   flow. The local smoke test sets temporary passwords and **does not prove
   original passwords will still work**.
6. Verify the reported zero Storage buckets/objects is still accurate in
   production before recovery. Database rows alone cannot replace object
   storage contents if new objects have been added later.

This is a **recovery strategy**, not a claim of fully rehearsed managed Auth
disaster recovery. If automatic preservation of existing sessions or exact
managed Auth/platform state is a business requirement, a separately provisioned
compatible Supabase project and an approved full restore rehearsal are necessary;
that release gate remains open.

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
- [ ] Compare the offline backup's **all managed Auth-table counts** against
      the read-only inventory; document schema/version-specific omissions
- [ ] Operator accepts fresh-sign-in session policy or requests a complete
      managed Auth/session restoration rehearsal
- [ ] Set release window, avoid concurrent report edits, take a fresh
      timestamped checksum-verified backup, confirm production row counts
- [ ] Run approved **forward-only** migrations once
- [ ] Deploy approved build once
- [ ] Confirm Admin/Teacher sign-in, Editor save, report preview and
      Guardian-email preview **without delivery**
- [ ] Re-enable/send guardian reports only after **separate authorization**

**Current release status: DRAFT / HOLD.** No production migration, merge,
deployment, or report delivery is implied by this document.
