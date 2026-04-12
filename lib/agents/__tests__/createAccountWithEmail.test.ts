import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";

vi.mock("@/lib/supabase/accounts/insertAccount", () => ({
  insertAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/insertAccountEmail", () => ({
  insertAccountEmail: vi.fn(() => ({ id: "ae_1" })),
}));

vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({
  insertCreditsUsage: vi.fn(() => ({ id: "cu_1" })),
}));

describe("createAccountWithEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertAccount).mockResolvedValue({ id: "acc_new" } as unknown as Awaited<
      ReturnType<typeof insertAccount>
    >);
    vi.mocked(insertAccountEmail).mockResolvedValue({
      id: "ae_1",
    } as unknown as Awaited<ReturnType<typeof insertAccountEmail>>);
    vi.mocked(insertCreditsUsage).mockResolvedValue({
      id: "cu_1",
    } as unknown as Awaited<ReturnType<typeof insertCreditsUsage>>);
  });

  it("creates the account, inserts the email link and credits row, and returns the new account id", async () => {
    const result = await createAccountWithEmail("user@example.com");

    expect(result).toBe("acc_new");
    expect(insertAccount).toHaveBeenCalledOnce();
    expect(insertAccountEmail).toHaveBeenCalledWith("acc_new", "user@example.com");
    expect(insertCreditsUsage).toHaveBeenCalledWith("acc_new");
  });

  it("throws when insertAccountEmail returns null so the caller cannot end up with an emailless account", async () => {
    vi.mocked(insertAccountEmail).mockResolvedValueOnce(
      null as unknown as Awaited<ReturnType<typeof insertAccountEmail>>,
    );

    await expect(createAccountWithEmail("user@example.com")).rejects.toThrow(/insertAccountEmail/);
  });

  it("throws when insertCreditsUsage returns null", async () => {
    vi.mocked(insertCreditsUsage).mockResolvedValueOnce(
      null as unknown as Awaited<ReturnType<typeof insertCreditsUsage>>,
    );

    await expect(createAccountWithEmail("user@example.com")).rejects.toThrow(/insertCreditsUsage/);
  });
});
