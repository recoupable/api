# Context ownership contract

Status: implemented and fixture-tested in this repository; not hosted-verified. This document states what the API enforces for every Context operation across HTTP, MCP (API key and OAuth) and background workers, and what it does not claim. Refs recoupable/app#2120 (CE04) in epic recoupable/app#2116. `README.md` describes the operations themselves; this file covers only who may run them and what a denial looks like.

## 1. Identity comes only from transport authentication

- HTTP `POST /api/context` (`contextOperationHandler.ts`): the body is parsed with the strict `contextOperationSchema` first, so `account_id` or any other identity field in the body is rejected with 400. `validateAuthContext` then resolves the account from `x-api-key` or a bearer token.
- MCP `context` tool (`lib/mcp/tools/context/registerContextTool.ts`): `resolveAccountId` reads the account from `authInfo`; the tool accepts no override argument.
- MCP OAuth per-action tools (`lib/mcp/oauth/registerFullOAuthTools.ts`): each option of `contextOperationSchema` becomes one public tool named in `contextToolOperations.ts`. The public schema strips `action` and `account_id`. On every call the grant is re-verified, the public input is re-parsed, the action is re-injected and the verified account is bound before the same `context` callback runs.
- Request, release and enrichment workers receive `actor` and `owner` only from the dispatching operation, after it authorized them, and recheck both (section 3).
- The guest worker (`guest/runGuestContext.ts`) is the exception: it starts from a guest ID and lease token, not an actor. After extraction it loads `actor` and `owner` from `context_guest_worker_scope`. They are set only when a signed-in account adopted the guest work through the authorized `claim` action, and the worker then rechecks them before `complete_context_guest`. Unadopted guest work has no actor or owner and is scoped by its private bearer capability.

## 2. Authorization before any private read, write or dispatch

- `processContextOperation` (`processContextOperation.ts`) is the single domain surface for HTTP, MCP and OAuth. It parses the input, then calls `authorizeContextOwner(accountId, organization_id)` before any database RPC, Supabase wrapper or workflow dispatch. The owner is the selected organization or, without one, the personal account.
- `authorizeContextOwner` (`authorizeContextOwner.ts`) rechecks organization membership through `validateOrganizationAccess` on every call. It never retains a grant and fails closed when the membership lookup errors.
- HTTP additionally checks organization membership at the transport (`lib/auth/validateAuthContext.ts`): a non-member receives 403 before the domain layer runs. MCP has no transport-level organization check; the domain layer is its enforcement point. Both transports deny the same operations; HTTP only denies earlier.
- Every account-scoped Context RPC takes `p_owner`, and release-case RPCs also take `p_actor`. The database filters by owner on every read and write (`database/supabase/migrations/2026092*_context_*.sql`, `20261008160000_context_release_cases.sql`), and Context tables and functions are revoked from `public`, `anon` and `authenticated`, so only the service role reaches them. Release-case RPCs additionally lock the actor's membership row inside the transaction (`authorize_context_case_actor`, `SELECT … FOR SHARE`).
- Guest RPCs are not owner-scoped. They are scoped by the hashed bearer capability (`p_hash`: `read_context_guest`, `start_context_guest`, `adopt_context_guest`) or by the guest ID and lease token (`p_id`, `p_token`: `claim_context_guest_worker`, `context_guest_worker_scope`, `complete_context_guest`, `fail_context_guest`). `adopt_context_guest` also takes the authorized `p_actor` and `p_owner`.

## 3. Workers recheck membership before commit

Queued work does not inherit the permission that queued it.

- `runContextRequest` (`runContextRequest.ts`) authorizes at start and again after provider extraction, immediately before `commit_spotify_context`. A denial at the recheck records `fail_context_request` with a fixed generic message and never commits.
- `runReleaseVerification` (`planning/runReleaseVerification.ts`) authorizes at planning, at execution authorization, at node authorization and again at provider authorization inside `dispatchPlannedContextModule`. Each check also re-reads the release target and aborts if it changed.
- `runRecordedReleaseTrackIsrcs` and `runReleaseTrackIsrcs` (`planning/`): `loadCurrentReleaseTrackSlots` authorizes before and after pagination on every read. Execution and node authorization reload the slots. `runReleaseTrackIsrcs` rechecks membership once more before `complete_context_release_track_isrcs`.
- Recorded runs (`planning/runRecordedContextModules.ts` with `runPlannedContextModules.ts`) behave differently depending on when access is revoked:
  - Revoked before execution authorization: the run rejects before any execution row exists.
  - Revoked at node authorization: the scheduler catches the denial and saves one generic node outcome, `{ key, status: "failed", failureStage: "authorize" }`, through `save_context_execution_outcome`. The run then resolves normally. No node is claimed, no provider is dispatched, no credential is fetched and no error text is stored.
  - An existing or uncertain node claim stops for reconciliation instead of calling a provider again.
- `runContextEnrichment` (`enrichment/runContextEnrichment.ts`) authorizes before claiming and again after the paid call, immediately before `complete_context_enrichment`. A denial at the recheck marks the attempt with `fail_context_enrichment` (owner and attempt ID only) and never completes it.
- `runGuestContext` rechecks an adopted guest's actor and owner before `complete_context_guest`. A denial records `fail_context_guest` (guest ID and lease token only).
- The `contextWorkflow` review step (`app/workflows/context/recordContextPlanStep.ts` → `planning/recordBlockedContextPlan.ts`) authorizes once through `planStoredContextModules` at the start of the step, before it reads the request or records anything.

## 4. Derived documents inherit their inputs' restrictions

- `withdraw_context_source` is owner-scoped and cascades in one function: the source is withdrawn, its results become `withdrawn`, and the owner's documents that pointed at those results are detached (`current_result_id` cleared, revision bumped) in `20260920010000_context_foundation.sql`.
- `compileContextBrief` reads only owner-scoped documents through `read_context_documents` and instructs consumers to treat quoted evidence as source material, not instructions. A saved brief snapshot reads back as `unavailable`, with its content withheld, when any input request is no longer complete or any cited source has been withdrawn; a newer result only marks it `superseded` (`20260926170000_context_brief_snapshots.sql`). Release-case review receipts withhold withdrawn evidence.
- Customer corrections are owner-scoped while canonical Spotify subjects stay global (`20260922161000_context_release_corrections.sql`): a public identity never grants private access.
- Guest work (`/api/context/guest`) is cookie-scoped; claiming it into an account revokes anonymous reads in SQL.

## 5. Denials are opaque on every transport

The security property is fixed. Every denial is a non-success result, HTTP denials are 4xx, and no response carries the underlying error message, the selected organization ID or other private detail. A denial is deliberately indistinguishable from a missing request or an unavailable provider. The envelope and exact status code belong to the Context error contract; open api#1005 replaces the domain-layer rows below with typed codes (a denial becomes 403 `permission_denied` with `code`, `retryable` and `guidance`). The fixture tests pin only the property, so either envelope satisfies them.

Current values on `main`:

| Transport   | Denial point                                               | Response                                                                                                     |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| HTTP        | transport organization check                               | 403 `{ "status": "error", "error": "Access denied to specified organization_id" }`                           |
| HTTP        | domain layer (`authorizeContextOwner` or any domain error) | 409 `{ "error": "Context operation could not complete. …" }`                                                 |
| MCP API key | domain layer                                               | `{ "success": false, "message": "Context operation failed. …" }`                                             |
| MCP OAuth   | grant, scope or client mismatch                            | `isError` with "Operation unavailable or permission denied …"                                                |
| MCP OAuth   | invalid tool arguments (`ZodError`)                        | `isError` with "Invalid tool arguments. Check the tool schema and try again."                                |
| MCP OAuth   | tool rate limit                                            | `isError` with the limiter's own fixed message ("Tool rate limit reached; retry in N seconds")               |
| MCP OAuth   | domain layer                                               | the same opaque `context` tool result as the API-key path                                                    |

## 6. Fixture tests

- `__tests__/ownershipParity.test.ts` covers every option of `contextOperationSchema`. Options are iterated generically through `buildContextOperationFixture.ts`, so actions that sibling PRs add are covered on merge, provided the candidate pool can satisfy their required fields. Three scenarios run through the real handler, the real MCP callback and the real `processContextOperation`:
  - Authorized: the same actor, arguments and dependencies on both transports, with membership rechecked by the domain layer. Every private sink call (RPC, Supabase wrapper or workflow dispatch) receives the authorized organization as owner and the authenticated account as actor. HTTP and MCP make identical sink calls and return the same result. With an empty database answer, 19 of 27 actions succeed on both transports; the other 8 fail identically on both.
  - Denied in the domain layer, with a private canary in the error: both transports return an opaque non-success, the canary and organization ID are absent, and no sink runs.
  - Denied organization membership: HTTP stops at the transport with 403; MCP is denied by the domain layer; no sink runs.
- `__tests__/oauthContextParity.test.ts` registers the real `context` tool through `registerFullOAuthTools`. It checks one public tool per action, action re-injection, verified-identity forwarding, `readOnlyHint` matching `contextToolOperations`, and an opaque result on domain denial.
- `__tests__/workerRevocationParity.test.ts` revokes membership after work was queued. `runReleaseVerification` and `runRecordedReleaseTrackIsrcs` run through the real recorder, scheduler and execution wrappers against one mocked RPC boundary:
  - Revoked before execution authorization: the run rejects and nothing is recorded.
  - Revoked before node authorization: the run resolves, exactly one `failed`/`authorize` outcome is saved, and no claim, dispatch or credential fetch occurs.
  - The same suite covers `runContextRequest`, `runContextEnrichment` (revoked while queued and during the paid call), an adopted `runGuestContext` job, and the `contextWorkflow` review step.
  - In every case, no RPC parameter carries the revocation detail.
- `__tests__/authorizeContextOwner.test.ts`, `__tests__/releaseCaseOperations.test.ts`, `__tests__/spotifyPipeline.test.ts`, `__tests__/guest.test.ts` and the database fixtures in `database/supabase/tests/` cover the underlying checks.

Ticket acceptance coverage:

- Item 1 (REST, MCP and worker parity) and item 2 (revocation while queued or running) are fixture-tested here.
- Item 3 (another customer's private canary through briefs, caches, snippets or exports) is covered only indirectly. A denied caller reaches no private sink, and every authorized read is bound to the caller's own owner. The only canary is the authorization error. No cross-customer brief, cache, snippet or export fixture exists yet.
- Item 4 (corrections scoping) is documented from the database migration in section 4 and not exercised by these suites.
- Item 5 (storage, retention and withdrawal) is owned by the open storage PRs listed in section 7.

## 7. Explicit non-claims

- Worker commit RPCs (`commit_spotify_context`, `save_context_execution_outcome`, `complete_context_release_track_isrcs`, `complete_context_enrichment`) do not recheck the actor inside the transaction. The application rechecks membership immediately before calling them, but the RPC itself trusts `p_owner`. Shared commit RPCs with an in-transaction lock belong to CE05/CE06 (recoupable/app#2121, #2122).
- The `contextWorkflow` review step authorizes only at its start. If access is revoked between planning and saving, it still records the blocked plan's server-owned reasons. It never claims a node or calls a provider.
- In-transaction actor locks exist today only for release cases. Evidence-attachment RPCs with the same lock are in open database#90 / api#983 and are not covered here.
- Private deletable storage, original-file receipts and the revoked-membership-during-download lifecycle are in open api#986–#991 and database#94/#95.
- Supporting-text extraction is still `not_implemented`, so no privileged-instruction path exists yet. The untrusted-evidence posture is enforced only in brief and enrichment prompts.
- Parity is verified in-process by invoking the registered MCP callbacks, not over a network MCP session. Nothing here is hosted- or live-verified.
- Workflow runtime logs may carry a thrown error's message server-side. A run revoked before execution authorization rejects with that error. Only customer-readable records and transport responses are asserted opaque.
