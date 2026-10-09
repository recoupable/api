# Private storage and explicit reconciliation

`storeContextOriginal` combines bounded incoming preparation (#989), current
workspace authorization immediately before storage, context-private insertion
with hardcoded upsert:false, actual stored-byte readback and registration (#987).
The byte fingerprint/size/type must match the preparation before registration;
the returned receipt must still match afterward. The disabled POST pilot calls these flows; no MCP caller exists.

`reconcileContextOriginal` is a separate explicit recovery operation. Given the
same original input/source/retry identity, it derives the same key, checks existing
stored bytes and invokes the same idempotent registration. It never uploads or
deletes. Changed or unavailable stored bytes withhold the receipt. Neither flow
calls a provider, accepts a caller digest/path/actor override or asserts rights.

Any upload error, including a possible already-present object, is conservatively
unknown. It stops without automatic upload/read/register retry. An authorized
coordinator must choose the explicit reconciliation operation, not invoke store
blindly again or allocate a new retry key. After storage dispatch, lost save replies,
revoked scope or metadata/byte mismatch retain the original recovery identity and
internal cause as ContextOriginalNeedsReconciliation. A stored object may already
exist or be retained; no removal API is called. Exact registration replay is enforced
by Database94, with current-access/withdrawal checks—not by local caches.

No staging ledger, cleanup, source/subject auto-attachment, accepted enrichment or
financial change. Potential orphan objects are left for review; confirmed orphan
cleanup is not implemented. No-overwrite is guaranteed for this insertion call,
not against other trusted raw service writers or storage administrators. A mutation
between verification and save withholds the receipt and requires reconciliation,
which is not an automatic rollback or proof that registration failed.

The disabled transport adds authentication, a 4MiB body cap, a 30-second body
deadline, disconnect cancellation and shared rate admission. Distributed concurrency,
retained storage budgets and controlled delivery remain activation gates. Byte/chunk caps
are not duration/upstream memory/zero-copy guarantees; readback downloads complete
before their Blob size cap. The existing helper's PDF/UTF-8 tests are plausibility,
not parsing, malware/contract validation, identity or rights proof.

Depends on separately pending API986/987/989 and Database94. Reviewed API dependency
commits are included until their releases; refresh main afterward. Nothing is
merged/deployed/live-verified by this engineering slice.

Validation:12 new synthetic mocked-storage/RPC-boundary cases +60 inherited =72 local cases,
full lint/scoped TypeScript/format/diff. Initial missing-module TDD failures were resolved before the passing run. Tests are synthetic, including upload errors, lost register ack,
explicit no-upload replay, changed bytes, revoked scope and a simulated raw storage
mutation. No hosted upload, customer bytes, storage deletion or production fault.

Known activation blocker: changing PDF/CSV type with the same owner/source/work
key changes the extension and may store a second orphan object before Database94
rejects changed payload. Including mediaType in the UUID name does not solve this.
Stable type-independent object addressing or an authoritative pre-upload binding
needs a coherent storage/schema correction before activation; the connected pilot remains
disabled. Do not claim changed-type rejection occurs before upload.

The second stored-byte read also compares prepared fingerprint, size and type before
SQL dispatch. A changed second read cannot register a different version.
