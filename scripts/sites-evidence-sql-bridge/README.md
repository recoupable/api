# Offline Sites evidence API → SQL bridge

This suite executes actual capture, stored assessment, selected-publication orchestration, authority/receipt validators and evidence RPC wrappers against the unchanged, inactive Database #136 proposal at `afd214aa73dfd70b0f2b860fce90c12ceb23f28b`. It does not expose a schema or activate publication. The [reviewed plan](PLAN.md) records scope and the discovered correction.

## What runs

`sources.json` identifies the API baseline and exact SHA-256 hashes of 31 executed business modules. Capture has one reviewed change from that baseline: parse the persisted journey using the existing schema for execution-artifact comparison, matching assessment. PostgreSQL JSONB changes key order; raw `JSON.stringify` otherwise rejects unchanged journeys. The original report and digests remain intact. The loader freezes verified bytes, rejects unpinned business imports and original implementations of synthetic seams, and requires every pinned business module to load.

The runner reads all Database sources from the pinned Git commit, verifies hashes before cluster creation, then materializes only those verified bytes. It invokes the original SitesEvidence bootstrap and actual prerequisite authorization migrations. It does not copy or reconstruct SQL business logic. Class cleanups run in `finally`, even after partial setup failure.

A minimal explicit environment, temporary home, UTF-8 locale and disabled dotenv discovery exclude service credentials and hosted DSNs. PostgreSQL listens only on its owned Unix socket. The test transport validates that directory and its marker, then invokes fixed local `psql` without a shell. It maps exactly three RPC names and complete named-argument envelopes, returning actual JSON/SQLSTATE through `callSiteEvidenceRpc`. No business receipt is invented. Node fetch, TCP, TLS, HTTP, DNS and UDP entry points are denied before business imports; each test requires zero attempts. The marker prevents accidental misconfiguration; it is not a credential or security sandbox.

## Declared synthetic seams

The Supabase client is replaced before initialization. Site selection reads the actual disposable SQL row. Workspace membership is an explicit permissive fixture so foreign actors reach—and fail—the actual SQL authorization; a separate API preflight case denies before any RPC. Artist organization/name, account-artist access, paid entitlement, fan configuration and OAuth configuration use synthetic reads while the actual publication authority function runs. Context and signed-preview seams are isolated but deliberately not exercised by these candidates. No provider, browser, hosted authentication or signed Workflow validation is claimed.

Thirteen cases cover two exact JavaScript canonical vectors (including Unicode and numbers), create-once capture/replay, scoped read and actual assessment, eligible review publication, explicit override, API preflight denial, actual SQL foreign actor/owner/site denials, duplicate-key conflict, revision/pointer/artist races after final API reads, and three real postcommit response failures. Race tests compare complete site/evidence state after the injected change against state after rejection. Pointer injection is an actual competing SQL publication. Response-loss/tampered/null receipts leave the committed row visible, propagate failure and produce exactly one publication call with no retry or rekey.

## Run

Install this checkout's frozen dependencies. Supply an existing local Database repository containing the exact commit and a PostgreSQL 15 or 17 binary directory:

```sh
python3 scripts/sites-evidence-sql-bridge/run.py \
  --database-repo /absolute/path/to/database \
  --pg-bin /absolute/path/to/postgresql/bin \
  --evidence-dir /absolute/path/to/local-evidence
```

No network checkout occurs in the runner. CI separately checks out the pinned public Database source read-only, installs tools, and runs the same fixture on PostgreSQL 15 and 17. Ordinary unit discovery skips the 13 integration cases when the runner socket is absent; this is not passing integration evidence. Evidence includes loader attribution and PostgreSQL diagnostics.

This qualifies the API-to-SQL contract through a synthetic transport. PostgREST exposure, hosted identity forwarding, production grants, paid/provider reads, signed-preview execution, external-read atomicity, native acceptance and activation remain unqualified. Database #136 stays draft and unapplied.
