# Development-only entitlement transports (CATD-29)

This extends the internal-only proposal in `README.md` with a distinct **development
transport**, not a customer production operation. The reviewed method, input/result
schemas and calculator remain unchanged. Existing Context save/read/list and stream
operations retain their semantics.

## Invocation

- HTTP: `POST /api/context/development/entitlements`.
- Standard MCP: `dev_calculate_catalog_entitlements`.
- Both use `dispatchDevelopmentEntitlement` and the existing
  `developmentEntitlementSchema` (`kind`, `method_version`, `case_id`,
  `expected_revision`, `assessment_id`, optional `organization_id`).
- Both require `NODE_ENV=development` **and** `CATALOG_ENTITLEMENT_DEV=true`.
  This change does not set either variable or activate an environment.

HTTP returns 404 when disabled, before consuming/parsing the request body or doing
authentication or storage work. The standard
MCP tool is absent from registration/discovery unless both gates hold; a captured
handler also rechecks the gates on invocation. Production always refuses, including
when the flag is true. The name is explicitly excluded by the existing delegated
OAuth registrar, and the handler independently rejects delegated OAuth before
resolving an account. No scope or delegated permission is added.

HTTP resolves the actor with `validateAuthContext` (API key or existing bearer
credential), without a body actor override. MCP uses `resolveAccountId`, also without
an override. The existing calculation adapter owns workspace authorization for both
transports; HTTP does not introduce a competing workspace-denial path. The adapter
rechecks authority, current case/revision/source evidence and final owner access.
Authentication failures and exceptions yield sanitized errors; storage/source errors
cannot expose private exception text. There is no calculator-specific database code.

## Results and errors

Successful HTTP JSON and MCP JSON content are identical: the existing computed
result and provenance, `persisted: false`, `external_actions: unsupported`. No result
is saved or represented as verified rights, recognized debt or bank cash.

Shared dispatcher failures return `{status: "error", code, error}`. HTTP uses the corresponding
status; MCP returns that same JSON body with `isError: true`:

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 404 | unavailable | Development gate disabled |
| 400 | invalid_arguments | Invalid/missing strict calculation input |
| 401 | authentication_required | Missing/invalid authentication or authentication dependency failure |
| 403 | delegated_oauth_unavailable | Delegated MCP invocation is unsupported |
| 409 | calculation_unavailable | Workspace access, current revision/source evidence or calculation unavailable |

The MCP SDK additionally validates the declared input schema before calling the
handler; its ordinary invalid-arguments error can therefore precede the dispatcher.
Both paths reject extra actor fields. Every HTTP handler response, including invalid
JSON, disabled, auth and domain errors, carries `Cache-Control: private, no-store`.
The handler logs no input, source locator or raw exception. Partial/manual-workpaper
calculation results are successful calculations with their existing explicit blockers,
not transport failures.

## Acceptance and limits

Focused synthetic tests compare a populated entitlement result across HTTP and an
in-memory standard MCP client/server, validate schema/discovery, auth/workspace
rejection, revoked source states, redacted failures and disabled production behavior.
The accepted calculation oracle and source review are reused unchanged; this work does
not rebuild financial arithmetic. No live database, customer/provider invocation,
production activation, migration, payment or public capability advertising occurs.
A future production transport requires a separate decision/review; these development
routes do not complete authenticated deployed or private-case acceptance for #2306.
