# Connect IBM to Supabase

You only need a hosted Supabase project and the local settings file. Docker is optional.

## 1. Open your environment file

Open **`.env.local`** in the root of this project, beside `package.json`. A blank copy was created for this checkout. In VS Code, press **Command + P**, type `.env.local`, and press Enter. In Finder, **Command + Shift + .** shows hidden files.

If your editor hides ignored files too, open it directly in TextEdit from the project terminal:

```sh
open -e .env.local
```

For a fresh clone without that local file, create it from the template:

```sh
cp .env.example .env.local
```

Next.js loads `.env.local` automatically. You do not need a separate `.env` file. Git ignores `.env.local` because it will contain your credentials.

## 2. Create a hosted project and fill in three settings

1. Visit [the Supabase dashboard](https://supabase.com/dashboard) and create a new development project. Choose a region near you and save its database password.
2. Wait for the project to finish starting. Open **Connect**, or **Settings → API Keys**, to find the **Project URL** and **Publishable key**. The publishable key usually starts with `sb_publishable_`; the legacy `anon` key also works.
3. Fill in these lines in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep the `https://` in the Supabase URL. The database password is different from the publishable key.

## 3. Create the database tables and permissions

In the Supabase dashboard, open **SQL Editor → New query**.

1. Copy the entire contents of [the core migration](../supabase/migrations/20261022000100_core.sql), paste it into a new query, and click **Run**. This creates the tables, signup restrictions, permissions, and contribution workflow. Run this migration **once on a fresh project**.
2. Open another query, paste [the skill catalog](../supabase/seed.sql), and click **Run**. This adds the starting skills and can be repeated.

You should now see `profiles`, `projects`, `approved_emails`, and `project_deliverables` in the Table Editor. If SQL reports an error, resolve it before creating accounts. A migration that was already applied should not be pasted again.

For later deployments, use the versioned Supabase CLI migration process described in the README instead of reapplying the SQL manually.

## 4. Create your first login

The app deliberately rejects signup until an administrator approves the address. Use one of these provisioning options to create the first account.

Open **Settings → API Keys → Legacy API keys** and copy the **service_role** key into this line in `.env.local`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=YOUR_LEGACY_SERVICE_ROLE_KEY
```

This is a server-only provisioning key. Keep it in the ignored local file; never give it a `NEXT_PUBLIC_` prefix or paste it into browser code.

### Your own administrator account

Fill in the existing bootstrap lines in `.env.local`. Choose a password of at least 12 characters:

```dotenv
BOOTSTRAP_ADMIN_EMAIL=your-email@example.com
BOOTSTRAP_ADMIN_PASSWORD=YOUR_UNIQUE_PASSWORD
BOOTSTRAP_ADMIN_NAME=Your Name
```

Then run, from the project directory:

```sh
npm run bootstrap
```

The script approves your address, creates an email-confirmed account, and makes it an administrator. You can then sign in using that email/password. An existing account keeps its existing password.

### Or explore with fictional demo accounts

Set these two lines in `.env.local`:

```dotenv
DEMO_PASSWORD=YOUR_UNIQUE_PASSWORD_OF_AT_LEAST_12_CHARACTERS
ALLOW_REMOTE_DEMO_SEED=true
```

Then run:

```sh
npm run seed
```

This creates six fictional people and six synthetic projects. Sign in as `admin@ibm-projects.example` for admin controls, or `casey@ibm-projects.example` for the first-time homepage. They use your `DEMO_PASSWORD`. These example accounts are email-confirmed by the provisioning script, so demo setup does not require email delivery.

Provisioning keys are only needed for these scripts; the running app uses the publishable key and each user's session.

## 5. Start the app

If dependencies are not installed yet, run `npm ci`. Then:

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000) and sign in. Restart the dev server after changing `.env.local`.

As admin, open **Admin → Manage workspace access** to approve additional email addresses. They can then create their own accounts once email delivery is configured.

## 6. Enable normal signup and password reset emails

For local development, set **Authentication → URL Configuration** to:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/auth/confirm`

Keep email/password authentication and email confirmation enabled. Under Auth's email templates, paste the [confirmation template](../supabase/templates/confirmation.html) and [recovery template](../supabase/templates/recovery.html) into their corresponding settings. They contain the server-side confirmation links this app expects.

Supabase's default email service has delivery restrictions. For real verification and recovery, configure a custom SMTP provider and test actual received messages. The [deployment guide](DEPLOYMENT.md) covers SMTP and the production redirect URLs. First-time bootstrap and the fictional demo do not depend on SMTP.

## If something does not work

| Symptom | What to check |
| --- | --- |
| “Workspace setup needed” | Both public Supabase settings must be filled in `.env.local`; restart `npm run dev`. |
| “Unable to verify workspace access” | Apply the core migration to the same project as the URL in `.env.local`. |
| Signup is unavailable | An admin must approve that email first. Bootstrap the first admin instead of using public signup. |
| Seed/bootstrap returns 401 or 403 | Use the matching project's legacy `service_role` key for provisioning, plus its publishable or legacy `anon` key. |
| Confirmation/reset link fails | Check the Auth URL settings and the two email templates; then request a fresh link. |
| You can log in but cannot see data | Check whether the account was confirmed and its approved-email entry is active. |

Database, email, and browser acceptance remain separate checks. Filling in environment settings alone does not certify those flows.
