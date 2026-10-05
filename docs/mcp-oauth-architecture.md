# MCP OAuth architecture and compatibility spike

Status: implementation decision proposed by [Mono #208](https://github.com/recoupable/mono/issues/208), under [epic #207](https://github.com/recoupable/mono/issues/207). Read and write access are both required at launch. This document does not declare OAuth ready for production.

## Decision

Use `oidc-provider` as the candidate authorization server, retaining Privy for Recoup authentication. Pin `oidc-provider@9.12.2` and `@types/oidc-provider@9.12.1` in the **development-only** compatibility lab until the durable adapter and deployment integration pass their gates. No application route imports this lab. Never deploy its synthetic login, auto-consent, ephemeral keys, or in-memory storage.

The executable spike exercises discovery, DCR, PKCE, issuer identification, registered callbacks, code exchange, scopes, refresh rotation/replay, and revocation over real loopback HTTP. A generic MCP SDK client reads and updates a synthetic record and reads it back through Streamable HTTP. CIMD resolution uses an explicitly supplied synthetic HTTPS-document response; this proves provider parsing/exchange, **not** real HTTPS retrieval or SSRF protection. These are protocol tests, not Claude/Codex/ChatGPT/Cursor or Privy integration tests.

### Alternatives considered

| Approach | Fit and cost |
| --- | --- |
| oidc-provider | Identity-agnostic interaction API can accept verified Privy identity without moving account login. Implements the needed grants, DCR, resource indicators, revocation, and experimental CIMD. Requires Node 22 LTS or later, a durable adapter, interaction UI, and Node HTTP integration. Selected for the spike. |
| Better Auth OAuth provider | Offers OAuth/MCP integration, but introduces another authentication/session layer and a Privy-to-Better-Auth bridge. No compatibility spike performed; do not claim equivalent behavior. Revisit if the selected provider fails the deployment/adapter gates. |
| Managed authorization service | Could reduce protocol operations, but tenant configuration, external identity federation, client-registration flexibility, pricing, and required account access remain unverified. No new service or purchase is assumed. |
| Handwritten authorization server | Rejected: implementing grants, PKCE, token rotation and protocol edge cases ourselves adds unnecessary security maintenance. Keep custom code at identity, persistence, consent and authorization boundaries. |

CIMD is explicitly experimental (`draft-02`) in this pinned provider. Upgrades require the compatibility suite and review of the acknowledged draft, fetch protections and token behavior. The provider package is MIT-licensed. Library capability is not production readiness.

## Runtime and hosting contract

- Keep resource identifier `https://api.recoupable.dev/mcp`.
- Proposed issuer: `https://api.recoupable.dev/api/oauth`. Publish its discovery using the path-aware well-known location and/or OIDC discovery; advertise the exact identifier in MCP resource metadata.
- Publish root `/.well-known/oauth-protected-resource` and a path-aware MCP metadata route or equivalent challenge. Avoid accidental payment middleware on discovery, registration, or OAuth routes.
- `oidc-provider.callback()` consumes Node `IncomingMessage`/`ServerResponse`. The current API uses Next App Router Web Request/Response handlers; they are not interchangeable. Implement and test a Node Pages API boundary with `bodyParser: false` or use a dedicated Node service if deployment testing fails. Do not invent an untested stream shim.
- Next's installed Pages API documentation confirms Node request/response support. The spike uses Node HTTP directly; a real Next/Vercel preview integration remains an explicit #209 gate.
- Existing CI uses Node 20. The spike has its own Node 22 job; do not infer that the deployed Vercel runtime has been upgraded. Verify production runtime before moving the dependency into runtime dependencies.
- Keep signing keys, cookies, clients, grants and storage namespaces separate between production and preview. Do not derive the canonical issuer from arbitrary Host headers. Stable keys must come from managed secrets and support rotation.
- Keep the resource server stateless at the transport layer where possible. Verify authentication/grant state on every call, including calls on a previously initialized connection.

## Identity and persistence contract

Current Privy resolution verifies a token, finds an email-linked account, and can provision an account. OAuth must use a dedicated **existing-account** resolver with a durable mapping from verified Privy subject to Recoup account ID.

1. Verify Privy tokens server-side, obtain the immutable Privy subject, and look up its established mapping.
2. On first link, require an unambiguous existing account associated with the provider-verified email; reject ambiguous/missing associations instead of creating or merging accounts. Reconfirm provider email verification semantics before implementing the migration.
3. Enforce unique provider-subject mapping. Subsequent email changes never silently remap the subject to another Recoup account. Linking conflicts need explicit recovery.
4. Store client registrations, interactions, authorization codes, grants, access/refresh artifacts and connection summaries in durable server-only storage. Keep database calls inside `lib/supabase/<table>/` and migrations in the database repository.
5. Design atomic single-use consumption and refresh rotation for multiple instances. The provider adapter's `find` followed by `consume` cannot be assumed atomic; a compare-and-set operation must reject a second consumer. Test concurrent exchanges, rollback and consumed-marker persistence.
6. Encrypt sensitive provider payloads at rest with versioned managed keys. Hash token/index identifiers where the adapter contract permits it. Never use broad client-side/RLS access for authorization artifacts.
7. Keep a grant/account/org/client binding that remains authoritative after client registration or account membership changes. Fail closed when storage is unavailable.

## Grant, refresh and revocation policy

Initial implementation defaults, to be encoded and tested in #209/#213:

- Access tokens: opaque, 5 minutes; authorization codes: 60 seconds; login/consent interaction: 5 minutes.
- Persistent connection grant: 30-day maximum, with rotating refresh tokens that never extend beyond that grant's absolute expiry. Expiry requires re-consent.
- Consent must explicitly explain persistent agent access. Do not depend on an MCP client sending OIDC `prompt=consent`: the provider strips `offline_access` without that parameter by default. Issue refresh tokens only when the stored Recoup consent permits persistent access and the client supports the refresh grant.
- Ordinary Recoup browser sign-out does not disconnect already approved apps. Use Connected Apps to revoke. Do not leave the provider's session-bound token default active for these persistent grants.
- A disconnected grant is rejected on the next authorization check; do not use a positive authorization cache in the first release. DB failure rejects access. Removing a role/membership has the same effect for disallowed resources.
- Already accepted in-flight work may finish; revocation prevents new starts and future scheduled executions attributable to the grant. Record grant attribution on scheduled/background work so that this is enforceable. Cancellation of existing work must follow the domain's safe cancellation path.
- Issuer responses include exact RFC 9207 `iss`, including error redirects to validated destinations. Never redirect an error to an unvalidated URI.

## Permission model and launch writes

`mcp:tools` currently grants broad access after bearer verification. Delegated OAuth needs explicit scopes **and** current resource authorization. Neither a tool annotation, the tool list, nor the model's system prompt is an access-control boundary.

| Scope | Meaning |
| --- | --- |
| `mcp:read` | Read data already accessible to the approved account/context. |
| `mcp:write` | Create or update authorized records. |
| `mcp:delete` | Additional permission for destructive deletion. |
| `mcp:send` | Additional permission for outbound email/support communication. |
| `mcp:publish` | Additional permission for public publishing/unpublishing. |
| `mcp:spend` | Additional permission to consume Recoup credits or invoke billable providers, within existing entitlements and configured limits. |

These are cumulative: sending requires write+send; paid generation requires write+spend; deletion requires write+delete. A paid read/analysis may require read+spend. Scope assignment does not claim the current billing path is sufficient—verify it per tool.

Store one selected personal or organization context per grant. Personal-only operations (currently task mutation handlers) must reject incompatible organization grants until their domain contract supports them. Organization grants constrain the selected organization; they must not inherit the existing universal Recoup-org admin shortcut or arbitrary access to another shared organization. Validate the actual role/permission model; do not assume membership alone implies write access.

The [tool inventory](../scripts/mcp-oauth/tool-policy.json) covers 51 registered tool names at the inspected main commit, including 10 dynamically registered site operations. Its drift test requires new registrations to be classified. Every entry records required authorization work; **none is marked production-approved for OAuth**.

The `context` tool multiplexes operations. Apply policy after parsing its discriminated action:

- Read/plan/list/brief operations require read scope and request/subject/brief ownership.
- `save_brief` requires write scope and idempotency, in the same authorized workspace.
- Ingest, verify and expansion operations require write+spend wherever they dispatch paid work; preserve all existing job and credit guards.
- Unknown/new actions deny by default until reviewed. Inspect planning methods for side effects rather than inferring policy from their names.

### Source findings that determine the work order

- `app/mcp/route.ts` authenticates requests before tools are exposed; `verifyApiKey.ts` accepts Privy or API keys and assigns `mcp:tools`. No delegated OAuth issuer/grant contract exists yet.
- `get_api_key` returns the inbound bearer credential. Hide and reject it for OAuth; migrate raw-HTTP skills to server-side authorized operations instead of exporting tokens into model context.
- `get_tasks` calls `selectScheduledActions(args)` with an optional caller-supplied account filter. The REST validation path is more restrictive. Bind MCP reads to authenticated identity/context before OAuth exposure.
- Catalog adapters accept account/catalog identifiers without taking MCP auth context. Check catalog ownership in the shared domain layer for both reads and inserts.
- Artist profile/social and knowledge-base adapters need equivalent resource ownership checks; knowing an artist ID is not authority.
- `send_email` and `contact_team` need explicit outbound policy, attribution, rate limits and idempotency before delegated use. Test recipients must be controlled.
- Task mutations already resolve an authenticated account and enforce personal ownership. Preserve that behavior; do not broaden it because an OAuth grant includes write.
- Sites and Context route through shared authenticated domain functions, but OAuth must constrain their organization inputs to the selected grant context and apply per-operation scopes.
- Provider job IDs (for example video retrieval) need a durable account ownership bridge, not possession-only access.
- Existing `canAccessAccount` permits universal Recoup-org access and shared-org access. An OAuth grant must impose its narrower context first.

## Callback and client contract

Use validated registrations/CIMD/pre-registration; no global wildcard callback list. Record actual redirect URIs during named-client tests.

| Client | Starting callback fixture |
| --- | --- |
| Claude web and Desktop remote connectors | `https://claude.ai/api/mcp/auth_callback` |
| ChatGPT stable mode | `https://chatgpt.com/connector_platform_oauth_redirect` |
| ChatGPT connection-specific mode | `https://chatgpt.com/connector/oauth/{actual_callback_id}` |
| Codex native | Exact registered loopback host, path and dynamic port; include a callback-ID path where used. |
| Cursor desktop | `http://localhost:8787/callback` |
| Cursor web/agents | `https://www.cursor.com/agents/mcp/oauth/callback` |

DCR accepts multiple valid redirect URIs. Native port exceptions follow the provider's OAuth rules; paths and loopback host identities remain bound. Public clients use PKCE without an embedded secret. CIMD must validate document identity, URI syntax, redirect registrations, auth methods, fetch timeout/size limits and actual network SSRF protections. Unknown client names are unverified labels. Pre-registration remains available for clients unable to use discovery registration.

## Verification and remaining gates

Run on Node 22 LTS:

```sh
pnpm typecheck:mcp-oauth
pnpm test:mcp-oauth
```

The lab intentionally has no access to Privy, Supabase, real Recoup records, email, or paid services. It issues only ephemeral synthetic credentials on IPv4 loopback. No live vendor callback is fetched; the test inspects the authorization redirect and performs its own token exchange.

Before this design becomes a runtime integration:

1. #209: prove durable multi-instance consumption/refresh, real Next/Vercel Node mounting, stable key configuration, existing-account Privy mapping and a real login handoff.
2. #210: test real HTTPS CIMD fetch behavior, bounded registration abuse protection, browser endpoint CORS, issuer and callback rules in the deployed environment.
3. #211/#213: real signed-out/already-signed-in/wrong-account/denied consent and Connected Apps ownership/revocation journeys, including CSRF and cookie behavior in a browser.
4. #212/#214: implement and review every tool's authorization work, role constraints, billing checks, token non-disclosure, write idempotency, and failure/redaction paths.
5. #215/#216: all named clients must perform a real authorized read and write with independent read-back, denied writes, refresh and disconnect in production. Version/date/callback and deployment identity are part of the evidence. Marketplace listing remains separately scoped.

Do not close the epic from these local tests. Synthetic login is not Privy verification; fixture writes are not customer-resource isolation proof; protocol fixtures are not vendor-client compatibility proof.

## Sources

- [oidc-provider documentation](https://github.com/panva/node-oidc-provider/blob/main/docs/README.md); installed 9.12.2 configuration/types are the implementation source for this spike.
- [Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider), evaluated at documentation level only.
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
- [OpenAI auth and callback contract](https://developers.openai.com/plugins/build/auth).
- [Codex MCP](https://developers.openai.com/codex/mcp).
- [Claude connector development](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers) and [cloud-brokered remote connector model](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- [Cursor MCP callbacks](https://prod.cursor.com/docs/mcp).

Inspected October 5, 2026 against API main `4797fc39`. Refresh the inventory and provider/client requirements before release.
