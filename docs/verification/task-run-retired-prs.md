# Task-run query follow-through from retired test PRs

Existing owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
This is a two-PR disposition, not completion of the 119-PR inventory. Neither old
branch is retargeted, merged or closed by this change.

Inspected current-main baseline:
`8586fb7598981f4ec853ce6fea347a559f3c15a0`.

| Original PR and exact head | Original intent | Current-main disposition |
| --- | --- | --- |
| [API #523](https://github.com/recoupable/api/pull/523), `efd2ab7fe78c02c650f0e9085e3dce104231e36b` | Resolve account overrides before retrieving a run, hide inaccessible runs, retain list/retrieve response shapes. | The intent is present through [API #1037](https://github.com/recoupable/api/pull/1037), actual `e926ffee47b207a8775d44fd639fd9c53c9116c8`. `validateGetTaskRunQuery` resolves the authorized account in both modes. `getTaskRunHandler` delegates to `readTaskRunForAccount` / `canReadTaskRun` and hides inaccessible runs with 404. Route comments describe both modes and limits. Preserve this shared reader rather than restoring #523's inline tag-only check. |
| [API #488](https://github.com/recoupable/api/pull/488), `774dd5f8a7f50abeb8b50e52964759dc806bcfa7` | Clarify optional query parameters and require a trimmed UUID for explicit `account_id`. | Route/list/retrieve documentation is already present. The format validation was still absent at the inspected baseline. This successor ports only that validation and its regression coverage, preserving the newer ownership path. |

## Resulting request behavior

An authenticated request with a malformed, explicitly supplied `account_id`
returns 400 with `status: "error"` and `error: "account_id must be a valid UUID"`
before admin/account-access or task-provider lookups. Whitespace around a valid
UUID is trimmed. Valid UUIDs still require the existing authorization checks;
UUID syntax never grants access. Omitting the override retains the authenticated
account. The existing empty-query-value handling is unchanged. List defaults,
limits, task run IDs, successful response shapes, foreign-run 404 behavior and
standard/delegated MCP ownership checks are unchanged.

The maintained OpenAPI reference already declares `account_id` as `format: uuid`
at Marketing `fbfef975ebc8be09db5a3abb9a1dfef67252bb9b`,
`content/docs/source/api-reference/openapi/releases.json`,
`GET /api/tasks/runs`. This validation aligns with that declaration; it does not
establish that every sentence of the existing reference has been reconciled.

## Verification and remaining authority

New tests fail at the baseline for malformed overrides, then pass with the
validator correction. They exercise the actual GET export with synthetic API-key
and Bearer authentication leaves, list/retrieve inputs, and mocked access/provider
boundaries; malformed requests make no task-provider request. Existing tests keep
valid admin, self and organization overrides, denied overrides and inaccessible
run behavior covered. This is source/fixture evidence, not a real account or
provider test. No credential, database, access, billing or deployment action is
part of this change.

The coordinator retains source merge and any old-PR closure decisions. Existing
#328/#361 named-client and customer acceptance remains separate. This repair does
not close #358, infer that the other historical PRs are superseded, or change
Stop/disconnect/reconnect behavior under #1070.
