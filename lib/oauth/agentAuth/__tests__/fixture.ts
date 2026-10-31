import { generateKeyPairSync } from "node:crypto";
import { errors } from "oidc-provider";
import { createOAuthAdapter } from "../../createOAuthAdapter";
import { createOAuthCipher } from "../../createOAuthCipher";
import { createRecoupOAuthProvider } from "../../createRecoupOAuthProvider";
import type { OAuthStore } from "../../OAuthStore";
import type { OAuthRuntimeConfig } from "../../loadOAuthConfig";
import { createAgentRegistrationService } from "../createAgentRegistrationService";

const signingKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  format: "jwk",
});
export const identity = {
  accountId: "00000000-0000-4000-8000-000000000001",
  subject: "did:privy:alice",
  verifiedEmails: ["alice@example.com"],
};

/** Real provider models and crypto, with a deterministic clock and isolated storage. */
export function fixture(port = 43333, durableStore?: OAuthStore) {
  let clock = Math.floor(Date.now() / 1000);
  let exists = true;
  const records = new Map<
    string,
    Parameters<OAuthStore["upsert"]>[0] & { consumed: number | null; deadline: number }
  >();
  const revoked = new Set<string>();
  const key = (q: { namespace: string; model: string; idHash: string }) =>
    JSON.stringify([q.namespace, q.model, q.idHash]);
  const store: OAuthStore = durableStore ?? {
    async purgeAgentRegistrations(namespace) {
      const expired = new Set(
        [...records.values()]
          .filter(
            r =>
              r.namespace === namespace &&
              r.model === "RecoupAgentRegistration" &&
              r.deadline <= clock,
          )
          .slice(0, 100)
          .map(r => r.idHash),
      );
      let deleted = 0;
      for (const [id, row] of records)
        if (
          row.namespace === namespace &&
          row.grantHash &&
          expired.has(row.grantHash) &&
          row.deadline <= clock
        ) {
          records.delete(id);
          deleted++;
        }
      return deleted;
    },
    async upsert(row) {
      if (row.grantHash && revoked.has(row.grantHash)) throw new Error("revoked");
      records.set(key(row), {
        ...row,
        consumed: records.get(key(row))?.consumed ?? null,
        deadline: row.expiresIn === null ? Infinity : clock + row.expiresIn,
      });
    },
    async find(q) {
      const row = [...records.values()].find(
        r =>
          r.namespace === q.namespace &&
          r.model === q.model &&
          r[q.index === "id" ? "idHash" : q.index === "uid" ? "uidHash" : "userCodeHash"] ===
            q.hash,
      );
      if (!row || row.deadline <= clock || (row.grantHash && revoked.has(row.grantHash)))
        return null;
      return { id_hash: row.idHash, payload: row.payload, consumed: row.consumed };
    },
    async consume(q) {
      const row = records.get(key(q));
      if (!row || row.consumed !== null || row.deadline <= clock) return false;
      row.consumed = clock;
      return true;
    },
    async compareAndSwap(q) {
      const row = records.get(key(q));
      if (
        !row ||
        row.payload !== q.expectedPayload ||
        row.deadline <= clock ||
        (row.grantHash && revoked.has(row.grantHash))
      )
        return false;
      row.payload = q.payload;
      return true;
    },
    async destroy(q) {
      records.delete(key(q));
    },
    async revokeGrant(namespace, hash) {
      revoked.add(hash);
      for (const [id, row] of records)
        if (row.namespace === namespace && row.grantHash === hash) records.delete(id);
    },
    async listConnections(namespace, hash) {
      return [...records.values()]
        .filter(
          r =>
            r.namespace === namespace &&
            r.model === "RecoupGrant" &&
            r.accountHash === hash &&
            r.deadline > clock,
        )
        .map(r => ({ id_hash: r.idHash, payload: r.payload, consumed: r.consumed }));
    },
  };
  const config: OAuthRuntimeConfig = {
    issuer: `http://127.0.0.1:${port}/api/oauth`,
    resource: `http://127.0.0.1:${port}/mcp`,
    consentUrl: "http://127.0.0.1:43334/oauth/authorize",
    consentOrigin: "http://127.0.0.1:43334",
    cookieKeys: ["test-cookie-key"],
    cipher: createOAuthCipher({ activeKeyId: "test", keys: { test: Buffer.alloc(32, 2) } }),
    indexKey: Buffer.alloc(32, 1),
    jwks: { keys: [{ ...signingKey, kid: "fixture", use: "sig", alg: "RS256" }] },
    agentAuthEnabled: true,
  };
  const adapter = createOAuthAdapter({
    namespace: config.issuer,
    indexKey: config.indexKey,
    cipher: config.cipher,
    store,
    invalidGrant: () => new errors.InvalidGrant(),
  });
  const accountExists = async () => exists;
  const provider = createRecoupOAuthProvider(config, adapter, accountExists);
  const service = createAgentRegistrationService({
    config,
    adapter,
    store,
    provider,
    accountExists,
    now: () => clock,
  });
  return {
    service,
    records,
    config,
    adapter,
    store,
    provider,
    resource: config.resource,
    accountExists,
    tick: (seconds: number) => {
      clock += seconds;
    },
    deleteAccount: () => {
      exists = false;
    },
  };
}
