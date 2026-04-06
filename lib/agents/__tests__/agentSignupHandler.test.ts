import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentSignupHandler } from "@/lib/agents/agentSignupHandler";

import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";

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
  insertAccountEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({
  insertCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/organizations/assignAccountToOrg", () => ({
  assignAccountToOrg: vi.fn(),
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

      const result = await agentSignupHandler({ email: "agent+bot@example.com" });
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

      const result = await agentSignupHandler({ email: "user@example.com" });
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

      const result = await agentSignupHandler({ email: "user@example.com" });
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body.account_id).toBe("acc_new");
      expect(body.api_key).toBeNull();
    });
  });
});
