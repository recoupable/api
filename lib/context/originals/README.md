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

The disabled POST pilot connects private storage and registration. No MCP tool,
parsing, signed download or customer intake has been activated. Server adapters
register and read scoped source/version receipts;
see [the registration boundary](./ORIGINAL-REGISTRATION.md).
The Blob download completes before its size is checked; this is not a streaming
network/memory cap. Future acquisition must enforce bounded immutable storage and
handle orphans; current-access original retrieval remains required. This helper
never accepts caller digests as verification or creates accepted analysis.

New original object addresses use `.original`, independent of PDF/CSV type, while
legacy `.pdf` and `.csv` verification remains supported. Neutral-path bytes select
the bounded PDF/UTF-8 plausibility check; preparation rejects a declared type that
differs from the detected type. This is not statement parsing, malware validation
or proof of storage immutability. New neutral registrations require Database94's
forward-only `20261009230000` migration before dependent release. Do not migrate
or reupload historical objects automatically. No customer intake is activated.
