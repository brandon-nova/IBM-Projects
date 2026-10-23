# Update your IBM site

For your existing installation, update Supabase first, then publish the app. Keep your environment files and email settings.

## 1. Install the project update

Back up the database first and test the SQL on a separate Supabase Cloud test project before production.

1. Open [update-projects.sql](../supabase/update-projects.sql).
2. Press **Cmd+A**, then **Cmd+C**.
3. Open [your Supabase SQL Editor](https://supabase.com/dashboard/project/hatvbfuznerrprpuccpj/sql/new).
4. Paste and click **Run**.
5. Wait for **Project tools updated**.

Run this once if you already installed the original October 23 upgrade. It includes the assignment-search fix, so it is fine if you already ran that small fix. It preserves accounts, projects, existing descriptions, links, and accepted work. **Do not rerun `setup.sql` or the full upgrade.**

If you have never installed the October 23 upgrade, use the current [upgrade-20261023.sql](../supabase/upgrade-20261023.sql) instead. It includes all seven October 23 migrations and ends with **IBM update complete**; do not run `update-projects.sql` afterward. Fresh, empty databases use [setup.sql](../supabase/setup.sql).

If any SQL reports an error, stop and investigate that message; do not reset the database. If you already applied individual board/admin-creation migrations, apply only those still missing.

## 2. Try it locally

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000).

- As admin, open **Create a project**. The single **Project owner** field shows your name by default. Type a name and select a result to choose someone else, then **Create and publish project**. It immediately appears in workspace discovery. Employee proposals still need approval. The simplified owner field needs only an app deployment, with no additional SQL.
- New descriptions have a **300-character counter**. Existing longer descriptions remain readable and editable. Hours are labeled **Estimated hours per week**.
- Open a project: the **native board is the default**. Add a task, assign it to a participant, edit it, and move it between **To Do**, **In Progress**, and **Done**. Drag between columns, or select a status and press **Move**. Deletion asks for confirmation.
- As owner/admin, open **Board settings → External board**, add an HTTP/HTTPS URL, then **Save board**. **Open board** opens the external tool. Switch back to **Native board** and confirm every task and its status remain.
- Authorized workspace users can read published boards. Participants and admins can edit them. Completed projects are read-only. A Done task does not replace contribution acceptance and completion verification.
- Assignment search includes active accounts before email verification. Admins can find hidden profiles and search by email; existing participants and pending invitees stay visible with status labels. Revoked accounts stay excluded. Sign-in and accepting invitations still require verification.

For an empty assignment search, run `npm run assignments:inspect`. It reports missing profiles, access bindings, and filter counts without changing data or printing email addresses/credentials. It uses the existing server-only service-role key in `.env.local`.

When finished, press **Ctrl+C**.

## 3. Publish

After the database and app checks pass, run these one at a time:

```sh
npm run cf:deploy
npm run cf:verify
```

Open **https://projects.fncai.org** and refresh. Test the same workflow using separate admin, owner, and employee accounts. Saving files alone does not update the live site; deployment updates app code and Supabase SQL updates the database separately.

The new SQL has **not** been applied for you. Hosted database/security and actual visual/keyboard acceptance remain pending. See [ACCEPTANCE.md](ACCEPTANCE.md) for executed checks and blockers, and [DEPLOYMENT.md](DEPLOYMENT.md) for the full release checklist. Automated database tests need a separate disposable Supabase project; never point fixture tests at production.
