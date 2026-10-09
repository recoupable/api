# Unused retained original readback

`readRetainedContextOriginal(actor, owner, receiptId)` is server-only and has no
HTTP/MCP caller, signing or acquisition flow. Actor/workspace come from trusted
authentication, never a public identity override. Caller provides receipt ID,
not a storage path, hash or claimed byte size.

It authorizes before the real allowlisted Database #95 lookup, strictly validates
its internal owner/receipt/source/version and context-private location tuple,
then uses #986's actual-byte verifier with the default storage boundary. The
returned digest, size and PDF/CSV type must match the retained receipt. It then
uses #987's current receipt read to recheck access, withdrawal and exact retained
metadata before returning `{ receipt, file }` to internal server code.

Internal paths are discarded, not returned. The Blob is intentionally original
untrusted content for a future controlled delivery/parser; never JSON-serialize
it or assume it is malware-free, a valid contract/statement, rights or accepted
analysis. No parser, provider or financial call. PDF/UTF-8 plausibility checks
are unchanged. No automatic read/write retry or side effects.

The byte read still completes before the 50MiB size cap is checked. This does not
provide streaming acquisition/memory limits or immutable object guarantees.
Authorization is checked at specific points, not locked throughout delivery; a
future URL/stream flow must retain its own access contract, brief expiry if signed,
no stored signed URLs and honest post-issuance revocation limits. Stable bounded
acquisition, immutable staging and confirmed-orphan handling remain separate gates.

Dependencies: Database #95/#94 and API #986/#987, each separately approved before
release. This branch includes reviewed API dependencies pending their release;
refresh main to remove overlap afterward. Ordinary receipts remain metadata-only.

Validation: 17 new real-RPC/default-storage/actual-byte fixtures plus 47 inherited
original cases pass locally. New suite failed for missing module before code.
Synthetic RPC/storage/auth boundaries only; no hosted file read or transport proof.
