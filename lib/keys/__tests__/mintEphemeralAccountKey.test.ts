import { describe, it, expect, vi, beforeEach } from "vitest";
import { mintEphemeralAccountKey } from "@/lib/keys/mintEphemeralAccountKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";

vi.mock("@/lib/const", () => ({ PRIVY_PROJECT_SECRET: "test_secret" }));
vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((k: string) => `hashed_${k}`),
}));
vi.mock("@/lib/supabase/account_api_keys/insertApiKey", () => ({
  insertApiKey: vi.fn(),
}));

describe("mintEphemeralAccountKey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts an account-scoped recoup_sk_ key with a future expiry and returns the raw key + id", async () => {
    vi.mocked(insertApiKey).mockResolvedValue({ data: { id: "key-1" } as never, error: null });
    const ttlMs = 15 * 60 * 1000;
    const before = Date.now();

    const result = await mintEphemeralAccountKey("acc-1", {
      ttlMs,
      name: "ephemeral:report:run-1",
    });

    expect(result.rawKey).toMatch(/^recoup_sk_/);
    expect(result.keyId).toBe("key-1");

    const arg = vi.mocked(insertApiKey).mock.calls[0][0];
    expect(arg.account).toBe("acc-1");
    expect(arg.name).toBe("ephemeral:report:run-1");
    expect(arg.key_hash).toBe(`hashed_${result.rawKey}`);
    const exp = Date.parse(arg.expires_at as string);
    expect(exp).toBeGreaterThan(before);
    expect(exp).toBeLessThanOrEqual(Date.now() + ttlMs + 1000);
  });

  it("throws if the insert fails", async () => {
    vi.mocked(insertApiKey).mockResolvedValue({ data: null, error: { message: "boom" } as never });
    await expect(mintEphemeralAccountKey("acc-1")).rejects.toThrow(/mint/i);
  });
});
