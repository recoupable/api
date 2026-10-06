import { Provider, errors, type AdapterFactory } from "oidc-provider";
import type { OAuthRuntimeConfig } from "./loadOAuthConfig";
import { oauthScopes } from "./oauthScopes";

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
    clients: [],
    // Remote metadata/JWKS fetching needs a dedicated SSRF-safe policy before enabling CIMD.
    fetch: async () => {
      throw new Error("Remote OAuth metadata is not enabled");
    },
    scopes: ["openid", "offline_access", ...Object.keys(oauthScopes)],
    responseTypes: ["code"],
    pkce: { required: () => true },
    features: {
      devInteractions: { enabled: false },
      registration: { enabled: true, issueRegistrationAccessToken: false },
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => config.resource,
        useGrantedResource: () => true,
        getResourceServerInfo: (_ctx, resource) => {
          if (resource !== config.resource) throw new errors.InvalidTarget();
          return {
            scope: Object.keys(oauthScopes).join(" "),
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
      Grant: 30 * 86400,
      Session: 86400,
      RefreshToken: ctx => {
        const remaining = (ctx.oidc.entities.Grant?.exp ?? 0) - Math.floor(Date.now() / 1000);
        if (remaining <= 0) throw new errors.InvalidGrant();
        return Math.min(remaining, 30 * 86400);
      },
    },
    interactions: { url: (_ctx, interaction) => `${config.issuer}/interaction/${interaction.uid}` },
    findAccount: async (_ctx, id) =>
      (await accountExists(id)) ? { accountId: id, claims: async () => ({ sub: id }) } : undefined,
  });
  provider.proxy = true;
  return provider;
}
