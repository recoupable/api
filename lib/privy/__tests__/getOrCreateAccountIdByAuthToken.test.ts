import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { getEmailByAuthToken } from "@/lib/privy/getEmailByAuthToken";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";

vi.mock("@/lib/privy/getEmailByAuthToken", () => ({
  getEmailByAuthToken: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/agents/createAccountWithEmail", () => ({
  createAccountWithEmail: vi.fn(),
}));

describe("getOrCreateAccountIdByAuthToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing accountId when account_emails has a row", async () => {
    vi.mocked(getEmailByAuthToken).mockResolvedValue("existing@example.com");
    vi.mocked(selectAccountEmails).mockResolvedValue([
      { account_id: "acc-existing", email: "existing@example.com" } as never,
    ]);

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(accountId).toBe("acc-existing");
    expect(createAccountWithEmail).not.toHaveBeenCalled();
  });

  it("creates an account and returns the new accountId when email is unknown", async () => {
    vi.mocked(getEmailByAuthToken).mockResolvedValue("new@example.com");
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc-new");

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(createAccountWithEmail).toHaveBeenCalledWith("new@example.com");
    expect(accountId).toBe("acc-new");
  });

  it("creates an account when account_emails returns null", async () => {
    vi.mocked(getEmailByAuthToken).mockResolvedValue("new@example.com");
    vi.mocked(selectAccountEmails).mockResolvedValue(null as never);
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc-new");

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(createAccountWithEmail).toHaveBeenCalledWith("new@example.com");
    expect(accountId).toBe("acc-new");
  });

  it("propagates errors from getEmailByAuthToken (e.g. invalid token)", async () => {
    vi.mocked(getEmailByAuthToken).mockRejectedValue(new Error("Invalid authentication token"));

    await expect(getOrCreateAccountIdByAuthToken("bad-token")).rejects.toThrow(
      "Invalid authentication token",
    );
    expect(createAccountWithEmail).not.toHaveBeenCalled();
  });
});
