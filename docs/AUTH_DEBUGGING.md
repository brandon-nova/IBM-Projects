# Signup or verification email not working

## Domain verified, but no email arrives?

Domain verification confirms DNS; it does not test the saved SMTP credentials or confirm that a resend was eligible.

1. Open [Authentication → Users](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/users) and search for the recipient. If absent, **create an account** first. If already confirmed, **sign in**; verification resend will not send a confirmation. `npm run bootstrap` creates an already-confirmed administrator.
2. If the account exists and is unconfirmed, request one verification email, then open **Resend → Emails**. If absent there, check **Supabase → Logs → Auth** at the attempt time for SMTP authentication, sender, or rate-limit errors. A resend success message intentionally does not reveal whether an account exists.
3. If Resend shows **Delivered**, the recipient mail server accepted it; check spam/quarantine and ask your mail administrator about filtering. If **Bounced/Failed/Suppressed**, open that event for the reason.
4. Keep tracking disabled for auth emails; it is not required for sending. Do not change DNS or enable tracking just to troubleshoot a missing message.

To inspect the account without changing it, run:

```sh
npm run auth:inspect
```

Enter the recipient email when prompted. This local-only administrator tool uses the service-role key from `.env.local` for GET requests. It reports account confirmation, profile presence, and access binding without sending email or exposing keys. Do not put this key in Cloudflare or browser code.

## Requested test-account reset and personal administrator

The local `.env.local` bootstrap administrator is set to `btongnova@gmail.com`. To perform the specifically requested reset of `nova@ibm.com` in this development workspace, run:

```sh
npm run auth:reset-test
```

This command first provisions/repairs and verifies the confirmed personal administrator, then checks the IBM test account for linked projects, memberships, requests, and submitted/reviewed evidence. It stops without deleting the IBM login if the personal admin is not ready or linked work exists. It deletes only the named test Auth account and its cascaded profile/settings. The email allowlist row is left unbound, preserving any explicit revocation. No email is sent by this command. It requires the account-repair migration and local service-role key already configured for bootstrap.

For a new personal administrator, its password is the existing `BOOTSTRAP_ADMIN_PASSWORD`; an existing account retains its original password. Sign in at **https://projects.fncai.org/login**, not the root domain. After reset, sign out of old sessions and use a private window to **create** `nova@ibm.com` again through normal signup. Do not bootstrap the IBM address again: bootstrap confirms email administratively and does not test email delivery. Do not put the personal address in a public env file; runtime access is stored in Supabase.

## Confirmed account, but profile or workspace access is missing

A login created before the application tables were installed may be missing its app records. Older bootstrap code also skipped repairs for existing logins. For your intended administrator:

1. Copy all of [the account-repair migration](../supabase/migrations/20261022000300_repair_account_records.sql), paste into [Supabase SQL Editor → New query](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new), then click **Run**. Do not rerun `setup.sql`.
2. In `.env.local`, set `BOOTSTRAP_ADMIN_EMAIL` to the confirmed administrator address you want to repair. Keep your existing service-role key, admin name, and bootstrap password configured.
3. Run `npm run bootstrap`, then `npm run auth:inspect` for the same email. Expect profile **present**, workspace access **active and bound**, and email **already confirmed**.
4. Sign in using the account's original password. Use **Forgot password?** if you do not know it. No website redeployment is needed for this database/account repair.

Repair preserves existing passwords/profile details and does not change email confirmation or silently restore revoked access. Only the trusted service-role provisioning tool can execute it. Normal signed-in administrators and anonymous callers cannot. The SQL migration installs the repair operation; `npm run bootstrap` applies it to the selected account.

## No email provider yet?

Turning on custom SMTP does not create an email service. Set up the provider first:

1. Sign up at [Resend](https://resend.com). Go to **Domains → Add domain**, enter `fncai.org` (or `m.fncai.org` if you prefer). Your website stays at `projects.fncai.org`.
2. In **Cloudflare → fncai.org → DNS → Records**, add the records Resend displays. Use **DNS only** for any mail-related CNAME records. Wait until Resend shows **Verified**.
3. In Resend, go to **API Keys → Create API key**. Give it permission to send from the verified domain.
4. Open [Supabase → SMTP Settings](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/smtp). Enable custom SMTP and save:

| Field | Enter |
| --- | --- |
| Sender email | `no-reply@fncai.org` |
| Sender name | `IBM Projects` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |

If you verify `m.fncai.org`, use `no-reply@m.fncai.org` instead. Existing records for `auth.fncai.org` can stay while you verify the new sender domain; do not delete unrelated mail records. A domain verified only as `auth.fncai.org` does not automatically authorize the root or `m` sender.

The password is the API key, not your Resend login password. Do not paste it into chat or browser code. Confirm the current settings and sending limits in Resend. SMTP changes save directly in Supabase; no app redeployment is needed for them.

Without custom SMTP, Supabase's built-in service limits sending to authorized project-team recipients; it is not general employee email delivery. Keep email confirmation enabled. Your bootstrapped administrator can sign in without a verification email.

## Try one signup and follow it through

1. Open [the live signup page](https://projects.fncai.org/login?mode=signup). Use a new exact `@ibm.com` address you can receive mail at, or an administrator-approved address. Fill all fields; passwords need at least 12 characters. Note the time and any on-screen error reference.
2. Open [Supabase → Authentication → Users](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/users). Search for the address. **Login accounts live here**, separately from Table Editor. Table Editor → `profiles` holds the app profile; `approved_emails` holds access approval. Signup can roll back if the database trigger or email delivery fails, so a failed attempt may leave no row.
3. If the account exists but is unconfirmed, open [Resend verification](https://projects.fncai.org/login?mode=verify). Request one fresh email. Check spam. If the address already existed before app setup, missing profile rows need investigation; resending does not create a missing profile.
4. In Resend, open **Emails**, locate the message, and check its delivery status. Accepted by the provider does not guarantee arrival in the inbox. Check bounces, suppression, recipient spelling, and verified sender domain if it is not delivered.
5. Open the newest message and click **Verify email**. The website confirms your address and signs you in automatically. Check Authentication → Users for the confirmed account. With JavaScript disabled, select **Verify and sign in** on the page.
6. Test **Forgot password?** separately. Admin bootstrap bypasses email delivery; its success does not prove SMTP works.

## If it fails: where to look

- **Fields are highlighted:** the form did not send a request. Fix them first.
- **No account and a signup error:** in Supabase, open **Logs → Auth**, filter around the attempt time, and inspect the signup error. SMTP authentication/sender errors mean fix SMTP. Database errors mean inspect **Logs → Postgres** and the signup trigger. Do not rerun the one-time setup over existing tables.
- **Rate limit:** wait before retrying. Check [Supabase auth limits](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/rate-limits) and your email provider's limits.
- **A reference appears:** in **Cloudflare → Workers & Pages → ibm-projects → Observability → Logs**, search for that reference or `auth_failure`. After deploying this version, errors include the operation, safe provider code, status, and reference. Raw emails, passwords, and email-token URLs are not logged by the application diagnostic. Supabase's own logs contain the detailed provider error.
- **Button does nothing and no Supabase log:** open browser Developer Tools → **Network**, submit once, and inspect the POST to `/login`. No POST generally means client validation or JavaScript failure. A failed POST means inspect Cloudflare logs. Old-tab Server Action errors after deployment can be resolved by refreshing the page. Never share full request payloads or token links.
- **Email opens the wrong host or an expired link:** follow [email setup steps 2–3](EMAIL_SETUP.md#2-tell-supabase-where-the-live-app-is). Save the templates in Supabase, then request a fresh message. Editing local HTML alone does not update hosted templates.

## Read-only checks from the terminal

```sh
npm run auth:check
```

This checks local/production project consistency, the public Auth endpoint/settings, and whether the live signup form is available. It does not send email, create accounts, or test SMTP credentials. Network errors can also come from local DNS or firewall restrictions.

For application changes, publish the saved code first:

```sh
npm run cf:deploy
npm run cf:verify
```

These commands use `.env.production`. It needs the matching public Supabase URL and publishable key plus `NEXT_PUBLIC_APP_URL=https://projects.fncai.org`. Set `CLOUDFLARE_PUBLIC_PREVIEW=false` for the configured app. Never copy the service-role key or admin password there. A preview flag of `true` does not disable sign-in when both public Supabase values are configured; their presence determines whether the app can connect.

Actual delivered signup/recovery messages and the authenticated live workflow remain manual acceptance checks.
