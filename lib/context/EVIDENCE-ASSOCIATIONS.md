# Retained evidence associations (requires Database #90 and this API release)

`attach_evidence` accepts an existing `source_version_id`, a stable `idempotency_key`,
optional `organization_id`, and 1–100 distinct typed targets: `{ artist_id }`,
`{ professional_id }`, or `{ request_id, subject_id }`. The actor comes from
authentication. These are relevance associations, never identity, credit, rights
or mandate confirmations. No source content, new accounts, provider calls or
charges are created. Submitted writer/company candidates remain unresolved.

`read_evidence_attachment` takes `attachment_id`. `list_evidence_attachments`
takes the exact `source_version_id` and optional/null `after_id`; use `next_id`
while `has_more` is true, including empty pages where protected receipts are
withheld. Both recheck current source retention and independent target access.
Exact input/key replay returns the original receipt; changed payload/version
conflicts. A later source version requires a separate association. Historical
receipts remain stored when roster access or evidence is withdrawn. An owned
request with retained accepted lineage is a separate historical access path;
the attachment itself cannot bootstrap access.

HTTP uses these actions through `POST /api/context`. Standard MCP clients can
discover `attach_music_evidence`, `read_music_evidence_attachment` and
`list_music_evidence_attachments` with individual object schemas. The combined
`context` handler also accepts them. Evidence operations remain excluded from
delegated OAuth tools pending organization-grant review, including read/list
because their receipts can contain professional records. Responses are validated
against the requested owner/version/receipt/target set before being returned.

This does not implement original-file registration, source-version discovery,
validated document locators, parsing, review or saved company assessment. Tests
use synthetic database/transport fixtures; they do not prove deployment or a
customer import. Release Database #90 first and verify it before dependent API
deployment and authorized live readback.

