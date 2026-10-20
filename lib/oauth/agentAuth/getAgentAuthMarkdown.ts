import type { OAuthRuntimeConfig } from "../loadOAuthConfig";

/** Publish only the enabled, user-verified read session supported by this issuer. */
export function getAgentAuthMarkdown(config: OAuthRuntimeConfig) {
  return `# Recoup agent authentication

Use this flow to read an existing Recoup account's personal artists, social profiles, and chat list.
The account holder must sign in to Recoup, enter the code displayed by the agent, and explicitly approve.
The service_auth flow grants only mcp:read for one hour. Organization workspaces and write tools are excluded.
For broader permissions, use the existing OAuth authorization-code flow with PKCE and explicit consent.

## Discovery
- [Protected resource metadata](${new URL("/.well-known/oauth-protected-resource", config.issuer)})
- [Authorization server metadata](${config.issuer}/.well-known/openid-configuration)
- [Connected agents](${config.consentOrigin}/oauth/connections)

## Register
POST ${config.issuer}/agent/identity with application/json:
\`{"type":"service_auth","login_hint":"the account holder's verified email"}\`

This returns registration_id, claim_token, claim_token_expires, and a claim block with user_code,
verification_uri, expires_in (600 seconds), and interval (5 seconds). It returns no account credential.
Show the code and link to the account holder. Never collect their password or complete the consent for them.
Keep claim_token private; do not include it in the verification URL. A rejected or expired ceremony needs a new registration.

## Receive a token
POST ${config.issuer}/token with application/x-www-form-urlencoded:
\`grant_type=urn:workos:agent-auth:grant-type:claim&claim_token=<claim_token>\`

Poll no faster than interval. authorization_pending means wait. On slow_down, add five seconds
to the interval (up to sixty). access_denied and expired_token stop the attempt.
Approval returns access_token, token_type Bearer, expires_in (at most 300), scope mcp:read,
identity_assertion, and assertion_expires. No refresh_token is issued.

Use Authorization: Bearer <access_token> only at ${config.resource}.
To renew within the approved hour, POST the same token endpoint:
\`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<identity_assertion>&resource=${config.resource}\`
The assertion can be re-exchanged until assertion_expires. Scope and resource cannot be widened.
An expired session requires new account-holder consent.

## Revoke
POST ${config.issuer}/token/revocation with application/x-www-form-urlencoded:
\`token=<access_token>&token_type_hint=access_token\`
This invalidates that access token. The account holder disconnects the registration in Connected agents
to invalidate all its tokens and future assertion exchanges.

Only service_auth is supported here. No anonymous access, external-provider assertions, or security-event
receiver is advertised. Keep credentials out of prompts, logs, URLs, and tool results.
`;
}
