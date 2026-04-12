import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";

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

describe("createAccountWithEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates account, inserts email, credits, and assigns to org", async () => {
    vi.mocked(insertAccount).mockResolvedValue({ id: "acc_new" } as unknown as Awaited<
      ReturnType<typeof insertAccount>
    >);

    const result = await createAccountWithEmail("user@example.com");

    expect(result).toBe("acc_new");
    expect(insertAccount).toHaveBeenCalledOnce();
    expect(insertAccountEmail).toHaveBeenCalledWith("acc_new", "user@example.com");
    expect(insertCreditsUsage).toHaveBeenCalledWith("acc_new");
    expect(assignAccountToOrg).toHaveBeenCalledWith("acc_new", "user@example.com");
  });
});
