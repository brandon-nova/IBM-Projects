# Email verification and automatic IBM signup

The application automatically approves new accounts with an exact `@ibm.com` email address. Users must still verify ownership of their mailbox before accessing the workspace. Automatic approval grants the member role; administrator roles still require administrator assignment or bootstrap.

## 1. Apply the signup migration

If the core database is already installed, run only [20261022000200_ibm_signup.sql](../supabase/migrations/20261022000200_ibm_signup.sql) in the hosted project's **SQL Editor**. Do not rerun the original core migration. Fresh projects need both migrations, in filename order, followed by the skill catalog.

This migration changes the existing Auth signup trigger, so direct API signup follows the same rules as the app. Other email domains still require explicit administrator approval. Subdomains such as `person@dept.ibm.com` and lookalike suffixes do not receive automatic approval. An inactive approval entry stays inactive, including when its Auth user has been deleted; only an administrator can reactivate it. Existing user-ID binding, verified-email checks, RLS, and role controls remain in force.

The file is prepared in this repository; it has **not** been applied to the hosted project by the agent.

## 2. Install the email templates in Supabase

Repository templates do not automatically update a hosted Supabase project. In the dashboard, open **Authentication → Emails / Email Templates**, then update both templates:

| Supabase template | Subject | HTML body |
| --- | --- | --- |
| Confirm signup | Verify your email for IBM Projects | Entire contents of [confirmation.html](../supabase/templates/confirmation.html) |
| Reset password | Reset your IBM Projects password | Entire contents of [recovery.html](../supabase/templates/recovery.html) |

The designs use blue, white, and light grey, inline styles, accessible headings, email-compatible presentation tables, a prominent button, and a fallback text link. No remote images are required. The footer identifies the independent development preview.

Keep `{{ .TokenHash }}` and `{{ .SiteURL }}` exactly as written. The templates link directly to the application's confirmation page. Replacing those links with `{{ .ConfirmationURL }}` changes the flow: the Supabase verification endpoint may consume the one-time token before the application opens.

## 3. Check the destination and enable email confirmation

Under **Authentication → URL Configuration**, use the origin of the app you are testing:

| Environment | Site URL | Allowed redirect URL |
| --- | --- | --- |
| Development | `http://localhost:3000` | `http://localhost:3000/auth/confirm` |
| Production | `https://projects.fncai.org` | `https://projects.fncai.org/auth/confirm` |

Use separate development and production projects where possible. These templates use Site URL as their canonical destination, including when a new email is requested from the dashboard. Site URL must be an origin without `/auth/confirm` appended; the template appends that path itself.

Keep email confirmations enabled. Make sure `NEXT_PUBLIC_APP_URL` matches the app's environment. The current Cloudflare deployment is a homepage-only preview: enabling live sign-in requires setting the two public Supabase values in `.env.production`, setting `CLOUDFLARE_PUBLIC_PREVIEW=false`, and deploying the updated application after database/email configuration. A local `.env.local` change alone does not enable hosted sign-in.

## 4. Use a verified sender

To control the visible sender and improve deliverability, configure Supabase **Custom SMTP** with a provider and a verified domain you control, such as `auth.fncai.org`.

- Sender name: `IBM Projects`.
- Sender address: an actually verified address such as `no-reply@auth.fncai.org`.
- Configure the provider's required DKIM/SPF records and confirm domain verification.
- Keep SMTP passwords/API keys in Supabase's SMTP settings.
- Disable email-provider click tracking for authentication messages if it rewrites verification links.
- Confirm the provider's current free-tier limits; real delivered-message tests are required.

Using an `@ibm.com` recipient does not authorize sending from an `@ibm.com` address. Use a sender domain you control unless organizational authorization exists.

The agent has not changed hosted templates or SMTP settings and has not verified delivery in an email client.

## 5. Request a fresh email and test the flow

After the migration, template settings, and application changes are installed:

1. Open **Sign in → Resend verification email** (`/login?mode=verify`). Request a new email for your unconfirmed account. Existing messages retain their original link format and may already be invalid.
2. Open only the newest email. Its button opens a confirmation page; simply opening that page does not redeem the custom-template token. Select **Confirm email** to submit it and establish a session.
3. Verify that a second attempt to use a redeemed token fails safely. Confirm an unverified account cannot access workspace data.
4. Test password recovery separately: open the email, select **Continue to reset password**, save a new password, and sign in again.
5. Revoke a test account through the admin access controls and verify its existing session loses workspace access.

The extra confirmation step reduces accidental token use by scanners that follow links with GET requests; it cannot guarantee behavior for every corporate email system. Default PKCE `?code=...` callbacks are also accepted, but the code must be exchanged in the browser that requested it. The custom token-hash templates support opening the link in another browser.

## Troubleshoot an immediately invalid link

- **Default or old template:** install both provided templates, deploy the new app, and request a fresh message. The old handler only accepted token hashes; the new handler also accepts PKCE codes.
- **Email scanner/prefetch:** use the custom template's direct application link and explicit confirmation button. A scanner following a provider's verification URL can consume that token before the user clicks it.
- **Different browser or blocked cookies:** PKCE callbacks require the initiating browser's verifier cookie. Request another email or use the provided token-hash template.
- **Old/reused email:** a new message may replace an earlier token. Open the newest one and do not reuse a successfully redeemed link.
- **Wrong destination:** compare the email's hostname with Supabase Site URL, the redirect allowlist, and the app's public origin. Never paste a full live token URL into logs or chat.
- **Provider outage:** the app reports temporary unavailability separately from an invalid/used token; retry after connectivity recovers.

The exact cause of the reported expired message has not been established from provider logs. Do not disable confirmation or lengthen expiry merely to hide a broken link flow.
