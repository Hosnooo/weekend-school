# Shared personal account — 2026-10-09

## One destination for everyone

The canonical personal self-service route is `/[locale]/account`, labelled **My account** for Administrators, Teachers, and dual-role users. Teacher `/[locale]/profile` redirects there for older bookmarks. School settings remains Administrator-only; it changes school-level configuration, not login identity.

The account page manages the logged-in user's own `profiles.display_name`, Supabase Auth login email, and password. Teacher business records remain read-only in that page and are not silently rewritten. Changing a personal login name or email does not alter authoritative teacher/class assignment or past reports.

Passwords are bcrypt hashes; the existing password can never be retrieved or revealed. Eye controls only unmask text currently entered into the password form. Every password change verifies the current password independently with Supabase before calling the current user's own `auth.updateUser`. The auxiliary verifier does not persist a browser session or sign out other users.

Email change uses Supabase `auth.updateUser({email})`, not service-role modification. The new email is pending until provider-required confirmation. The change-email template stays under Supabase configuration; do not change the Reset Password or Invite User templates that were repaired in PR #37. If email confirmation redirects fail, verify the project's canonical Site URL and template separately.

## Safety and release

- No database migrations or account backfills.
- Do not change production Supabase Auth keys, users, emails, or passwords to test the feature.
- Test schema/UI transitions and permissions locally using development fixtures only; do not use production accounts.
- One PR and one controlled production deployment after reviewed tests.
