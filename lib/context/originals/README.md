# Private original verification prerequisite

`verifyContextOriginal` is an unused server-side helper. It authorizes the actor's
workspace before and after reading a canonical owner/UUID PDF or CSV key from
`context-private`, derives SHA-256 and byte size from the actual stored bytes,
and rejects empty or over-50-MiB files. The service storage utility itself does
not authorize callers; use the scoped domain helper.

PDF checks only recognizable header/end markers. CSV checks nonempty UTF-8 text
without binary control bytes; it does not prove a valid statement schema.
Neither check is a malware scan, document extraction, credit/rights verification
or signature validation. Original CSV formulas/content are preserved; later
rendering/export must treat them as untrusted data.

No endpoint, MCP tool, upload, source/version registration, persisted receipt,
parsing, signed download or customer intake is introduced. The Blob download
completes before its size is checked; this is not a streaming network/memory cap.
A future staged-upload/registration flow must enforce acquisition limits and
immutable/version-bound storage, handle orphans, retain byte fingerprints, and
recheck current scope/withdrawal before original retrieval. This helper does not
accept caller-provided digests as verification or create accepted analysis.

New original object addresses use `.original`, independent of PDF/CSV type, while
legacy `.pdf` and `.csv` verification remains supported. Neutral-path bytes select
the bounded PDF/UTF-8 plausibility check; preparation rejects a declared type that
differs from the detected type. This is not statement parsing, malware validation
or proof of storage immutability. New neutral registrations require Database94's
forward-only `20261009230000` migration before dependent release. Do not migrate
or reupload historical objects automatically. No customer intake is activated.
