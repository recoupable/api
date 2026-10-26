# Internal catalog report observations

These helpers are deliberately **unwired**. No route, MCP tool, scheduler, worker, task creator, or application entry point calls them. They do not grant execution permission or make exact-catalog weekly reports available. The app's existing unavailable guard remains authoritative until a separately reviewed durable scope/executor contract exists.

## Input and authority

`catalogReportIntentSchema` accepts exactly `{ kind: "catalog_weekly_report", catalog_id: UUID, organization_id: UUID | null }`. Workspace is explicit; null means personal. It rejects account/actor IDs, artist scope, arbitrary prompts, scheduling fields and all other unknown keys. This is an internal read intent, not a published task-creation schema.

`resolveCatalogReportScope(request, input)` calls `validateAuthContext` with verification evidence on every invocation. Existing-account-only Privy verification or current API-key verification supplies the principal; organization access uses the existing verifier's fresh membership read. No account override is accepted; this boundary requires a self account observation and matching actor/effective account. The fields remain distinct so provenance is explicit, not because delegation has been implemented.

The exact selected owner (organization ID or authenticated account) is passed to `selectAccountCatalogs([owner], { catalogIds: [id] })`, and both ID and owner link are checked. Account-wide visibility through another workspace is insufficient. Evidence absence, mismatch, access denial, or database failure returns an error, not an empty successful observation. Existing organization lookup collapses query errors to denied membership; this helper does not relabel that as an observed revocation.

Output includes non-secret verifier evidence, selected identity, current observation timestamp and physical `account_catalogs` provenance. It excludes authToken and explicitly states `executionAuthorization: "not_granted"`. It cannot reconstruct/revalidate an original scheduled creator from a worker's credential. Never persist/reuse it as a capability or permission token.

## Membership and coverage

`readCatalogReportMembershipPage(request, intent, { page, limit })` validates positive safe page bounds and limit1–100, authorizes, performs **one** `selectCatalogSongsWithArtists` read, then freshly reauthorizes before returning. A principal change or lost link while the read is pending discards rows. Checks are not atomic with the read or any future side effect, and confer no durable guarantee.

The existing selector uses `catalog_songs`, exact catalog equality, deterministic `song desc`, explicit range and no artistName filter. Its inner `songs` join and left artist joins mean creator-less songs survive; the observation concerns joined rows and cannot prove absent/orphan links do not exist. Only exact ISRC membership identifiers are returned; no title/name/artist fallback, provider lookup, discography enumeration or page traversal occurs. Invalid, mixed-catalog, duplicate-ISRC or over-limit row sets fail closed.

The selector's opt-in `observeCount` adds `observed_total_count` from raw Supabase count. Existing callers retain the same shape and numeric `total_count` fallback. This reader uses **only** raw count provenance: missing/invalid/inconsistent counts become null, never zero. A real zero stays zero. `hasMore` is based on the observed count, or null if unknown; it is not a completeness certificate. Even an empty page or a known count fitting one page returns `complete:false`, `generation:null`, reason `stable_membership_generation_unavailable`. There is no membership revision, snapshot or stable cross-page generation to assert. Timestamps identify local observation boundaries only.

## Qualification

Tests mock every authentication/database seam; real Supabase query-client tests replace fetch with synthetic responses. They verify strict input, exact personal/org link, missing/mismatched evidence, current revocation, post-read revocation, principal transition, one-page query parameters/order, count provenance (missing Content-Range vs real zero), row validation, creator-less/case-sensitive ISRCs and error sanitization. No live DB, SQL migration, key mint, provider call, task or schedule operation is involved.

`pnpm test lib/catalog/reports/__tests__ lib/songs/__tests__/authorizeCatalogAccess.test.ts lib/supabase/catalog_songs/__tests__/selectCatalogSongsWithArtists.test.ts`

`pnpm exec tsc --project tsconfig.catalog-reports.json` checks this boundary and its imports using the repository's compiler policy. Global type diagnostics are compared with the exact base separately; this scoped check is not a claim that the entire repository typechecks.
