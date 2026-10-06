import { describe, expect, it } from "vitest";
import { createOAuthCipher } from "../createOAuthCipher";
const key = Buffer.alloc(32, 1);
const context = ["issuer", "AuthorizationCode", "a".repeat(64)] as const;
describe("OAuth authenticated encryption", () => {
  it("round trips with random nonces and no plaintext", () => {
    const cipher = createOAuthCipher({ activeKeyId: "k1", keys: { k1: key } });
    const first = cipher.encrypt({ accountId: "private-account" }, context);
    expect(first).not.toContain("private-account");
    expect(first).not.toBe(cipher.encrypt({ accountId: "private-account" }, context));
    expect(cipher.decrypt(first, context)).toEqual({ accountId: "private-account" });
  });
  it("rejects tampering and records moved across issuer, model or ID", () => {
    const cipher = createOAuthCipher({ activeKeyId: "k1", keys: { k1: key } });
    const envelope = cipher.encrypt({ accountId: "secret" }, context);
    for (let index = 0; index < 3; index++) {
      const wrong = [...context] as [string, string, string];
      wrong[index] = "other";
      expect(() => cipher.decrypt(envelope, wrong)).toThrow("Invalid OAuth ciphertext");
    }
    const parts = envelope.split(".");
    parts[4] = Buffer.from("tampered").toString("base64url");
    expect(() => cipher.decrypt(parts.join("."), context)).toThrow("Invalid OAuth ciphertext");
  });
  it("reads old keys during rotation and rejects retired or malformed keys", () => {
    const old = createOAuthCipher({ activeKeyId: "old", keys: { old: key } });
    const rotated = createOAuthCipher({
      activeKeyId: "new",
      keys: { old: key, new: Buffer.alloc(32, 2) },
    });
    expect(rotated.decrypt(old.encrypt({ a: 1 }, context), context)).toEqual({ a: 1 });
    expect(rotated.encrypt({}, context)).toMatch(/^v1.new\./);
    expect(() => old.decrypt(rotated.encrypt({}, context), context)).toThrow(
      "Invalid OAuth ciphertext",
    );
    expect(() => createOAuthCipher({ activeKeyId: "missing", keys: {} })).toThrow();
    expect(() =>
      createOAuthCipher({ activeKeyId: "bad", keys: { bad: Buffer.alloc(16) } }),
    ).toThrow();
  });
});
