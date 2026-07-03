import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  mintEphemeralAccountKey,
  DEFAULT_EPHEMERAL_KEY_TTL_MS,
} from "@/lib/keys/mintEphemeralAccountKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";

vi.mock("@/lib/keys/generateApiKey", () => ({
  generateApiKey: vi.fn(() => "recoup_sk_RAW"),
}));
vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn(() => "hashed"),
}));
vi.mock("@/lib/supabase/account_api_keys/insertApiKey", () => ({
  insertApiKey: vi.fn(),
}));
vi.mock("@/lib/const", () => ({ PRIVY_PROJECT_SECRET: "secret" }));

describe("mintEphemeralAccountKey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults the ephemeral TTL to 60 minutes (long runs with step retries outlive 15m — chat#1839)", () => {
    expect(DEFAULT_EPHEMERAL_KEY_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("mints an account-scoped recoup_sk_ key with the default expiry and returns rawKey + keyId", async () => {
    vi.mocked(insertApiKey).mockResolvedValue({ data: { id: "key-1" }, error: null } as never);

    const before = Date.now();
    const result = await mintEphemeralAccountKey("acc-1");
    const after = Date.now();

    expect(result).toEqual({ rawKey: "recoup_sk_RAW", keyId: "key-1" });

    const arg = vi.mocked(insertApiKey).mock.calls[0][0];
    expect(arg.account).toBe("acc-1");
    expect(arg.key_hash).toBe("hashed");
    const expMs = new Date(arg.expires_at as string).getTime();
    expect(expMs).toBeGreaterThanOrEqual(before + DEFAULT_EPHEMERAL_KEY_TTL_MS);
    expect(expMs).toBeLessThanOrEqual(after + DEFAULT_EPHEMERAL_KEY_TTL_MS);
  });

  it("throws when the insert fails", async () => {
    vi.mocked(insertApiKey).mockResolvedValue({ data: null, error: { message: "boom" } } as never);
    await expect(mintEphemeralAccountKey("acc-1")).rejects.toThrow(/mint/i);
  });
});
