# Set up signup and email on the live site

Use your existing Supabase project. Complete these steps in order. The links below open that project's dashboard.

**Signup failing or no email provider yet?** Start with [the short troubleshooting guide](AUTH_DEBUGGING.md). Custom SMTP needs a real provider account and a verified sender domain.

## 1. Allow IBM email addresses

If you have not created the app tables yet, open [setup.sql](../supabase/setup.sql) in VS Code and copy **all its contents**. Open [Supabase → SQL Editor → New query](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new), paste it, and click **Run**. The result should say **Database setup complete**. This creates all tables and enables IBM signup together; do not run the individual migrations afterward.

If the app tables already exist, run only [the IBM signup SQL](../supabase/migrations/20261022000200_ibm_signup.sql) there instead. If this says `public.approved_emails` does not exist, use the combined setup above.

New exact `@ibm.com` addresses can then sign up. They still need to verify their email; revoked accounts stay blocked.

## 2. Tell Supabase where the live app is

Open [Authentication → URL Configuration](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/url-configuration).

Set **Site URL** to:

```text
https://projects.fncai.org
```

Under **Redirect URLs**, click **Add URL**, add this, then save:

```text
https://projects.fncai.org/auth/confirm
```

Use the live URL once the domain opens successfully. If you are testing only on your Mac, use `http://localhost:3000` and `http://localhost:3000/auth/confirm` in these two fields instead.

## 3. Replace the two email designs

Open [Authentication → Email Templates](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/templates). Your dashboard may label this section **Emails → Templates**.

Click **Confirm signup**:

- Subject: `Verify your email for IBM Projects`
- Body: replace everything with the entire contents of [confirmation.html](../supabase/templates/confirmation.html).
- Click **Save**.

Click **Reset password**:

- Subject: `Reset your IBM Projects password`
- Body: replace everything with the entire contents of [recovery.html](../supabase/templates/recovery.html).
- Click **Save**.

Copy the HTML exactly, including the `{{ ... }}` placeholders. Changing the local HTML files alone does not change hosted Supabase emails.

Open [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/providers), select **Email**, and keep **Confirm email** enabled.

## 4. Enable delivery to other IBM addresses

Supabase's built-in email service restricts recipients. To send signup emails to employees beyond your Supabase project team, configure **Custom SMTP**.

1. Open [Resend](https://resend.com), sign in, then choose **Domains → Add domain**. Enter `fncai.org` (or `m.fncai.org` if you prefer).
2. Add the DNS records Resend displays in **Cloudflare → fncai.org → DNS → Records**. Return to Resend and wait for the domain to show **Verified**.
3. In Resend, open **API Keys → Create API key**. Keep this key private.
4. Open [Supabase → Authentication → SMTP Settings](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/auth/smtp), enable **Custom SMTP**, and enter:

| Field | Value |
| --- | --- |
| Sender email | `no-reply@fncai.org` |
| Sender name | `IBM Projects` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |

If you chose `m.fncai.org`, use `no-reply@m.fncai.org` instead. Existing `auth.fncai.org` DNS records can remain while you verify the new domain; the sender must match the domain verified in Resend.

Click **Save**. Verify these settings against the provider's current dashboard and check its free-plan limits before sending. Disable authentication-email click tracking if enabled. Use a sender domain you control; recipient auto-approval does not authorize an `@ibm.com` sender.

## 5. Enable sign-in on Cloudflare

In VS Code, open `.env.production`. Copy **only** the values of `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local` into their matching lines.

Set the other two lines to:

```dotenv
NEXT_PUBLIC_APP_URL=https://projects.fncai.org
CLOUDFLARE_PUBLIC_PREVIEW=false
```

Save the file. Do not copy your service-role key, passwords, or SMTP credentials into it.

In the project terminal, run:

```sh
npm run cf:deploy
npm run cf:verify
```

The first command builds and publishes the updated app. The second checks the live domain. Database SQL and email templates are configured separately in Supabase; this deployment command does not install them.

## 6. Get a fresh verification email

Open [the live resend page](https://projects.fncai.org/login?mode=verify), enter your unconfirmed account's email, and click **Send verification email**. If you have not created an account yet, use **Create an account** first.

Open the **newest** email and click **Verify email**. The page verifies your address and signs you in automatically. If JavaScript is unavailable, select **Verify and sign in** on the page. Old emails are not repaired by the template change. Test password recovery separately with **Forgot password?**.

After success, the homepage displays **Email verified successfully.** Reopening that same link in the same signed-in browser continues to the success message. This uses a browser hint for the last verified link (30 days) plus a fresh check of the same confirmed account and active workspace access; the hint grants no access. Signed-out users and other browsers must sign in normally after a link has been used. Signup and new-password forms require matching **Password** and **Confirm password** entries.

These are setup instructions, not a record that hosted settings or delivered emails have been verified.

<details>
<summary>If a fresh link still fails</summary>

## Troubleshoot an immediately invalid link

- **Default or old template:** install both provided templates, deploy the new app, and request a fresh message. The old handler only accepted token hashes; the new handler also accepts PKCE codes.
- **Email scanner/prefetch:** use the custom template's direct application link. Plain GET previews do not redeem tokens; the browser submits once after the page loads. Scanners that execute JavaScript can still consume one-time links. If a link was used, try signing in or request a fresh email.
- **Different browser or blocked cookies:** PKCE callbacks require the initiating browser's verifier cookie. Request another email or use the provided token-hash template.
- **Old/reused email:** a new message may replace an earlier token. Open the newest one and do not reuse a successfully redeemed link.
- **Wrong destination:** compare the email's hostname with Supabase Site URL, the redirect allowlist, and the app's public origin. Never paste a full live token URL into logs or chat.
- **Provider outage:** the app reports temporary unavailability separately from an invalid/used token; retry after connectivity recovers.

The exact cause of the reported expired message has not been established from provider logs. Do not disable confirmation or lengthen expiry merely to hide a broken link flow.

</details>
