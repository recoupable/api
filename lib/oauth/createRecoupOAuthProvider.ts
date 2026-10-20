import { oauthPersistentExpiry } from "./oauthPersistentExpiry";
import { Provider, errors, type AdapterFactory } from "oidc-provider";
import type { OAuthRuntimeConfig } from "./loadOAuthConfig";
import { oauthLaunchScopes } from "./oauthLaunchScopes";
import { createOAuthMetadataFetch } from "./createOAuthMetadataFetch";
import { validateOAuthMetadataUrl } from "./validateOAuthMetadataUrl";
import { validateOAuthClientMetadata } from "./validateOAuthClientMetadata";
import { validateOAuthRedirectUris } from "./validateOAuthRedirectUris";
import { agentRegistrationPolicy } from "./agentAuth/agentRegistrationPolicy";

/** Real-account provider; all secrets and durable storage are supplied explicitly. */
export function createRecoupOAuthProvider(
  config: OAuthRuntimeConfig,
  adapter: AdapterFactory,
  accountExists: (id: string) => Promise<boolean>,
) {
  const grants = adapter("RecoupGrant");
  const provider = new Provider(config.issuer, {
    adapter,
    jwks: config.jwks,
    cookies: { keys: config.cookieKeys },
    clients: config.agentAuthEnabled
      ? [
          {
            client_id: agentRegistrationPolicy.clientId,
            client_name: agentRegistrationPolicy.clientName,
            token_endpoint_auth_method: "none",
            grant_types: [],
            response_types: [],
            redirect_uris: [],
            scope: agentRegistrationPolicy.scope,
          },
        ]
      : [],
    discovery: config.agentAuthEnabled
      ? {
          agent_auth: {
            skill: `${config.issuer}/auth.md`,
            identity_endpoint: `${config.issuer}/agent/identity`,
            claim_endpoint: `${config.issuer}/agent/identity/claim`,
            identity_types_supported: ["service_auth"],
          },
        }
      : {},
    // MCP desktop clients may omit application_type while registering native callbacks.
    clientDefaults: { application_type: "native" },
    extraClientMetadata: {
      properties: ["redirect_uris", "client_id"],
      validator: (_ctx, key, value, metadata) => {
        if (key === "redirect_uris") validateOAuthRedirectUris(value);
        else validateOAuthClientMetadata(metadata);
      },
    },
    fetch: createOAuthMetadataFetch(),
    fetchResponseBodyLimits: { "client_id metadata document": 16384, jwks_uri: 16384 },
    scopes: ["openid", "offline_access", ...Object.keys(oauthLaunchScopes)],
    responseTypes: ["code"],
    pkce: { required: () => true },
    features: {
      devInteractions: { enabled: false },
      clientIdMetadataDocument: {
        enabled: true,
        ack: "draft-02",
        cacheDuration: { min: 0, max: 300 },
        allowFetch: (_ctx, clientId) => {
          try {
            validateOAuthMetadataUrl(clientId);
            return true;
          } catch {
            return false;
          }
        },
      },
      registration: { enabled: true, issueRegistrationAccessToken: false },
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => config.resource,
        useGrantedResource: () => true,
        getResourceServerInfo: (_ctx, resource) => {
          if (resource !== config.resource) throw new errors.InvalidTarget();
          return {
            scope: Object.keys(oauthLaunchScopes).join(" "),
            audience: resource,
            accessTokenTTL: 300,
            accessTokenFormat: "opaque",
          };
        },
      },
    },
    // A fresh authorization always needs approval; only this interaction's result is reused.
    loadExistingGrant: async ctx => {
      const id = ctx.oidc.result?.consent?.grantId;
      return typeof id === "string" ? provider.Grant.find(id) : undefined;
    },
    issueRefreshToken: async (_ctx, client, source) => {
      const grant = await grants.find(source.grantId);
      return (
        !!grant &&
        grant.accountId === source.accountId &&
        grant.clientId === client.clientId &&
        grant.extra?.persistent === true &&
        client.grantTypeAllowed("refresh_token")
      );
    },
    rotateRefreshToken: true,
    expiresWithSession: () => false,
    ttl: {
      AccessToken: 300,
      AuthorizationCode: 60,
      Interaction: 300,
      Grant: () => oauthPersistentExpiry - Math.floor(Date.now() / 1000),
      Session: 86400,
      RefreshToken: (ctx, token) => {
        const remaining = (ctx.oidc.entities.Grant?.exp ?? 0) - Math.floor(Date.now() / 1000);
        if (remaining <= 0) throw new errors.InvalidGrant();
        // Preserve the exact grant deadline across serialization and refresh rotation.
        token.exp = ctx.oidc.entities.Grant!.exp;
        return remaining;
      },
    },
    interactions: { url: (_ctx, interaction) => `${config.issuer}/interaction/${interaction.uid}` },
    findAccount: async (_ctx, id) =>
      (await accountExists(id)) ? { accountId: id, claims: async () => ({ sub: id }) } : undefined,
  });
  if (config.agentAuthEnabled) {
    // These profile grants are handled by our Node dispatcher at the same token endpoint.
    // Do not advertise provider-assertion trust or event endpoints that are not implemented.
    provider.use(async (ctx, next) => {
      await next();
      if (ctx.oidc.route === "discovery" && ctx.body && typeof ctx.body === "object") {
        const body = ctx.body as { grant_types_supported?: string[] };
        body.grant_types_supported = [
          ...(body.grant_types_supported ?? []),
          agentRegistrationPolicy.claimGrant,
          agentRegistrationPolicy.assertionGrant,
        ];
      }
    });
  }
  provider.proxy = true;
  return provider;
}
