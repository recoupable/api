# Unwired existing-account MCP identity

`lib/mcp/applications/verifyExistingApplicationMcpActor.ts` is an internal,
opt-in verifier for a future App2104 standard-MCP handoff. It has no route,
registered tool, storage adapter or production caller. Its original source
baseline is `38ee9828635881526ac9f8b304626739ef1813f8`.

The caller must own the original `NextRequest`. The helper rejects missing or
malformed Bearer headers and any `x-api-key` header, including an empty one.
It does not accept a separate token, body identity, `authInfo` or verifier callback.
It runs the actual `verifyOAuthBearer` classifier first. Valid delegated grants
are unsupported regardless of full/limited scope. Classification failure returns
a bounded unavailable response without legacy fallback. When OAuth is disabled,
that classifier does not import its runtime; an undefined classification still
requires successful independent standard authentication.

The helper invokes `validateAuthContext` with fixed `allowAccountCreation:false`
and `includeVerificationEvidence:true`, without account or organization overrides.
The actual `validateProposedRegistrationActor` guard requires original actor,
effective account and account ID equality; self access; null organization; strict
API-key/Privy identity evidence; and unresolved execution-resource authority.
Known shared-auth failure responses are preserved. Unexpected provider or guard
failures become a generic 503 without raw exception details in responses or logs.
Helper-owned failures use the shared error envelope and CORS headers; existing
authentication responses retain their existing envelopes.

Success contains only `{actor, workspace, verificationEvidence}`. Evidence is
copied per invocation and is private, point-in-time identity metadata. It must
never become a public tool result or a storage-port argument. Only actor/workspace
may cross a future reviewed storage boundary. No token, request, profile or email
is returned. Evidence equality does not establish entitlement, personal enrollment,
client approval, immutable subject mapping or atomic credential revocation.

## Default behavior and future handoff

Existing `app/mcp/route.ts` invokes `verifyBearerToken` before dispatch. That
legacy verifier can onboard a Privy account; this helper does not change it or
retroactively make that route nonprovisioning. A future invocation must select the
new path before legacy verification and preserve ownership of the original request.
Do not copy `extra.authInfo.token` into a fabricated request or promote its account
UUID into verifier evidence. Legacy `clientId` is not a verified client identity.

Full/limited OAuth execution wrappers retain their current grant rechecks and
allowlists. App2104 operations remain excluded. No delegated application policy is
introduced. `createProposedApplicationRegistration` and
`readProposedApplicationRegistration` still accept their own authenticated request; no caller-supplied evidence/actor bypass was added. Their future trusted
invocation seam needs a separate review. Reverify at the operation boundary if
execution is separated from initial verification; no cached observation is a grant.

Real existing-account Privy authentication still performs a profile GET and an
account-email lookup. Nonprovisioning is not network-free. SQL enrollment,
entitlement and transaction authority remain separate, and credentials may expire
or be revoked after verification. This helper does not solve that race.

## Controlled tests

The suite lives at
`lib/applications/proposedRegistration/__tests__/mcpExistingActor.test.ts`, under
the existing dedicated harness. Ordinary Vitest excludes that directory; the
OAuth config does not include it. Use only the controlled launcher:

```sh
node_path="$(command -v node)"
test "${node_path#/}" != "$node_path"
env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C TZ=UTC "$node_path" scripts/application-registration-proposal/run.mjs
```

The clean parent starts without `NODE_OPTIONS`, loaders, credentials or real HOME.
The existing runner checks source/golden bindings, constructs a synthetic child
environment with disposable HOME, preloads network denial, disables dotenv loading,
and bounds execution and owned-process cleanup. The runner/setup/config/network
preload/golden remain unchanged. Only the reviewed branch guard hash is refreshed.
Dependency installation is outside this test-process containment claim.

Tests keep the actual classifier, shared authentication, key/email selectors and
actor guard. They mock only OAuth runtime, Privy SDK and the existing controlled
DB/profile leaves, with exact predicates and a provisioning trap. Disabled runtime
import, valid full/limited denial, undefined independent verification and throwing
runtime/no-fallback are distinct cases. Controlled grant results are not provider
cryptographic or live revocation proof. The existing 45 proposal tests run for
harness compatibility; this suite does not repeat the expiry-policy matrix.

No source test proves deployment, intended-client authentication, native parity,
SQL entitlement or live MCP availability. Those gates remain unchanged.

## Inactive direct-SDK transport composition

`handleProposedRegistrationMcpRequest` composes a request-local SDK server and
stateless JSON Streamable HTTP transport with the existing verifier and proposed
create/read domains. It is unregistered: current `/mcp`, its onboarding, catalogs
and delegated allowlists are unchanged. It has no production dependency factory.
Only server-owned proposed policy/storage dependencies may be supplied. There is
no adopted query mode or public registration endpoint.

The exact original NextRequest is retained once; its body is read once and passed
to the SDK as `parsedBody`. No AuthInfo or token is manufactured. A frozen admission
observation is compared with each call's actual credential tuple (including key ID
or Privy subject), actor and workspace. Domain authentication runs independently;
a per-invocation port wrapper checks its actual actor/workspace and intended method
before invoking the original port. Nothing substitutes the earlier identity into a
fresh domain call. The domain exposes no credential tuple at that third observation,
so same-actor credential-only changes there are not claimed detectable. These are
observations, not atomic revocation or SQL entitlement checks.

Internal source constants are 64KiB wire bytes, a five-second total body read,
a 30-second whole-request deadline, and a separately bounded one-second cleanup.
Authentication precedes body reads. All arrays and id-less tool calls are rejected
before effects; unsupported Accept/content type yield406/415; malformed JSON400,
oversize413, body timeout408 and whole-request timeout504. Abort yields408 when a
response can still be delivered. Cleanup uncertainty yields503. Early denial owns
and cancels unread input too. These are inactive source contracts, not deployed
limits or client acceptance.

The real SDK uses JSON response mode. The owner closes server/transport before
returning a completed JSON response, including202 notifications and errors. Request
abort/deadline races bound every asynchronous stage and observe losing rejections;
closing alone cannot settle the SDK's pending JSON promise. No mcp-handler import,
adapter interval, global owner, session store or response-stream teardown claim is
introduced. A normal returned response body can be abandoned after SDK closure.

The storage guard checks owner/request/SDK termination immediately before port
entry. Termination before entry prevents execution. Once storage starts, closing
HTTP does not roll it back: a lost response is an unknown outcome, retaining the
original operation/key/input, with no automatic retry. Domain work may settle after
transport cleanup; a never-settling dependency is not reported as settled merely
because the response deadline or process boundary ended. Controlled tests separately
release and await delayed domain/storage work. Known storage errors render fixed
messages, never mutable adapter exception details.

The controlled `mcpTransport` and `mcpTransportLifecycle` suites exercise real SDK
client/server composition with synthetic credential and storage leaves. Existing
proposal containment and source/golden bindings remain unchanged. The cohesive
request-owner, bounded-reader and guard functions deliberately retain their local
state/control flow despite the review configuration's 50-line function guideline;
splitting that state into a generic lifecycle framework would obscure ownership.
