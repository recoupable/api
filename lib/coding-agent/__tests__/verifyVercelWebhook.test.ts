import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyVercelWebhook } from "../verifyVercelWebhook";

describe("verifyVercelWebhook", () => {
  const secret = "whsec_test123";
  const body = '{"type":"deployment.error","id":"evt_1"}';

  /**
   * Signs a body with a secret using HMAC-SHA1.
   *
   * @param rawBody - The body to sign
   * @param rawSecret - The secret key
   * @returns The hex signature
   */
  function sign(rawBody: string, rawSecret: string): string {
    return crypto.createHmac("sha1", rawSecret).update(rawBody).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const signature = sign(body, secret);
    expect(verifyVercelWebhook(body, signature, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(verifyVercelWebhook(body, "invalid_sig", secret)).toBe(false);
  });

  it("returns false for an empty signature", () => {
    expect(verifyVercelWebhook(body, "", secret)).toBe(false);
  });

  it("returns false when body is tampered", () => {
    const signature = sign(body, secret);
    expect(verifyVercelWebhook(body + "tampered", signature, secret)).toBe(false);
  });

  it("returns false when wrong secret is used", () => {
    const signature = sign(body, "wrong_secret");
    expect(verifyVercelWebhook(body, signature, secret)).toBe(false);
  });
});
