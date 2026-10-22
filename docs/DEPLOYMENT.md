# Cloudflare deployment: projects.fncai.org

The Next.js application runs on **Cloudflare Workers with OpenNext**. Supabase remains the authentication and database provider. Server Actions, SSR sessions, database permissions, and the contribution workflow remain part of the application.

Deployment tooling is prepared, but the OpenNext adapter build and Cloudflare upload have **not** been executed here. Installation was blocked by network restrictions and automatic approval review (HTTP 403 for the unavailable `gpt-5.6-luna` review model). No Cloudflare login or Supabase project keys are configured in this workspace. A passing standard Next.js build does not certify the Cloudflare adapter or production workflows.

## 1. Prepare your Cloudflare account

Sign in to [Cloudflare](https://dash.cloudflare.com/) and confirm **fncai.org** is an active website/zone in your account. The custom hostname must belong to the same Cloudflare account as the Worker.

If another provider currently manages DNS, the domain administrator must first connect the zone to Cloudflare. Preserve existing DNS records when moving DNS. This repository does not change the root domain or other subdomains.

From the project directory, with Node 24 installed:

```sh
npm ci
npm run cf:setup
npm run cf:login
npm run cf:whoami
```

`cf:setup` installs `@opennextjs/cloudflare` and Wrangler, updating `package.json` and `package-lock.json`. Keep those dependency changes with the repository so future installs are repeatable. `cf:login` opens Cloudflare's OAuth login in your browser; choose the account containing `fncai.org`. No credentials need to be pasted into chat.

The adapter/Next.js version combination must pass the Cloudflare build below before deployment. Do not force installation through a reported peer-dependency incompatibility.

## 2. Fill in the production settings

Open **`.env.production`** in the project root. A blank copy was created in this checkout. If absent in a fresh clone, copy `.env.production.example` to `.env.production`.

```dotenv
NEXT_PUBLIC_APP_URL=https://projects.fncai.org
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLOUDFLARE_PUBLIC_PREVIEW=false
```

Use the production Supabase project's URL and publishable key, or its legacy `anon` key. These values are public and embedded during the build. Do not put the service-role key, database password, admin password, or SMTP password in this file. Admin provisioning stays in the ignored local development environment.

Cloudflare commands explicitly load these production values before running Next.js, so `.env.local` cannot replace the production origin with localhost. The deployment script generates an ignored `wrangler.deploy.json` containing only the three public application variables and the checked-in Worker configuration. They are provided both at build time and as Worker bindings. Cloudflare login credentials remain separate from application bindings.

If you explicitly want to publish **only the public homepage** while setting up Supabase, leave **both** Supabase fields empty and set `CLOUDFLARE_PUBLIC_PREVIEW=true`. This intentionally leaves protected pages and sign-in unavailable; it is not acceptance of the complete app. Set the Supabase values and redeploy to enable workspace access.

## 3. Configure Supabase

Complete the [Supabase setup guide](SUPABASE_SETUP.md): apply the migration/catalog and bootstrap the first administrator. Keep fictional data until use with real employees/projects is authorized.

Under **Authentication → URL Configuration**, set:

| Setting | Production value |
| --- | --- |
| Site URL | `https://projects.fncai.org` |
| Allowed redirect URL | `https://projects.fncai.org/auth/confirm` |

Keep email/password authentication and email confirmation enabled. Copy the confirmation/recovery templates from `supabase/templates/` into the corresponding hosted Auth email settings. Configure local development redirects separately; avoid wildcard production redirects.

## 4. Build and test the Worker

```sh
npm run typecheck
npm run lint
npm test
npm run cf:build
npm run cf:preview
```

`cf:build` uses the Cloudflare OpenNext adapter, producing `.open-next/worker.js` and `.open-next/assets`. `cf:preview` rebuilds and runs the output in Wrangler's local Workers runtime; check the URL it prints. Use normal `npm run dev` with `.env.local` for everyday development. A production preview retains production email redirect URLs.

The standard `npm run build` remains a Next.js build. It does not replace `cf:build`. `open-next.config.ts` is optional deployment tooling, excluded from the ordinary app type check so local app development can run before the adapter is installed; the actual adapter build must validate that configuration.

## 5. Deploy the subdomain

After the build/preview checks succeed:

```sh
npm run cf:deploy
```

This rebuilds the Worker and runs Wrangler deployment using the generated production configuration. The checked-in route is:

```json
{ "pattern": "projects.fncai.org", "custom_domain": true }
```

Cloudflare should create the custom-domain DNS record and provision its HTTPS certificate. Confirm **Workers & Pages → ibm-projects → Settings → Domains & Routes** shows `projects.fncai.org` active. Workers development URLs and preview URLs are disabled in the configuration.

Do not add a Vercel DNS target. If a conflicting DNS record already occupies `projects.fncai.org`, inspect its existing use and resolve that specific record before retrying; avoid changing unrelated records. Do not enable paid services merely to work around a deployment error.

## 6. Verify the live app

```sh
npm run cf:verify
```

This checks DNS, HTTPS, the IBM public landing page, and anonymous redirects on protected routes. It does **not** verify signup email, sessions, RLS, owner permissions, or the contribution workflow.

Complete the [acceptance checklist](ACCEPTANCE.md) on the live domain using separate admin, owner, and contributor sessions. Test session persistence, an already signed-in account losing revoked access, private project isolation, and the full proposal → owner assignment/approval → joining → submission → owner acceptance → completion → verified profile-credit workflow. Check narrow-screen layouts and keyboard operation on the deployment.

## 7. Test delivered email

Plan Resend's free SMTP tier, then confirm its current availability, quotas, and Supabase Auth limits during provider setup. No paid upgrade is assumed or authorized by this configuration.

1. Verify a sender domain such as `auth.fncai.org`, using the exact DKIM/SPF records supplied by the provider.
2. Configure Supabase custom SMTP with the provider's hostname, port, username, secret, and verified sender. SMTP credentials belong in Supabase Auth settings, not Worker public variables.
3. Approve a test address you control, sign up, receive the actual verification message, follow its link, and sign in.
4. Request and receive a real reset email, change the password, sign out, and sign in with the new password. Confirm expired/reused links fail and unapproved signup is still denied.

An accepted email API request or a successful Cloudflare upload does not satisfy these checks. A homepage-only preview also leaves authenticated acceptance incomplete.

## Optional Git deployments

After a manual Cloudflare build/deploy succeeds and the adapter dependencies/lockfile are included in the repository, connect the repository to **Workers Builds** for the existing `ibm-projects` Worker.

- Node version: `24` (also recorded in `.node-version`).
- Build command: `npm run cf:build`.
- Deploy command: `npx wrangler deploy --config wrangler.deploy.json`.
- Build variables: the three `NEXT_PUBLIC_` values above; `CLOUDFLARE_PUBLIC_PREVIEW` only for an intentional homepage-only preview.

Hosted builds use their environment variables; `.env.production` remains local and uncommitted. Use a separate Worker/domain and Supabase project for preview environments. Production redirects remain exact. A green build is one check, not launch acceptance.

## Operations and rollback

Retain migrations and Worker deployment revisions. Restore a previously verified version through Cloudflare's Worker deployments interface for an application rollback. Keep database migrations compatible or apply a reviewed forward fix; never reset a hosted database as a rollback.

Restrict cloud/operator access, review Supabase backup options before using authorized real data, and inspect provider logs without logging passwords, JWTs, email tokens, or deliverable payloads. Revoke affected accounts through the access list when needed.
