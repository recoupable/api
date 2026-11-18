# Offline Sites API → SQL qualification plan

Base API f6103bc4f31dfa12f8f9c553920837a7e4d80da5. Database proposal remains draft at afd214aa73dfd70b0f2b860fce90c12ceb23f28b. The sole business-source change is captureSavedSiteReview journey parsing for artifact comparison, as reviewed after the red cross-layer test below. The SQL proposal remains unchanged.

Existing API unit suites substitute RPCs; Database proposal tests invoke SQL without executing API wrappers. Neither closes the combined transport/envelope/assessment/publication gap. Reuse the application-proof SQL bridge frozen-source loader pattern and Database SitesEvidence.setUpClass bootstrap, not SQL business logic or Python canonicalization.

## Source and execution boundary

Pin all actual API business modules in the executed graph by SHA-256 and freeze their bytes in a pre-load Vitest plugin; require each pinned module to load and reject unexpected unpinned local business imports. Explicit synthetic seams are enumerated. Pin Database proposal, fixture grants, golden vectors, test_contract.py, tests/test_release_cases.py and every prerequisite migration from exact Git bytes before cluster creation. Materialize only these verified files to a temporary source tree and import its unchanged SitesEvidence bootstrap. No tests from that class run; setup and cleanup only. Its actual actor authorization migrations execute unchanged.

Runner constructs a minimal environment (explicit executable PATH, temporary HOME/TMPDIR, locale and synthetic fixture marker/socket); no inherited credentials, DSNs, PG options or dotenv loading. Re-execute bootstrap worker under that environment before imports. PostgreSQL listens on owned absolute Unix socket only. Transport verifies marker and socket ownership/path, calls psql without a shell, explicitly fixed local database/port, no URL/host fallback. Deny Node network APIs before business imports, count attempts, require zero. Supabase client module is replaced before import so no production client initializes.

## Actual modules and synthetic seams

Execute actual captureSavedSiteReview, assessStoredSitePublishEvidence, assessSitePublishEvidence, publishSelectedSiteEvidence, publication selection/authority/receipt validators, all evidence Supabase wrappers and callSiteEvidenceRpc, identity/canonical/digest/render helpers and schemas. Supabase RPC stub maps only the three known typed function names and exact named arguments to actual SQL functions as service_role; SQLSTATE is parsed from psql verbose errors and returned to actual callSiteEvidenceRpc. It does not fabricate business results or retry.

Site select transport reads actual SQL row. Workspace membership, Context/artist/paid/fan configuration/OAuth/name reads and signed-preview build reads use explicit synthetic fixtures where unavoidable; actual SQL actor/owner checks remain active regardless of fixture authorization. Prefer executing actual workspace authorization with synthetic membership reads if import graph permits. Actual publication authority executes with its external reads stubbed. Tests assert all substitutions, RPC counts and zero network attempts. No render/browser execution is claimed; review fixtures bind actual pure render artifact hashes.

## Required scenarios and assertions

1. Capture actual saved review → read/assess actual stored record → eligible selected publication. Assert original record identity/time, full candidate bytes/hash, published row/pointer and humanApproval not-recorded. Use actual JS vectors including Unicode and number serialization, compare exact pinned canonical strings/hashes after SQL JSONB round trip.
2. Explicit override through orchestrator → actual capture/read/assessment/publish, exact reason/actor and preserved draft revision.
3. Foreign actor/owner/site scoped read/capture/publish rejection through actual SQL and actual API status mapping; no writes. Also real duplicate-key payload conflict (23505→409) and malformed/absent transport result (503).
4. Inject real SQL changes immediately before publication RPC after final API reads: stale revision, pointer and artist. Require 40001→409 and complete before/after row equality across rejected publication (apart from injected change); evidence immutable. These cases test eight-argument CAS directly in orchestrator.
5. Execute actual SQL commit then discard/throw transport result once. Require exactly one publish call, no blind retry/rekey, actual committed row inspected separately. Also tampered successful receipt rejected by actual validator with committed state explicitly qualified.

## Delivery and qualification

Independent spec and standards review of this plan BEFORE any new fixture execution. Implement test scenarios before harness execution; qualify failures and fixes. Run dedicated suites on disposable PG15 and PG17, focused existing API regressions, actual-import type checks/lint/format. Dedicated CI matrix checks out Database exact commit read-only and runs same runner. Normal unit discovery skips dedicated fixture without marker (not passing integration evidence). Commit/push feature branch, open PR against main, inspect current CI and independent source reviews, seal local evidence with source hashes and raw logs. Root owns merge/release and Business ledger.

Scope is offline cross-layer contract evidence only: no PostgREST schema exposure, hosted authentication, native/provider execution, external-read atomicity, activation, migration apply, production grants, credential use, network service or policy change. Preserve existing worktrees/seals and Database proposal unchanged.

## Independent plan review accepted

Spec reviewer approved with mandatory assertions: SQL denial reaches RPC with 42501 (separate API preflight rejection), CAS snapshots taken after injection, and committed-response loss checked independently with one publication call and unchanged key. Standards reviewer approved with mandatory finally/doClassCleanups even after partial bootstrap failure and envFile:false in standalone Vitest config. These requirements are incorporated before fixture execution.

## Reviewed scope correction after red cross-layer test

Real PostgreSQL JSONB key reordering caused capture to reject unchanged execution journey hashes. Both independent reviewers approved parsing the journey through the existing experienceContractSchema for artifact recomputation, matching assessment, while retaining original report content/hash. The new regression failed before the fix. This is the only business-source change; no renderer/SQL/route/factory change. Stale-pointer injection uses an actual competing SQL publication, not a pointer-only update that the existing trigger clears.
