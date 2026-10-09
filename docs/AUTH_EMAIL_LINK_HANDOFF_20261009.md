# Auth email-link handoff and canonical website — 2026-10-09

## Scope and cause

The live password recovery failure is **not** fixed by renaming the website or adjusting the Auth allowlist alone. A recovery request on 2026-10-09 at 20:51 UTC used the correct new domain, `mceschoolreporting.vercel.app`; hosted Supabase accepted its first verification (303) but the browser still displayed an invalid/expired link. An earlier one-time URL was visited more than once, and later requests failed as already used. A browser-session handoff problem and email-link prefetching are both relevant failure modes. Do not claim the two are independently proven root causes.

The `SetPasswordForm` now supports two paths:
- **New manual confirmation path:** email links land at `/[locale]/set-password#token_hash=...&type=recovery` or `type=invite`. The token is kept in the URL **fragment**, never the HTTP request/query string. Landing on the page cannot redeem it. A person clicks **Continue to set password**, at which point the browser calls `auth.verifyOtp({token_hash, type})`. Success unlocks the existing password form and clears the hash from history; failure shows a safe error and cannot reuse an existing signed-in account's session.
- **Legacy path:** existing Supabase confirmation URLs, codes, and session fragments remain recognized to avoid breaking pre-existing emails.

The new path **only activates when Supabase emails are updated**. Do not change email templates until the reviewed application branch is tested and the new production deployment is READY.

## Supabase dashboard actions **after** production code rollout

Open **Supabase → Authentication → Email Templates** for the existing Weekend School production project. Keep all other Auth settings and templates unchanged.

In **Reset Password**, replace only the confirmation button's `href` with:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery">Continue to reset your password</a>
```

In **Invite User**, replace only the invitation button's `href` with:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=invite">Accept your invitation</a>
```

`{{ .RedirectTo }}` keeps the language-specific URL passed by the server, and `{{ .TokenHash }}` is the signed one-time hash provided by Supabase. Do **not** use `{{ .Token }}` or `{{ .ConfirmationURL }}` with this manual-verification link. Keep all existing email styling, sender, and wording unless the user separately requests changes.

**Production URL configuration**
- Site URL: `https://mceschoolreporting.vercel.app`
- Redirect allowlist: `https://mceschoolreporting.vercel.app/en/set-password` and `https://mceschoolreporting.vercel.app/ar/set-password`.
- Existing valid legacy redirects can remain temporarily. Do not change signing keys, token lifetime, SMTP credentials, Auth user records, or passwords.

## Verification and rollback

1. On an isolated local or reviewed preview version, verify that visiting the manual-fragment URL triggers **zero** calls to `verifyOtp` until the user clicks Continue. Invalid/expired hashes must stay locked and must not fall back to an existing session.
2. Once reviewed, merge the application change and allow **one** normal Vercel `main` production deployment.
3. Confirm `READY` and preserve the logged-in Administrator browser.
4. Make the two Supabase template changes in the dashboard **after** the new app version is serving the canonical URL.
5. Request **one** fresh password reset to an authorized test account; open the new email, confirm that the Continue button appears, click it once, and test password setup. Do not share the token or the link.
6. Independently test a single new legitimate invitation, if available.
7. No real guardian reports or bulk email campaigns are part of this change.

**Rollback:** If the new manual link fails, first revert each edited Supabase template button to its original `{{ .ConfirmationURL }}` value; this restores the old email format without changing accounts or migrations. Review and revert the app commit separately if required.

## GitHub repository metadata

The GitHub repository's **About → Website** field is independent of tracked files. Set it to `https://mceschoolreporting.vercel.app` using the **gear icon** beside About on `https://github.com/Hosnooo/weekend-school`. That metadata cannot be updated by the available GitHub repository-files connector. The README and domain-specific tests are updated in this PR.
