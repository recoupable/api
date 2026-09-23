# Context Engine — connected metadata pilot

Part of recoupable/app#2116. Spotify metadata now flows through shared authenticated operations into persistent context and task-specific evidence briefs. This is **not the full enrichment engine**: automatic paid audio, lyric, artwork and research dispatch remains unavailable. An explicitly approved, opt-in paid pilot exercises independently persisted enrichment modules. No creative concepts or websites are generated here.

## Flow

`POST /api/context` and MCP `context` → `processContextOperation` → saved request → Vercel Workflow → `runContextRequest` → Spotify → transactional persistence → authorized brief selection.

- `ingest`: provide `url`, client-generated `idempotency_key`, optional `organization_id` and topics. Returns a saved request with HTTP 202. Retry the same input/key after dispatch failure. A changed input/key pair is rejected.
- `read`: provide `request_id` and the same optional organization scope. Returns progress, subject IDs, gaps and error state.
- `brief`: provide `request_id`, `purpose` (`creative_direction` or `playlist_pitch`), optional organization scope and `max_characters` (1000–32000). Returns attributed current documents, result/version references, missing topics and readiness. This selects evidence; it does not write a creative concept or playlist pitch.

Account identity always comes from authentication. Both transports use the same authorization. Background execution rechecks access before acceptance. Private context never becomes public Site content automatically.

## Persistence and identity

Companion database migrations: `20260920010000_context_foundation.sql` and `20260920020000_context_spotify_pipeline.sql`.

Exact case-preserving Spotify IDs and ISRC identify recording/artist anchors. Ambiguous existing mappings fail instead of choosing an arbitrary account. Recording and submitted release presentation have separate subjects. Collaborators remain separate, with Spotify credit order retained; order does not assert a legal credit role. New artists receive legacy social, account-info and roster links, plus organization attachment when requested.

Source versions and results are immutable. Identical current artist metadata is reused across requests. Earlier fetched metadata cannot overwrite a newer source snapshot. Briefs exclude withdrawn evidence and raw provider payloads. Raw responses remain in server-only storage records for inspection.

Database request claims use fencing tokens and a two-minute metadata lease. Retrying `ingest` can recover an expired claim or failed dispatch. This lease is not a creative-generation cap. The current pilot has no scheduled dispatch-gap recovery sweep, automatic enrichment, or paid retries.

## Scope and costs

`release_metadata` contains track/release facts and artwork URLs. `artist_metadata` contains credited provider identity/name; it is **not artist research**. Metadata coverage is explicitly partial and says no audio was analyzed. Other requested topics are unavailable. Requests are partial when topics are missing.

The public metadata path invokes no LLM. Spotify metadata has no per-call model charge; hosting/database costs are not measured by the zero provider-cost field. Paid enrichment remains gated on spending authorization and stable settlement, rather than bypassing the existing credit ledger.

## Validation

- `pnpm test lib/context`: contracts, access, extraction, orchestration, brief selection and HTTP/MCP delegation tests.
- Database `supabase/tests/context_pipeline.sql`: real transactional persistence, duplicate requests, input conflict, worker fencing, two-track artist reuse, separate release documents and ownership.
- `pipeline.live.test.ts`: opt-in real Spotify requests through **the same shared domain runner**, using database functions through a local psql transport. Requires an isolated PostgreSQL fixture on port 55439, database `context_final`, `CONTEXT_LIVE_TEST=1`, `CONTEXT_TRACE_DIR`, and existing Spotify configuration. Ordinary tests skip it without credentials.

The live test does not verify deployed Supabase, HTTP credentials, MCP transport or hosted Vercel Workflow execution. Release migrations through the database repository PR before deploying dependent code. Keep production activation separate from local proof.

## Next milestone

Connect independently persisted paid analysis/research modules with bounded spend and recoverable settlement; then review fully enriched two-song/two-brief output. Reuse the Music Flamingo catalog/lyric presets, distinguish preview from full-song coverage, and keep artwork observations separate from creative proposals. Sites integration and YouTube follow their existing epic dependencies.

## Approved paid enrichment pilot

`enrichment.live.test.ts` uses the persisted local Spotify fixture, production Recoup Music Flamingo `catalog_metadata` and `lyric_transcription` presets, GPT-6 Astra for neutral preview summary and visual extraction, and Perplexity search plus Astra for attributed artist research. It stops at saved context and evidence briefs, with no creative concept or site generation.

Enable only deliberately with `CONTEXT_PAID_TEST=1`, `CONTEXT_BASELINE` pointing to the metadata report and a private `CONTEXT_TRACE_DIR`. Requires the third companion migration, `20260920030000_context_enrichment_pilot.sql`, on the isolated local fixture. Each paid response is checkpointed before persistence. Accepted results are reused; an ambiguous prior attempt requires reconciliation rather than another provider call.

Music Flamingo's production endpoint handles its own API-key credit charge. Gateway and search calls in this manual harness are approved internal test expenses; they do not debit a customer wallet. This does not prove production spend reservation, reconciliation, or automatic paid dispatch. Unknown provider costs remain null, not zero. Preview analyses and snippet-based research remain partial, including when every brief topic has a document.

## Guest-to-account funnel

The Chat app exposes `/context` and same-origin `/api/context` proxy routes. Its public route does not open the login modal automatically. A guest submits one Spotify track, sees metadata progress, and chooses **Sign in and save**. After Privy authentication and account creation are ready, the browser claims the saved work into the personal account. The API also supports an explicitly authorized organization destination; this initial UI intentionally labels and uses the personal account.

API configuration: `CONTEXT_GUEST_ENABLED=true`, `CONTEXT_GUEST_ORIGINS` with the exact comma-separated app origins, and `CRON_SECRET` for scheduled retention cleanup. Chat configuration: server-only `CONTEXT_API_URL` targeting the matching API deployment. Apply all four database migrations before enabling the feature. No service credentials are forwarded from the browser proxy. Guest cookie values are HttpOnly, hashed at rest, and excluded from JSON.

`POST /api/context/guest` starts/resumes metadata work; `GET` reads it; `POST /api/context/guest/claim` requires the original cookie plus verified account authentication. Claim is idempotent and revokes anonymous reads. A claimed/expired cookie is replaced only when starting new guest work. The browser preserves claim intent through an in-tab login redirect, and retains a request ID scoped to the signed-in account. Clearing cookies, switching browsers or switching devices does not transfer guest access.

Guest admission is capped at 100 new workspaces/day globally, metadata only. Unclaimed records expire after seven days and are purged daily. Claimed payloads are removed after expiry while a small receipt remains for claim retries. Failed claimed jobs report failure to the account and retry through the original guest job. This is a limited pilot, not a complete anti-abuse system or production availability claim.

Still outside this addition: automatic paid enrichment/credit settlement, Sites creation from saved context, signup completion email delivery, cross-device claim links, and a UI organization destination picker. Do not promise an emailed or generated experience from this metadata screen.

### Read an execution trace

The shared HTTP/MCP context operation accepts `{ "action": "read_execution", "execution_id": "<uuid>" }`, with optional `organization_id`. Workspace authorization resolves the owner before the service-only `read_context_execution` database call. The response is `{ execution }`, including its immutable plan, policy version and node outcomes. Reading does not dispatch providers or retry work; cancelled runs remain inspectable.

Requires database PR77 (`20260923080000_context_execution_records.sql`). No automatic execution creation or inspector integration is enabled by this read operation. Evidence dispatch additionally requires the completion-scope migration from database PR76 and collection/spending policy integration.
