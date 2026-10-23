# Cloudflare deployment: projects.fncai.org

The Next.js application runs on **Cloudflare Workers with OpenNext**. Supabase remains the authentication and database provider. Server Actions, SSR sessions, database permissions, and the contribution workflow remain part of the application.

**First release selected:** publish the public IBM homepage at `projects.fncai.org` while Supabase is being configured. The domain's DNS is already managed by Cloudflare. In explicit homepage-only mode, sign-in displays an availability notice and protected workspace pages remain closed. Retain your existing authenticated production settings if signup/login are already enabled. Supabase and email setup below are required for the later authenticated release.

The supplied terminal log confirms successful dependency installation, Cloudflare OAuth login, an OpenNext adapter build, and Worker deployment to the custom domain. The subsequent verification failed at DNS lookup (`ENOTFOUND`), before HTTPS or application checks could run. That establishes a successful upload, not a verified live site. The agent's own DNS/HTTPS checks are blocked by sandbox network restrictions. This historical upload record does not establish the currently deployed configuration.

For the October 23 application changes, apply [the ordered database upgrade](UPDATE_SETUP.md) before deploying the dependent UI. Hosted database, browser, and live verification remain separate release gates.

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

Skip this step for the selected homepage-only first release. Complete it before enabling workspace sign-in.

Complete the [Supabase setup guide](SUPABASE_SETUP.md): apply the migration/catalog and bootstrap the first administrator. Keep fictional data until use with real employees/projects is authorized.

Under **Authentication → URL Configuration**, set:

| Setting | Production value |
| --- | --- |
| Site URL | `https://projects.fncai.org` |
| Allowed redirect URL | `https://projects.fncai.org/auth/confirm` |

Keep email/password authentication and email confirmation enabled. Apply the IBM signup migration after the core migration and install both branded templates from [email setup](EMAIL_SETUP.md) in the hosted Auth email settings. `ibm.com` and valid nested-subdomain addresses then receive automatic member approval without overriding revoked access. The confirmation page automatically submits verification after navigation, signs in on success, and retains an explicit continue button as fallback. GET/prefetch alone does not consume a token. Configure local development redirects separately; avoid wildcard production redirects.

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

### DNS lookup fails after a successful deploy

`ENOTFOUND projects.fncai.org` means the verifier's DNS resolver could not find the hostname. The check has not reached the Worker yet. A new custom-domain record may still be propagating, or the custom-domain/DNS configuration may need attention.

1. Wait a few minutes and rerun `npm run cf:verify`; a verification failure alone does not require another deployment.
2. In Cloudflare, open **Workers & Pages → ibm-projects → Settings → Domains & Routes**. Confirm `projects.fncai.org` is present and check its activation/certificate status.
3. Open **fncai.org → DNS → Records** and confirm Cloudflare created the Worker custom-domain record. If it is absent or pending, resolve the status shown in the custom-domain settings.
4. Compare the system resolver with Cloudflare's public resolver:

   ```sh
   dig projects.fncai.org
   dig @1.1.1.1 projects.fncai.org
   ```

   If the public resolver returns addresses but the system resolver does not, retry after the local negative DNS cache expires or check the network's DNS settings. If both return `NXDOMAIN`, recheck the Cloudflare zone, authoritative nameservers, and custom-domain status. A timeout or refused query indicates a DNS/network problem and does not prove that the record is absent.

Then open `https://projects.fncai.org` and rerun the verifier. DNS success alone does not establish HTTPS or application success. The verifier accepts IPv4 or IPv6 answers and exits with a failure status until every public check passes.

### Public DNS works, but corporate Wi-Fi does not

A local DNS cache or a corporate DNS/filtering policy can behave differently from a public resolver. An `NXDOMAIN` response alone does not identify the cause or establish that a new-domain filter is responsible.

Compare `dig projects.fncai.org` with `dig @1.1.1.1 projects.fncai.org`. A public DNS query may itself be blocked on a managed network; a timeout/refusal is inconclusive. Check from another permitted network if needed. Use the organization's support process if the hostname is being filtered.

Mapping a name to an address in `/etc/hosts` overrides DNS on that computer; it does not make DNS propagate. For a temporary diagnostic, use an IPv4 address actually returned by the public lookup:

```sh
# Replace PUBLIC_IPV4 with an address returned by the successful public lookup.
curl --head --resolve projects.fncai.org:443:PUBLIC_IPV4 https://projects.fncai.org/
```

This preserves the hostname for HTTPS and certificate verification without modifying DNS or `/etc/hosts`. It tests that connection only; it does not prove ordinary DNS or browser access works. Do not guess an address or disable certificate verification. Avoid permanent Cloudflare IP mappings, which can become stale. If public DNS also returns `NXDOMAIN`, a local override cannot establish correct public DNS configuration.

For a stale macOS DNS cache, after confirming the public record exists, these commands flush the cache and restart the local resolver:

```sh
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

They do not change corporate DNS policy or Cloudflare records. Rerun the ordinary DNS/HTTPS verification afterward.

### Dependency warnings

The supplied install log reports nine high-severity findings. The detailed advisory report remains unreviewed because the agent's `npm audit` request could not resolve the npm registry. Run `npm audit` locally and inspect the affected packages and proposed upgrades before choosing a fix. Avoid `npm audit fix --force` without reviewing its breaking changes. Deprecation and install-script warnings did not stop the successful build/upload in that log.

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
