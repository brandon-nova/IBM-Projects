# Update your IBM site

There are two updates: **Supabase gets the new tables and permissions; Cloudflare gets the new app.** Saving files does not update the live site.

Keep your existing environment files, SMTP settings, and email templates. No Docker is needed.

## Already upgraded? Fix assignment search

If you already saw **IBM update complete**, use only this small correction:

1. Open [fix-assignment-search.sql](../supabase/fix-assignment-search.sql). Press **Cmd+A**, then **Cmd+C**.
2. Open [your Supabase SQL Editor](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new), paste, and click **Run**.
3. Wait for **Assignment search updated**. Then publish using step 3 below.

Do not rerun the full upgrade. The correction can be rerun safely. It allows active accounts to appear before email verification and lets admins find hidden profiles in assignment controls. Ordinary People search still respects hiding. Existing participants and pending invitees stay visible with status labels after the app is deployed. Revoked accounts stay excluded; sign-in and accepting invitations still require verification.

To investigate account records without changing anything, run `npm run assignments:inspect`. It reports account counts, missing profiles, access bindings, and how the old filters could empty each project's list. It needs the existing server-only service-role key in `.env.local`; it never prints email addresses or credentials.

## 1. Update Supabase

Back up your database first. Test the upgrade on a separate Supabase Cloud test project before using it on the live database.

1. Open [upgrade-20261023.sql](../supabase/upgrade-20261023.sql) in your editor.
2. Press **Cmd+A**, then **Cmd+C** to copy the entire file.
3. Open [your Supabase SQL Editor](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new).
4. Paste the file and click **Run**.
5. Wait for **IBM update complete**.

This one file contains all five October 23 migrations, including the assignment search correction. Run it once. **Do not run `setup.sql` again or run the individual migrations afterward.**

It expects the previous October 22 setup. If it reports an error, stop and use the error message to diagnose it; do not reset the database. If you already ran any October 23 migrations, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md) before proceeding.

## 2. Try the app on your computer

In the project terminal, run:

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). Sign in and check your profile, skill search, project links, and the admin assignment screen. Use separate admin and employee accounts to test invitation acceptance, work submission, and completion.

When finished, press **Ctrl+C** in the terminal.

## 3. Publish to your domain

After the database and app checks pass, run these commands one at a time. Continue only if each succeeds:

```sh
npm run cf:deploy
npm run cf:verify
```

Then open **https://projects.fncai.org** and refresh. Check sign-in, an actual signup email, and the same project workflow on the live site.

For future code changes, repeat the deploy and verify commands. Only apply SQL when an update includes new migrations.

## What still needs testing

The new database upgrade and deployment have **not** been run for you. Hosted database/security tests and visual/keyboard checks remain pending. A successful build or `cf:verify` does not prove those checks passed.

See [ACCEPTANCE.md](ACCEPTANCE.md) for the checks already executed and remaining blockers, and [DEPLOYMENT.md](DEPLOYMENT.md) for the full release checklist. Automated database tests require a separate disposable Supabase project; do not point them at your live database.
