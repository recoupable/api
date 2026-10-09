# Original registration adapter

`registerContextOriginal` and `readContextOriginalRegistration` are unused server
functions. No HTTP/MCP operation, upload, signed URL or paid caller is connected.
The authenticated caller supplies the actor/workspace separately from the strict
logical source ID, retry key and private file key input. Never accept actor or
workspace identity overrides in an eventual public input.

Registration uses the API #986 byte verifier, then Database #94's service-only
transaction. The verifier checks current workspace access before and after loading
private bytes, computes SHA-256 and size, and checks basic PDF/UTF-8 plausibility.
It does not parse a contract/statement, scan malware or verify rights. The current
50MiB check happens after Blob download; bounded acquisition still needs support.

The adapter rejects returned owner/source/digest/size/type mismatches and unknown
receipt fields. Database authorization, withdrawal and retained-version checks
remain authoritative on write, read and exact-key replay. A read returns metadata
only. It does not re-download bytes or prove the stored object remains immutable.

A lost RPC reply, storage error after dispatch or invalid post-write receipt throws
`ContextOriginalNeedsReconciliation` with the original owner/source/retry key and
internal cause. This conservative classification does not assert that the write
committed. The adapter never retries automatically. A future coordinator must stop
dependents and reconcile using that same identity; never allocate a new retry key
or report a confirmed failed save. Do not serialize internal causes to clients.

Private immutable object acquisition, staging/orphan handling, scoped original
retrieval and attachment readback are still required before customer intake.
Registration is a customer assertion, never an accepted enrichment, identity,
rights or mandate decision. It reuses existing sources/versions and private storage.

Validation: 25 new real-adapter tests plus 18 verifier/storage tests. Supabase RPC
and storage boundaries use synthetic fixtures; no hosted operation is exercised.
