# Private original verification prerequisite

`verifyContextOriginal` is a server-side byte verifier used by registration and
retrieval adapters; the chain has no public HTTP/MCP caller on this branch. It authorizes the actor's
workspace before and after reading a canonical owner/UUID PDF or CSV key from
`context-private`, derives SHA-256 and byte size from the actual stored bytes,
and rejects empty or over-50-MiB files. The service storage utility itself does
not authorize callers; use the scoped domain helper.

PDF checks only recognizable header/end markers. CSV checks nonempty UTF-8 text
without binary control bytes; it does not prove a valid statement schema.
Neither check is a malware scan, document extraction, credit/rights verification
or signature validation. Original CSV formulas/content are preserved; later
rendering/export must treat them as untrusted data.

No endpoint, MCP tool, upload, parsing, signed download or customer intake is introduced.
Separate unused server adapters now register and read scoped source/version receipts;
see [the registration boundary](./ORIGINAL-REGISTRATION.md).
The Blob download completes before its size is checked; this is not a streaming
network/memory cap. Future acquisition must enforce bounded immutable storage and
handle orphans; current-access original retrieval remains required. This helper
never accepts caller digests as verification or creates accepted analysis.

The verifier accepts canonical `.original`, `.pdf` and `.csv` keys. Only neutral
`.original` paths select type from the bytes. Legacy paths retain their suffix-selected
PDF or UTF-8 plausibility policy. This helper accepts no declared type, performs no
preparation, and does not validate contract/schema semantics, malware or rights.
Neutral registration requires Database94's forward-only compatibility migration.
Do not automatically migrate or reupload historical objects. Intake is not activated.

The server-only retained reader accepts a trusted optional maximum byte size. It
rejects oversized receipt metadata before storage download and checks Blob size
afterward. It uses the installed SDK stream and existing bounded reader before Blob creation.
Upstream allocation, response-header wait and concurrency remain unbounded here.
All 95 local original fixture cases pass; this branch exposes no HTTP route or signed capability.
