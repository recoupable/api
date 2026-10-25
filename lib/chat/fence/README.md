# Chat fence foundation — disabled and unwired

This is the first API foundation for recoupable/chat#636 and draft Database #122
at `51a49a7daf20e9664f8b2762d5a50d910517b9f4`. No route, MCP tool, production
workflow, enrollment flag or generated database type uses it. Current quiescent
trailing DELETE and explicit Stop/editor recovery behavior are unchanged.

## Source contract

- `createChatFenceAuthority` validates and freezes the authenticated admission's
  immutable chat/effective-account/epoch/request-owner tuple. It does not grant
  access: existing auth/override/ownership validation must run first.
- `canonicalizeChatAdmission` accepts the strict server-built `chat-admission/v1`
  envelope. It hashes complete ordered messages, resolved options and an immutable
  execution snapshot's identity/digest using UTF-8 SHA-256. Object keys use UTF-16
  lexical order; array order, metadata and all JSON string contents remain intact.
  Absent artist/dev-surface become null and absent interactive becomes true once.
  Resolved model is mandatory; no mutable configuration is consulted.
- Explicit undefined, nonfinite numbers, unsafe integers, cycles, sparse/extended
  arrays, symbols, accessors, own `__proto__` keys and non-plain objects fail.
  The `__proto__` restriction prevents Zod silently discarding accepted content. Nesting over 100 fails.
  The numeric-key golden vector protects against JSON.stringify's object-key
  reordering. Unrecognized envelope/options/snapshot properties fail rather than
  disappearing from the hash. Full message data remains JSON; this is not a
  secret detector/redactor for arbitrary user-authored message strings.
- Credential bytes have no field in the execution snapshot reference or resolved
  options. Credential identity/account scope belongs in the immutable snapshot
  content whose digest is supplied by the trusted server. Never pass the current
  `DurableAgentContext` wholesale: it contains `recoupAccessToken`.
- `executeChatFenceCommand` is the sole Supabase I/O boundary. It validates exact
  command and receipt shapes, scoped identity and receipt epochs. It performs one
  RPC call, no retry, no token refresh and no logging of DB payloads/errors.
  `updated:false` and `released:false` remain explicit non-successful mutations.
  Write outcomes distinguish inserted/exactDuplicate/updated; they do not prove
  title/activity effects were delivered.
- SQLSTATE `40001` means conflict, including stale/tombstoned identity; it does
  **not** authorize generic retry or authority renewal. Only `40P01` marks the
  exact same command retryable. Transport rejection remains ambiguous after a
  possible commit. Recovery must use original identity/receipt, not redispatch.

## Required snapshot persistence contract — not implemented

Source inspection found no existing chat request store that meets this boundary.
The proposed `chat_fence.turns` has `(chat_id,request_id)`, input_hash, expected
and admitted epochs, bound_run_id and closed state, but no reconstructable input.
Workflow inputs become durable only when `start` creates a run; they cannot
recover a reservation whose start response is lost or whose dispatch never ran.
Sessions' sandbox_state/snapshot fields are mutable lifecycle state and messages
are mutable/deletable. Neither is an immutable admission snapshot store.

There is a **precedent**, not a reusable chat facility: Database migration
`20260920010000_context_foundation.sql` defines `context_requests` with input,
fingerprint, workflow ID and resource-scoped idempotency. Its resource/lifecycle
constraints make it inappropriate to silently reuse for chat admissions.

The minimal requested Context-owned extension is two immutable JSONB columns on
`chat_fence.turns`: `admission_envelope` and `execution_snapshot`. The envelope
contains the snapshot ID/digest and version; existing `input_hash` covers the
canonical envelope. This is a proposed interface, not an existing schema. Extend
`admit` to accept and atomically store both, and add an authenticated
`admission_snapshot` command taking only the existing chat/account plus request
ID to retrieve both with the original receipt. Context owns its SQL design:

1. After current authentication/override/ownership checks, the server resolves
   the original execution snapshot once and canonicalizes the envelope. Snapshot
   content pins sandbox identity/configuration, working directory, discovered
   skills, resolved model configuration, artist/repository context and credential
   identity/account scope. The snapshot digest must cover that exact content.
   Any newly execution-affecting option needs an explicit versioned field; it
   cannot be silently omitted by the mapper. Raw bearer/key bytes are excluded.
2. Admission atomically stores the original normalized envelope, canonical hash,
   snapshot ID/digest/content and version with the existing request receipt.
   No successful admission is dispatchable without committed reconstructable
   input. Store-before-admit with independent writes would need orphan and race
   handling; atomic admission is the minimal proposed ownership boundary.
3. An authenticated service-only lookup by `(chat_id,request_id)` returns the
   original envelope/snapshot and receipt, including original bound_run_id after
   close. SQL rechecks session ownership; no browser table grants. Stored input
   is immutable. Changed semantic input under the same key conflicts. An exact
   retry must compare against the stored original, without resolving today's
   defaults/skills/sandbox state first. Lookup failures never imply no start.
4. Before dispatch/recovery the API verifies version, canonical hash and snapshot
   digest, builds durable input from the stored material, and uses the original
   authority. An open receipt may resume only its matching live owner/epoch/run;
   a closed receipt returns its original resource and never redispatches.
5. Retain the original material with receipts through binding/release and define
   retention/deletion separately. Hash-only SQL does not satisfy this contract.

**Credential recovery is unresolved.** Current `buildRunAgentInput` forwards a
Privy token or raw ephemeral key, while the API-key table stores a hash rather
than recoverable raw bytes. No suitable durable credential-reference/secret-store
facility was found. This PR neither invents one nor stores tokens in the snapshot.
A reviewed identity-bound credential materialization/recovery design must precede
runtime wiring. Reacquiring credentials must not silently change execution scope.

Per-chat retry is the accepted scope. A headless retry provisioning a different
chat is outside this deduplication guarantee. This PR adds no global provisioning
map, implicit enrollment, new outbox, SQL migration or activation.

## Compiled offline qualification

Run `pnpm test:chat-fence-foundation` for unit tests/types and the standalone SDK
fixture. The fixture's `.ts.txt` sources are copied to a disposable isolated
compiler root, so application workflow discovery does not register them.
`StandaloneBuilder` compiles actual workflow and step bundles. Local World uses
its direct in-process handlers, real run metadata and durable local journal;
network transports are blocked before compiler/runtime loading.

The fixture binds in a journaled first step, suspends on a durable hook,
re-enqueues the **same** run, and verifies completed binding is not repeated. A
second dispatched run loses before entering winner cleanup. Awaited synthetic
user persistence precedes the provider stub and release. A resolved write failure
prevents provider/release but permits that bound run's key cleanup. The typed
foundation authority/receipt parsers execute inside compiled steps.

This is not the real production agent workflow, SQL-lock enforcement, hosted
scheduling, provider cancellation, stream drainage, a production credential test,
or a deployed guarantee. The synthetic binding file only selects a fixture
winner; Context's disposable PostgreSQL tests own SQL proof. Runtime wiring,
original snapshot retrieval, full persistence/Stop/resume adapters, fresh edited
user/new-turn assistant IDs, old-worker drain and separately approved deployment
and activation remain outstanding. Stronger #636 remains open.
