# Private original verification prerequisite

`verifyContextOriginal` is used by preparation and registration server flows;
this branch connects a disabled HTTP pilot; no intake environment was enabled. It authorizes the actor's
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
