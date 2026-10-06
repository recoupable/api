import type { AdapterFactory } from "oidc-provider";
import { z } from "zod";
import type { OAuthRuntimeConfig } from "./loadOAuthConfig";
import type { OAuthStore, OAuthStoredRecord } from "./OAuthStore";
import { hashOAuthIdentifier } from "./hashOAuthIdentifier";

const schema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string(),
  grantId: z.string(),
  extra: z.object({
    clientName: z.string(),
    context: z.literal("personal"),
    scopes: z.array(z.string()),
    createdAt: z.number().int(),
    expiresAt: z.number().int(),
  }),
});

/** Read and revoke only grants owned by the verified account; never return credentials. */
export function createOAuthConnections(
  config: OAuthRuntimeConfig,
  store: OAuthStore,
  adapter: AdapterFactory,
) {
  const hash = (id: string) => hashOAuthIdentifier(config.issuer, config.indexKey, id);
  const decode = (accountId: string, record: OAuthStoredRecord) => {
    const payload = schema.parse(
      config.cipher.decrypt(record.payload, [config.issuer, "RecoupGrant", record.id_hash]),
    );
    if (payload.accountId !== accountId || hash(payload.grantId) !== record.id_hash)
      throw new Error("Connection access denied");
    return payload;
  };
  return {
    async list(accountId: string) {
      if (!store.listConnections) throw new Error("Connection storage unavailable");
      const records = await store.listConnections(config.issuer, hash(accountId));
      return {
        connections: records.map(record => {
          const payload = decode(accountId, record);
          return {
            id: record.id_hash,
            clientId: payload.clientId,
            clientName: payload.extra.clientName,
            scopes: payload.extra.scopes,
            createdAt: payload.extra.createdAt,
            expiresAt: payload.extra.expiresAt,
          };
        }),
        truncated: records.length === 200,
      };
    },
    async revoke(accountId: string, connectionId: string) {
      if (!/^[a-f0-9]{64}$/.test(connectionId)) throw new Error("Invalid connection");
      const record = await store.find({
        namespace: config.issuer,
        model: "RecoupGrant",
        index: "id",
        hash: connectionId,
      });
      if (!record) return;
      const payload = decode(accountId, record);
      await adapter("Grant").revokeByGrantId(payload.grantId);
    },
  };
}
