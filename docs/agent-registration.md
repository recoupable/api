# User-verified agent registration

This opt-in profile implements WorkOS `auth.md` `service_auth` using Recoup's existing
issuer, verified Privy sign-in, encrypted OAuth store, and MCP grant checks. It does not
accept anonymous registrations or external identity assertions.

## Policy and boundaries

- Register an existing account by its verified email. Registration does not look up the
  email or grant account access; it returns opaque claim handles and a six-digit code.
- The account holder signs in on `/oauth/claim`, enters the code displayed by their agent,
  and explicitly approves or declines. The API checks the verified email again on submit.
  Account IDs, permissions, and credential lifetimes never come from the browser.
- A ceremony expires after ten minutes and locks after five wrong codes. Each approval
  ticket is single-use and bound to the verified account, Privy subject, registration,
  resource, and scope. Atomic ciphertext transitions serialize approvals and polling
  across instances.
- Approval creates a **personal `mcp:read` grant for one hour**. Access tokens last at most
  five minutes. No refresh token is issued. Signed assertions can be re-exchanged until
  the original hour expires; neither polling nor renewal extends that deadline.
- Connected Agents shows the ordinary `RecoupGrant`. Disconnecting it tombstones the grant
  and removes the registration and all its tokens. Late token saves or state transitions
  cannot revive it. Individual token revocation leaves the assertion usable until expiry
  or disconnection.
- Each new registration purges expired artifacts from at most 100 expired registration
  families in the same issuer. Active records and revocation tombstones are preserved.
  This bounds cleanup work per request; expiry remains enforced even without traffic.

The signing key is the existing issuer RSA key. Assertions require `typ=oauth-id-jag+jwt`,
RS256, matching issuer/audience, a valid registration subject, fixed scope/client,
and bounded timestamps. They cannot be substituted with OIDC ID tokens.

## HTTP surface

All paths are relative to the configured issuer (`https://api.recoupable.dev/api/oauth`).

| Path | Caller | Purpose |
| --- | --- | --- |
| `POST /agent/identity` | Agent | `{type:"service_auth",login_hint:"…"}`; returns no credential |
| `POST /agent/identity/claim` | Signed-in browser | Load the consent request using `claim_attempt_token` |
| `POST /agent/identity/claim/complete` | Signed-in browser | Explicit decision, CSRF ticket, and code for approval |
| `POST /token` | Agent | Claim polling or service-signed JWT bearer exchange |
| `POST /token/revocation` | Agent | Idempotent revocation of one profile access token |
| `GET /auth.md` | Public | Discoverable instructions for the enabled profile |

The two browser endpoints require the exact configured consent Origin and a verified Privy
Bearer token; cookies alone are insufficient. The agent never receives a Privy token.
The registration endpoint shares the existing atomic registration/IP budgets and fails
closed on storage or throttling failure.

The profile's form grants omit `client_id`. A reserved provider client has no ordinary
grant or response types. The Node dispatcher handles the two profile grants at the existing
token endpoint and creates ordinary provider AccessTokens. Other form requests retain their
raw body for oidc-provider's documented upstream-parser fallback, preserving duplicate
parameters and PKCE validation. This produces its one-time upstream-parser warning.

The profile claim endpoint is a service-owned consent endpoint. There is no anonymous
claim retry API; expired ceremonies require a fresh registration.

## Deployment order

1. Apply database migration `20261020040000_oauth_agent_registration_cas.sql`.
2. Deploy API and chat with `OAUTH_AGENT_REGISTRATION_ENABLED` absent/false.
3. Verify chat's existing `OAUTH_CONSENT_ENABLED`, `OAUTH_ISSUER`, and Privy configuration;
   enable `OAUTH_AGENT_REGISTRATION_ENABLED=true` on chat and deploy.
4. Verify `/oauth/claim` renders sign-in under the configured HTTPS consent origin.
5. Enable `OAUTH_AGENT_REGISTRATION_ENABLED=true` on API and deploy. Only then does issuer
   discovery advertise `agent_auth`, its two grants, and the hosted instructions.
6. With the account holder, exercise registration → code → explicit approval → personal
   read → denied write → renewal → disconnect → denied renewal.

Rollback: disable the API flag to stop new ceremonies and exchanges, then disable the chat
flag. Existing access tokens remain subject to ordinary grant checks for at most five
minutes; disconnect an affected registration to revoke it immediately. Leave the additive
database function installed so unrelated OAuth flows continue normally.

## Validation

The tests use synthetic identities and signing keys. They cover protocol parsing, verified
email and account binding, code lockout, parallel approval/polling, assertion validation,
resource/scope escalation, expiry, ordinary PKCE compatibility, and revocation. A separate
PostgreSQL fixture runs the new state machine across two provider instances and verifies
the actual storage/revocation behavior. These are not live account-holder or named-client
interoperability receipts.

Protocol reference: [WorkOS agent service guide](https://github.com/workos/auth.md/blob/main/agent-services/README.md).
