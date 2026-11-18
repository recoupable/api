# Fan/host identity contract and protocol

Source contract for [Fans #2111](https://github.com/recoupable/app/issues/2111) and provider integration [#2107](https://github.com/recoupable/app/issues/2107). The implemented surface is an inactive internal shape/consistency model. The protocol, transaction ordering and recovery requirements below are the selected initial design, **unimplemented and not adopted production policy**. No fan authentication, proof verification, credential/session issuance, mapping persistence, billing reservation or route/MCP activation follows from this document.

## Two journeys

**Host sign-in:** a later trusted host backend initiates Recoup sign-in, binds the browser flow, redeems an intended-recipient result, and selects an existing scoped host mapping or creates a host account under the same durable operation. Only confirmed host and mapping persistence can precede host-session issuance. A matching email never selects an existing Google/email host account. Host account creation and Recoup mapping are separate systems; unknown results require same-operation recovery rather than duplicate account creation.

**Existing-host linking:** a backend independently proves its current host session and binds the operation to that host account and session generation. The fan separately proves control of a sign-in method. Linking preserves the host account, purchases and progress. Logout/account switching must invalidate links not yet durably authorized; already-authorized completion follows the ordering below. A sign-in result cannot be used to link; a link result cannot log in.

Neither journey enrolls a program, grants points, subscribes to marketing or moves purchases. Customer API credentials prove a backend actor, not the fan's host session. Public widget IDs, browser IDs, email matches, player tokens and connection-status events are not login evidence.

## Exact source surface

- `parseFanHostIntent`: parses internal intent shape, with no authority provenance.
- `assertFanHostReceiptMatchesIntent`: parses a receipt and compares it with expected intent; matching data is not authenticated or proof of persistence.
- `decideFanHostLinkConflict`: pure mapping-observation classification.
- `decideFanHostContinuity`: pure configured-policy classification.
- Two local fixture suites; no runtime integration or barrel export.

Intent/receipt version is exactly 1. Customer/application/fan/host/recipient/operation IDs are opaque, 1–256 UTF-16 code units, NUL-free and well formed; valid supplementary characters and literal backslash-u text are preserved. No trimming, case folding, Unicode normalization or email lookup. These are internal proposed structural limits, not an adopted external wire contract. Return targets are exact canonical HTTPS URLs, at most 2048 code units, without credentials or fragments. URL shape is not proof of registered origin or intended-recipient authorization.

Revisions/generations are nonnegative safe integers; expected mapping revisions stop at MAX_SAFE_INTEGER - 1 so the modeled successor is representable; mapping receipt revisions are positive safe integers. A link receipt models exactly expected_mapping_revision + 1. This is a proposed model transition, not an existing database versioning claim; replay compares the same original receipt and intent. The host-sign-in intent forbids link-only host/session/mapping fields. Receipt timestamps require exact valid UTC ISO timestamps with milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`). A receipt records a time, not a proof expiry or freshness guarantee. Receipt outcomes are `host_mapping_created` or `host_mapping_selected` for host sign-in, and `existing_host_linked` for linking. The nested `intent` carries the complete operation and binding fields; outer fan and host fields must agree where the expected intent constrains them. Unknown properties and mismatches reject.

## Provenance and scope

A future server-owned verifier must authenticate the backend, check exact customer/app/environment permission and recipient, obtain verified fan-method evidence, and verify current host-session/CSRF/ initiation binding. It must construct expected intent from trusted server state. Parsing browser JSON into this shape does not perform any of that work.

The tests intentionally show that forged, well-shaped JSON can pass the consistency matcher when the attacker supplies both the receipt and expected intent. That is the boundary of this helper, not an authentication result. No export converts serialized claims to trusted verifier evidence. Types, schema parsing, fixture objects and classifications cannot mint authority. No issuer, redeemer, cryptography, production verifier or host-session factory is present.

A stable fan is customer-scoped, independent of optional email/Spotify sign-in methods and marketing consent. Authorized applications may recognize that fan while retaining separate host mappings. The mapping scope is customer/application/environment: one host maps to one fan and one fan to one host in that scope. Other applications may use different host IDs; unrelated customers and development/production namespaces are isolated. No cross-program balances/history or universal anonymous identity follows. These helpers compare explicit scope observations; they do not establish that an application is authorized.

Missing mapping observations are not absent records. Only an explicit `state: absent` models absence. Unknown security, malformed observation, stale expected revision or wrong scope returns `unavailable`. Same fan with another host in the same scope, or a host already linked to another fan, returns `conflict`. One-sided mappings fail closed. Reassignment/deletion requires explicit future recovery; revocation denies. `unchanged_candidate` and `needs_atomic_mapping_check` are not permissions.

## Initial protocol

Use **OpenID Connect Authorization Code flow with S256 PKCE**, a separate Fans issuer/identity boundary, and a server-backed host. Reuse maintained protocol machinery and a maintained relying-party client; do not implement a custom login handoff or handwritten token validation. OIDC supplies an authentication result, but it does not prove the existing host session or perform account linking. Apply the full applicable code-flow ID Token validation rules, including pinned issuer/client, signature, audience, expiry and request-bound nonce. [OpenID Connect Core §3.1](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth)

The API already uses `oidc-provider`, but `createRecoupOAuthProvider`, `loadOAuthConfig` and `approveOAuthInteraction` implement Recoup-account/MCP authority. Do not reuse their live issuer, account resolver, keys, grants, scopes, persistent-access policy or storage namespace as Fans authority. Namespaced encrypted storage and consumption are reusable patterns only after separate Fans qualification. A custom handoff would still require host-session proof, application authority, durable consumption and mapping recovery while adding another client/protocol contract.

The initial integration requires these boundaries:

- Bind one enrolled host client to an authoritative customer/application/environment and recipient. Exact callback registration is not execution permission. Do not inherit MCP dynamic registration, scopes or offline grants. Production issuer/key configuration, client authentication method, TTLs and admission policy remain separate implementation/adoption gates.
- The trusted host backend initiates a purpose-bound operation after its actual session/CSRF checks. Keep PKCE verifier, state/nonce association, host account/session generation and return destination in server-held state. Require backend client authentication plus PKCE; browser IDs, generic customer API credentials and otherwise valid ID Tokens cannot select a host-link intent.
- Use top-level navigation initially. Fans/Spotify authorization and host/Fans authentication have independent request/state/PKCE bindings. Spotify returns to its fixed Recoup callback; the host returns only to its separately registered exact callback. Reject arbitrary returns, wildcard builder origins and issuer substitution. These controls follow [RFC 9700 §2.1 and §4.4](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1).
- Server-side provider completion establishes method control and resolves the canonical customer-scoped fan independently of marketing consent. Spotify's [PKCE exchange](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) and [authorized profile lookup](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile) do not prove the host session. The existing Site callback's marketing-bound capture and Player exchange's recoverable fan-capture failure cannot be promoted to successful host authentication.
- Resolve the opaque completion record server-side to the original authenticated client, interaction, verified fan, purpose and operation. Linking preserves the independently verified host account; sign-in may select/create a scoped host mapping. Neither a caller-supplied operation ID nor an ID Token alone authorizes this resource operation. No general Fans API access or refresh-token promise follows from the initial authentication profile.
- Callback success/error responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, render no third-party resources, consume the host callback transaction once and redirect to a clean local URL. No reusable credentials or provider tokens enter host messages. Exclude codes, tokens, verifiers, cookies, callback queries and request/response bodies from application/proxy logs and error telemetry.

Host identity lookup uses issuer plus opaque subject, never email or raw provider ID. Subject assignments map durably to the customer fan within the registered app/environment and survive signing-key and client-credential rotation. Never recycle a deleted subject for another fan. Replacing a client registration or issuer requires explicit authenticated continuity/migration or a new proof-bound association; it is not ordinary credential rotation. OIDC pairwise sector defaults can group apps sharing a callback hostname, so they do not establish customer/app/environment isolation by themselves. Qualify the chosen mapping against [OIDC Core §8.1](https://openid.net/specs/openid-connect-core-1_0.html#PairwiseAlg).

## Host authorization, logout and remote completion

A session recheck followed by a remote call is a check-then-use race. The host must serialize durable link authorization and logout/account switch through the same session-generation authority, using database transactions or equivalent durable compare-and-swap. A process mutex, cookie removal, request timestamp or repeated remote session read is insufficient.

| Point | Required transaction behavior |
| --- | --- |
| Prepare | Persist the exact intent and initiating host/browser binding without dispatch authority. Bind the authoritative verified fan/completion exactly once before attributing any host-account reservation. |
| **H — host authorization** | Lock/compare the live host session/generation and operation in a common documented order. Verify account, CSRF, fixed fan/intent, local security and eligibility; atomically commit authorization plus a durable dispatch record. No network call holds this lock. |
| **L — host logout/switch** | Use the same authority lock/CAS to invalidate the session generation and cancel operations still prepared. If L commits before H, authorization fails and no dispatch is created. |
| **R — Recoup completion** | An enrolled, permitted backend submits only the immutable authorized operation. In one Recoup transaction, check current app/client/environment authority, security and expiry; compare original bindings, consume the eligible completion, enforce mapping uniqueness/revision and persist the receipt. Recoup revocation/deletion must share this transaction's serialization discipline. |
| **F — host finalization** | Reconcile the exact receipt to the original operation idempotently. Before any sign-in session issuance, check the current host/browser-attempt generation under the host's transaction discipline. Linking never calls the sign-in session factory. |

**Accepted ordering:** L before H prevents a link. H before L may settle afterward only for the original host account and fan; it cannot switch accounts, restore the logged-out browser, create a linking session or extend session authority. The enrolled host backend attests its actual session verification under explicit link permission. Recoup cannot independently inspect an arbitrary host cookie, and a serialized attestation alone proves nothing.

H and R are separate commits across systems. A partition/crash can leave an authorized operation with unknown remote outcome; R can commit before a response is lost or F runs. Do not report that state as completed or safely cancelled. Retry/readback preserves the original operation and current authority checks. No global atomicity or automatic unlink compensation is promised. A requirement that every L before R prevent the mapping needs a separately reviewed common authority/coordinator; an extra session check cannot supply that guarantee.

For sign-in, use a one-use browser attempt generation. Logout, cancellation or account switch invalidates it under the same local serialization used at F. Host-account creation must be idempotent under the original operation; preserve its reservation while Recoup mapping completion is unresolved. Confirm both durable results before issuing a host session, without claiming a transaction spanning both databases.

## Recovery and reservation expiry

An authorization code remains single-use. Never make it redeemable again to recover a lost token response. Fresh authentication supplies new protocol evidence, not a replacement business intent.

Retain the immutable original customer/app/environment, client/recipient, purpose, operation, canonical verified fan and authoritative issuer/subject association, completion reference, return target, expected mapping revision and host account/reservation. Linking additionally retains the original host session/generation. Recovery must:

1. Authenticate current backend/recovery authority and resolve the original operation from server storage before receipt disclosure or mutation.
2. Resolve fresh authentication to the **same original canonical fan** and exact customer/app/environment/client/recipient. A changed method/subject must already have an authorized association to that fan; recovery never creates one through email matching or reassignment.
3. Preserve purpose, operation, host account/reservation, original generation and request/revision. New state/nonce/code may belong to fresh authentication but cannot overwrite the original intent/evidence or revive a cancelled operation, expired completion, deleted mapping or stale host session.
4. Return a committed receipt only under current authorized readback, comparing its original request/revision to the retained intent. Historical receipt existence grants neither current mapping access nor session authority. An uncommitted, already-authorized and still-eligible operation may retry only its identical dispatch/idempotency identity.
5. Stop with unresolved/denied outcome when original fan/completion provenance is missing or differs. A fresh token cannot fill that gap or let another fan claim the retained reservation. Any separate new operation needs explicit orphan disposition, not a new ID minted silently on retry.

Expiry transitions use the operation lock/CAS. Prepared, undispatched operations can expire/cancel with tombstones preventing late revival or reassignment. Dispatched operations with unknown remote outcome remain quarantined for reconciliation: a timer does not prove no commit and cannot release their identity/account reservation to another fan. Confirmed success reconciles its original receipt. Only confirmed terminal failure with no remote commit and no purchases/progress/membership dependencies can qualify a provisional account for separately authorized cleanup. This contract authorizes no deletion or retention duration; a minimal non-reassignable identity tombstone is distinct from indefinite profile retention.

## Continuity and lifecycle

The policy model separates returning sign-in, recovery, disconnect, new registration and campaign operations. Known returning mappings may yield `auth_lane_candidate` with explicit bounded authentication admission whether campaign allowance is funded or exhausted. Campaign exhaustion is enforced only for campaign operations in this model. New registration requires its own configured admission, independently of returning-auth admission; missing/unknown policy fails closed. A funded campaign classification grants no billing reservation. Revocation/deletion denies independently of funding.

Callers explicitly supply finite positive safe-integer maximum authentication age and session lifetime in milliseconds, an observation time and authentication time, and admission observations. Future times, stale authentication and unsafe expiry arithmetic fail closed; the maximum-age boundary is inclusive. No environment/default policy, adopted rates or production TTLs are selected. This model does not measure requests or enforce a rate limit. `*_candidate` outputs are only proposed lane choices.

| Action | Required future boundary |
| --- | --- |
| Host logout | Ends/rotates the host session; cancels pre-H links and prevents stale F session issuance; post-H operations may settle only for their original account/fan |
| Recoup fan-session logout | Revokes that session and dependent pending proof; no universal host logout promise |
| Spotify disconnect | Removes provider authorization/sign-in method; preserves host account, purchases, progress, memberships and points |
| Mapping unlink/relink | Explicit proof and revision checks; different-fan reassignment requires verified recovery, never email merge |
| Marketing unsubscribe | Changes the marketing subscription only |
| Account deletion | Denies future sessions/proofs; prevents stale resurrection; retention and host business records require separate policy |

Coordinated logout is a separate capability: [OIDC RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout) does not guarantee that every independent host session ends.

A static embed can connect/play and display status. Private host content requires a trusted backend or reviewed hosted service enforcing access server-side. No frontend secret or client boolean can substitute for it. The pure helpers perform none of these lifecycle operations.

## Qualification boundary

The selected host must expose an actual server session verifier, durable session/attempt invalidation and account/reservation transactions capable of the H/L/F ordering. A static host needs a trusted backend/service enforcing protected content. No host adapter, Fans issuer, mapping transaction or live provider integration is implemented by the existing shape fixtures.

Future local qualification uses the real protocol library and selected host session/logout paths with test-only keys and disposable storage. Declare synthetic authority explicitly; do not claim production permission or concurrency from mocked validity booleans. Required cases include:

- Wrong issuer/audience/nonce/PKCE, callback substitution, malformed completion and cross-customer/app/environment/purpose denial.
- Barrier-controlled L-before-H denial and H-before-L original-account-only settlement; account switch cannot inherit the operation or restore a session at F.
- Atomic host authorization/outbox crash behavior, Recoup revocation/deletion racing R, partition/restart and R-committed/response-lost readback without duplicate mapping.
- Fresh login as a different fan, missing original provenance or changed host generation cannot claim/revive a reservation; same-fan recovery preserves original identity and expiry.
- Unknown-outcome reservation expiry cannot delete/reassign it; confirmed success and separately authorized cleanup remain distinct.
- Subject stability across signing-key/client-credential rotation, explicit registration replacement and qualified shared-callback sector isolation.
- No-store/no-referrer callback behavior, clean destinations, no third-party resources and credential-free logs/telemetry.

These are required future tests, not results of the current fixture suites. Source/document review, ordinary CI, deployment readiness and public reachability do not establish host concurrency, provider execution or either deployed journey.

## Existing source and future guarantees

Protocol/source inspection: API `67429e716b81695b8f6d0c3923c40be125b7f560`, tree `c6b23dc2f011339c25fb32150eb1e761b03543a6`. Inspected Database source: `acea75c0e118b6ca12bb9a22470a8bd7b383f925`. Source inspection does not establish deployed schema or policy.

- `lib/fans/getArtistFans.ts` reads discovered social engagement, not authenticated fan identity.
- `lib/sites/fanConnection/startFanConnection.ts`, `finishFanConnection.ts` and `lib/supabase/site_fan_connections/consumeFanSession.ts` provide Site-bound PKCE/browser binding/claim patterns. Their status is display-only and their marketing agreement is not consent-independent sign-in.
- `lib/players/verifyPlayerSession.ts` and `requirePlayerSession.ts` bind player capabilities, not verified host-account identity.
- Database `20261010100000_player_organization_contacts.sql` already preserves workspace/provider contact identity and player relationship IDs. Preserve those IDs; do not infer contact-to-fan mapping, owner-to-customer authority, migration or email merge.
- `lib/auth/validateAuthContext.ts` exposes existing-account verification observations with unresolved execution resources. It cannot supply host-session proof.
- `lib/oauth/OAuthStore.ts`, `createOAuthAdapter.ts` and `resolveOAuthAccess.ts` provide existing consumption/revocation patterns, but their MCP account/resource authority is not Fans authority.
- `lib/applications/proposedRegistration/assertProposedRegistrationReceipt.ts` illustrates strict intent comparison. An inactive registration receipt is not an active application grant.

Future persistence must atomically bind proof consumption, mapping uniqueness, expected revisions and durable receipt, and linearize revocation/deletion with completion. Separate reads/RPCs and in-memory ordering cannot establish this. Same-operation readback must recover lost responses without new mappings or new session authority. This slice has no mock store and makes no replay, transaction, concurrency or revocation-linearization claim.

Fixtures establish shape/comparison/decision behavior and input invariance only. They do not prove provider control, cryptography, current app authority, durable storage, billing enforcement, host session creation or either deployed journey. #2104 remains the foundation prerequisite; #2107 owns provider integration, #2105 continuity/admission enforcement and #2110 deployed acceptance. Source review/merge does not adopt production policy or activate this model.
