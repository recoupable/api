# Application registration preflight

Proposed contract for app issue #2104, under Sites epic #2093. This is a
registration **preflight**, not an application registry or an activation API.
After authentication resolves the account, the preflight itself creates no
resource, identity, credential, consent, session, quota, or charge. The existing
Privy authentication path can provision a Recoup account and send a welcome email
before preflight runs; that authentication behavior is unchanged.
No database migration is needed for this slice.

`POST /api/applications/registration/validate` and MCP
`validate_application_registration` call `validateApplicationRegistration`.
HTTP uses existing API-key or account Bearer authentication. Standard MCP derives
the account from validated auth metadata. Delegated OAuth MCP deliberately excludes
this new tool pending the application/OAuth contract review. There is no account-ID override.

Example input:

```json
{
  "name": "Release companion",
  "environment": "production",
  "allowed_origins": ["https://music.example"],
  "return_urls": ["https://music.example/listen?connected=spotify"]
}
```

Optional `organization_id` selects a workspace only after existing organization
access checks. Omitting it selects the authenticated account. Proposed workspace
and billing owner are the same account/organization across environments. This
validates attribution only; it does not prove a subscription, authorize a purchase,
or reset/allocate capacity. Callers cannot supply a billing owner or secrets.

The flat response has `status: "validated"`, `persisted: false`,
`origins_verified: false`, `workspace_id`, `billing_owner_id`, and the four
validated input fields. It contains no application ID or token. HTTP responses
are private/no-store. Errors are 400 invalid proposal, 401 unauthenticated,
403 unavailable workspace, or 503 validation infrastructure unavailable.
Infrastructure details are not returned.

Origins must equal the URL parser's canonical origin: no wildcard, path, trailing
slash, credentials, query, or fragment. HTTPS is required except explicit HTTP
localhost, 127.0.0.1 or [::1] in development. Those loopback hosts are rejected in
production. The environment is explicit; one preflight contains one environment.
Return URLs must be canonical exact URLs on one of the proposed origins, without
credentials or fragments. Query strings are retained, not interpreted as patterns.
Each address list has 1–32 distinct entries of at most 2048 characters; these are
input-validation limits, not a commercial allowance. The name is 1–120 characters.
No DNS lookup, URL fetch, provider callback edit, or ownership verification occurs.

## Contract handoff and remaining decisions

- Applications are configuration resources, not OAuth agent clients or fan
  identities. Keep existing OAuth clients and future shared Fans identity separate.
- Before durable registration/activation, settle the origin-ownership proof and
  re-verification policy. Merely passing preflight never proves ownership. The
  issue requires verified origins but does not select a proof mechanism.
- Registry persistence, create/read/update/revoke, provider configuration reference
  authorization, short-lived fan sessions, and bootstrap remain subsequent work.
  Propose storage migrations in the owning database repository, never apply them
  under this preflight task.
- Quotas, origin verification, provider capabilities, and commercial policies
  must not be inferred from a successful validation response.
- The shared-file delta adds standard MCP registration and explicitly excludes the
  new tool from delegated OAuth discovery. No OAuth issuer/client, identity, consent,
  provider operation or delegated permission changes. OAuth owner review must
  approve a separate policy/preparation contract before delegated exposure.
- This source contract is for review. Marketing-owned public documentation and
  generated indexes must accompany the accepted API contract before release;
  do not claim a deployed endpoint from this proposal.

## Verification

Domain tests cover unrelated workspaces, explicit environment separation, spoofed
origins, credentials, destination origin mismatch, and caller-injected ownership.
The real in-memory MCP SDK verifies HTTP/MCP response parity and discovery without
external requests. Full delegated-catalog and existing organization authorization
tests check integration. None of these establishes hosted registration or browser
fan-sign-in acceptance.
