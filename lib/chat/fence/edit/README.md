# Edited-turn preparation — internal and unwired

2026-10-25. API base `fd2a46735f572af458d3617f434fcad615d8de3f`; exact draft
SQL `7914f063729db04960149647d9ee19c8f857c417`. Reuses the accepted captured
trailing-delete adapter and existing execution snapshot/admission canonicalizers.
No route, App producer, shared SQL/schema change, enrollment, credential recovery,
resource grant, admission/dispatch or provider call is added.

`captureFencedEditedTurn(input)` is the pure preflight boundary. It takes no executor
and performs no deletion, admission, dispatch or storage. Its frozen handle exposes
only `.read()`, returning an independent strict-JSON copy of `{deletion, admission,
turn:{kind:"new"}}`. The existing v1 envelope, execution snapshot, exact canonical
strings and hash are available before any destructive work. It retains projected
credential-policy metadata, not raw workflow credential context. A caller can mutate
a returned copy without changing later reads; a copy is not an authorization grant,
delete acknowledgement or proof that its original epoch remains current.

The existing preparation helper reuses this capture and the original delete adapter.
Both consume the same exported deletion-intent schema; canonicalization has a single
implementation. Receipt validation and prepared output bytes remain unchanged.
This extraction does not implement atomic persistence with DELETE. A future reviewed
SQL extension must bind saved edit material and its receipt in the same transaction;
no route, App producer or durable browser locator is introduced here.

`createFencedEditedTurn(input, executeChatFenceCommand)` captures one original edit.
The trusted caller supplies original deletion intent, complete original message
history, edited user envelope retaining the anchor ID, already allocated replacement
user/admission/snapshot IDs, resolved workflow input, credential-policy reference
and the known tombstone inventory. IDs are allocated once outside explicit retry.
A surviving client prefix alone is insufficient: missing/ambiguous user anchor or
duplicate original message IDs fails before DELETE. The scoped deletion intent and
its acknowledgement are required; Stop success or history observations cannot substitute.

Capture preflights every schema, identity, both required epoch increments and all
canonical bytes before destructive work. It retains the exact surviving prefix plus
one replacement user message, removing the inclusive original suffix. The replacement
ID must differ from all captured history/deleted IDs and supplied tombstones; the new
admission request must differ from the deletion request. Local checks do not prove
global freshness or authority. SQL rejects unseen tombstones/collisions and reused
admission keys; no conflict causes reminting, epoch adoption or automatic retry.

The execution snapshot projects resolved options and credential-policy metadata,
not the credential-bearing input object. Chat/account must match the deletion
scope; snapshot policy scope validation remains in the existing schema. Actual
chat/session ownership and current authorization remain caller/SQL obligations.

Each explicit `.prepare()` invokes only the captured delete adapter once. It returns
`{deletionReceipt, admission: {action:"admit",payload}, turn:{kind:"new"}}` only after
that adapter validates the original request and resulting epoch. The precomputed
next expected epoch is exactly the acknowledged delete epoch. It returns independent
JSON copies, so caller mutation cannot alter later preparation bytes. Preparation
does not execute the returned admission or establish its current admissibility.

An original receipt may replay after a newer admission. The preparation remains
byte-identical with the original expected epoch; a subsequent attempt to admit it
must conflict with the newer owner. Changed edited content under the same preallocated
identity changes the immutable input hash, and the existing SQL request guard rejects
that change. No local cache/hash comparison is claimed as server conflict enforcement.
A lost acknowledgement yields no prepared result and no admission/start. Explicit
reconciliation can repeat only the original captured operation under separately
validated access; this helper supplies no recovery authorization or retry policy.

`turn.kind:new` selects the existing workflow's durable fresh assistant ID and fresh
pending assistant object. Edited regeneration is not `same-turn-resume`. Surviving
history IDs remain context; deleted IDs cannot be recreated. The preparation type
is not a complete trusted workflow invocation, execution grant or credential object.

## Offline qualification

Unit tests exercise the actual delete adapter/RPC parser with mocked transport,
including pre-delete rejection, input/output mutation, byte-stable replay, wrong or
lost acknowledgements and changed content hashes. Deterministic vectors capture the
actual delete command and prepared admission bytes. The SQL fixture loads the unchanged
pinned proposal/harness via the existing loader and uses disposable socket-only PG.
It checks original old-ID rejection, stable fresh replacement acceptance, immutable
same-request conflict, newer-owner preservation and an unseen cross-chat tombstone.
Lost acknowledgement leaves the database idle after deletion with no admission.
Actual SQL deletion receipts also pass back through the preparation helper.

The existing compiled local workflow fixture consumes the prepared vector and
verifies the replacement user write plus a fresh assistant object, without legacy
writes/cleanup or real provider/credential effects. Its captured command trace is
replayed separately on exact SQL. Synthetic seams and separate SQL replay are not
live transport, provider, authorization or production activation evidence.

```sh
WRITE_EDITED_TURN_VECTORS=1 pnpm exec vitest run lib/chat/fence/edit
WORKFLOW_FENCE_OUTPUT=/tmp/edited-compiled.json pnpm test:chat-fence-workflow
EDITED_TURN_SQL_RESULTS=/tmp/edited-sql.json python3 scripts/chat-fence-edit/test-sql.py /path/to/database /tmp/edited-compiled.json
EDITED_TURN_SQL_RESULTS=/tmp/edited-sql.json pnpm exec vitest run lib/chat/fence/edit
```

Root owns source review/merge. Any later App or route integration needs a separately
accepted public protocol and original-intent persistence/authorization design.
This is preparation after deletion, not an atomic delete-plus-send transaction.
Existing enrollment/drain, backfill, ancillary-effect and resource/credential gates
remain; no database apply or current legacy wire behavior changes follow from this PR.
