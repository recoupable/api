import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type Context = readonly [namespace: string, model: string, idHash: string];

/** Versioned authenticated encryption; keep old keys available until their records expire. */
export function createOAuthCipher(config: { activeKeyId: string; keys: Record<string, Buffer> }) {
  const keys = new Map(Object.entries(config.keys).map(([id, key]) => [id, Buffer.from(key)]));
  if (
    !keys.has(config.activeKeyId) ||
    [...keys].some(([id, key]) => !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || key.length !== 32)
  ) {
    throw new Error("Invalid OAuth encryption configuration");
  }
  return {
    encrypt(payload: Record<string, unknown>, context: Context): string {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", keys.get(config.activeKeyId)!, nonce);
      cipher.setAAD(Buffer.from(JSON.stringify(context)));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
      ]);
      const result = [
        "v1",
        config.activeKeyId,
        nonce.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        encrypted.toString("base64url"),
      ].join(".");
      if (Buffer.byteLength(result) > 262144) throw new Error("OAuth record exceeds storage limit");
      return result;
    },
    decrypt(envelope: string, context: Context): Record<string, unknown> {
      try {
        if (typeof envelope !== "string" || envelope.length > 262144) throw new Error();
        const parts = envelope.split(".");
        if (
          parts.length !== 5 ||
          parts[0] !== "v1" ||
          parts.slice(1).some(part => !/^[a-zA-Z0-9_-]+$/.test(part))
        )
          throw new Error();
        const key = keys.get(parts[1]);
        const nonce = Buffer.from(parts[2], "base64url");
        const tag = Buffer.from(parts[3], "base64url");
        if (!key || nonce.length !== 12 || tag.length !== 16) throw new Error();
        const decipher = createDecipheriv("aes-256-gcm", key, nonce);
        decipher.setAAD(Buffer.from(JSON.stringify(context)));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(parts[4], "base64url")),
          decipher.final(),
        ]);
        const payload = JSON.parse(plaintext.toString("utf8"));
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
        return payload;
      } catch {
        // Never expose provider payloads, encryption material, or crypto-library errors.
        throw new Error("Invalid OAuth ciphertext");
      }
    },
  };
}
