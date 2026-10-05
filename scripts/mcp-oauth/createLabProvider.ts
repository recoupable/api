import { generateKeyPairSync, randomBytes } from "node:crypto";
import { Provider, errors } from "oidc-provider";

/**
 * Test-only OAuth implementation spike. Never mount this factory in an application route:
 * it uses ephemeral signing keys and the provider's in-memory adapter.
 *
 * @param issuer - Loopback HTTP issuer of the isolated fixture.
 * @returns Provider configured to exercise the required protocol features.
 */
export function createLabProvider(
  issuer: string,
  metadataDocuments: Map<string, Record<string, unknown>> = new Map(),
) {
  const url = new URL(issuer);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("The OAuth compatibility lab must use an IPv4 loopback HTTP issuer");
  }
  const resource = `${issuer}/mcp`;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return new Provider(issuer, {
    jwks: {
      keys: [
        { ...privateKey.export({ format: "jwk" }), kid: "lab-only", use: "sig", alg: "RS256" },
      ],
    },
    cookies: { keys: [randomBytes(32).toString("hex")] },
    clients: [
      {
        client_id: "pre-registered-agent",
        redirect_uris: ["https://agent.example/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    ],
    fetch: async input => {
      const document = metadataDocuments.get(String(input));
      if (!document) throw new Error("Unexpected outbound request in OAuth lab");
      return Response.json(document);
    },
    fetchResponseBodyLimits: { "client_id metadata document": 16_384 },
    scopes: ["openid", "offline_access", "mcp:read", "mcp:write"],
    responseTypes: ["code"],
    pkce: { required: () => true },
    features: {
      devInteractions: { enabled: false },
      registration: { enabled: true },
      revocation: { enabled: true },
      clientIdMetadataDocument: {
        enabled: true,
        ack: "draft-02",
        // Exercise CIMD resolution using explicit synthetic HTTPS documents; never access the network.
        allowFetch: async (_ctx, clientId) => metadataDocuments.has(clientId),
      },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => resource,
        useGrantedResource: () => true,
        getResourceServerInfo: (_ctx, indicator) => {
          if (indicator !== resource) throw new errors.InvalidTarget();
          return {
            scope: "mcp:read mcp:write",
            audience: resource,
            accessTokenTTL: 300,
            accessTokenFormat: "opaque",
          };
        },
      },
    },
    // Synthetic consent explicitly includes persistent access; MCP clients need not send OIDC prompt=consent.
    issueRefreshToken: (_ctx, client) => client.grantTypeAllowed("refresh_token"),
    rotateRefreshToken: true,
    expiresWithSession: () => false,
    ttl: {
      AccessToken: 300,
      AuthorizationCode: 60,
      Interaction: 300,
      Grant: 3600,
      RefreshToken: 3600,
      Session: 3600,
    },
    interactions: { url: (_ctx, interaction) => `/interaction/${interaction.uid}` },
    findAccount: async (_ctx, id) =>
      id === "synthetic-account" ? { accountId: id, claims: async () => ({ sub: id }) } : undefined,
  });
}
