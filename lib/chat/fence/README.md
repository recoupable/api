# Chat fence foundation — disabled and unwired

This is the first API foundation for recoupable/chat#636 and draft Database #122
at `1d19c6c7c026520c3e8d028c51d4f674972fd8f0`. No route, MCP tool, production
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

## Immutable snapshot source contract

`buildChatExecutionSnapshot` explicitly projects resolved `RunAgentWorkflowInput`
into strict `chat-execution/v1`: model/artist/interactive/dev-surface options,
session title, repository owner/name, sandbox state (source repository/branch/new
branch/prebuilt, runtime identifiers and expiry), working directory/current branch,
Recoup organization and every current skill metadata/options field. Messages stay
in the admission envelope. Any new execution-affecting field requires a reviewed
snapshot contract update. Stored skill metadata does not freeze mutable sandbox
files or remote repository contents.

Raw `recoupAccessToken`, `source.token`, runtime `ephemeralKeyId`, model instances,
writer/run IDs and transient effects are excluded. Repository URLs must be HTTPS
without userinfo, query or fragment; rejected input is never silently rewritten.
The strict `credentialPolicy` records a verified original principal (Privy app,
issuer, subject/account or API-key row/account), effective account, organization,
authorization basis/version/permissions and credential intent. This builder does
not authenticate. Today's shared auth result lacks these fields; a later reviewed
adapter must preserve them before account override. No new auth transport is added.
These non-secret identifiers are sensitive metadata, not a secret store or an
attenuated credential. Arbitrary message strings are not scanned for secrets.

Context's pinned draft stores `admission_envelope`, `execution_snapshot`,
`admission_canonical`, and `execution_canonical` atomically with the receipt.
SQL verifies UTF8 hashes and JSONB equality, not ECMAScript canonical form.
`executeChatFenceCommand` verifies admit material before its single RPC.
`getChatAdmissionSnapshot` retrieves the original request and verifies its expected
account/chat/session/request/epoch, strict versions and snapshot ID, exact canonical
text for both projections, both digests and identical resolved options. Corruption,
missing material, or changed scope fails without fallback. A valid closed receipt
returns explicit `state: "closed"` and its original resource; it never dispatches.
An open result is **not permission to dispatch**. The lower-level RPC's lookup
result is a wire receipt; recovery callers must use `getChatAdmissionSnapshot` with
the original scope for complete integrity verification.

NUL and unpaired UTF16 surrogates are rejected recursively in keys and values
before hashing or sending JSONB. Valid pairs and Unicode normalization are preserved.
Neither JSONB serialization nor current mutable defaults replace stored API bytes.

The accepted credential policy is reauthentication only for durably proven
never-dispatched work. Pending state or null bound-run is never that proof.
Context owns the separate dispatch-attempt CAS; this pin predates it. No dispatch,
recovery-to-workflow reconstruction, credential refresh/mint/revoke or raw-secret
storage is implemented here. Ambiguous or bound work keeps its original identity
and credential disposition; no blind restart or credential renewal is permitted.

## API/SQL byte qualification

`sqlGoldenVectors.test.ts` reproduces the checked-in synthetic
`scripts/chat-fence-fixture/golden-vectors.json`. It covers ECMAScript floats,
lexically sorted numeric keys, non-BMP UTF16 ordering, valid pairs and distinct
composed/decomposed Unicode. Share this vector file with Context; do not fork SQL.

Run `python3 scripts/chat-fence-fixture/test-sql-golden.py /path/to/database`
with PostgreSQL 17 installed (`PG_BIN` can select its binaries). The script reads
SQL and the existing Context test harness directly from the pinned Git commit,
uses its disposable socket-only cluster and teardown, and tests exact readback,
tampering, malformed characters, missing lookups and closed originals after a new
owner. No migration is deployed. This is a local cross-repository qualification;
the standard CI job runs the generated-vector comparison and compiled fixture.
Set `CHAT_FENCE_SQL_OUTPUT=/absolute/output.json` on the Python run and then
`CHAT_FENCE_SQL_RESULT=/absolute/output.json pnpm exec vitest run
lib/chat/fence/__tests__/sqlGoldenVectors.test.ts` to reverify actual PostgreSQL
readback through the API verifier. Without that variable the readback test is
explicitly skipped, never counted as SQL qualification.

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
recovery-to-workflow reconstruction, full persistence/Stop/resume adapters, fresh edited
user/new-turn assistant IDs, old-worker drain and separately approved deployment
and activation remain outstanding. Stronger #636 remains open.
