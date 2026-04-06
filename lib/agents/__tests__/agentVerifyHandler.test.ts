import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentVerifyHandler } from "@/lib/agents/agentVerifyHandler";

import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

vi.mock("@/lib/keys/generateApiKey", () => ({
  generateApiKey: vi.fn(() => "recoup_sk_verified123"),
}));

vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((input: string) => `hashed_${input}`),
}));

vi.mock("@/lib/supabase/account_api_keys/insertApiKey", () => ({
  insertApiKey: vi.fn(() => ({ data: {}, error: null })),
}));

vi.mock("@/lib/privy/getPrivyUserByEmail", () => ({
  getPrivyUserByEmail: vi.fn(),
}));

vi.mock("@/lib/privy/setPrivyCustomMetadata", () => ({
  setPrivyCustomMetadata: vi.fn(),
}));

describe("agentVerifyHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_SECRET = "test-secret";
  });

  it("returns api_key on correct code", async () => {
    const codeHash = "hashed_123456";
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({
      id: "privy_123",
      custom_metadata: {
        verification_code_hash: codeHash,
        verification_expires_at: new Date(Date.now() + 60000).toISOString(),
        verification_attempts: 0,
      },
    });
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: "acc_123",
      email: "user@example.com",
    } as unknown as Awaited<ReturnType<typeof selectAccountByEmail>>);

    const result = await agentVerifyHandler({ email: "user@example.com", code: "123456" });
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.account_id).toBe("acc_123");
    expect(body.api_key).toBe("recoup_sk_verified123");
    expect(body.message).toBe("Verified");
    expect(setPrivyCustomMetadata).toHaveBeenCalledWith("privy_123", {});
  });

  it("returns 400 for wrong code", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({
      id: "privy_123",
      custom_metadata: {
        verification_code_hash: "hashed_correct_code",
        verification_expires_at: new Date(Date.now() + 60000).toISOString(),
        verification_attempts: 0,
      },
    });

    const result = await agentVerifyHandler({ email: "user@example.com", code: "wrong" });

    expect(result.status).toBe(400);
    expect(setPrivyCustomMetadata).toHaveBeenCalledWith(
      "privy_123",
      expect.objectContaining({
        verification_attempts: 1,
      }),
    );
  });

  it("returns 429 after 5 failed attempts", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({
      id: "privy_123",
      custom_metadata: {
        verification_code_hash: "hashed_code",
        verification_expires_at: new Date(Date.now() + 60000).toISOString(),
        verification_attempts: 5,
      },
    });

    const result = await agentVerifyHandler({ email: "user@example.com", code: "123456" });

    expect(result.status).toBe(429);
  });

  it("returns 400 for expired code", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({
      id: "privy_123",
      custom_metadata: {
        verification_code_hash: "hashed_123456",
        verification_expires_at: new Date(Date.now() - 1000).toISOString(),
        verification_attempts: 0,
      },
    });

    const result = await agentVerifyHandler({ email: "user@example.com", code: "123456" });

    expect(result.status).toBe(400);
  });

  it("returns 400 when no privy user found", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue(null);

    const result = await agentVerifyHandler({ email: "user@example.com", code: "123456" });

    expect(result.status).toBe(400);
  });

  it("returns 400 when no verification code stored", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({
      id: "privy_123",
      custom_metadata: {},
    });

    const result = await agentVerifyHandler({ email: "user@example.com", code: "123456" });

    expect(result.status).toBe(400);
  });
});
