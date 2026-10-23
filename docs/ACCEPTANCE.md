# Assignment search correction — October 23, 2026

Source inspection found that assignment discovery required `email_confirmed_at`, excluded all hidden profiles (including for administrators), and silently filtered existing participants and pending invitees from the page. Search also did not match email addresses. These are confirmed code paths, not a verified diagnosis of the hosted records.

- Added incremental migration `20261023000500_assignment_search.sql`. Candidate discovery requires a real profile and active, user-bound workspace approval, without email confirmation. Admin assignment controls can find hidden accounts and search by email without returning email addresses. Ordinary owners still respect hidden-directory preferences and cannot search by email. Anonymous/unauthorized callers and revoked access remain excluded.
- Invitations can be recorded for unconfirmed active accounts without creating membership. Actor authentication, owner eligibility, recipient-only acceptance, verified sign-in/acceptance, publication prerequisites, revocation, and explicit reinvitation controls remain intact. The `workspace_active` and `account_eligible` helpers are unchanged.
- Existing participants and pending invitees remain in browse/search results with explicit statuses and no duplicate-selection control. Empty results distinguish missing active accounts, unmatched searches, pages, skill suggestions, and load errors. Updated profile visibility text explains admin assignment visibility.
- Generated the small, repeatable `supabase/fix-assignment-search.sql` for already-upgraded databases. Fresh setup and the full October 23 upgrade include the correction. Do not rerun the full upgrade over an already-upgraded database.
- Added read-only `npm run assignments:inspect`: paginates accounts and app records, checks local/production project mismatch, and reports missing profiles/access bindings and filter counts without emails or credentials. Mocked regression reproduces an empty old search with hidden/unconfirmed admins and existing membership, including pagination and GET-only enforcement.

Executed this increment: **35 unit tests, TypeScript, lint, Next.js production build, Cloudflare/OpenNext build, compiled application/confirmation smoke checks, JavaScript syntax checks, and `git diff --check` passed**. Compiled checks use mocked Supabase and verify existing/pending candidates remain visible. These are not database or browser acceptance.

Real hosted integration suites stopped at setup because `.env.test` is absent; zero hosted cases ran. Added hosted cases for admin/unconfirmed discovery, hidden-profile scope, email search, pagination, anonymous/revoked denials, pre-verification invitations, and acceptance only after verification, plus browser assertions for hidden-admin discovery and persistent participant results. They remain unexecuted.

Live read-only diagnosis failed on sandbox DNS (`ENOTFOUND`). Network escalation was not executed: automatic approval review returned **403** because configured model `gpt-5.6-luna` is unavailable. Approval was not bypassed. No live records were inspected successfully, no hosted SQL applied, and no deployment performed. Run the diagnostic locally and apply/test the correction against hosted Supabase before claiming live resolution.

---

# October 23 feature implementation — local evidence

This entry supersedes older feature descriptions below; earlier entries remain historical. Source changes are implemented, but **new migrations, hosted database acceptance, actual visual inspection, and deployment acceptance have not run successfully**. See [UPDATE_SETUP.md](UPDATE_SETUP.md) for ordered rollout and commands.

Implemented: IBM root/valid nested-subdomain signup policy; owner/admin permission parity with actual attribution; catalog UUID pickers and skill requests/approval/retirement; 360-character bios and six learning interests with legacy preservation; project Links; public Sign up; avatar menu, delayed persistent theme toggle and confirmed sign-out; Projects labels and My projects/Clear filters; admin tabs; scoped, searchable two-panel assignment; deterministic contribution/training previews; transactional consent-based invitations/history/cancellation/removal; suggested projects on both homes. Accepted contribution evidence and completion prerequisites remain enforced in the new SQL. The new SQL has been reviewed in source but has **not** been executed against PostgreSQL/Supabase.

Executed against the final local code:

| Check | Result |
| --- | --- |
| `npm test` | Passed: 34 tests, zero failures/skips. Includes matching, profile limits, catalog-ID validation, link safety, permission predicates, filter URLs, password/verification regressions, and reset-history safeguards. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with zero warnings. |
| `npm run build` | Passed; repeated as part of the final Cloudflare build. |
| `npm run cf:build` | Passed; OpenNext generated `.open-next/worker.js`. Existing adapter warnings about Node middleware and compatibility date remain; this is not deployment verification. |
| `npm run test:compiled` | Passed: compiled public/newcomer/participant homes, pending suggestions, signup forms/error/success, protected redirects, project filters/forms, profile catalog controls, links, admin tabs/assignments. Separate compiled confirmation checks prove mocked session-cookie setting, fixed redirects, same-active-account repeat handling, rejection of unrelated/revoked sessions, and recovery routing. Every provider request was mocked. No live accounts or emails were created. |
| `npm run db:setup-file` | Generated fresh setup and additive October 23 upgrade. No SQL was applied. |
| `git diff --check` | Passed. |
| `npm run test:integration` | Both suites stopped at setup: `.env.test` is missing. Zero hosted cases passed or executed. |
| `npm run test:e2e -- tests/e2e/public.spec.ts` | Blocked before browser tests: Next web server cannot bind `127.0.0.1:3000` (`listen EPERM`). |
| Separate system-Chrome launch | Browser exited during launch; no screenshots or visual/keyboard inspection completed. |
| Optional PostgreSQL initialization without Docker | Failed at shared-memory creation (`shmget: Operation not permitted`); no schema validation performed. |

Dependency installation: sandbox registry lookup returned `ENOTFOUND`. The escalation was not executed because automatic approval review returned **403** for unavailable configured review model `gpt-5.6-luna`. Approval was not bypassed. Planned Radix/dnd-kit packages were not installed. Native disclosure/dialog/skill controls and native dragging to prepare a selection are implemented, with keyboard/touch selection buttons. The planned dnd-kit sensor integration remains blocked; its acceptance is not marked complete.

Real integration cases were added/updated for admin attribution, IBM subdomains/spoof rejection, catalog limits/retirement/requests, private links, invitation consent/duplicates/reinvites/cancellation/races, candidate eligibility, preserved evidence, and completion cleanup. Browser cases were updated for catalog pickers/Projects labels and added for assignment consent, filters, persistent theme, and confirmed logout. These suites remain **unexecuted** beyond the setup failures described above.

Still required: apply/test the upgrade in a dedicated Supabase Cloud project; run both real suites; inspect responsive light/dark/keyboard interactions and project-switch races; install/validate dnd-kit when dependency access is restored; then perform the production migration/deployment and live verification. No user account was deleted, no SMTP setting changed, and no production schema or Worker was updated in this implementation run.

---

# Core release acceptance record

## Password confirmation and repeat-link experience — October 22, 2026

- Added Confirm password to signup and new-password forms, with matching enforced by the shared browser/server schemas. Confirmation is not forwarded to Supabase. Login remains a single password field.
- Successful verification redirects to the authenticated homepage with **Email verified successfully.** The homepage renders this only for an active authenticated viewer. A 30-day HTTP-only cookie stores a fingerprint of the last verified link and its user ID, without raw email tokens. Reopening the same link skips OTP redemption only after `getUser` validates the same confirmed user and `workspace_active` grants current access. This hint grants no authentication or authorization and is never applied to recovery. Unrelated links, signed-out sessions, different users, and revoked access cannot use this shortcut. Consumed email tokens remain one-time credentials.
- Executed: 26 unit tests, TypeScript, ESLint, production compilation, Cloudflare/OpenNext build, and whitespace checks passed. The compiled-server smoke test with mocked Supabase verified session cookies, success redirects, repeat clicks without repeated OTP calls, failure for unrelated links/revoked access, inline errors, and preserved recovery routing. No live account, email, or deployment was changed by these checks.
- Added unexecuted browser assertions for mismatched-password feedback, success status, repeat opening of a consumed link in the same session, and unrelated-link rejection. Actual delivered-email/browser verification remains pending after `npm run cf:deploy`. No new SQL migration, SMTP change, or template installation is required for this increment.

## Automatic verification sign-in — October 22, 2026

- The user reports receiving both recovery and signup emails, and being able to sign in after a verification attempt that displayed a timeout/failure. This establishes reported delivery and confirmed-account login; it does not establish the cause of the timeout or a passing automatic sign-in flow.
- Signup email links now submit the existing verification Server Action automatically once after browser hydration. The action persists the Supabase session and redirects home. A manual submit button remains for JavaScript-disabled browsers. Recovery token links retain the manual continue button and password-reset destination. Plain GET previews do not redeem tokens; scanners executing JavaScript may still do so.
- Verification failures remain inline with explicit sign-in/new-link actions. Network errors explain that confirmation may already have succeeded, and used links are distinguished from service unavailability. No automatic retries, relaxed token checks, confirmation bypasses, or permission changes were added.
- Executed: 23 unit tests, TypeScript, ESLint, Next.js production build, Cloudflare/OpenNext build, and whitespace checks passed. An in-process compiled-server smoke check with mocked Supabase verified that GET does not redeem; successful verification POST sets a session cookie and redirects home; service/used-token failures stay inline; recovery redirects to password reset. Its first run used the ordinary build's local-origin configuration and failed; the rerun after building with the Cloudflare production configuration passed. No live accounts/emails were used by this smoke check.
- Added a real Supabase/browser test for unconfirmed token generation, non-consuming GET, automatic sign-in, and session persistence. It has not been executed against hosted Supabase/browser. No deployment, hosted template edit, account deletion, or new live verification test was performed by the agent. Publish with `npm run cf:deploy`, save the updated confirmation template in Supabase, reset only the designated test account using `npm run auth:reset-test`, and test a fresh normal signup.

## Optional administrator People visibility — October 22, 2026

- Added an opt-in hide/show setting on the admin's own Edit profile page. People search omits hidden profiles before applying search/skill/availability filters. Other profile links, project attribution, and access remain available; this is directory visibility, not profile confidentiality. Profiles start visible, and admin demotion restores visibility.
- Added incremental migration `20261022000400_admin_directory_visibility.sql`, with an authenticated self-only admin RPC, restricted execution grants, fixed search paths, and serialization against role/access changes. Direct profile writes remain prohibited. Regenerated the initial setup file; existing databases must apply only the incremental migration.
- Executed: TypeScript checks, ESLint, the production build, and all 22 existing unit tests passed. Those tests do not execute the new database operation. Added real Supabase integration coverage for defaults, hide/show, self-only calls, anonymous/member/revoked denials, direct-write rejection, and demotion; added browser coverage for admin controls, directory filtering, and preserved direct profile access. These new hosted/browser tests have not been executed; no dedicated test project is configured here. The migration has not been applied to hosted Supabase, and this change has not been deployed.

## User sign-in clarification — October 22, 2026

The user reports that live sign-in worked; their remaining objective is to delete the existing IBM test account and test verification through a fresh signup. They also report two profiles named Workspace admin in People. This label is the default bootstrap display name, not evidence by itself of role assignments. The targeted reset removes the IBM test profile when its Auth account is deleted, preserving the personal administrator. The user requested that admins remain visible by default, with an option to hide their own account from People. No hosted deletion has been performed by the agent.

## Requested personal-admin and IBM test-account reset — October 22, 2026

The user explicitly requested retaining `btongnova@gmail.com` as administrator and deleting `nova@ibm.com` to test normal signup/email verification. Updated only the local bootstrap email setting; secret values were preserved.

- Added `npm run auth:reset-test`, restricted to those accounts and this Supabase project. It provisions and verifies the confirmed personal admin before checking the test account's linked work. It deletes the test Auth user only when no projects, memberships, requests, or deliverable attribution reference it. Database foreign keys also protect linked work. The unbound allowlist entry remains, preserving revocations; passwords on existing personal accounts remain unchanged.
- Executed: 22 unit tests passed, including six mocked reset scenarios (successful reset, linked evidence, unready admin, absent target, revoked address, and wrong project). ESLint passed. These mocks created/deleted no real accounts and sent no emails.
- Hosted read-only checks for both addresses failed with `ENOTFOUND` in the agent environment. Neither hosted account was changed by the agent. The prepared command must be run from the user's network-connected terminal. Live sign-in is still unverified; the application URL is `https://projects.fncai.org`, not the root domain.

## Existing-account provisioning repair — October 22, 2026

The user-supplied inspection output confirms an existing, confirmed login with a missing app profile and missing/revoked/unbound workspace access. The old bootstrap returned early for an existing Auth login and could report success after an update matched no role rows.

- Added service-role-only transactional `provision_workspace_records` to repair missing profile, role, availability, and access binding. It validates the service actor and confirmed Auth account, locks the target account and allowlist row, preserves existing profile/role data unless explicitly assigning admin, and rejects revoked or conflicting access. Passwords and email verification are untouched.
- Bootstrap and fictional seeding use this operation; new-account allowlisting no longer silently reactivates revoked emails. Regenerated the combined initial installer. Existing databases need only the incremental account-repair migration.
- Executed: 21 unit tests passed, including existing-account repair routing, preservation of existing passwords, no allowlist reactivation, member/admin intent, and failure propagation. ESLint passed. Database integration coverage was added for service-only permissions, missing-record recovery, repeated repair, preservation, revocation, and unconfirmed-user rejection, but was not executed against hosted Supabase. The SQL migration and repair have not been applied to the user's hosted account by the agent.

## Landing refresh and account inspection — October 22, 2026

- Reworked the public landing with a neutral application icon, IBM workspace label, two-line hero, blue primary action, real GET search to the protected discovery route, and clearly fictional challenge cards. Existing newcomer/participant behavior and authorization are preserved; navigation labels now say Challenges.
- Added local-only `npm run auth:inspect`: GET-only account, email-confirmation, profile, and access-binding inspection. The administrator key stays in the local environment. Added resend-page guidance for missing and already-confirmed accounts.
- Executed: 18 unit tests passed; TypeScript and ESLint passed; the configured Cloudflare production build passed. Mocked compiled-page checks passed for public/newcomer/participant rendering, public search markup, protected-page rendering, and signup success/SMTP-failure feedback.
- `npm run auth:check` validated matching local/production Supabase project URLs, but both external requests failed with `ENOTFOUND`. Actual SMTP settings and email delivery remain unverified. The user reports a verified Resend sender domain, missing app rows for their test address, and no messages in Resend. This does not yet establish whether that address exists in Supabase Authentication → Users.
- Browser/responsive/keyboard checks remain unverified because of the previously recorded local-port and browser restrictions. No Cloudflare upload was performed for this refresh. Publish with `npm run cf:deploy`.

## Earlier homepage and email diagnostics update — October 22, 2026

| Check | Result |
| --- | --- |
| Unit tests | 17 passed with `npm test`, including safe auth errors, rate limits, unknown/5xx failures, and exclusion of provider messages and credentials from diagnostics. |
| TypeScript and ESLint | `npm run typecheck` and `npm run lint` passed. The final Cloudflare build also passed TypeScript. |
| Production builds | Native Webpack build passed; `npm run cf:build` passed with configured production public values. The adapter still warns that Node.js middleware support is experimental. No Worker upload was performed for this update. |
| Compiled-page checks | In-process rendering passed for the public page, zero-membership home, and participant home. The public page made no Supabase calls. Protected-page rendering returned sign-in redirects, including streamed redirects, without workspace content. Authenticated checks used a fictional session and mocked provider responses; they do not validate real permissions. |
| Signup action checks | In-process multipart Server Action requests exercised a mocked Supabase 500/SMTP failure and success. The failure returned a reference and safe setup/delivery feedback; the provider message was excluded. Success returned inbox/verification guidance. No real accounts or emails were created. |
| Public browser tests | Added responsive, keyboard, navigation, and form-validation checks in `tests/e2e/public.spec.ts`. Execution stopped before assertions because starting the local server failed with `listen EPERM`. An independent installed-Chrome launch also aborted with `SIGABRT` under the environment restrictions. Browser presentation, responsive behavior, and keyboard operation remain unverified. |
| Read-only auth diagnostics | `npm run auth:check` confirmed valid public production configuration and matching local/production project URLs. Both the Supabase settings request and live signup page request failed with `ENOTFOUND`; live Auth configuration, signup, SMTP delivery, and domain reachability remain unverified from this environment. |
| Hosted setup reported by user | User reports successful execution of `supabase/setup.sql` and supplied successful administrator bootstrap output. These were not independently verified against hosted Supabase. |

IBM naming is retained. The homepages now use a restrained teal action accent with neutral surfaces and the existing blue IBM wordmark. The public discovery preview uses labeled fictional examples rather than private records. The complete contribution workflow has not been rerun against real Supabase. See [email debugging](AUTH_DEBUGGING.md) for sender-domain choices, SMTP setup, logs, and the real delivery test.

## Earlier checks in this workspace — October 22, 2026

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

The user selected a public-homepage-first release at `https://projects.fncai.org`, whose DNS is already managed in Cloudflare. The supplied log confirms the Worker was deployed. At the time of that earlier deployment, the ignored `.env.production` enabled homepage-only mode with no Supabase credentials. It now contains public Supabase values; publishing the configured application is a separate step. This mode shows a sign-in availability notice and keeps protected workspace pages closed. Follow [the DNS troubleshooting steps](DEPLOYMENT.md#dns-lookup-fails-after-a-successful-deploy), then verify DNS, HTTPS, and public routes before calling that preview live. Authenticated release acceptance remains a separate gate.

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
- [ ] Verify the installed templates and automatic confirmation/sign-in with the actual email provider/client; plain GET previews must not redeem the token. Confirm session persistence and manual fallback with JavaScript disabled.
- [ ] Verify `projects.fncai.org` DNS, HTTPS certificate, application identity, public landing, and protected-route redirects.
- [ ] Execute the full proposal → approval/ownership → discovery → joining → submission → owner acceptance → completion → profile-credit workflow on the deployment.
- [ ] Revoke an already signed-in test user and verify that existing sessions lose reads and mutations.
- [ ] Review provider error logs and confirm no unresolved workflow errors.

Only after the core release passes should execution features begin. Later invitations require recipient acceptance; board-mode switching must preserve all tasks. Suggested matching and drag-and-drop come after those workflows are verified.
