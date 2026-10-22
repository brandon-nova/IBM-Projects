# Core release acceptance record

## Executed in this workspace — October 22, 2026

| Check | Result |
| --- | --- |
| Domain/security unit tests | 6 passed with `npm test` |
| Full application TypeScript | Passed with `npm run typecheck` |
| ESLint | Passed with `npm run lint` |
| Production build with Webpack | Passed with `npm run build -- --webpack` |
| Default Turbopack build | Sandbox prevented its CSS worker from binding a local port; retry outside sandbox was blocked by automatic approval review (HTTP 403: unavailable `gpt-5.6-luna` model) |
| Production request smoke checks | Passed in-process against the compiled app: `/` and `/login` returned 200; `/projects` and `/admin` redirected to login. No HTTP listener was used. |
| Public homepage browser/responsive/keyboard checks | Attempted with installed Chrome; browser process aborted under sandbox restrictions before assertions. Not verified. |
| Dependencies | Installed dependencies and a generated lockfile are now present; installation was not rerun during the visual update |
| Supabase migration and real integration tests | Not verified: no configured hosted project/credentials; `.env.local` was created with empty credentials |
| Authenticated browser contribution workflow | Not run; requires configured Supabase and browser execution |
| Actual SMTP, production DNS/HTTPS | Not verified |

The visible app is now named IBM and uses a blue, light grey, and white palette. Public, newcomer, and participant home layouts were updated. No authenticated layout is claimed as browser-verified.

**Phase 1 is implemented in source but has not passed release acceptance. Phase 2 and Phase 3 have not been started. No deployed domain is claimed.**

## Required local/staging acceptance

- [ ] Apply migrations and seed fictional data successfully against real Supabase.
- [x] Pass type checking, linting, unit tests, and a production build (Webpack). A generated dependency lockfile is included; repository changes are not committed by this work.
- [ ] Run `npm run test:e2e` successfully with separate administrator, owner, and contributor accounts against hosted Supabase (or optional local Supabase).
- [ ] After the main workflow, run `npm run test:integration` against a dedicated test project, including direct API attacks and revoked-session checks.
- [ ] Confirm both home experiences, responsive layouts, keyboard operation, labels, visible errors, and empty states.
- [ ] Submit revisions, accept useful work, and verify accepted evidence cannot be changed.
- [ ] Verify concurrent submission edits and owner acceptance preserve accepted evidence; reject malformed URLs through direct RPC calls.
- [ ] Confirm completed credit appears only for accepted contributors and private project/evidence does not leak to outsiders.

## Required deployment acceptance

- [ ] Confirm real-employee/project authorization, or retain entirely fictional demonstration content.
- [ ] Verify production Site URL, redirect allowlist, secrets, and signup restrictions.
- [ ] Receive real verification and password-reset emails through the configured provider and complete both flows.
- [ ] Verify `projects.fncai.org` DNS, HTTPS certificate, application identity, public landing, and protected-route redirects.
- [ ] Execute the full proposal → approval/ownership → discovery → joining → submission → owner acceptance → completion → profile-credit workflow on the deployment.
- [ ] Revoke an already signed-in test user and verify that existing sessions lose reads and mutations.
- [ ] Review provider error logs and confirm no unresolved workflow errors.

Only after the core release passes should execution features begin. Later invitations require recipient acceptance; board-mode switching must preserve all tasks. Suggested matching and drag-and-drop come after those workflows are verified.
