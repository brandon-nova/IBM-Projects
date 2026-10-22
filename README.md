# IBM

Find work worth doing. A single-workspace opportunity marketplace built around **propose → approve → join → contribute → owner verification**.

This repository implements the Phase 1 application. Task boards, external workspace modes, invitations, and suggested matching are deliberately gated behind a passing core acceptance test. Initials replace uploaded avatars. Learning currently filters projects by desired skills; there is no curated resource directory or AI service.

The IBM-named demo uses fictional people, synthetic projects, and clearly marked illustrative evidence. It is independently built and does not imply IBM endorsement. Real employee/project use requires appropriate authorization.

## First time here?

Start with the [Supabase setup walkthrough](docs/SUPABASE_SETUP.md). It shows exactly where to find your keys, which SQL files to run, and how to create your first login. No Docker is needed.

Local settings belong in **`.env.local`**, at the project root beside `package.json`. A blank local file has been created in this checkout. Environment files start with a dot, so Finder hides them by default; press **Command + Shift + .** to show them. In VS Code, use **Command + P** and type `.env.local`. The file is ignored by Git so credentials stay out of commits; `.env.example` is the shared template.

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn-style UI primitives, Lucide, React Hook Form, Zod, Supabase PostgreSQL/Auth/RLS. Node **24** and npm are required. Hosted Supabase Cloud is the standard setup; Docker is not required.

## Host on Cloudflare

The production target is **Cloudflare Workers at `https://projects.fncai.org`**, using OpenNext for the Next.js server and Supabase for authentication/database storage. Use the [Cloudflare deployment walkthrough](docs/DEPLOYMENT.md).

```sh
npm run cf:setup
npm run cf:login
# Fill .env.production using .env.production.example, then:
npm run cf:deploy
npm run cf:verify
```

`fncai.org` must be an active zone in the same Cloudflare account. The Worker configuration binds only `projects.fncai.org`; Cloudflare provisions that hostname's DNS and HTTPS. `.env.local` is for local development, while `.env.production` supplies the three public deployment values and overrides local settings during Cloudflare builds. Keep provisioning credentials out of the production file.

For the requested **homepage-first launch**, this checkout's `.env.production` has `CLOUDFLARE_PUBLIC_PREVIEW=true` with both Supabase fields empty. This publishes the IBM landing and a sign-in availability notice. Supabase authentication and project workflows can be enabled in a later deployment after setup and acceptance.

Cloudflare adapter dependencies are included in the manifest and lockfile. The supplied terminal log confirms a successful OpenNext build and Worker deployment to `projects.fncai.org`. Live verification then failed at DNS lookup (`ENOTFOUND`), so HTTPS and application checks remain unverified. See the [DNS troubleshooting steps](docs/DEPLOYMENT.md#dns-lookup-fails-after-a-successful-deploy). The adapter configuration is separate from the Next.js application type check and is validated by the Cloudflare build.

## Run the application with hosted Supabase

1. Install Node 24 and run `npm ci` using the provided `package-lock.json`.
2. If `.env.local` does not exist yet, copy `.env.example` to `.env.local`. Keep any values you have already configured.
3. Create a Supabase Cloud development project. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from its Connect/API settings. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Provisioning scripts need the legacy **server-only** `SUPABASE_SERVICE_ROLE_KEY`; the application itself does not. Do not commit keys.
4. Apply both SQL files in `supabase/migrations/`, in filename order, once in the hosted SQL editor, then `supabase/seed.sql`. If the core migration is already installed, apply only `20261022000200_ibm_signup.sql`. Alternatively, use `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, and `npx supabase db push` to apply versioned migrations, then apply the skill catalog in the SQL editor. Both methods work without Docker. Use migrations consistently afterward; do not apply the same migration manually and through the CLI.
5. For a fictional demo, choose a unique password of 12+ characters, set `DEMO_PASSWORD` and `ALLOW_REMOTE_DEMO_SEED=true`, and run `npm run seed`. For an empty workspace instead, use the administrator bootstrap below.
6. Run `npm run dev` and visit `http://localhost:3000`.

Demo users are deliberately created as email-confirmed through the admin API, so you can verify the main workflow without delivering to fictional domains. Normal signup still requires confirmation; configure and test hosted SMTP before claiming verification or password reset works. See [deployment instructions](docs/DEPLOYMENT.md).

### Optional local Supabase

If you prefer local Supabase and already have Docker, `npm run db:start` starts it and `npx supabase status` supplies local keys. `npm run db:reset` applies migrations and the skill catalog but destroys local application data. Never reset a hosted database. Local confirmation/recovery messages appear at `http://127.0.0.1:54324`.

### Fictional accounts

All accounts use the `DEMO_PASSWORD` you supplied; no reusable password is shipped.

| Account | Purpose |
| --- | --- |
| `admin@ibm-projects.example` | Administrator, Morgan Vale |
| `alex@ibm-projects.example` | Owner/member, Alex Rowan |
| `jamie@ibm-projects.example` | Owner/member, Jamie Brooks |
| `sam@ibm-projects.example` | Owner/member, Sam Ellis |
| `taylor@ibm-projects.example` | Owner/member, Taylor Quinn |
| `casey@ibm-projects.example` | Zero-membership newcomer, Casey Rivers |

Seeding is repeatable and preserves existing projects and accepted evidence. It refreshes synthetic profile fields but never resets existing passwords. After a local database reset, seed again. Hosted seeding requires explicit `ALLOW_REMOTE_DEMO_SEED=true` and must target a synthetic demonstration environment.

### Administrator bootstrap

For an empty deployment, set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a unique `BOOTSTRAP_ADMIN_PASSWORD`, then run `npm run bootstrap` from a trusted terminal with that environment’s service-role key. This inserts the approved email, creates an email-confirmed account, and assigns the admin role. Existing passwords are preserved. Remove provisioning secrets from your working environment when finished; the deployed app does not need the service-role key.

After the IBM signup migration is applied, new accounts with an exact `@ibm.com` address are approved automatically as members; mailbox verification is still required. Admins approve other addresses using **Admin → Manage workspace access**. Explicit revocation overrides domain approval, including for existing sessions and later signup attempts. Email changes are unsupported in V1 so approved accounts cannot transfer to other addresses through the Auth API. See [email setup and troubleshooting](docs/EMAIL_SETUP.md) for the migration and professional confirmation/recovery templates.

## Core workflow

1. A member creates a private proposal and requests publication. The proposer immediately participates, without becoming the official owner.
2. An admin assigns an owner and approves publication. Assignment adds the owner as a participant.
3. Another member discovers the published opportunity and requests to join.
4. The owner accepts the request; membership is created atomically.
5. The contributor submits a deliverable link, summary, and optional outcome. The owner accepts useful work or requests specific changes.
6. After at least one accepted submission, the owner completes the project. Only accepted contributors receive verified completed-project credit.

Approved projects remain published after owner edits. Ownership changes preserve former participation and accepted reviewer attribution. Completed projects and accepted submissions are immutable through application operations. Private work is filtered from profiles according to viewer permissions.

## Security model

- The database guards `auth.users` insertion, not just the signup form. Approved access is bound to an Auth user ID.
- Exact `@ibm.com` signup creates an approval entry without reactivating revoked entries. It grants no admin role, and workspace access requires verified email ownership.
- Every protected request and every database mutation checks active access. Revoking access immediately blocks queries/RPCs made with an existing JWT.
- All application tables use RLS. Application roles have read access through policies and no direct table mutation grants.
- Mutations use narrowly granted, actor-checked security-definer functions with an empty search path and qualified references. Internal helpers are not executable by application roles.
- Ownership/publication, joining, review, and completion serialize on project rows. Submission review cannot race an edit into overwriting accepted evidence.
- Admins have private-project oversight but do not gain owner-only review or completion rights.
- Profiles cannot change roles. The last active administrator cannot be demoted or revoked.
- Requests use user-scoped SSR clients; no authenticated data is cached globally. Privileged keys are confined to provisioning scripts/tests.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

To run the browser workflow first, copy `.env.test.example` to `.env.test`, use a **dedicated hosted test project** with the migration/catalog applied, and set `ALLOW_REMOTE_TESTS=true`. Use a unique `TEST_PASSWORD` of 12+ characters. Point the app’s `.env.local` at that same test project. Optional local Supabase also works.

```sh
npx playwright install chromium
npm run test:e2e
# Broader direct API and RLS checks, after the main workflow:
npm run test:integration
```

Integration tests exercise real Auth and PostgREST/RLS. They deliberately fail setup rather than silently skip when configuration is missing. They create and remove only test-owned accounts/projects; do not run them against production. Remote tests require explicit `ALLOW_REMOTE_TESTS=true` and a disposable test project.

Browser tests use separate admin, owner, and contributor sessions and check the mobile newcomer home, private URL protection, publication, joining, submission, owner acceptance, completion, and verified profile credit. CI always runs source checks/build. To enable its hosted workflow tests, provide dedicated `TEST_SUPABASE_URL`, `TEST_SUPABASE_KEY`, and `TEST_SUPABASE_SERVICE_ROLE_KEY` repository secrets, and set the repository variable `RUN_HOSTED_CORE_TESTS=true`. No Docker service is required. A skipped hosted test job does not satisfy workflow acceptance.

See [the acceptance record](docs/ACCEPTANCE.md) for checks actually run and [deployment instructions](docs/DEPLOYMENT.md) for cloud setup. The domain has **not** been verified live.

## Routes

`/`, `/login`, `/projects`, `/projects/new`, `/projects/[projectId]`, `/projects/[projectId]/edit`, `/people`, `/people/[userId]`, `/learning`, `/admin`, `/auth/confirm`, `/reset-password`.

There are no organization slugs, SSO assumptions, social features, or native external-tool integrations.
