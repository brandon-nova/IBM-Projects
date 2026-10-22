# Core release acceptance record

## Executed in this workspace — October 22, 2026

| Check | Result |
| --- | --- |
| Domain/security, email confirmation, and Cloudflare configuration unit tests | 15 passed with `npm test`, including token/code callbacks, fixed recovery destinations, invalid-link handling, and provider failures. |
| Full application TypeScript | Passed with `npm run typecheck` and during the production build. Optional `open-next.config.ts` is excluded from the app check and handled by the adapter build. |
| ESLint | Passed with `npm run lint` |
| Standard production build | Passed with `npm run build`, which selects Webpack. The email update was also built with configured public Supabase values and the canonical HTTPS app origin. |
| Turbopack build | Earlier attempt was blocked by sandbox restrictions on local worker ports. The standard build now uses Webpack. |
| Production request smoke checks | Passed in-process against the compiled app with homepage-first settings: `/` returned 200 with IBM branding; `/login` returned 200 with the availability notice; `/projects` and `/admin` returned 307 redirects to login. No HTTP listener was used. |
| Confirmation-page request smoke checks | Passed in-process against the configured production build: token, recovery, code, missing-link, and resend pages returned 200. Confirmation pages set `Referrer-Policy: no-referrer`; GET requests made no token-redemption calls. A multipart form POST made exactly one mocked Supabase verification request and returned a 303 safe invalid-token redirect. This does not test real Supabase confirmation. |
| Email HTML | Parsed both templates and checked headings and direct token-hash links. No email-client rendering or actual message delivery was verified. |
| Public homepage browser/responsive/keyboard checks | Attempted with installed Chrome; browser process aborted under sandbox restrictions before assertions. Not verified. |
| Dependencies | Supplied terminal log confirms installation of Cloudflare tooling; dependencies and generated lockfile are present. Nine high-severity npm findings require advisory review; agent-side `npm audit` failed at npm registry DNS lookup. |
| Cloudflare adapter build | Executed `npm run cf:build` successfully for the email update with homepage-only production settings: Next.js 16.4.2, OpenNext Cloudflare 1.20.13, Wrangler 4.152.0. Node.js middleware support emitted an experimental-support warning; authenticated Workers behavior remains unverified. No upload was performed. |
| Cloudflare upload and custom domain | Supplied terminal log confirms OAuth login, Worker upload, and custom-domain deployment. Worker version: `7ef864e0-3604-43f1-892a-cd6f3f363847`. No redeployment was performed by the agent. |
| Production DNS/HTTPS verification | Supplied `cf:verify` run failed with `queryA ENOTFOUND projects.fncai.org`; HTTPS/application assertions were not reached. Agent-side system and public DNS queries were refused by sandbox restrictions; HTTPS could not resolve the hostname. Current public DNS status is unverified. |
| Verifier failure handling | Executed the updated `npm run cf:verify`: it exited 1 with bounded IPv4/IPv6 lookup errors and troubleshooting instructions. This verifies the failure path only; live-domain acceptance remains incomplete. |
| Supabase migration and real integration tests | `npm run test:integration` was attempted and failed fixture setup because `.env.test`/dedicated test credentials are absent. No hosted assertions ran. The new exact-IBM signup migration is written but not applied by the agent; approval, verification gating, member-only roles, exact-domain rejection, and revocation tests are included for the dedicated hosted project. Earlier agent-side hosted checks also failed at DNS lookup. |
| Authenticated browser contribution workflow | Not run; requires configured Supabase and browser execution |
| Actual SMTP, production DNS/HTTPS | Not verified |

The visible app is now named IBM and uses a blue, light grey, and white palette. Public, newcomer, and participant home layouts were updated. No authenticated layout is claimed as browser-verified.

The email update adds a server-side exact-`@ibm.com` signup policy, an explicit confirmation step before token redemption, PKCE callback support, a resend-verification form, and branded signup/recovery templates. Follow [email setup](EMAIL_SETUP.md) to apply the incremental migration and hosted templates, configure the sender/URLs, deploy the application, and request fresh messages. Hosted settings and previously sent emails are not updated by source changes.

The user selected a public-homepage-first release at `https://projects.fncai.org`, whose DNS is already managed in Cloudflare. The supplied log confirms the Worker was deployed. The ignored `.env.production` explicitly enables homepage-only mode with no Supabase credentials. This mode shows a sign-in availability notice and keeps protected workspace pages closed. Follow [the DNS troubleshooting steps](DEPLOYMENT.md#dns-lookup-fails-after-a-successful-deploy), then verify DNS, HTTPS, and public routes before calling that preview live. Authenticated release acceptance remains a separate gate.

**Phase 1 is implemented in source but has not passed release acceptance. Phase 2 and Phase 3 have not been started. Worker deployment is confirmed by the supplied log; live-domain behavior remains unverified.**

## Required local/staging acceptance

- [ ] Apply migrations and seed fictional data successfully against real Supabase.
- [ ] Verify exact `@ibm.com` auto-approval, rejected lookalikes/subdomains, verification gating, preserved member roles, and revocation with real Supabase.
- [x] Pass type checking, linting, unit tests, and a production build (Webpack). A generated dependency lockfile is included; repository changes are not committed by this work.
- [ ] Run `npm run test:e2e` successfully with separate administrator, owner, and contributor accounts against hosted Supabase (or optional local Supabase).
- [ ] After the main workflow, run `npm run test:integration` against a dedicated test project, including direct API attacks and revoked-session checks.
- [ ] Confirm both home experiences, responsive layouts, keyboard operation, labels, visible errors, and empty states.
- [ ] Submit revisions, accept useful work, and verify accepted evidence cannot be changed.
- [ ] Verify concurrent submission edits and owner acceptance preserve accepted evidence; reject malformed URLs through direct RPC calls.
- [ ] Confirm completed credit appears only for accepted contributors and private project/evidence does not leak to outsiders.

## Required deployment acceptance

- [x] Install Cloudflare tooling, retain the manifest/lockfile changes, and pass the OpenNext adapter build (supplied terminal log).
- [ ] Verify a local Workers preview.
- [x] Publish the selected homepage-only preview (supplied terminal log).
- [ ] Pass `npm run cf:verify` against the live domain.
- [ ] Confirm real-employee/project authorization, or retain entirely fictional demonstration content.
- [ ] Verify production Site URL, redirect allowlist, secrets, and signup restrictions.
- [ ] Receive real verification and password-reset emails through the configured provider and complete both flows.
- [ ] Verify the installed templates and explicit confirmation page with the actual email provider/client; opening a custom-template link must not redeem it before the user submits the confirmation.
- [ ] Verify `projects.fncai.org` DNS, HTTPS certificate, application identity, public landing, and protected-route redirects.
- [ ] Execute the full proposal → approval/ownership → discovery → joining → submission → owner acceptance → completion → profile-credit workflow on the deployment.
- [ ] Revoke an already signed-in test user and verify that existing sessions lose reads and mutations.
- [ ] Review provider error logs and confirm no unresolved workflow errors.

Only after the core release passes should execution features begin. Later invitations require recipient acceptance; board-mode switching must preserve all tasks. Suggested matching and drag-and-drop come after those workflows are verified.
