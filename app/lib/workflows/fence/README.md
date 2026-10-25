# Internal fenced workflow branch — 2026-10-25

Base: API `7cafd24254e9403453f60a01d8e6c76f12342c4e` (accepted disabled adapter).
SQL contract/harness: `61d8b530f8b960b32402f4dd1f0d0a8f4f83d76e`, tree
`08bbb524033e34238ab6f4cf96dd1be581d874a0`.

## Invocation and authority boundary

`runAgentWorkflow` accepts either its existing `RunAgentWorkflowInput` or a
separately typed `TrustedFencedWorkflowInput` wrapper. The wrapper carries the
original admission authority, original dispatch attempt and explicit turn intent.
**No route, MCP tool, enrollment flag, public body field or production producer
supplies it.** It is not an authorization grant. Existing resource/recovery
authorization remains unresolved; no synthetic fixture policy is a real policy.
No credential materialization, rotation, revocation or new secret field is added.
The existing legacy workflow input's credential representation is not extended.

A future trusted producer must first establish authoritative resource permission,
accepted original admission/dispatch and an approved credential lifecycle. Merely
constructing this TypeScript shape does not establish those facts. Recovery denial
in the existing auth foundation remains unchanged. This branch must not be wired
or enrolled on the strength of this source qualification.

## Actual execution sequence

1. The first journaled step validates chat/account/authority/attempt/turn and binds
   the **actual workflow metadata run ID** through the existing RPC boundary.
   No ID generation, conversion, stream handle, routing, catalog, model or sandbox
   step precedes bind. Failed or ambiguous bind is terminal and receives no cleanup
   authority. It cannot clear/release/revoke or close the winner's stream.
2. The bound branch awaits the latest user message write before provider work.
   Every write uses the original captured chat/account/epoch/owner/run.
3. New-turn intent generates a fresh assistant ID **and** fresh pending object.
   Same-turn resume requires the explicit assistant ID to match the latest
   assistant and a required `update_parts` acknowledgement before any provider;
   SQL checks existence/current message generation. Bind still requires the
   original run/attempt. This does not authorize historical or cross-run recovery.
4. Catalog, routing-metadata and per-iteration assistant writes all await the
   required adapter. The installed AI SDK can emit own `undefined` object fields;
   `projectFencedUIMessage` omits these absent fields recursively before strict
   persistence. Meaningful metadata/data and full message structure survive.
   Undefined array elements, accessors, symbols, invalid keys, cycles, unsupported
   objects and invalid numbers/strings still fail. Canonical admission/authority
   callers retain the strict encoder default.
5. Auto-commit retains its separately journaled existing effect steps. Only its
   final persistence selection changes for an internal fenced writer: the full
   merged message goes through required `update_parts`. A missing target or other
   failure is terminal; it does not restart the commit/provider loop. Optional
   commit-result fields receive the same SDK-to-JSON projection.
6. Required writes use `FatalError` on failures, including transport ambiguity;
   no automatic retry advice is acted upon. The original bound SQL state remains
   for explicit reconciliation. This is a truthful unresolved state, not proof
   that a failed or unobserved write did not commit.
7. Only after all required writes and existing post-loop work succeed does the
   branch request scoped `workflow_complete` release. A false/failed/ambiguous
   release is terminal. It cannot clear a newer owner. Success finish follows
   release; failed fenced turns do not emit a misleading success finish.
8. After a successful bind, `finally` closes only that run's writable. It never
   invokes legacy slot clear or ephemeral-key deletion. Credential cleanup is a
   blocked lifecycle prerequisite; this PR intentionally makes no replacement
   revoke claim. Stream closure itself is not successful persistence or release.

The legacy path retains its original order, arguments, best-effort persistence,
finish behavior and cleanup. The `legacyCleanupEntered` marker preserves the old
boundary: failures in ID generation/conversion/stream-start previously occurred
outside legacy `try/finally`, so they still do not invoke that cleanup. No route,
Stop/edit caller or backfill behavior changes here. Title/activity remain in the
legacy helpers; fenced ancillary repair is not implemented or claimed exactly once.

## Qualification and limits

- Failing tests preceded the branch implementation. Actual workflow tests exercise
  first bind, losers, required failures, ambiguous outcomes, later-provider
  suppression, new assistant objects, resume-generation failure and legacy cleanup.
- Installed-SDK `readUIMessageStream` output reproduced a review-found failure
  from optional undefined fields. Regression now verifies the projected full
  message and malformed-value rejection. Spec and Standards reviews rechecked it.
- `scripts/chat-fence-workflow-fixture/run.mjs` copies the actual workflow,
  required steps and auto-commit orchestration byte-for-byte into an isolated
  compilation root. Synthetic provider/key/stream/RPC/credit/sandbox boundaries
  cannot contact the network; provider output uses the installed SDK assembler.
  It runs 13 scenarios: success, losing bind, user failure, routing assistant
  failure, ambiguous assistant write, iteration failure, catalog failure, final
  parts failure, release rejection, catalog success, new object, resume, legacy.
  Completed journal replay repeats no effects. This is not hosted execution or
  exactly-once provider/commit proof.
- `test-sql.py` imports the unchanged pinned Context SQL/harness. It replays the
  **captured compiled success commands** on disposable socket-only PostgreSQL,
  checks full-message/data-part readback, duplicate bind rejection, stale writes,
  and old release isolation after a new owner. SQL execution is separate from
  the synthetic compiled run, not an end-to-end RPC transport integration test.
- CI runs the actual compiled fixture as well as the existing full suite,
  foundation fixture and production type checks.

```sh
pnpm test:chat-fence-workflow
WORKFLOW_FENCE_OUTPUT=/private/tmp/workflow-compiled-results.json \
  pnpm test:chat-fence-workflow
WORKFLOW_FENCE_SQL_OUTPUT=/private/tmp/workflow-sql-receipts.json \
  python3 scripts/chat-fence-workflow-fixture/test-sql.py \
  /path/to/database /private/tmp/workflow-compiled-results.json
```

Status: internal branch ready for source review, with no producer or enrollment.
Next action: root reviews/merges only this bounded source. Before activation,
authorization/admission producer, credential ownership/recovery/cleanup, Stop/edit
and historical migration lanes, and ancillary repair require separate approved
work and live qualification. No deployment or activation follows from these tests.
