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

The verifier accepts canonical `.original`, `.pdf` and `.csv` keys. Only neutral
`.original` paths select type from the bytes. Legacy paths retain their suffix-selected
PDF or UTF-8 plausibility policy. This helper accepts no declared type, performs no
preparation, and does not validate contract/schema semantics, malware or rights.
Neutral registration requires Database94's forward-only compatibility migration.
Do not automatically migrate or reupload historical objects. Intake is not activated.
