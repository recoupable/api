# Context ownership contract

Status: implemented and fixture-tested in this repository; not hosted-verified. This document states what the API enforces for every Context operation across HTTP, MCP (API key and OAuth) and background workers, and what it does not claim. Refs recoupable/app#2120 (CE04) in epic recoupable/app#2116. `README.md` describes the operations themselves; this file covers only who may run them and what a denial looks like.

## 1. Identity comes only from transport authentication

- HTTP `POST /api/context` (`contextOperationHandler.ts`): the body is parsed with the strict `contextOperationSchema` first, so `account_id` or any other identity field in the body is rejected with 400. `validateAuthContext` then resolves the account from `x-api-key` or a bearer token.
- MCP `context` tool (`lib/mcp/tools/context/registerContextTool.ts`): `resolveAccountId` reads the account from `authInfo`; the tool accepts no override argument.
- MCP OAuth per-action tools (`lib/mcp/oauth/registerFullOAuthTools.ts`): each option of `contextOperationSchema` becomes one public tool named in `contextToolOperations.ts`. The public schema strips `action` and `account_id`. On every call the grant is re-verified, the public input is re-parsed, the action is re-injected and the verified account is bound before the same `context` callback runs.
- Workers receive `actor` and `owner` only from the dispatching operation, after it authorized them, and recheck both (section 3).

## 2. Authorization before any private read, write or dispatch

- `processContextOperation` (`processContextOperation.ts`) is the single domain surface for HTTP, MCP and OAuth. It parses the input, then calls `authorizeContextOwner(accountId, organization_id)` before any database RPC, Supabase wrapper or workflow dispatch. The owner is the selected organization or, without one, the personal account.
- `authorizeContextOwner` (`authorizeContextOwner.ts`) rechecks organization membership through `validateOrganizationAccess` on every call. It never retains a grant and fails closed when the membership lookup errors.
- HTTP additionally checks organization membership at the transport (`lib/auth/validateAuthContext.ts`): a non-member receives 403 before the domain layer runs. MCP has no transport-level organization check; the domain layer is its enforcement point. Both transports deny the same operations; HTTP only denies earlier.
- Every Context RPC takes `p_owner`, and release-case RPCs also take `p_actor`. The database filters by owner on every read and write (`database/supabase/migrations/2026092*_context_*.sql`, `20261008160000_context_release_cases.sql`), and Context tables and functions are revoked from `public`, `anon` and `authenticated`, so only the service role reaches them. Release-case RPCs additionally lock the actor's membership row inside the transaction (`authorize_context_case_actor`, `SELECT … FOR SHARE`).

## 3. Workers recheck membership before commit

Queued work does not inherit the permission that queued it.

- `runContextRequest` (`runContextRequest.ts`) authorizes at start and again after provider extraction, immediately before `commit_spotify_context`. A denial at the recheck records `fail_context_request` with a fixed generic message and never commits.
- `runReleaseVerification` (`planning/runReleaseVerification.ts`) authorizes at planning, at execution authorization, at node authorization and again at provider authorization inside `dispatchPlannedContextModule`; each check also re-reads the release target and aborts if it changed.
- `runRecordedReleaseTrackIsrcs` and `runReleaseTrackIsrcs` (`planning/`): `loadCurrentReleaseTrackSlots` authorizes before and after pagination on every read; execution and node authorization reload the slots; `runReleaseTrackIsrcs` rechecks membership once more before `complete_context_release_track_isrcs`.
- `runRecordedContextModules` claims each node in the database before dispatch; an existing or uncertain claim stops for reconciliation instead of calling a provider again.

## 4. Derived documents inherit their inputs' restrictions

- `withdraw_context_source` is owner-scoped and cascades in one function: the source is withdrawn, its results become `withdrawn`, and the owner's documents that pointed at those results are detached (`current_result_id` cleared, revision bumped) in `20260920010000_context_foundation.sql`.
- `compileContextBrief` reads only owner-scoped documents through `read_context_documents` and instructs consumers to treat quoted evidence as source material, not instructions. A saved brief snapshot reads back as `unavailable`, with its content withheld, when any input request is no longer complete or any cited source has been withdrawn; a newer result only marks it `superseded` (`20260926170000_context_brief_snapshots.sql`). Release-case review receipts withhold withdrawn evidence.
- Customer corrections are owner-scoped while canonical Spotify subjects stay global (`20260922161000_context_release_corrections.sql`): a public identity never grants private access.
- Guest work (`/api/context/guest`) is cookie-scoped; claiming it into an account revokes anonymous reads in SQL.

## 5. Denials are opaque on every transport

| Transport   | Denial point                                              | Response                                                                  |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| HTTP        | transport organization check                              | 403 `{ "status": "error", "error": "Access denied to specified organization_id" }` |
| HTTP        | domain layer (`authorizeContextOwner` or any domain error) | 409 `{ "error": "Context operation could not complete. …" }`               |
| MCP API key | domain layer                                              | `{ "success": false, "message": "Context operation failed. …" }`           |
| MCP OAuth   | grant, scope, client or input mismatch                    | `isError` with "Operation unavailable or permission denied …"              |
| MCP OAuth   | domain layer                                              | the same opaque `context` tool result as the API-key path                  |

The domain-layer messages are fixed strings. A denial is deliberately indistinguishable from a missing request or an unavailable provider, and the underlying error message is never serialized.

## 6. Fixture tests

- `__tests__/ownershipParity.test.ts`: for every option of `contextOperationSchema` (iterated generically through `buildContextOperationFixture.ts`, so sibling-added actions are covered on merge) three scenarios run through the real handler, the real MCP callback and the real `processContextOperation`: authorized (same actor, same arguments, same dependencies, membership rechecked by the domain layer on both transports); denied in the domain layer with a private canary in the error (HTTP 409 and MCP `success: false`, canary absent from both responses, and no RPC, Supabase wrapper or workflow dispatch runs); and denied organization membership (HTTP 403 before the domain layer, MCP denied by the domain layer, no private sink).
- `__tests__/oauthContextParity.test.ts`: the real `context` tool registered through `registerFullOAuthTools`: one public tool per action, action re-injection, verified-identity forwarding, `readOnlyHint` matching `contextToolOperations`, and an opaque result on domain denial.
- `__tests__/workerRevocationParity.test.ts`: membership revoked after queueing for `runContextRequest`, `runReleaseVerification` and `runRecordedReleaseTrackIsrcs`: no commit, provider call, credential fetch or outcome save after revocation, and the recorded failure carries no private detail.
- `__tests__/authorizeContextOwner.test.ts`, `__tests__/releaseCaseOperations.test.ts`, `__tests__/spotifyPipeline.test.ts` and the database fixtures in `database/supabase/tests/` cover the underlying checks.

## 7. Explicit non-claims

- No in-transaction actor recheck inside worker commit RPCs (`commit_spotify_context`, `save_context_execution_outcome`, `complete_context_release_track_isrcs`). The application rechecks membership immediately before calling them, but the RPC itself trusts `p_owner`. Shared commit RPCs with an in-transaction lock belong to CE05/CE06 (recoupable/app#2121, #2122).
- In-transaction actor locks exist today only for release cases; evidence attachment RPCs with the same lock are in open database#90 / api#983 and are not covered here.
- Private deletable storage, original-file receipts and the revoked-membership-during-download lifecycle are in open api#986–#991 and database#94/#95.
- Supporting-text extraction is still `not_implemented`; no privileged-instruction path exists yet, so the untrusted-evidence posture is enforced only in brief and enrichment prompts.
- Parity is verified in-process by invoking the registered MCP callbacks, not over a network MCP session, and nothing here is hosted- or live-verified.
- Workflow runtime logs may carry a thrown error's message server-side; only customer-readable records and transport responses are asserted opaque.
