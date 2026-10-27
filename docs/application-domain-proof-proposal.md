# Application domain proof and re-verification proposal

Status: **proposed for coordinator adoption**, October 27, 2026. Related work:
[application registration #2104](https://github.com/recoupable/app/issues/2104).
This is an API/Database contract proposal plus an offline executable specification,
not registration, a deployed resolver, a migration, or an approved customer promise.
No routes, tools, grants, credentials, provider operations or live probes are added.

## Current source and authority gap

At API base `08f62b74`, `lib/applications/validateApplicationRegistration.ts`
validates canonical exact origins and return URLs, resolves the authenticated
account or an accessible organization, and returns `persisted: false` and
`origins_verified: false`. HTTP uses `validateAuthContext`; standard MCP uses
`resolveAccountId` and the same domain function. Delegated OAuth discovery remains
excluded. `applicationRegistrationSchema.ts` rejects injected ownership/secret
fields. `lib/organizations/validateOrganizationAccess.ts` checks organization
membership (or account equality), not an application-management or billing role.
The reported billing owner is attribution only. The validator is not a registry.

Future creation/verification/revocation requires an explicit application-management
authorization decision for the authenticated workspace on every operation, checked
again at commit. Existing membership is insufficient evidence of that new grant.
A building-agent scope must be narrower than its owner's authority and rechecked
for expiry/revocation; neither existing keys nor delegated OAuth acquire a new scope
through this proposal. Coordinator must adopt the role/scope mapping before routes.
Public app IDs and published challenges are not credentials. Fan sessions, provider
configuration access and billing-member authorization remain separate checks.

## Recommendation: exact-host DNS TXT first

Choose DNS TXT for the first implementation because it avoids fetching a
customer-controlled HTTP destination. HTTPS well-known proof could support tenants
without DNS access, but adds TLS, redirects, SSRF, proxy and path-ownership rules;
it is deferred rather than silently treated as equivalent.

For canonical `https://music.example`, query only
`_recoup-app.music.example` for a TXT record exactly equal to
`recoup-app-v1=<nonce>`. Generate a fresh 32-byte cryptographic random nonce encoded
as unpadded base64url (43 characters). Concatenate strings within one TXT record;
never concatenate separate records, trim, case-fold, or accept substrings.
Multiple unrelated records may coexist. The server stores the nonce SHA-256,
never accepts a client-supplied expected digest, and compares against that stored
challenge. The nonce is intentionally public; its unpredictability prevents
prepublication, not credential theft. Return it only at issuance; lost values
require rotation. Avoid logging raw TXT answers or credential headers.

Bind each challenge immutably to `(workspace_id, application_id, environment,
canonical_origin, origin_revision, challenge_id)`. Domain hostname is derived from
the canonical origin, never separately trusted from input. Production and
development, ports, sibling hosts, apps and workspaces require distinct challenges.
A record for the apex never verifies a subdomain, and vice versa. A reused value
cannot verify another binding: only its unique stored challenge digest matches.
DNS control does not prove control of the HTTPS service or content on a particular
port. It provides an explicitly limited domain-control assertion for that exact
configured origin, not proof of legal ownership or exclusive tenancy.

No wildcard, registrable-domain inheritance, shared-provider wildcard, or automatic
reuse of an earlier successful proof. Initially support public DNS hostnames only:
no IP literals, loopback, single-label/local names, or public suffixes. An adopted,
versioned hostname eligibility policy must identify public suffixes/private shared
hosting suffixes; do not invent a regex-based registrable-domain test. Provider-owned
base domains and path-only shared hosts are unsupported for tenant registration.
An exact tenant hostname is eligible only with tenant-controlled challenge DNS;
no proof against a provider base domain confers tenant-wide access. Shared-host
policy maintenance and exception review are prerequisites, not implemented here.
Development loopback origins accepted by preflight remain unverified and cannot
use this proof method or enable public bootstrap. A separate local-development
contract must define any exception before implementation.

Use a fixed trusted resolver, server-derived query name, bounded TXT count/bytes,
timeout and concurrency. Reject CNAME/DNAME delegation for the challenge name in
v1; no arbitrary resolver supplied by callers. Reject truncated/ambiguous responses,
DNSSEC-bogus responses when surfaced, and transport failures. The future adapter
must expose alias-chain and freshness evidence; a convenience resolver that hides
these facts is insufficient. DNS authenticity and caching remain explicit trust
limits; this proposal does not claim DNSSEC is universal. No live resolver exists
in this change. Resolver selection and adapter qualification block activation.

## Proposed lifecycle and technical intervals

These are reviewable engineering defaults, not commercial or provider commitments:

| Parameter | Proposed choice | Consequence |
| --- | --- | --- |
| Challenge lifetime | 1 hour from server issuance | Reject at `now >= expires_at`; retry needs a fresh nonce |
| Observation freshness | At most 60 seconds at commit; queried after issuance | Old answers cannot extend a new challenge |
| Verification lease | 7 days from successful commit | Authorization checks reject at `now >= verified_until` |
| Renewal scheduling | Recommend starting 24 hours before lease expiry; early renewal allowed | Advisory scheduling, not an eligibility boundary; owner publishes a new nonce and retained old TXT never auto-renews |
| Renewal failure | Keep only the unexpired old lease | No extension for timeout, missing record, or invalid answer |
| Security revocation | Immediate committed invalidation | Overrides a valid lease and any in-flight challenge |

The cost of DNS TXT v1 is manual fresh publication at each renewal. A seven-day
lease may be too burdensome; coordinator must explicitly accept it or change the
contract before release. No automatic publication, permanent nonce refresh or
silent grace period. A successful proof is point-in-time control; domain transfer
may remain undetected until lease expiry (up to seven days), unless explicit
revocation or separately approved monitoring detects it sooner.

State: unverified → pending → verified (with hard expiry). Issuing a replacement
challenge invalidates the preceding pending challenge but retains an existing
unexpired lease. Successful verification atomically consumes the challenge and
replaces the lease. Exact retries cannot extend the lease: a consumed challenge
returns the original receipt only under its original authorized idempotency key,
otherwise a conflict. A stale revision, changed binding or concurrent revoke wins
against an in-flight observation at commit. A failed observation cannot update the
lease. Revocation is terminal for that origin revision; restoration requires a
new revision and fresh proof, never resurrection of an old record.

Changing workspace, application, environment or origin creates a new binding;
no in-place transfer of verification. Return URLs must still match exact registered
origins; changing them increments configuration revision and invalidates bootstrap
artifacts as required by the future session contract, not the DNS hostname proof.
Rotating an owner credential does not prove or renew a domain. Revoking management
authority blocks subsequent management commits; application suspension/origin
revocation invalidates bootstrap and access independently of billing exhaustion.
Consumers must check current status, revision and lease on every new authorization;
any token/cache revocation propagation contract must be adopted before issuance.
This does not alter essential identity access or spending rules in the epic.

## Proposed persistence boundary (Database-owned; no migration here)

Use existing account/workspace ownership, not a new Fans, points or Context store.
Proposed application configuration rows reference their authenticated workspace and
existing billing owner. A verified origin must never allocate/reset allowances.

- Application environment/origin row: composite owner/application/environment
  reference, canonical exact origin, configuration revision, security status,
  verified-at/until and active verification receipt reference.
- Challenge row: immutable binding and origin revision, random challenge ID, unique
  digest, issued/expires timestamps, issuing actor/grant reference, pending/consumed/
  superseded/revoked state. Unique active challenge per binding; digest uniqueness
  prevents cross-binding nonce reuse. No plaintext nonce required after issuance.
- Receipt: immutable challenge/binding, resolver policy version, query name,
  observation time/outcome, matched digest, commit time, resulting revision/lease.
  Sanitized failure code and correlation ID; no entire TXT response or provider data.
- Idempotency: workspace/operation/key plus request fingerprint and original result;
  different payload on same key conflicts. Authorized retry returns existing receipt
  without renewing time. Retention must preserve replay tombstones and audit needs;
  exact retention duration is a separate adoption decision.

Acquire DNS evidence outside the transaction. At commit, lock the authorization,
application/environment/origin and challenge rows in a documented consistent order;
recheck current grants, suspension, revision, expiry, observation age and matching
binding; consume challenge and append receipt/update lease atomically. Concurrent
revoke/rotation must serialize. Browser/public roles have no challenge/receipt
writes. API supplies authenticated actor, never trusts a body account ID; persistence
rechecks workspace authority rather than trusting an API boolean. Service-only
operations and their grants require Database review. No SQL or migration is shipped.

HTTP and MCP should call the same future issue/verify/read/revoke domain operations.
Errors proposed: 400 invalid input/unsupported hostname; 401 unauthenticated;
403 unavailable authority/resource (avoid tenant enumeration); 409 stale revision,
consumed/superseded challenge or idempotency conflict; 410 expired challenge;
422 fresh nonmatching proof; 503 unavailable resolver. Read status may expose only
sanitized evidence to authorized management clients. Do not return different
cross-tenant errors that reveal existence. New API docs belong in the Docs repository
when the contract is adopted; older preflight text naming Marketing is historical.

## Offline qualification and next gate

`pnpm exec vitest run scripts/application-proof/__tests__/contract.test.ts`
executes a small state model under `scripts/`, outside production domain exports.
It uses synthetic bindings, tokens, clock and TXT observations; no network, database,
credentials, application resources or provider configuration. It covers binding,
authority rejection, split TXT records, exact matching, replay, expiry, observation
freshness, rotation, revocation and renewal. `authorized: true` represents a trusted
fixture decision, not an implemented permission check. State is prevalidated: the
model does not implement hostname eligibility, cryptographic issuance, resolver
validation, transactions, transport parity, idempotency storage or session enforcement.
It is an executable specification, not production implementation acceptance.

Adoption decisions: DNS-first support boundary; role/delegated-scope mapping;
lease/renewal burden and stale-control exposure; resolver/eligibility policy;
retention and consumer revocation enforcement. After adoption, implement and review
Database persistence in its own PR, then shared API/MCP operations and adapters,
then scoped hosted proof/renewal acceptance with human authorization. Keep #2110
provider/two-host/mobile/shared-callback tests and #2345's browser hold separate.
No whole-ticket completion or deployed registration claim follows from this proposal.
