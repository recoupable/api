# Verified execution evidence — additive, disabled recovery prototype

2026-10-25. Base API main `96d4f5215f6780ea3529506df4c010f2b0cbf632` (merged disabled foundation #1158). Database #122 remains draft/unapplied. No route or workflow opts into this feature. No dispatch, credential materialization or fence wiring is added.

## Shared verification result

`validateAuthContext(request, {includeVerificationEvidence:true, ...existingOverrides})` returns the existing AuthContext plus `verificationEvidence`. This is a **server-only option**, not a request body field. Opt-in forces existing-account-only Privy resolution even if allowAccountCreation is true. Default callers retain their existing return shape, onboarding behavior, header selection, override rules and error behavior.

The same existing helpers perform verification exactly once. Optional internal observers retain selected non-secret observations before helper return values discard them. There is no parallel authenticator, JWT decoding shortcut, OAuth rebinding call or second verifier. Both x-api-key and Bearer recoup_sk_ credentials use the same hash/expiry/row lookup; the evidence mechanism is recoup_api_key in both cases. Other Bearer tokens remain on the current Privy path; no OAuth transport support is added.

The result contains:

- `principal`: mechanism plus `actorAccountId` captured before override. A key principal includes its verified `keyId`. A Privy principal includes appId, issuer and subject from the SDK's verified response, not unverified JWT fields. Opt-in additionally requires app ID agreement with the configured client and fetched profile ID agreement with verified subject.
- `effectiveAccountId`: the account after existing override validation. Equal effective accounts do not imply equal principals.
- `accountAccess`: the actual successful branch observed by existing validation: self, admin_membership, organization_membership or shared_membership, with organization ID where applicable.
- `organizationAccess`: null when no requested organization was checked; otherwise membership or self_organization and the checked organization ID. This is checked against the effective account, consistent with current behavior.
- `executionResources`: always `{status:"unresolved",reason:"resource_authorization_contract_missing"}`.

This object excludes raw credentials, key hashes, email addresses and provider payloads. AuthContext still contains its existing authToken for legacy consumers; **never persist or log the full AuthContext** as a snapshot. API snapshot code must explicitly map/validate only non-secret evidence into its strict credential policy. This PR does not add a snapshot schema or alter #1158.

Opt-in identity/evidence gaps fail closed; provider exceptions are not logged in this mode. Database errors retain existing resolver semantics. The result is an observation at verification time, not an immutable grant or authorization token. Current email-to-account resolution is preserved; a changed mapping produces a changed actorAccountId. It is not replaced with OAuth's write-capable identity-binding facility.

## Execution resource contract that is missing

`canAccessAccount` reads current memberships and short-circuits on one allowing branch. Its shared-membership query returns at most one match. No complete scope set, policy revision, membership revision or atomic snapshot is returned. Additional memberships can leave the same allowing branch unchanged. A newly observed admin branch is visible; every permission expansion is not. Membership queries and later session/resource operations are separate reads, with no transaction or lifetime authorization guarantee.

`validateChatOwnership` separately compares the chat's session account to effective auth account. It does not return a versioned execution-resource grant. `buildRunAgentInput` derives recoupOrgId/repository routing from session.clone_url. That parser supplies routing, not repository permission. A matching requested organization still does not prove GitHub repository/installation access, sandbox ownership, artist authorization, tool/action scope or immutable resource configuration. Neither a clone URL nor a fabricated hash/version string can fill this gap.

The disabled `assessExecutionRecovery(original,current,cloneUrl)` prototype consumes freshly obtained evidence and original stored non-secret evidence. It detects changed principal or selected authorization observations and flags a routed organization that differs from the requested/validated organization. **Its result is always allowed:false**. Even unchanged principal, branch and matching routing returns resource_authorization_contract_missing. It is diagnostic source scaffolding, not an authorization validator, credential recovery implementation or permission to start a workflow. Production imports remain absent.

Required contract before changing that blocker: identify the authoritative operation-specific resource set (session/chat, repository/installation, sandbox, artist, working directory/skills and permitted actions); verify access through each existing authoritative owner; define how removed and expanded relevant authority are compared to the original intent; and define fresh reads/consistency and any authoritative revision semantics. Do not invent a grants version from organization strings or treat a content digest as an authorization revision. Root/UI must agree the strict snapshot representation and materialization policy before any runtime adapter enables recovery.

## Proof and limitations

Tests call the actual validateAuthContext → existing header/credential resolver → Privy/key and override/organization paths. Only external provider/DB/onboarding boundaries are mocked with synthetic values; Privy fetch is stubbed. They cover one verification, refreshed bytes with the same principal, changed subject/key/account mapping, removed access, changed admin basis, header compatibility, expired keys, body-token non-authority, no recovery onboarding, and actual buildRunAgentInput clone routing versus authenticated organization. Legacy auth/Privy/org/chat ownership/builder tests are also run.

These tests do not prove live credential validity, provider identity behavior, full resource scope, atomic membership reads, hosted encryption, credential recovery or production authorization. No real accounts, keys, provider calls, grants, rotations, mint/revoke or Database operations are exercised.

## Status and next action

Feature branch and draft PR only. Root reviews the opt-in shared evidence shape and missing resource contract; UI owns its strict snapshot mapping. Credential design A still requires proven never-dispatched state, fresh same-principal/current-scope authentication, accepted one-shot claim and original snapshot verification. Matching evidence here is insufficient to dispatch. Database122, its SQL and all prior sealed audit packets remain unchanged.
