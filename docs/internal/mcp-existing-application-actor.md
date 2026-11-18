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
failures become a generic 503 without raw exception details.

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
introduced. Sites' create/read functions still accept their own authenticated
request; no caller-supplied evidence/actor bypass was added. Their future trusted
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
