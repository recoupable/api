# Context Engine release runbook

Release sequencing, rollback switches and the verification checklist for the Context Engine (recoupable/app#2116, release gate recoupable/app#2134). This document describes the shipped surface at the commit that carries it; it does not deploy anything, and every hosted step below is marked as performed or not. `lib/context/__tests__/contextReleaseRunbook.test.ts` fails when a shared action, a runtime `CONTEXT_*` switch or a brief purpose is added without a line here.

Companion documents: `lib/context/README.md` (architecture and per-action behavior), `lib/context/SCENARIOS.md`, the database repository `README.md` ("Rollout and rollback"), and the public reference `docs/api-reference/openapi/context.json` in the docs repository.

## 1. State vocabulary

Report each capability in exactly one of these states. A state is never implied by a later one being requested.

| State | Meaning | Who may claim it |
| --- | --- | --- |
| implemented | Code exists on a branch or in `main`. | Any repository PR. |
| fixture-tested | Unit, transport or transaction tests pass locally or in CI using fixtures and mocks. No provider, credit or hosted call is involved. | Any repository PR; name the command and the pass/fail/skip counts. |
| connected | The merged code in every owning repository is wired end to end (HTTP/MCP → workflow → database functions → app route) and its switches are documented. | Only after the docs, database, api and app PRs for that slice are all merged. |
| deployed | The released commit is the production alias of that repository and the migration is applied in the hosted database. | Only an epic comment that links the deployment and migration evidence. |
| live-verified | An authorized human or agent exercised the deployed path with real workspace data and recorded the outcome. Private request, receipt and source IDs stay in the private operating workspace. | Only an epic comment that links the evidence. |

A repository PR can reach at most **implemented + fixture-tested**. Documentation, an open PR, a merged PR and a green CI run are not deployment. "Not performed" is a valid, reportable state; it is distinct from "failed".

Every output keeps `unknown`, `zero`, `failed`, `uncollected`, `not_applicable`, `denied`, `not_collected` and `needs_reconciliation` distinct. Unknown provider cost is `null`, never `0`.

## 2. Deployment sequence: docs → database → api → app

Merge and release in this order. Each step is a prerequisite for the next; a later step must not be released while an earlier one is open.

1. **docs** (recoupable/docs): the public contract in `api-reference/openapi/context.json` and the frontmatter-only pages under `api-reference/context/`. Publishing docs first makes the contract reviewable before behavior ships; docs describe shipped behavior and must not describe open PRs as live.
2. **database** (recoupable/database): additive migrations listed in 2.1, applied through the approved database release process only. Never apply a migration to a hosted database from a developer machine or an agent session. Follow the database `README.md` "Rollout and rollback" guidance.
3. **api** (recoupable/api): `POST /api/context`, the guest routes, the Vercel Workflows and the MCP `context` tool. Dependent actions fail with a controlled error until step 2 is applied.
4. **app** (recoupable/app, the `chat` submodule): `/releases`, `/context` and the same-origin `/api/context` proxy. The app calls the api, so it is released last and reverted first.

Hosted deployment of the api and app happens through their existing Vercel projects after the PR merges. No sequence step in this document was performed for this PR: `[ ] docs published`, `[ ] migration applied`, `[ ] api deployed`, `[ ] app deployed` — not performed in this PR.

### 2.1 Context migrations in release order

The database repository holds 37 migrations whose file name contains `context` (as of database `main` on 2026-10-10). They are additive: new `context_*` tables, new or replaced `security invoker` functions executable only by `service_role`, and service-role grants on existing tables. None alters the `sites` tables or the legacy knowledge-base storage. Apply in file order; later files replace functions created by earlier ones.

| # | Migration | Introduces | Unlocks |
| --- | --- | --- | --- |
| 1 | `20260920010000_context_foundation.sql` | `context_resources`, `context_subjects`, `context_resource_links`, `context_requests`, `context_sources`, `context_source_versions`, `context_attempts` | Prerequisite for everything below. |
| 2 | `20260920020000_context_spotify_pipeline.sql` | Request claim tokens; `create_context_request`, `read_context_request`, `claim_context_request`, `fail_context_request`, `save_context_metadata`, `commit_spotify_context`, `read_context_documents` | `ingest`, `read`, `brief`; the `contextWorkflow` metadata run. |
| 3 | `20260920030000_context_enrichment_pilot.sql` | Attempt input/error columns; `claim_context_enrichment`, `complete_context_enrichment`, `fail_context_enrichment` | Opt-in paid enrichment harness (`enrichment.live.test.ts`) only; no public action. |
| 4 | `20260920040000_context_guests.sql` | `context_guest_workspaces`; `start_context_guest`, `read_context_guest`, `claim_context_guest_worker`, `context_guest_worker_scope`, `complete_context_guest`, `fail_context_guest`, `adopt_context_guest` | `/api/context/guest`, `/api/context/guest/claim`, the guest and purge workflows (behind `CONTEXT_GUEST_ENABLED`). |
| 5 | `20260921150000_context_reuse_unlinked_socials.sql` | `commit_spotify_context` revision | Reuses unlinked social rows during `ingest` commit. |
| 6 | `20260922060000_context_provider_evidence.sql` | Enrichment claim/complete revision | Provider evidence binding for enrichment results. |
| 7 | `20260922070000_context_catalog_entry.sql` | Provider/kind check extensions; `create_catalog_context_request` | `ingest_catalog`. |
| 8 | `20260922080000_context_artist_scope.sql` | `resolve_context_artist` | Artist scoping in planning. |
| 9 | `20260922144500_context_release_scope.sql` | `resolve_context_spotify_release` | Release scoping in planning. |
| 10 | `20260922160000_context_canonical_spotify_releases.sql` | `commit_spotify_context` revision | Canonical Spotify release subjects. |
| 11 | `20260922161000_context_release_corrections.sql` | `context_release_corrections`; `correct_context_spotify_release` | Server-side release correction records. |
| 12 | `20260922190000_context_profile_lookup_index.sql` | `socials_context_profile_identity_idx` | Profile lookup performance for identity matching. |
| 13 | `20260923070000_context_enrichment_scope.sql` | Enrichment claim/complete revision | Completion-scope checks (database PR76). |
| 14 | `20260923080000_context_execution_records.sql` | `context_executions`, `context_execution_outcomes`; `create_context_execution`, `save_context_execution_outcome`, `read_context_execution` | `plan`, `list_executions`, `read_execution`, `plan_catalog_members`; the `CONTEXT_RECORD_BLOCKED_PLAN_ENABLED` step (database PR77). |
| 15 | `20260924020000_context_enrichment_reuse_binding.sql` | Enrichment claim revision | Reuse binding for accepted results. |
| 16 | `20260924030000_context_artist_entry.sql` | `create_context_artist_request`, `list_context_artist_request_target` | `ingest_artist`. |
| 17 | `20260924040000_context_release_entry.sql` | `create_context_release_request`, `list_context_release_request_target` | `ingest_release`; the `verify_release` target read. |
| 18 | `20260924050000_context_release_verification_scope.sql` | `resolve_context_spotify_release` revision | `verify_release` workflow scope. |
| 19 | `20260924060000_context_release_track_slots.sql` | `context_release_track_slots`; `save_context_spotify_release_track_slots` | Track positions written by release verification. |
| 20 | `20260924070000_context_release_track_read.sql` | `list_context_release_track_slots` | `list_release_tracks`; the `verify_release_tracks` precondition read. |
| 21 | `20260924080000_context_release_track_identity_claim.sql` | `claim_context_release_track_isrcs` | `verify_release_tracks` single-attempt claim. |
| 22 | `20260924090000_context_release_track_identity_evidence.sql` | `complete_context_release_track_isrcs` | `verify_release_tracks` evidence save; `read_release_track_observations`. |
| 23 | `20260924100000_context_release_track_execution.sql` | `save_context_execution_outcome` revision | Release-track execution nodes in `read_execution`. |
| 24 | `20260924110000_context_release_track_identity_review.sql` | `review_context_release_track_identities` | `review_release_track_identities`. |
| 25 | `20260925100000_context_songwriter_name_entry.sql` | Kind checks; `create_context_songwriter_name_request`, `list_context_songwriter_request_target` | `ingest_songwriter_name`. |
| 26 | `20260925110000_context_company_name_entry.sql` | Kind checks; `create_context_company_name_request`, `list_context_company_request_target` | `ingest_company_name`. |
| 27 | `20260925120000_context_campaign_brief_entry.sql` | Kind checks; `create_context_campaign_brief_request`, `list_context_campaign_request_target` | `ingest_campaign_brief`. |
| 28 | `20260925130000_context_supporting_text_entry.sql` | Kind checks; `create_context_supporting_text_request`, `list_context_material_request_target` | `ingest_supporting_text`. |
| 29 | `20260926170000_context_brief_snapshots.sql` | `context_briefs`; `save_context_brief`, `read_context_brief` | `save_brief`, `read_brief`. |
| 30 | `20260927090000_context_audio_source.sql` | Enrichment claim revision | Audio source binding for enrichment. |
| 31 | `20260929030000_site_context_server_permissions.sql` | Service-role grants on `song_identifiers`, `email_send_log` | Server-side Sites/Context reads; no Context action. |
| 32 | `20260929050000_site_context_relationship_permissions.sql` | Service-role `select` grants on relationship tables | Workspace relationship reads for Context. |
| 33 | `20260929060000_context_artist_link_permissions.sql` | Service-role `insert` on `account_socials`, `artist_organization_ids` | Artist link creation during `ingest` commit. |
| 34 | `20261008160000_context_release_cases.sql` | `context_release_case_reviews`; `authorize_context_case_actor`, `list_context_release_cases`, `read_context_release_case`, `read_context_release_case_review`, `review_context_release_case` | `list_release_cases`, `read_release_case`, `review_release_case`, `read_release_case_review`; app `/releases`. |
| 35 | `20261008160100_context_release_case_cursor.sql` | `list_context_release_cases` revision (forward-only cursor correction) | Controlled permission error for missing, foreign or non-release cursors. |
| 36 | `20261009190000_context_research_without_roster.sql` | `commit_spotify_context` revision | Research saves without roster enrollment. |
| 37 | `20261010010000_context_company_assessment.sql` | `context_briefs` purpose check; `save_context_brief` revision | `company_onboarding` purpose for `brief`, `save_brief` and `read_brief`; app company assessment panel. |

Non-`context`-named prerequisite: `20261008030000_onboarding_membership_lock_privilege.sql` grants the `service_role` `select` and `update`-column privileges on `account_organization_ids` that migrations 34–35 lock inside their transactions.

Hosted migration state is **not verified by this document**. The 2026-10-08 read-only production audit recorded in the database `README.md` confirmed the prerequisites for migration 34; migrations 34–37 were later released per epic #2116 comments (database PR86 audit, database PR96 release). `[ ] Hosted migration inventory re-checked` — not performed in this PR.

### 2.2 API release contents

- `POST /api/context` (`app/api/context/route.ts` → `lib/context/contextOperationHandler.ts` → `processContextOperation`). The MCP `context` tool (`lib/mcp/tools/context/registerContextTool.ts`) and the per-operation OAuth tools (`lib/mcp/oauth/contextToolOperations.ts`) share the same Zod schema, authorization and domain function, so MCP parity is structural: the public docs can lag, the MCP schema cannot.
- `POST`/`GET /api/context/guest`, `POST /api/context/guest/claim` (`lib/context/guest/guestContextHandler.ts`) and the cron `GET /api/internal/context-guest-maintenance` (`CRON_SECRET` bearer).
- Vercel Workflows under `app/workflows/context` (`contextWorkflow`, `releaseVerificationWorkflow`, `releaseTrackIsrcWorkflow`, `recordContextPlanStep`) and `app/workflows/contextGuest` (`guestContextWorkflow`, `purgeGuestWorkflow`).
- Database access only through `lib/supabase/context_requests/` (`callContextRpc.ts` and the typed wrappers).

### 2.3 App release contents

- `/releases` (`components/Releases/ReleaseCasesPage.tsx`, `CompanyAssessment.tsx`, `hooks/useCompanyAssessment.ts`, `lib/releases/`) using the authenticated organization-scoped Context helper.
- `/context` guest funnel (`components/Context/ContextFunnel.tsx`) and the same-origin proxy `app/api/context/*` → `lib/context/proxyContextRequest.ts`, which forwards only `authorization`, `content-type`, `origin` and the guest cookie to `CONTEXT_API_URL`.

### 2.4 Docs release contents

- `api-reference/openapi/context.json` documents `ingest`, `read`, `brief`, `save_brief`, `read_brief` and the three guest routes; the remaining shared actions are documented in `lib/context/README.md` and the MCP tool schema until they are promoted to the public reference.
- MDX pages are frontmatter-only; `docs.json` nav group "Context".

## 3. Rollback switches

### 3.1 Runtime switches read by api code

Every switch is off unless its value is exactly `true`. Turning a switch off is a code-free rollback for that path; saved rows are untouched.

| Switch | Read in | Default | Off disables |
| --- | --- | --- | --- |
| `CONTEXT_GUEST_ENABLED` | `lib/context/guest/guestContextHandler.ts`, `app/api/internal/context-guest-maintenance/route.ts` | off | Guest start/read/claim routes return 503 `Guest context is not enabled`; the maintenance cron returns `{ skipped: true }` and dispatches no purge workflow. Already-dispatched guest workflows finish or fail on their own. |
| `CONTEXT_GUEST_ORIGINS` | `lib/context/guest/guestContextHandler.ts` | the request's own origin | Restricts guest `POST` to the exact comma-separated app origins; any other `Origin` receives 403. Point it at the previous app origin to roll the funnel back to an earlier app deployment. |
| `CONTEXT_RECORD_BLOCKED_PLAN_ENABLED` | `app/workflows/context/recordContextPlanStep.ts` | off | The durable blocked-plan step returns `null`; the metadata workflow still returns its original result. Requires migration 14 when on. |
| `CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED` | `lib/context/processContextOperation.ts`, `lib/context/planning/runReleaseVerification.ts` | off | `verify_release` throws `Spotify release verification is not enabled` before any dispatch; the workflow step rechecks the switch and stops. `ingest_release` (saving an unverified locator) stays available. |
| `CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED` | `lib/context/processContextOperation.ts`, `lib/context/planning/runReleaseTrackIsrcs.ts`, `lib/context/planning/runRecordedReleaseTrackIsrcs.ts` | off | `verify_release_tracks` throws `Spotify release track lookup is not enabled`; the workflow and recorded node recheck the switch. `list_release_tracks`, `read_release_track_observations` and `review_release_track_identities` remain read-only and available. |

Related non-`CONTEXT_` configuration: `CRON_SECRET` (maintenance cron bearer), existing Spotify credentials (metadata path), Vercel Workflow runtime. Test-harness variables (`CONTEXT_LIVE_TEST`, `CONTEXT_PAID_TEST`, `CONTEXT_LOCAL_DATABASE_TEST`, `CONTEXT_TRACE_DIR` and similar) are read only by opt-in tests and are not production switches.

### 3.2 App switch

| Switch | Read in | Default | Use |
| --- | --- | --- | --- |
| `CONTEXT_API_URL` (server-only) | `chat/lib/context/proxyContextRequest.ts` | `API_PUBLIC_BASE_URL` | Repoint the app proxy at a previous api deployment or alias without redeploying the app. Guest cookies require the api's `CONTEXT_GUEST_ORIGINS` to include the app origin that serves the proxy. |

### 3.3 Rollback order and retention rule

1. Revert or roll back the **app** deployment first (it depends on the api). Alternatively repoint `CONTEXT_API_URL`.
2. Revert or roll back the **api** deployment, or turn the relevant switch off (3.1).
3. **Keep** the additive `context_*` tables, review receipts, execution records and brief snapshots. Rolling back code must **never drop** Context tables, functions or snapshots as a routine step; schema removal needs a separate reviewed retention/export plan (database `README.md`, "Rollout and rollback"). Earlier api code ignores the newer columns and functions.
4. Existing published Sites URLs and the legacy knowledge-base file paths are served by their own tables and storage; no Context migration alters them, so a Context rollback leaves them unchanged. Private Context evidence never enters the legacy knowledge-base route.
5. Docs: revert the docs PR only if the described action is withdrawn, not merely disabled by a switch; a disabled switch should be documented as disabled.

`[ ] Rollback drill (app revert → api revert → saved rows and published Site URLs confirmed intact)` — not performed in this PR; no hosted rollback has been exercised for the Context Engine yet.

## 4. Shared HTTP/MCP action surface

Twenty-nine action literals in `contextOperationSchema` (`lib/context/processContextOperation.ts` plus `releaseCaseOperationSchemas.ts`). "State" is the state reported in epic #2116 comments at the time of writing; nothing in this column was re-verified by this PR. Migration numbers refer to table 2.1.

| Action | Requires | Switch | State (reported, not re-verified here) |
| --- | --- | --- | --- |
| `ingest` | 1–2 (+5, 10, 33, 36 for current commit behavior) | — | deployed and live-verified for the Spotify metadata path (api PR916, database PR74/75). |
| `read` | 1–2 | — | deployed and live-verified with `ingest`. |
| `brief` | 1–2; 37 for `company_onboarding` | — | fixture-tested for `creative_direction` and `playlist_pitch`; `company_onboarding` live-verified through `save_brief`. |
| `save_brief` | 29; 37 for `company_onboarding` | — | live-verified for `company_onboarding` (database PR96 → api PR992 → app PR2178, 2026-10-10); other purposes fixture-tested. |
| `read_brief` | 29 | — | live-verified with `save_brief` (`company_onboarding`). |
| `plan` | 14 | — | fixture-tested; read-only, never dispatches. |
| `list_executions` | 14 | — | fixture-tested. |
| `read_execution` | 14 | — | fixture-tested. |
| `ingest_catalog` | 7 | — | fixture-tested (api PR917 merged; not live-verified). |
| `list_catalog_members` | 7 | — | fixture-tested. |
| `expand_catalog_members` | 7 | — | fixture-tested; records inclusion only. |
| `plan_catalog_members` | 7, 14 | — | fixture-tested; `collectionPermitted: false` always. |
| `ingest_artist` | 16 | — | fixture-tested. |
| `ingest_release` | 17 | — | deployed and live-verified (direct locator intake, app PR2173, 2026-10-08). |
| `verify_release` | 17–19 | `CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED` | fixture-tested; default off. |
| `list_release_tracks` | 19–20 | — | fixture-tested. |
| `verify_release_tracks` | 20–23 | `CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED` | fixture-tested; default off. |
| `read_release_track_observations` | 22 | — | fixture-tested. |
| `review_release_track_identities` | 24 | — | fixture-tested (api PR917). |
| `ingest_songwriter_name` | 25 | — | fixture-tested. |
| `ingest_company_name` | 26 | — | fixture-tested. |
| `ingest_campaign_brief` | 27 | — | fixture-tested. |
| `ingest_supporting_text` | 28 | — | fixture-tested. |
| `list_release_cases` | 34–35 (+ membership privilege) | — | deployed and live-verified (app PR2172/PR2173, 2026-10-08). |
| `read_release_case` | 34–35 | — | deployed and live-verified for a saved locator case. |
| `review_release_case` | 34–35 | — | deployed; review receipts not yet live-verified per the 2026-10-08 epic entry. |
| `read_release_case_review` | 34–35 | — | deployed; not yet live-verified. |

Guest routes (`/api/context/guest`, `/api/context/guest/claim`) are a separate browser-session surface, not actions of this schema: fixture-tested; hosted activation state unknown to this document (switch default off).

Brief purposes: `creative_direction`, `playlist_pitch`, `company_onboarding`. `company_onboarding` adds `assessment_scope: "selected_saved_context_requests"` and per-request `next_steps` (`review_assessment_coverage` when topics are missing, otherwise `review_available_evidence`). Missing topics are coverage prompts, not proof that evidence does not exist; submitted names and provider metadata do not establish rights, ownership or mandates.

### 4.1 Open PRs, not merged

These add actions that are **not** part of the shipped surface. Do not document them as live; when one merges, add its actions to the table above or the runbook test fails.

- api PR981 + database PR89: `read_company_baseline` (company roster and evidence baseline).
- api PR983 + database PR90: `attach_evidence`, `list_evidence_attachments`, `read_evidence_attachment` (private evidence associations).
- api PR985 + database PR92: `list_evidence_versions` (retained evidence discovery).
- api PR986–PR991 + database PR94/PR95: private original intake and delivery, default-disabled.

## 5. Verification checklist

### 5.1 Fixture checks (repeat on every release candidate)

Run from each repository root. Record counts, not "passes".

| Layer | Command | Last recorded run (commit carrying this file) |
| --- | --- | --- |
| api Context suite | `pnpm exec vitest run lib/context` | 68 files passed, 8 skipped (76 files); 330 tests passed, 8 skipped (338) |
| api runbook guard | `pnpm exec vitest run lib/context/__tests__/contextReleaseRunbook.test.ts` | 4 tests: RED (ENOENT) before this file existed, GREEN after |
| api workflows | `pnpm exec vitest run app/workflows/context app/workflows/contextGuest` | 3 files, 4 tests passed |
| api types / lint / format | `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed files>`, `pnpm exec prettier --check <changed files>` | eslint and prettier clean on changed files; full `tsc --noEmit` reports pre-existing errors only in unrelated `__tests__` files, none in `lib/context`, `docs/` or changed files |
| database | `export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"` (on macOS also `export LC_ALL=en_US.UTF-8`, or `pg_ctl` stops with `postmaster became multithreaded during startup`) then `python3 -m unittest discover -s tests -p 'test_release_cases.py'` and `-p 'test_company_assessment.py'` (CI: PostgreSQL 15 and 16 in `.github/workflows/release-cases.yml`) | PostgreSQL 17.7, disposable cluster: `test_release_cases` 1 test OK, `test_company_assessment` 3 tests OK |
| docs | `python3 -c "import json;json.load(open('api-reference/openapi/context.json'))"` plus the enum/response assertions in the docs PR | parses; `brief`/`save_brief` enums contain `company_onboarding`; 200 response names `assessment_scope` |
| app | `pnpm exec vitest run components/Releases hooks/__tests__/useContextFunnel.test.tsx components/Context lib/context` and `pnpm exec tsc --noEmit` | `[ ]` not run in this PR (app untouched) |

### 5.2 Hosted smoke steps (after deployment, in the intended environment)

Each step is `[ ]` not performed in this PR. Perform them with an authorized account in the authorized workspace; keep request, snapshot and receipt IDs in the private operating workspace, never in a public PR or issue.

1. `[ ]` Migration inventory: confirm migrations 1–37 (and the membership privilege prerequisite) are applied, and that browser roles have no grants on `context_*` tables. — not performed in this PR.
2. `[ ]` Anonymous RPC denial: an `anon`/`authenticated` call to `save_context_brief`, `read_context_brief`, `list_context_release_cases` and `read_context_execution` is denied. — not performed in this PR.
3. `[ ]` Authenticated `save_brief` with `purpose: "company_onboarding"` on an existing completed or partial request, then `read_brief` of the returned snapshot ID returns the same `assessment_scope`, `next_steps` and `input_manifest`. — not performed in this PR.
4. `[ ]` Workspace-scope negative read: the same `read_brief` and `read_release_case` from another workspace (or after membership revocation) returns the controlled not-found/denied error, never the payload. — not performed in this PR.
5. `[ ]` App `/releases`: Preview assessment → cited evidence and gaps → Save → Open saved ID after a full reload; switching workspace clears the panel. — not performed in this PR.
6. `[ ]` MCP parity: the `context` tool (and the OAuth per-operation tools) accept the same `company_onboarding` request and return the same snapshot shape as HTTP. — not performed in this PR.
7. `[ ]` Guest switch: with `CONTEXT_GUEST_ENABLED` unset, `POST /api/context/guest` returns 503 and the maintenance cron returns `{ skipped: true }`; with it set, a wrong `Origin` returns 403. — not performed in this PR.
8. `[ ]` Default-off collection switches: `verify_release` and `verify_release_tracks` return their "not enabled" error with the switches unset; no workflow run or provider call appears. — not performed in this PR.
9. `[ ]` Public docs render the updated `purpose` enum and the `company_onboarding` response description at `docs.recoupable.dev`. — not performed in this PR.
10. `[ ]` Rollback drill (3.3) on a preview environment before any production rollback is needed. — not performed in this PR.

### 5.3 Evidence rules for the checklist

- Record the exact released commit SHAs for api and app and the migration file names applied; a Vercel preview result is not production evidence.
- Costs: the metadata path reports zero provider cost; hosting and database cost are `unmeasured`, not free. Any paid enrichment remains behind separate approval (#2123/#2105).
- A step that could not be performed is reported as not performed, with the blocker, not as passed.

## 6. Out of scope for this runbook and its PR

- Provider/customer cost reconciliation and the paid-execution lane (#2123, #2105); open api PR981–PR991 and database PR88–PR95 stay unapproved and undocumented as live.
- Sites generation quality and the Sites pipeline (#2094, #2133): hard blockers of #2134, untouched here.
- The controlled live pilot with cost ceilings, retention/removal, freshness and readiness policies.
- Broad release, which waits for pilot evidence meeting the epic's first checkpoint.
- Exercising rollback, deploying any revision, applying any migration, or calling any provider. This PR changes documentation and one test only.
