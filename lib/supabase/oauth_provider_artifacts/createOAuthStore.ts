import { z } from "zod";
import type { OAuthStore } from "../../oauth/OAuthStore";

export type OAuthRpc = (
  name: string,
  args: Record<string, string | number | null>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const storedRecord = z
  .object({
    id_hash: z.string().regex(/^[a-f0-9]{64}$/),
    payload: z.string().max(262144),
    consumed: z.number().int().nonnegative().nullable(),
  })
  .nullable();

/** Map the provider store to migration-owned RPCs; callers supply the server-only RPC client. */
export function createOAuthStore(rpc: OAuthRpc): OAuthStore {
  const call = async (name: string, args: Record<string, string | number | null>) => {
    try {
      const response = await rpc(name, args);
      if (response.error) throw new Error();
      return response.data;
    } catch {
      throw new Error("OAuth storage unavailable");
    }
  };
  const keyArgs = (key: { namespace: string; model: string; idHash: string }) => ({
    p_namespace: key.namespace,
    p_model: key.model,
    p_id_hash: key.idHash,
  });
  return {
    async upsert(record) {
      await call("oauth_store_upsert", {
        ...keyArgs(record),
        p_payload: record.payload,
        p_expires_in: record.expiresIn,
        p_grant_hash: record.grantHash,
        p_uid_hash: record.uidHash,
        p_user_code_hash: record.userCodeHash,
        ...(record.accountHash ? { p_account_hash: record.accountHash } : {}),
      });
    },
    async find(query) {
      const result = storedRecord.safeParse(
        await call("oauth_store_find", {
          p_namespace: query.namespace,
          p_model: query.model,
          p_index: query.index,
          p_hash: query.hash,
        }),
      );
      if (!result.success) throw new Error("Invalid OAuth storage response");
      return result.data as Awaited<ReturnType<OAuthStore["find"]>>;
    },
    async consume(key) {
      const result = await call("oauth_store_consume", keyArgs(key));
      if (typeof result !== "boolean") throw new Error("Invalid OAuth storage response");
      return result;
    },
    async destroy(key) {
      await call("oauth_store_destroy", keyArgs(key));
    },
    async revokeGrant(namespace, grantHash) {
      await call("oauth_store_revoke_grant", { p_namespace: namespace, p_grant_hash: grantHash });
    },
    async listConnections(namespace, accountHash) {
      const result = z
        .array(storedRecord.unwrap())
        .max(200)
        .safeParse(
          await call("oauth_store_list_connections", {
            p_namespace: namespace,
            p_account_hash: accountHash,
          }),
        );
      if (!result.success) throw new Error("Invalid OAuth storage response");
      return result.data.map(record => ({ ...record, consumed: record.consumed ?? null }));
    },
  };
}
