# Unused bounded original preparation

`prepareContextOriginal` accepts trusted actor/workspace, strict logical source ID,
retry key, PDF/CSV type and a server-owned incoming byte stream. It authorizes before
acquiring the reader, copies at most 50MiB across at most 10,000 chunks, and cancels
on overflow/error. Empty/non-byte content is rejected. Reader locks are released.
The existing #986 verifier checks actual prepared PDF/UTF-8 plausibility and derives
SHA-256/size with fresh scope checks, using the in-memory Blob instead of storage.

Object UUIDv5 is derived from a namespaced owner/source/retry tuple, not the bytes.
Same retry addresses the same object; changed bytes must conflict later rather than
get another object silently. Separate sources/work keys/workspaces get separate
identities. Media type selects the canonical extension. This is not a database
version ID. Inputs cannot supply a path, digest or identity override.

Return is server preparation data plus Blob, not a retained-source receipt or proof
of stored bytes. No upload, SQL, signing, HTTP/MCP caller, provider, parsing, rights
or customer intake. Storage must use no-overwrite semantics, check existing bytes
on exact replay, and reject changed payloads. Registration must reverify the stored
object rather than trust preparation metadata. Acquisition/reconciliation must keep
the stable retry identity and never blindly delete after uncertain registration.

The byte and chunk bounds do not limit how long reader.read waits, upstream network
allocation, total concurrent uploads or storage quota. A connected transport still
needs cancellation/deadline/concurrency controls. Blob/buffer verification may copy
bounded bytes more than once; this is not zero-copy streaming. Extremely fragmented
otherwise-valid files can hit the chunk cap. File checks are plausibility only,
not malware scan, PDF parser, statement/schema validation or rights evidence.

Depends on separately pending API #986 (reviewed commits included until release).
No staging/object-state store added. Immutable acquisition, confirmed-orphan recovery
and supported delivery remain required before intake. This preparation is local
engineering; no customer stream has been read.

Validation:13 new stream/preparation cases plus18 verifier/storage cases =31pass,
full lint/scoped TypeScript/format/diff. Two suites failed missing modules before
implementation. Overflow/cancel, chunk cap, copy isolation, scope revocation and
stable key versus changed digest are synthetic local fixtures.
