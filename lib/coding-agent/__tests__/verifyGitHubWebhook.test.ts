import { describe, it, expect } from "vitest";
import { verifyGitHubWebhook } from "../verifyGitHubWebhook";

describe("verifyGitHubWebhook", () => {
  const secret = "test-webhook-secret";

  it("returns true for a valid signature", async () => {
    const body = '{"action":"created"}';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    const signature = `sha256=${hex}`;

    const result = await verifyGitHubWebhook(body, signature, secret);
    expect(result).toBe(true);
  });

  it("returns false for an invalid signature", async () => {
    const result = await verifyGitHubWebhook('{"action":"created"}', "sha256=bad", secret);
    expect(result).toBe(false);
  });

  it("returns false for missing signature", async () => {
    const result = await verifyGitHubWebhook('{"action":"created"}', "", secret);
    expect(result).toBe(false);
  });
});
