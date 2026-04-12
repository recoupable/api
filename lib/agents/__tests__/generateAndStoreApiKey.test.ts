import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateAndStoreApiKey } from "@/lib/agents/generateAndStoreApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";

vi.mock("@/lib/keys/generateApiKey", () => ({
  generateApiKey: vi.fn(() => "recoup_sk_test123"),
}));

vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((input: string) => `hashed_${input}`),
}));

vi.mock("@/lib/supabase/account_api_keys/insertApiKey", () => ({
  insertApiKey: vi.fn(() => ({ data: {}, error: null })),
}));

describe("generateAndStoreApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_SECRET = "test-secret";
  });

  it("generates a raw key, hashes it, inserts it, and returns the raw key", async () => {
    const rawKey = await generateAndStoreApiKey("acc_123");

    expect(rawKey).toBe("recoup_sk_test123");
    expect(insertApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acc_123",
        key_hash: "hashed_recoup_sk_test123",
      }),
    );
  });

  it("throws when insertApiKey returns an error so the caller cannot leak an unpersisted key", async () => {
    vi.mocked(insertApiKey).mockResolvedValueOnce({
      data: null,
      error: { message: "DB write failed" },
    } as unknown as Awaited<ReturnType<typeof insertApiKey>>);

    await expect(generateAndStoreApiKey("acc_123")).rejects.toThrow(/DB write failed/);
  });
});
