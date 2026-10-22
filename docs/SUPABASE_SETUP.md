# Connect the app to Supabase

Your project is already created and its public keys have been added to `.env.local`. Start at step 2 if those values are still there.

## 1. Check the local keys

Open [your Supabase project](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj). Click **Connect** to find the Project URL and Publishable key.

In VS Code, open `.env.local` beside `package.json`. Fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep the actual values already in your file; do not replace them with these placeholders.

## 2. Create the database

For a project without the app tables, use **one file**:

1. Open [setup.sql](../supabase/setup.sql) in VS Code. Select all and copy.
2. Open [Supabase → SQL Editor → New query](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new).
3. Paste the entire file and click **Run**.

Expected result: a row saying **Database setup complete**. Open [Table Editor](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/editor) to see the tables.

This creates all application tables, permissions, automatic `@ibm.com` signup approval, and starting skills together. You do not need to run the individual SQL files afterward. This file does not create login accounts; continue to step 3 for your administrator.

The combined setup is for an app database that has not been set up yet. It stops if app objects already exist and does not reset or delete your data. If the app tables already exist and only IBM signup needs enabling, run [the IBM signup SQL](../supabase/migrations/20261022000200_ibm_signup.sql) instead. An error saying `type "public.approved_emails" does not exist` means the IBM signup file was run before the core database was created.

For repository maintenance, `npm run db:setup-file` regenerates the combined file from the versioned migrations and skill catalog. Existing databases should receive only missing migrations. If switching from manual SQL setup to CLI migrations, reconcile migration history first; do not replay the initial migrations over this setup.

## 3. Create your administrator login

In Supabase, click **Project Settings → API Keys → Legacy API keys**. Copy the `service_role` key.

In `.env.local`, fill in these existing lines:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVICE_ROLE_KEY
BOOTSTRAP_ADMIN_EMAIL=YOUR_EMAIL
BOOTSTRAP_ADMIN_PASSWORD=CHOOSE_A_PASSWORD_OF_AT_LEAST_12_CHARACTERS
BOOTSTRAP_ADMIN_NAME=Your Name
```

Keep this key and password private. Never give the service-role key a `NEXT_PUBLIC_` prefix.

In the project terminal, run:

```sh
npm run bootstrap
```

This creates your admin account with email already confirmed. If the account already exists, its password stays the same.

## 4. Open the app on your Mac

Run:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Sign in**, and use your admin email and password. Restart this command after changing `.env.local`.

## 5. Set up live signup and email

Follow [the live signup and email checklist](EMAIL_SETUP.md). It gives the exact Supabase pages, email-template files, SMTP fields, and deployment command.

<details>
<summary>Optional: add fictional demo accounts and projects</summary>

In `.env.local`, set `DEMO_PASSWORD` to a unique password of at least 12 characters and set `ALLOW_REMOTE_DEMO_SEED=true`. Then run `npm run seed`.

Sign in as `admin@ibm-projects.example` for admin controls, or `casey@ibm-projects.example` for the zero-project homepage, using that demo password. These fictional accounts are email-confirmed by the script and do not need email delivery. Run this only in a fictional demo project.

</details>

<details>
<summary>Common problems</summary>

| Problem | What to do |
| --- | --- |
| Cannot find `.env.local` | In VS Code press Command + P and type `.env.local`. For a fresh clone, copy `.env.example` to `.env.local`. |
| App says Supabase is not configured | Fill both public values in `.env.local` and restart `npm run dev`. |
| Unable to verify workspace access | Run the database SQL against the same project as the URL in `.env.local`. |
| Bootstrap returns 401/403 | Use that project's matching legacy `service_role` key for the bootstrap script. |
| IBM signup is denied | Apply the IBM signup SQL. Explicitly revoked addresses stay blocked. Other domains need admin approval. |
| Email link is invalid | Finish the [email checklist](EMAIL_SETUP.md), then request a fresh message. |

</details>
