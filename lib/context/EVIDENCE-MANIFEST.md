# Retained evidence discovery

`GET /api/context/evidence?request_id=<uuid>` reads retained source-version
metadata for an authorized saved request. Optional query parameters are
`organization_id` and `after_id`. Unknown or repeated fields are rejected;
responses use `Cache-Control: private, no-store`. The existing Context command
surface also accepts `POST /api/context` with `action: "list_evidence_versions"`
and the same fields. Standard MCP exposes the same operation as
`list_context_evidence_versions` with a concrete schema and no `action` parameter.
Pass returned `next_id` as `after_id` while `has_more` is true (up to 50 versions
per page). Each page rechecks access and withdrawal; pages are not a frozen export.

The typed response distinguishes customer assertions from observations and
current document inputs from retained history. It exposes no source contents,
storage paths, signed URLs or rights decisions. It invokes no collection, paid
provider or roster operation. Both the dedicated tool and delegated expansion of
the combined action are excluded from OAuth pending the organization-grant audit.
Requires Database PR92's `list_context_request_evidence_versions`. This feature
has not been released. It performs no original-file registration, parsing or
assessment.
