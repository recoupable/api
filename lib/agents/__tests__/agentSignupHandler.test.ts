import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { agentSignupHandler } from "@/lib/agents/agentSignupHandler";

import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";

/**
 * Builds a NextRequest for the agent signup endpoint with the given body.
 *
 * @param body - The request body to serialize
 * @returns A NextRequest targeting `/api/agents/signup`
 */
function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/insertAccount", () => ({
  insertAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/insertAccountEmail", () => ({
  insertAccountEmail: vi.fn(() => ({ id: "ae_1" })),
}));

vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({
  insertCreditsUsage: vi.fn(() => ({ id: "cu_1" })),
}));

vi.mock("@/lib/keys/generateApiKey", () => ({
  generateApiKey: vi.fn(() => "recoup_sk_test123"),
}));

vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn(() => "hashed_key"),
}));

vi.mock("@/lib/supabase/account_api_keys/insertApiKey", () => ({
  insertApiKey: vi.fn(() => ({ data: {}, error: null })),
}));

vi.mock("@/lib/privy/createPrivyUser", () => ({
  createPrivyUser: vi.fn(() => ({ id: "privy_user_123" })),
}));

vi.mock("@/lib/privy/getPrivyUserByEmail", () => ({
  getPrivyUserByEmail: vi.fn(),
}));

vi.mock("@/lib/privy/setPrivyCustomMetadata", () => ({
  setPrivyCustomMetadata: vi.fn(),
}));

vi.mock("@/lib/agents/sendVerificationEmail", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomInt: vi.fn(() => 123456),
  };
});

describe("agentSignupHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_SECRET = "test-secret";
  });

  describe("agent+ prefix email (new account)", () => {
    it("returns api_key immediately for new agent+ email", async () => {
      vi.mocked(selectAccountByEmail).mockResolvedValue(null);
      vi.mocked(insertAccount).mockResolvedValue({ id: "acc_123" } as unknown as Awaited<
        ReturnType<typeof insertAccount>
      >);

      const result = await agentSignupHandler(buildRequest({ email: "agent+bot@example.com" }));
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body.account_id).toBe("acc_123");
      expect(body.api_key).toBe("recoup_sk_test123");
      expect(body.message).toBeTruthy();
    });
  });

  describe("existing account", () => {
    it("sends verification code and returns null api_key", async () => {
      vi.mocked(selectAccountByEmail).mockResolvedValue({
        account_id: "acc_existing",
        email: "user@example.com",
      } as unknown as Awaited<ReturnType<typeof selectAccountByEmail>>);
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({ id: "privy_456" });

      const result = await agentSignupHandler(buildRequest({ email: "user@example.com" }));
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body.account_id).toBe("acc_existing");
      expect(body.api_key).toBeNull();
    });
  });

  describe("normal email (new account)", () => {
    it("creates account and sends verification code", async () => {
      vi.mocked(selectAccountByEmail).mockResolvedValue(null);
      vi.mocked(insertAccount).mockResolvedValue({ id: "acc_new" } as unknown as Awaited<
        ReturnType<typeof insertAccount>
      >);
      vi.mocked(getPrivyUserByEmail).mockResolvedValue(null);

      const result = await agentSignupHandler(buildRequest({ email: "user@example.com" }));
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body.account_id).toBe("acc_new");
      expect(body.api_key).toBeNull();
    });

    it("generates verification code with inclusive upper bound (100000 <= code <= 999999)", async () => {
      vi.mocked(selectAccountByEmail).mockResolvedValue(null);
      vi.mocked(insertAccount).mockResolvedValue({ id: "acc_new" } as unknown as Awaited<
        ReturnType<typeof insertAccount>
      >);
      vi.mocked(getPrivyUserByEmail).mockResolvedValue(null);

      await agentSignupHandler(buildRequest({ email: "user@example.com" }));

      // Node's randomInt upper bound is exclusive. Using 1000000 covers 999999
      // as a possible value; using 999999 would never generate it.
      expect(randomInt).toHaveBeenCalledWith(100000, 1000000);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing email", async () => {
      const result = await agentSignupHandler(buildRequest({}));
      expect(result.status).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const result = await agentSignupHandler(buildRequest({ email: "not-an-email" }));
      expect(result.status).toBe(400);
    });
  });
});
