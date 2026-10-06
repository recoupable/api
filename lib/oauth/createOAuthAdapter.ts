import { createHmac } from "node:crypto";
import type { AdapterFactory, AdapterPayload } from "oidc-provider";
import type { OAuthStore } from "./OAuthStore";
import type { createOAuthCipher } from "./createOAuthCipher";

/** Build durable provider adapters. The index key is stable across encryption-key rotation. */
export function createOAuthAdapter(options: {
  namespace: string;
  indexKey: Buffer;
  cipher: ReturnType<typeof createOAuthCipher>;
  store: OAuthStore;
  invalidGrant: () => Error;
}): AdapterFactory {
  const { namespace, cipher, store } = options;
  const indexKey = Buffer.from(options.indexKey);
  if (!namespace || namespace.length > 512 || indexKey.length !== 32)
    throw new Error("Invalid OAuth adapter configuration");
  const hash = (value: string) =>
    createHmac("sha256", indexKey)
      .update(JSON.stringify([namespace, value]))
      .digest("hex");
  const safe = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch {
      throw new Error("OAuth storage unavailable");
    }
  };
  return model => {
    if (!/^[A-Za-z][A-Za-z0-9]{0,99}$/.test(model)) throw new Error("Invalid OAuth model");
    const key = (id: string) => ({ namespace, model, idHash: hash(id) });
    const find = async (
      index: "id" | "uid" | "user_code",
      id: string,
    ): Promise<AdapterPayload | undefined> => {
      const target = hash(id);
      const record = await safe(() => store.find({ namespace, model, index, hash: target }));
      if (!record) return undefined;
      if (!/^[a-f0-9]{64}$/.test(record.id_hash) || (index === "id" && record.id_hash !== target))
        throw new Error("Invalid OAuth record binding");
      const payload = cipher.decrypt(record.payload, [namespace, model, record.id_hash]);
      const secondary = index === "uid" ? payload.uid : payload.userCode;
      if (index !== "id" && (typeof secondary !== "string" || hash(secondary) !== target))
        throw new Error("Invalid OAuth record binding");
      delete payload.consumed;
      if (record.consumed !== null) {
        if (!Number.isSafeInteger(record.consumed) || record.consumed < 0)
          throw new Error("Invalid OAuth consumption marker");
        payload.consumed = record.consumed;
      }
      return payload as AdapterPayload;
    };
    return {
      async upsert(id, payload, expiresIn) {
        if (
          (expiresIn === undefined && model !== "Client") ||
          (expiresIn !== undefined &&
            (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 2678400))
        )
          throw new Error("Invalid OAuth artifact lifetime");
        const recordKey = key(id);
        const clean = { ...payload };
        delete clean.consumed;
        await safe(() =>
          store.upsert({
            ...recordKey,
            payload: cipher.encrypt(clean, [namespace, model, recordKey.idHash]),
            expiresIn: expiresIn ?? null,
            grantHash:
              model === "Grant" ? recordKey.idHash : payload.grantId ? hash(payload.grantId) : null,
            uidHash: payload.uid ? hash(payload.uid) : null,
            userCodeHash: payload.userCode ? hash(payload.userCode) : null,
          }),
        );
      },
      find: id => find("id", id),
      findByUid: id => find("uid", id),
      findByUserCode: id => find("user_code", id),
      async consume(id) {
        if (!(await safe(() => store.consume(key(id))))) throw options.invalidGrant();
      },
      destroy: id => safe(() => store.destroy(key(id))),
      revokeByGrantId: id => safe(() => store.revokeGrant(namespace, hash(id))),
    };
  };
}
