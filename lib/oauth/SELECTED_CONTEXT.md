# Selected Context connections

An account can explicitly restrict a new `mcp:tools` connection to Context tools in one workspace. Existing full, limited, and agent-registration grants keep their existing contracts. There is no backfill, default switch, or in-place change to a connection's workspace or capabilities.

The first-party consent API supports an opt-in `consent_version=2` preview. Without a workspace choice it returns authorized workspace names/IDs and no approval ticket. Add `workspace_kind=personal`, or `workspace_kind=organization&organization_id=<uuid>`, to obtain a fresh selected preview and one-use ticket. POST the same version/choice with `decision` and `csrf`. Identity, client, resource and requested scopes are reconstructed by the server. Approval rechecks current Context access. A limited-scope interaction cannot opt in.

The encrypted `RecoupGrant.extra.selectedContext` contains schema version 1, capability version `context-workspace-v1`, mode, workspace kind, owner ID and organization ID (null for personal). The original account remains the actor. The legacy `context: personal` field still classifies that actor; it is not the selected workspace. Missing selection is legacy. Present malformed or unsupported selection fails closed. Refresh preserves the same grant attribution and expiry; changing workspace or capabilities needs fresh approval.

`selectedContextActions.ts` freezes the 27 approved actions. Do not derive consent from the evolving operation catalog or add actions to that version. The selected MCP handler registers only those Context operations, retaining existing delegated exclusions and annotations. Other tools and the Explore extension are absent. Execution independently rejects a connection routed through the wrong registry. The wrapper binds omitted organization input to the selected workspace and rejects a different explicit workspace, even when the actor belongs to both.

The Context handler receives an internal authorizer which revalidates the token, grant, actor, client and immutable selection at domain entry and existing domain recheck boundaries. It then calls the existing Context owner authority. Connection management exposes only sanitized selection metadata alongside its existing owner-only revocation operation.

## Remaining boundaries

Current Context authority checks membership/self-organization, not graded roles. A role downgrade that leaves membership in place is not enforced by this slice (Mono208/212 remain open). Broad business-tool/resource authorization remains outside it. Checks are point-in-time, not transactional locks. Already accepted jobs keep existing worker authorization semantics; disconnect does not introduce job cancellation or undo completed writes. This source change does not activate a provider, alter production configuration or apply a database migration.
