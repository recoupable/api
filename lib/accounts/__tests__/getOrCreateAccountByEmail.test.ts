import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateAccountByEmail } from "../getOrCreateAccountByEmail";

import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/insertAccount", () => ({
  insertAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/insertAccountEmail", () => ({
  insertAccountEmail: vi.fn(),
}));

vi.mock("@/lib/credits/initializeAccountCredits", () => ({
  initializeAccountCredits: vi.fn(),
}));

vi.mock("@/lib/organizations/assignAccountToOrg", () => ({
  assignAccountToOrg: vi.fn(),
}));

describe("getOrCreateAccountByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing account_id when the email is already registered", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: "existing-account-1",
      email: "member@example.com",
      id: "email-row-1",
    } as never);

    const result = await getOrCreateAccountByEmail("member@example.com");

    expect(result).toBe("existing-account-1");
    expect(insertAccount).not.toHaveBeenCalled();
    expect(insertAccountEmail).not.toHaveBeenCalled();
  });

  it("creates a new account when the email is not registered", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);
    vi.mocked(insertAccount).mockResolvedValue({ id: "new-account-1", name: "" } as never);
    vi.mocked(insertAccountEmail).mockResolvedValue({} as never);
    vi.mocked(initializeAccountCredits).mockResolvedValue({} as never);
    vi.mocked(assignAccountToOrg).mockResolvedValue(null);

    const result = await getOrCreateAccountByEmail("new@example.com");

    expect(result).toBe("new-account-1");
    expect(insertAccount).toHaveBeenCalledWith({ name: "" });
    expect(insertAccountEmail).toHaveBeenCalledWith("new-account-1", "new@example.com");
    expect(initializeAccountCredits).toHaveBeenCalledWith("new-account-1");
    expect(assignAccountToOrg).toHaveBeenCalledWith("new-account-1", "new@example.com");
  });

  it("returns null when account creation fails", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);
    vi.mocked(insertAccount).mockRejectedValue(new Error("Failed to insert account"));

    const result = await getOrCreateAccountByEmail("new@example.com");

    expect(result).toBeNull();
  });

  it("returns null when linking the email fails (account would be unfindable next call)", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);
    vi.mocked(insertAccount).mockResolvedValue({ id: "new-account-1", name: "" } as never);
    vi.mocked(insertAccountEmail).mockResolvedValue(null);

    const result = await getOrCreateAccountByEmail("new@example.com");

    expect(result).toBeNull();
    expect(initializeAccountCredits).not.toHaveBeenCalled();
    expect(assignAccountToOrg).not.toHaveBeenCalled();
  });

  it("returns null when initializing credits rejects", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);
    vi.mocked(insertAccount).mockResolvedValue({ id: "new-account-1", name: "" } as never);
    vi.mocked(insertAccountEmail).mockResolvedValue({} as never);
    vi.mocked(initializeAccountCredits).mockRejectedValue(new Error("credits failed"));

    const result = await getOrCreateAccountByEmail("new@example.com");

    expect(result).toBeNull();
  });

  it("returns null when org assignment rejects", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);
    vi.mocked(insertAccount).mockResolvedValue({ id: "new-account-1", name: "" } as never);
    vi.mocked(insertAccountEmail).mockResolvedValue({} as never);
    vi.mocked(initializeAccountCredits).mockResolvedValue({} as never);
    vi.mocked(assignAccountToOrg).mockRejectedValue(new Error("org assignment failed"));

    const result = await getOrCreateAccountByEmail("new@example.com");

    expect(result).toBeNull();
  });
});
