# IBM: project discovery, skills, and admin assignment updates

Implementation plan prepared October 23, 2026. Based on the current repository, the attached Admin Project Assignment & Employee Suggestions request, and the user's two clarifications. This document is a plan; none of the new features below have been implemented or deployed by this planning pass.

Current implementation, executed checks, and remaining dependency/hosted/browser gates are tracked in [UPDATE_SETUP.md](UPDATE_SETUP.md) and [ACCEPTANCE.md](ACCEPTANCE.md).

October 23 follow-up scope: the user requested a native Trello-style board by default, an owner/admin external-board switch that preserves tasks, immediate admin publication with owner assignment, 300-character new descriptions, weekly-hours labels, and tighter project spacing. These requests supersede this plan's original board deferral. Migrations `20261023000600` and `20261023000700` implement those database additions; existing installations use the combined `update-projects.sql`, which also includes the assignment search correction.

**Agreed decisions**

- Keep the IBM name, blue accent, Next.js/TypeScript/Tailwind/shadcn stack, Supabase permissions, and Cloudflare deployment at `projects.fncai.org`.
- Admins can edit project information, manage links and invitations, review join requests and contributions, start projects, and complete them. Record the actual acting admin; do not impersonate the official owner.
- Admin assignments are invitations. An employee becomes a participant only after accepting.
- Move **My projects** out of the filter checkbox into a button above **Create a project**. Add **Clear filters** to the filter bar.
- Use **Projects** everywhere in current interface copy, accessible labels, email copy, and maintained setup documentation. Preserve `/projects` and existing IDs.
- Preserve the zero-membership search home and the participant three-card home. Add pending suggestions to each.
- Deliver in working increments. Keep the requested board to simple tasks and three status columns; do not introduce a separate training platform, AI service, or new authentication provider.

**1. Current implementation and reuse**

| Area | Current repository evidence | Planned treatment |
| --- | --- | --- |
| Password confirmation | `signupSchema`, `passwordSchema`, and `AuthForm` already require matching confirmation. | Preserve and regression-test; do not rebuild. |
| Verification | `/auth/confirm` automatically posts verification, persists a Supabase session, redirects to an authenticated success notice, and supports repeat clicks for the same confirmed session/link. | Retain the secure behavior and make the success text **Success! Email verified.** Consumed tokens cannot create unlimited new sessions. |
| Skills | `skills`, `user_skills`, and `project_skills` already exist; the catalog has ten seeded names. `ensure_skill` currently creates arbitrary names through profile, project, and home-interest RPCs. | Reuse IDs and relationships; close every free-text catalog-creation path. |
| Profiles | Bios allow 500 characters; existing and learning skills allow 20 each. | Set bio to 360 and learning interests to six; retain the existing 20-skill cap for skills someone already has. |
| Admin | `/admin` currently shows approvals and workspace access. Owner assignment already exists. | Add tabs and reuse approval/access components; add Assignments and Skills. |
| Project editing | Database `edit_project`, the edit route, and detail controls currently exclude an admin who is not the owner. | Update all three layers together. |
| Work verification | `review_deliverable`, `complete_project`, `start_project`, and `review_join` currently require the official owner. | Extend authorized operations to active admins, retaining locks, prerequisites, evidence immutability, and attribution. |
| Invitations | `project_requests.request_type` includes `invitation`, but there is no send/respond/cancel workflow. Requests have one row per project/user/type. | Extend this model and keep membership in `project_members`. |
| Navigation | Public home has only Sign in. Participating users have Profile in the main navigation; the avatar links directly to the profile, and Sign out is immediate. | Add public Sign up; move account actions into an avatar menu with confirmed sign-out. |
| Theme | Some CSS variables exist, but many surfaces and text colors are hard-coded light colors. | Convert the full surface/status palette before enabling dark mode. |
| Signup policy | The Auth creation trigger approves only exact `@ibm.com`. | Approve `ibm.com` and valid nested subdomains, while preserving individual revocations. |

The earlier acceptance record reports passing local checks, and the user reported receiving signup/recovery email and signing in. The newly requested feature set has not been tested. Source inspection cannot establish which version or migrations are currently deployed.

**2. Authentication, header, and signup eligibility**

Public header: IBM at left; **Sign in** and a filled IBM-blue **Sign up** button with white text at right. Sign up links to `/login?mode=signup`. Apply the same signed-out header consistently to public authentication surfaces without adding unrelated navigation.

Preserve two password fields for signup and password changes. Matching is checked client-side and again before any provider mutation; password confirmation is never sent as user metadata, logged, or stored. Login keeps one password field.

Successful verification displays **Success! Email verified.** and leaves the user signed in. Repeat clicks on the same link continue to success when the same browser still has the validated, confirmed, active account and its matching verification receipt. A signed-out browser, another account, invalid link, or revoked account cannot reuse that shortcut. Recovery links never use it. Show sign-in guidance for consumed links rather than manufacturing a successful verification. Keep plain GET/prefetch non-consuming, and never automatically retry redemption in a loop.

Extend the signup trigger's domain check at account creation, including direct Supabase API signup. Normalize case, parse the domain after the single `@`, and accept `ibm.com` or valid DNS labels ending in `.ibm.com`. Match a domain boundary, not an arbitrary substring.

| Example | Auto-approved? |
| --- | --- |
| `person@ibm.com` | Yes |
| `person@us.ibm.com` | Yes |
| `person@research.eu.ibm.com` | Yes |
| `person@US.IBM.COM` | Yes, normalized |
| `person@ibm.com.example.org` | No |
| `person@notibm.com` | No |
| `person@ibm.org` | No |
| Malformed empty/doubled DNS labels | No |

Auto-approval grants member status only and still requires email confirmation. Insert allowlist entries with conflict handling that preserves an existing revoked/bound decision. Non-IBM email addresses retain the existing explicit administrator approval mechanism. Existing sessions continue to lose workspace reads/writes when access is revoked. Do not loosen email-change binding protections.

**3. Profile menu, theme, and bio**

Replace the avatar link and standalone sign-out icon with a keyboard-accessible account menu. Its visible items are **Profile**, **Dark mode**, and **Sign out**. Remove Profile from the main header navigation. Keep the profile route and the existing Profile home card.

Dark mode implementation:

- Use a small theme provider with light/dark state. Honor system preference until a user chooses; persist the preference locally and apply it before paint to avoid a white flash.
- Debounce theme changes by about 200 ms and disable the toggle while a change is queued. Clean up the timer on unmount. This prevents repeated clicks from queuing conflicting updates; it must not delay authentication or other navigation.
- Express backgrounds, panels, inputs, text, borders, hover states, badges, notices, focus rings, and previews through shared tokens. Retain IBM blue with suitable contrast in both themes. Set `color-scheme` for native controls.
- Respect reduced-motion preferences, handle unavailable local storage, and keep theme state out of authentication/data permissions.

Sign out opens a confirmation dialog with **Cancel** and **Sign out**. Cancel and Escape keep the session and current page. Confirm calls the existing logout action once. Return focus correctly after cancellation and disable duplicate submissions.

Bio editing gets a visible `0 / 360` counter, consistent character counting, accessible validation, and server/database enforcement for new or changed bios. Existing over-limit bios must not be silently truncated. Inventory them during migration, keep the profile readable, and require shortening at its next edit. Changing visibility or demoting an admin must still work for a legacy long bio; avoid a prematurely validated constraint that blocks unrelated profile updates. Once legacy rows comply, validate the final database check.

**4. Approved skill catalog and skill requests**

Reuse `skills`, `user_skills`, and `project_skills`; do not introduce parallel skill strings. Every new selection is a catalog UUID. Names remain display labels, not authorization inputs.

Seed an expanded catalog with idempotent, case-insensitive inserts. Preserve existing IDs and associations. Include the current ten names plus an initial set spanning:

- Languages/web: JavaScript, Java, Go, C#, C++, Bash, R, HTML, CSS, Node.js, Next.js, Angular, Vue.js, REST APIs, GraphQL.
- Data/analysis: PostgreSQL, Db2, MongoDB, Data analysis, Data visualization, Excel, Power BI, Tableau, Machine learning, Generative AI, watsonx.
- Design/quality: UX design, UI design, User research, Accessibility, Technical writing, Testing, Quality assurance.
- Delivery/infrastructure: Git, Docker, Kubernetes, OpenShift, CI/CD, Terraform, IBM Cloud, AWS, Azure, Google Cloud, Linux, Cybersecurity.
- Collaboration: Project coordination, Agile, Facilitation, Public speaking.

Inventory catalog names previously created through free text. Keep their references and make them selectable during migration; provide admin retirement rather than deleting names in use. Case/whitespace duplicates should resolve to the same catalog entry. Do not automatically merge semantically similar names and risk changing historical project data.

Build one searchable multi-select skill picker for profiles and projects. Show selected skills as removable chips, prevent duplicates, display the limit, and support keyboard selection/removal, mobile touch, and both themes. No comma-separated input remains.

- Profile **Skills I have**: up to 20 catalog skills, retaining the current cap.
- Profile **Want to learn / interests**: up to six catalog skills.
- Project **Skills needed**: one to 20 catalog skills, available to the proposer at creation and authorized editors afterward.
- Missing name: **Request a skill**, with a short name and optional reason. A request does not immediately become selectable or attach itself to a profile/project.

Add `skill_requests`: ID, requester, requested/normalized name, reason, pending/approved/rejected status, reviewer, review time, feedback, approved skill ID, and timestamps. Users can read their requests; admins can read/review all. Deduplicate pending normalized names without exposing another requester's details. Rejection requires feedback. Approval transactionally creates or reuses a catalog entry and records the decision; concurrent approvals cannot create duplicates. Users select an approved skill explicitly afterward.

Add an admin **Skills** tab for requests and catalog maintenance. Retire skills instead of deleting historical references. Existing retired selections stay visible, while new selections exclude them.

Update all skill-writing paths, including `save_profile`, `create_project`, `edit_project`, and `save_interest`. An old client must not continue creating skills indirectly through `ensure_skill` after this change. Use distinctly named ID-based RPCs to avoid PostgREST ambiguity between `text[]` and `uuid[]` overloads. During deployment transition, existing name-based RPCs may resolve approved names only; revoke obsolete execution grants after callers move.

Keep free-text project search separate from interest editing. Searching `I want to learn Python` still finds accessible projects; it must not create a new skill or an unapproved learning interest. Saving an interest requires catalog selection and respects the six-interest limit. A full interest list must never prevent a search.

For legacy users with more than six learning interests, preserve existing data for review and require a choice of six at the next profile save. Block new additions above six without silently choosing which interests to delete. Serialize profile/interest mutations by user so two simultaneous additions cannot exceed the cap.

**5. Admin project permissions and project links**

Centralize the application permission predicates so the detail page, edit route, forms, and database agree. Database checks remain authoritative.

| Operation | Member/proposer | Official owner | Active admin |
| --- | --- | --- | --- |
| Edit unfinished project details/skills | Proposer only while unassigned, retaining current rules | Yes | Yes, across projects |
| Add/edit/remove project links | No, unless also owner/admin | Yes | Yes |
| Send/cancel team invitations | No | Own eligible project | Any eligible project |
| Accept/decline an invitation | Recipient only | Recipient only | Recipient only |
| Review join requests and contributions | No | Own project | Any eligible project |
| Start/complete a project | No | Own project | Yes |
| Assign official owner/approve publication | No | No additional rights | Yes, existing prerequisites apply |

Do not automatically add an admin to membership when they edit or review. Preserve exactly one official owner, immediate proposer/assigned-owner participation, and retained former-owner participation after reassignment. Published projects stay published when edited. Completed projects and accepted evidence retain existing immutability.

An admin accepting useful work is an explicit override of the previous owner-only verification rule, authorized by the user's clarification. Use the existing `reviewed_by`, `reviewed_at`, `completed_by`, and `completed_at` fields to record the real admin. Preserve prior accepted evidence and its original reviewer on ownership changes. Completion still requires at least one accepted submission; only accepted contributors receive completed credit after completion, subject to project visibility.

Add a **Links** section to project details for Linear, Monday, Notion, documents, or other external tools. Use `project_links`: ID, project ID, label, HTTP/HTTPS URL, creator/updater, and timestamps. Cap at ten links per project initially; use simple creation order. No embeds, external-board API integration, scraping, or custom ordering system.

Validate URLs in the form, server action, and database, reusing the existing safe external-URL rules. Reject executable schemes, credentials, malformed hosts, invalid ports, and overlong URLs. Open external links with `noopener noreferrer`. Do not fetch URLs on the server. Readers must already have permission to view the project; links never appear on the public preview or via invitation metadata for inaccessible projects.

Owners/admins can edit links only while the project remains unfinished. Ordinary participants can open links but cannot change them. Unassigned proposers can still propose a project, but link management follows the requested owner/admin restriction.

**6. Projects page and visual corrections**

Place **My projects** above **Create a project** in the page-heading action area. When viewing the user's projects, show an obvious **All projects** return action in that position and an active-state label. Remove the old My projects checkbox. Preserve the existing membership/creator behavior of `?my=1` and preserve that view when searching or changing filters.

Use the recovered horizontal space for search, skill, status, **Search**, and **Clear filters**. Clear filters removes search/skill/status/learning filters while preserving the chosen All/My projects view. The URL remains the source of truth; refresh, bookmarking, and browser Back must work. Maintain hidden `my=1` when submitting a search in My projects.

Fix select indicators as a shared control treatment: explicit inline-end space for a single chevron, balanced inset from the right border, and no text overlap at narrow widths. Avoid double arrows from native and custom styles. Use the same treatment for project filters, owner assignment, availability, visibility, and new selectors. Searchable controls use proper combobox behavior rather than a native select disguised as search.

Replace every current user-facing Challenge/Challenges label with Project/Projects, including navigation, landing examples, hero support copy, search labels, cards, empty states, and tests. Keep historical acceptance records accurate rather than rewriting their past descriptions as new results.

**7. Invitations and membership foundation**

Extend `project_requests` instead of adding a second membership/invitation system. Keep the existing unique `(project_id, user_id, request_type)` constraint and join-request behavior. Add invitation sender, suggestion kind (`contribution`/`training`), reason, last-sent time, response time, and cancellation attribution as needed.

Keep the existing stored `rejected` status for compatibility and display it as **Declined** for invitations. Add `canceled`; preserve pending/accepted. Add an append-only `project_request_events` table recording invitation send/resend, response, and cancellation actors/times. This retains history when an explicitly re-sent invitation reopens the existing unique row. A declined invitation never reopens because someone logged in, refreshed, reran matching, or moved a card.

Transactional operations:

| RPC | Actor and behavior |
| --- | --- |
| `invite_project_members` | Owner/admin for the selected project; validates recipients, locks project, and creates pending contribution/training invitations. Bulk calls are capped and atomic. |
| `respond_project_invitation` | Invited active employee only; locks project then request; Accept creates/reactivates one membership and records response; Decline creates no membership. |
| `cancel_project_invitation` | Authorized owner/admin only; cancels pending invitations without deleting history. |
| `remove_project_member` | Authorized owner/admin on an unfinished project, with confirmation; marks membership inactive and preserves all work and evidence. Reassign the current owner before removing them. |

Eligibility for this release is a published, approved, organization-visible, unfinished project with an active official owner. The assignment selector can show other visible projects as disabled with a brief reason, but no API can invite into an unpublished proposal or completed project. Pending invitations grant no additional private-data access. Consequently, **View details** can reuse the existing published project route without a new private-preview permission path.

The recipient must be an active, confirmed account; exclude revoked and existing active members. Repeated send calls return the existing pending invitation without changing its reason/sender or creating a second suggestion. To invite again after a decline/cancellation or an accepted membership that was later made inactive, require an explicit reinvite action and record another event. Ownership reassignment does not change the sender attribution of invitations already sent; the current owner/admin manages their pending state.

When one participation path succeeds, resolve the other pending path transactionally. Accepting an invitation cancels any redundant pending join request with a clear event reason. Accepting a join request cancels any redundant invitation. Do not fabricate an owner's review or create a second membership. Completion cancels still-pending invitations; they disappear from employee suggestions.

Use the same project-first lock order across inviting, accepting, removing, owner reassignment, join approval, and completing. Recheck eligibility after acquiring locks. Test repeated responses and concurrent accept/cancel/complete requests. All operations check the authenticated actor and current active access, use fixed search paths/qualified database references, restrict execution grants, and disallow direct client DML. RLS limits request/event reads to appropriate recipients and project managers; no privileged application mutation keys.

**8. Admin Assignments interface**

Add tabs to `/admin`: **Approvals**, **Assignments**, **Skills**, and **Access**. Keep the existing controls functional. The Assignments tab follows the supplied two-panel reference and shows one selected project at a time.

Team panel:

- Search by employee name, existing skills, or desired learning skills. Show initials, concise skill chips, and availability when specified.
- Read only eligible active employees. Honor hidden-from-People admin preferences for candidate discovery; keep names visible where they are already assigned project owners/participants.
- Show **Member** and **Invited** states distinctly and disable duplicate actions.
- Offer an individual Assign button, selection checkboxes for bulk assignment, and a drag handle. Keep mobile/button use complete without dragging.

Selected-project panel:

- Searchable project switcher; short description, skills, status, official owner, and existing team.
- Separate **Participants** and **Pending invitations** lists. Do not count pending invitations as team members.
- **Assign**, **Auto-Assign**, and **Train** controls; cancel invitation and confirmed participant-removal actions.
- Switching project clears selections, candidate matches, errors, and drag state. Ignore stale responses for previously selected projects. In-flight mutations remain bound to their captured project ID and report success for that project, never silently for the newly selected one.

Implement button assignment first, then make dnd-kit call the exact same invitation action. Use pointer and keyboard sensors, appropriate drag activation thresholds, screen-reader announcements, and a clear drop area. Auto-scroll and touch behavior must not hijack ordinary page scrolling. On mobile, stack panels; switching and assigning remain available without dragging.

Avoid passing the full workspace snapshot or deliverables into the client assignment component. Use authorized, scoped project/team/candidate reads, capped results, and debounced employee/project search. Reuse existing Supabase clients and server actions rather than introducing another API backend or realtime infrastructure. Refresh authoritative membership/invitation lists after mutations.

**9. Auto-Assign and Train**

Use a pure deterministic matching function on approved skill IDs. Do not introduce an AI API.

- Exclude current members, recipients with pending invitations, revoked/unconfirmed accounts, and hidden candidates. Exclude previously declined candidates from automatic suggestions by default; an admin may explicitly search and reinvite them.
- Contribution ranking: `3 × matching existing skills + matching learning interests`.
- Training ranking: `3 × matching learning interests + matching existing skills`, requiring at least one learning match.
- Require a relevant skill/interest match; availability alone must not create a recommendation. Use reported weekly availability only as a tie-breaker, then stable name/ID ordering. Do not treat total project effort as a weekly commitment or invent capacity calculations.
- Show short, factual reasons such as **Python and SQL match** or **Suggested to help you learn Python**. Missing availability stays **Not specified**.

Auto-Assign displays the top matches with selection controls. It sends nothing until the admin confirms **Invite selected**. Train uses the same invitation operation with `training` kind and a learning reason. It does not grant membership, certify skills, or create a separate training record system. Confirm availability and eligibility again when invitations are actually sent.

**10. Employee Suggested projects experience**

For a zero-membership employee, keep the centered **What do you want to work on?** search and Browse projects/Create a project actions; add **Suggested for you** immediately below. For an existing participant, keep Profile/Learning/Projects cards and show a compact suggestions section.

Each pending invitation shows title, concise description, relevant skills, official owner, estimated effort if present, contribution/training kind, and reason. Display only authorized project data. Existing team can be linked through project details rather than overcrowding cards.

Actions: **Accept**, **Decline**, **View details**. Disable duplicate submissions. Accept updates membership and My projects; Decline removes the pending card without membership; View details never accepts. Handle multiple pending invitations. After the last card is resolved, remove the empty section. Canceled, completed, revoked, or otherwise ineligible suggestions must not persist as actionable cards.

Use the original request record as the source of truth; do not maintain a second frontend suggestions state in the database. This release does not send assignment emails or require another notification provider.

**11. Files and migration sequence**

| Existing files | Work |
| --- | --- |
| `src/app/page.tsx`, `src/app/login/page.tsx` | Public sign-up header, Projects copy, success notice, both home suggestion sections. |
| `src/components/shell.tsx`, `src/app/layout.tsx`, `src/app/globals.css` | Account menu integration, theme initialization/tokens, responsive control and select alignment. |
| `src/components/forms.tsx`, `src/lib/validation.ts` | Skill-picker integration, bio limit, catalog IDs, six-interest validation, password regression coverage. |
| `src/app/actions.ts` | Updated profile/project/search actions and owner/admin review checks; remove free-text skill creation from normal mutations. |
| `src/app/auth/confirm/actions.ts`, `src/lib/email-confirmation.ts`, `src/components/email-confirmation-form.tsx` | Preserve automatic sign-in and secure repeat handling; exact success text and regression tests. |
| `src/app/(workspace)/people/[userId]/page.tsx`, `people/page.tsx`, `learning/page.tsx` | Catalog skills/interests, profile counters, matching/filter display. |
| `src/app/(workspace)/projects/page.tsx` | My projects action, Clear filters, URL-preserving filters. |
| `src/app/(workspace)/projects/[projectId]/page.tsx`, `edit/page.tsx`, `projects/new/page.tsx` | Admin parity, links section, catalog project skills, invitation/team controls. |
| `src/app/(workspace)/admin/page.tsx`, `src/components/approval-controls.tsx` | Tabs, skill requests, searchable owner/assignment controls; reuse approval/access logic. |
| `src/lib/data.ts`, `src/lib/database.types.ts`, `src/lib/domain.ts` | New relationships/RPC types, permission helpers, scoped suggestion reads. |
| `supabase/seed.sql`, `scripts/seed.mjs` | Expanded catalog and fictional contribution/training/invitation scenarios using IDs. |
| `scripts/reset-test-account.mjs`, corresponding tests | Extend linked-work safeguards to new link, invitation-event, and skill-request attribution; never silently cascade away newly recorded history when resetting the designated test account. |
| `tests/*`, `tests/e2e/*`, `package.json`, `package-lock.json` | New test coverage, changed accessible labels, required UI/dnd dependencies. |
| `README.md`, setup/deployment/email/acceptance docs | Exact new migration instructions, behavior, release checks, and executed evidence. |

New focused components/modules:

- `src/components/public-header.tsx`: shared signed-out actions.
- `src/components/account-menu.tsx`, `theme-provider.tsx`: account actions, theme, confirmed sign-out.
- `src/components/skill-picker.tsx`, `skill-request-form.tsx`, `profile-form.tsx`, `project-form.tsx`: shared catalog selection and focused forms rather than expanding the generic fields renderer indefinitely.
- `src/components/project-links.tsx`, `project-invitations.tsx`: owner/admin resource and team controls.
- `src/components/admin/admin-tabs.tsx`, `assignments.tsx`, `skill-requests.tsx`: admin workflows.
- `src/components/suggested-projects.tsx`: shared employee suggestion cards.
- `src/lib/project-permissions.ts`, `assignment-matching.ts`, `assignment-data.ts`: shared predicates, testable ranking, scoped server-only reads.
- `src/app/assignment-actions.ts`, `skill-actions.ts`, `project-link-actions.ts`: focused server actions using the existing authentication/client/error conventions.
- Corresponding shadcn dropdown-menu, alert-dialog, and popover primitives where needed. Add only their necessary Radix packages and dnd-kit core/utilities; no separate theme, AI, or state-management dependency.

Proposed incremental migrations, continuing after the four existing migrations:

1. `20261023000100_access_and_admin_permissions.sql`: IBM subdomain signup, admin parity in project operations, actual actor attribution, preserved approval/completion checks.
2. `20261023000200_skill_catalog_and_profile_limits.sql`: catalog maintenance, skill requests, ID-based RPCs, closed legacy creation paths, staged profile limits, expanded catalog seed.
3. `20261023000300_project_links.sql`: links table, indexes, owner/admin RPCs, validation, RLS/grants.
4. `20261023000400_project_invitations.sql`: invitation fields/status/events/indexes, invitation/member operations, cross-flow reconciliation, completion cleanup, scoped candidate access.

Each migration must run transactionally, state its prerequisites, and add only the schema/functions needed for that increment. Preserve historical migrations; regenerate `supabase/setup.sql` for fresh installations only. Existing databases receive only missing incremental migrations, never a reset or rerun of the combined installer.

**12. Build order and release gates**

| Increment | Deliverable | Gate before proceeding |
| --- | --- | --- |
| A: access and navigation | IBM subdomains, admin operation parity, Sign up, Projects wording, My projects/Clear filters, bio form limits | Direct API/RLS tests for access and admin parity; original verified-contribution workflow still passes. |
| B: skills | Seeded catalog, searchable pickers, six interests, request/admin approval workflow, legacy-safe migration | No browser/RPC path creates arbitrary skills; concurrent saves cannot exceed limits; existing project/profile references survive. |
| C: links and appearance | Owner/admin links, avatar menu, dark mode, sign-out confirmation, shared select padding | Link permissions and validation pass; visual/keyboard inspection of both themes and mobile layouts. |
| D: invitation workflow | Secure send/accept/decline/cancel/removal, button-based admin Assignments, employee suggestions | Separate admin/owner/recipient/outsider sessions prove consent-based membership, no duplication, no private leakage, and cancellation/completion races. |
| E: matching and drag/drop | Auto-Assign review, Train, accessible dnd-kit using the proven invitation operation | Ranking tests, project-switch race checks, pointer/keyboard/mobile assignment parity. |
| F: production verification | Incremental database rollout and Cloudflare deployment | Live email/session checks, deployed assignment loop, responsive/theme/accessibility review, and recorded results. |

Keep every increment usable and deployable. Publish the secure button workflow before adding dragging. The screenshot is a layout/interaction reference; do not copy fictional dates, avatars, statistics, or decorative UI into live product data. Time estimates should follow the first database/browser validation rather than promise a weekend delivery for this scope.

**13. Test and visual inspection plan**

Unit tests: exact/valid-subdomain matching and spoof rejections; matching/missing password confirmation; 360-character bio and six-distinct-interest boundaries; skill-ID deduplication; deterministic contribution/training ranking and exclusions; URL safety; canonical filter URLs; owner/admin permission predicates; verification success/repeat/error routing and theme timer cleanup.

Real Supabase integration tests on a dedicated hosted test project:

- Anonymous, unapproved, revoked-session, role-escalation, and unauthorized function-call denials remain intact.
- Direct signup accepts verified ownership workflows for IBM subdomains but never overrides revocations or creates an admin from client metadata. Provider confirmation is still required.
- Admin/owner/proposer/member/outsider project edit rules, publication retention, owner assignment, locked completion, and immutable accepted evidence. Admin review/completion records the admin and retains original credit rules.
- Catalog-only writes through both new and transitional RPCs; request visibility; duplicate pending requests; concurrent approvals; retired skill behavior; bio/interest legacy handling and concurrent interest additions.
- Link read/write/delete restrictions on private/published/completed projects and malformed URLs through direct RPC calls.
- Invitation recipient/actor eligibility, duplicate sends/responses, explicit reinvites, pending cancellation, declined suppression, reactivation without duplicate membership, owner changes, member removal, join/invitation reconciliation, and accept-versus-cancel/complete/revoke races.
- A pending invitation must never make an unpublished/private project's description, links, members, or deliverables visible.

Browser end-to-end tests:

- Public Sign up reaches the correct form; mismatch prevents signup/password update; Projects labels and header menu routes work.
- Real verification token signs in and displays the exact success status; repeat click works in the same active session; logout/different user/invalid link/recovery cannot bypass verification. Test actual delivered email separately from admin-generated test links.
- Cancel sign-out retains access; confirm signs out. Theme persists over reload/navigation, rapid toggles settle predictably, system/reduced-motion preferences work, and no hydration console errors occur.
- Search/select/remove catalog skills, request a missing skill, approve as another admin, then select it. Seventh learning interest is blocked with useful feedback.
- My projects persists across searches; Clear filters resets filters predictably; browser Back restores view/filter state.
- Admin selects a project, invites by button, switches project during a slow read/mutation, sends training, reviews Auto-Assign, and invites selected candidates. Both home variants receive suggestions; Accept joins, Decline does not, and View details does not accept.
- Drag and keyboard assignment reach the same state as button assignment, with no accidental invites on canceled drops.

Perform an actual browser visual pass, not just CSS review: capture public home, both authenticated homes, profile/edit, projects/filters, details/links, admin assignments/skills, menus/dialogs, and error/empty states in light/dark at 320, 390, 768, and desktop widths. Inspect long names, long URLs, six/20 selected chips, dropdown inset, clipped menus, focus visibility, contrast, touch targets, tab order, focus return, and horizontal overflow. Record screenshots and console errors. If the environment cannot launch a browser or bind a local port, mark visual inspection blocked instead of passing it.

Required commands during implementation: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run cf:build`, dedicated-project integration tests, and Playwright tests. Current planning only inspected source and produced this document; it ran no feature tests.

**14. Deployment and acceptance**

Before production migration, inventory affected legacy records and back up the hosted database. Test on a dedicated Supabase Cloud project; Docker is not required. Use fictional fixtures and preserve real project/contribution records. Never run demo resets against production.

Apply each additive database change before deploying its dependent UI. Keep transitional RPCs safe for old open tabs; once the new app is live, remove obsolete grants. Update role/type declarations, seed tools, and test fixtures in the same increment. Provide a clearly ordered SQL file and click-by-click instructions for each existing-database upgrade; keep migration history consistent if using the CLI.

Deploy with `npm run cf:deploy`, then `npm run cf:verify`. Database migrations and email templates remain separate hosted changes; a successful Worker upload is not a feature acceptance result. No SMTP/provider replacement or new domain is required by this plan.

Final deployed acceptance: an IBM-subdomain employee verifies signup; selects catalog skills/interests; an admin selects a published project, sees suggested people, and sends a contribution/training invitation; the employee sees it on home, accepts, and becomes a member; an authorized owner/admin manages external Links; the employee submits useful work; an admin accepts it and completes the project; the employee receives verified profile credit with the actual reviewer recorded. A second suggestion can be declined without membership, and neither canceled nor declined suggestions spontaneously return.

Record executed checks, provider/network/browser blockers, and actual live results in `docs/ACCEPTANCE.md`. No unexecuted test, visual inspection, delivered email, migration, or deployment may be marked passed.
