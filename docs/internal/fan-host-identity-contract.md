# Inactive fan/host identity contract model

Proposed source contract for [Fans #2111](https://github.com/recoupable/app/issues/2111). This is an internal shape/consistency model. It does not authenticate a fan, verify a proof, issue a credential/session, persist a mapping, reserve billing capacity or expose a route/MCP tool.

## Two journeys

**Host sign-in:** a later trusted host backend initiates Recoup sign-in, binds the browser flow, redeems an intended-recipient result, and selects an existing scoped host mapping or creates a host account under the same durable operation. Only confirmed host and mapping persistence can precede host-session issuance. A matching email never selects an existing Google/email host account. Host account creation and Recoup mapping are separate systems; unknown results require same-operation recovery rather than duplicate account creation.

**Existing-host linking:** a backend independently proves its current host session and binds the operation to that host account and session generation. The fan separately proves control of a sign-in method. Linking preserves the host account, purchases and progress. Logout/account switching must invalidate pending links. A sign-in result cannot be used to link; a link result cannot log in.

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

## Continuity and lifecycle

The policy model separates returning sign-in, recovery, disconnect, new registration and campaign operations. Known returning mappings may yield `auth_lane_candidate` at campaign exhaustion only with explicit bounded authentication admission. New registration requires its own configured admission; missing/unknown policy fails closed. A funded campaign classification grants no billing reservation. Revocation/deletion denies independently of funding.

Callers explicitly supply finite positive safe-integer maximum authentication age and session lifetime in milliseconds, an observation time and authentication time, and admission observations. Future times, stale authentication and unsafe expiry arithmetic fail closed; the maximum-age boundary is inclusive. No environment/default policy, adopted rates or production TTLs are selected. This model does not measure requests or enforce a rate limit. `*_candidate` outputs are only proposed lane choices.

| Action | Required future boundary |
| --- | --- |
| Host logout | Ends/rotates that host session and invalidates pending links bound to it |
| Recoup fan-session logout | Revokes that session and dependent pending proof; no universal host logout promise |
| Spotify disconnect | Removes provider authorization/sign-in method; preserves host account, purchases, progress, memberships and points |
| Mapping unlink/relink | Explicit proof and revision checks; different-fan reassignment requires verified recovery, never email merge |
| Marketing unsubscribe | Changes the marketing subscription only |
| Account deletion | Denies future sessions/proofs; prevents stale resurrection; retention and host business records require separate policy |

A static embed can connect/play and display status. Private host content requires a trusted backend or reviewed hosted service enforcing access server-side. No frontend secret or client boolean can substitute for it. The pure helpers perform none of these lifecycle operations.

## Existing source and future guarantees

Inspected API source: `caaa1b5835a92ce6ae985ca446aa359147117899`, tree `529ad8131ca515cc903a9bc6d0e7ca75be54c7c4`, merged through API1274. Implementation starts from API main `b546cb5eabcb2a838fe5893b210816e4d38dcb8c`. Inspected Database source: `acea75c0e118b6ca12bb9a22470a8bd7b383f925`. Source inspection does not establish deployed schema or policy.

- `lib/fans/getArtistFans.ts` reads discovered social engagement, not authenticated fan identity.
- `lib/sites/fanConnection/startFanConnection.ts`, `finishFanConnection.ts` and `lib/supabase/site_fan_connections/consumeFanSession.ts` provide Site-bound PKCE/browser binding/claim patterns. Their status is display-only and their marketing agreement is not consent-independent sign-in.
- `lib/players/verifyPlayerSession.ts` and `requirePlayerSession.ts` bind player capabilities, not verified host-account identity.
- Database `20261010100000_player_organization_contacts.sql` already preserves workspace/provider contact identity and player relationship IDs. Preserve those IDs; do not infer contact-to-fan mapping, owner-to-customer authority, migration or email merge.
- `lib/auth/validateAuthContext.ts` exposes existing-account verification observations with unresolved execution resources. It cannot supply host-session proof.
- `lib/oauth/OAuthStore.ts`, `createOAuthAdapter.ts` and `resolveOAuthAccess.ts` provide existing consumption/revocation patterns, but their MCP account/resource authority is not Fans authority.
- `lib/applications/proposedRegistration/assertProposedRegistrationReceipt.ts` illustrates strict intent comparison. An inactive registration receipt is not an active application grant.

Future persistence must atomically bind proof consumption, mapping uniqueness, expected revisions and durable receipt, and linearize revocation/deletion with completion. Separate reads/RPCs and in-memory ordering cannot establish this. Same-operation readback must recover lost responses without new mappings or new session authority. This slice has no mock store and makes no replay, transaction, concurrency or revocation-linearization claim.

Fixtures establish shape/comparison/decision behavior and input invariance only. They do not prove provider control, cryptography, current app authority, durable storage, billing enforcement, host session creation or either deployed journey. #2104 remains the foundation prerequisite; #2107 owns provider integration, #2105 continuity/admission enforcement and #2110 deployed acceptance. Root review/merge does not adopt those policies or activate this model.
