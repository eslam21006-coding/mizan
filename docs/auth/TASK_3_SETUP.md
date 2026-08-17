# Task 3 — Authentication & Roles setup

This document records the hosted Supabase configuration required by Task 3. The application code alone is not sufficient to declare invite-only authentication complete.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe publishable key.
- `SUPABASE_SECRET_KEY`: trusted server-only secret key. Never expose it to the browser.
- `MIZAN_SITE_URL`: canonical HTTPS application URL.
- `MIZAN_ADMIN_EMAIL`: used only by `npm run bootstrap:admin` for the initial Admin.

## Role authority

Mizan roles are stored only in Supabase Auth `app_metadata.role` with one of these values:

- `admin`
- `mentee`

Never use `user_metadata` for authorization. It is user-editable.

## Hosted Supabase Auth configuration

Before Task 3 can be approved:

1. Email/password authentication must be enabled.
2. Public self-signup must be disabled. Accounts are created only through trusted Admin invitations/bootstrap.
3. Set the Auth Site URL to the production `MIZAN_SITE_URL`.
4. Add the deployed application URL to the allowed Redirect URLs.
5. Configure the **Invite user** email template for the SSR token-hash exchange:

```html
<h2>You've been invited to Mizan</h2>
<p>Use the link below to activate your account.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">
    Activate Mizan account
  </a>
</p>
```

The default `ConfirmationURL` flow is not used because SSR needs the token hash at the server endpoint in order to establish the cookie-backed session before password setup. Every successfully verified invitation is routed to `/set-password` before application access.

## Initial Admin

After the hosted project and environment variables are configured, run:

```bash
npm run bootstrap:admin
```

The script scans all Supabase Auth user pages before deciding whether an invitation is required. It then either invites `MIZAN_ADMIN_EMAIL` or promotes the existing Auth user and writes `app_metadata.role = "admin"` through the trusted Admin API. The configured email is not printed to command output.

## Mentee invitation flow

1. An authenticated Admin opens `/admin/invites`.
2. The server action freshly verifies that the caller is still an Admin.
3. The trusted Supabase Admin API sends the invitation.
4. The new Auth user is stamped with `app_metadata.role = "mentee"`.
5. If role assignment fails, Mizan attempts to delete the just-created user. A cleanup failure is surfaced distinctly because the Auth account may still exist without a recognized Mizan role.
6. The invitation exchanges its token at `/auth/confirm` and always redirects to `/set-password`.
7. The invited user chooses a password and enters Mizan.

## Task boundary

Task 3 covers authentication, Admin/Mentee roles, login/logout, and invite-only signup. Business ownership, memberships, Row Level Security policies, and unauthorized business-data access tests are deliberately deferred to Task 4.
