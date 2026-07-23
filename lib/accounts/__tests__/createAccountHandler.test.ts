import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccountHandler } from "../createAccountHandler";

const mockSelectAccountByEmail = vi.fn();
const mockSelectAccountByWallet = vi.fn();
const mockGetAccountWithDetails = vi.fn();
const mockInsertAccount = vi.fn();
const mockInsertAccountEmail = vi.fn();
const mockInsertAccountWallet = vi.fn();
const mockInitializeAccountCredits = vi.fn();
const mockAssignAccountToOrg = vi.fn();

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: (...args: unknown[]) => mockSelectAccountByEmail(...args),
}));

vi.mock("@/lib/supabase/account_wallets/selectAccountByWallet", () => ({
  selectAccountByWallet: (...args: unknown[]) => mockSelectAccountByWallet(...args),
}));

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: (...args: unknown[]) => mockGetAccountWithDetails(...args),
}));

vi.mock("@/lib/supabase/accounts/insertAccount", () => ({
  insertAccount: (...args: unknown[]) => mockInsertAccount(...args),
}));

vi.mock("@/lib/supabase/account_emails/insertAccountEmail", () => ({
  insertAccountEmail: (...args: unknown[]) => mockInsertAccountEmail(...args),
}));

vi.mock("@/lib/supabase/account_wallets/insertAccountWallet", () => ({
  insertAccountWallet: (...args: unknown[]) => mockInsertAccountWallet(...args),
}));

vi.mock("@/lib/credits/initializeAccountCredits", () => ({
  initializeAccountCredits: (...args: unknown[]) => mockInitializeAccountCredits(...args),
}));

vi.mock("@/lib/organizations/assignAccountToOrg", () => ({
  assignAccountToOrg: (...args: unknown[]) => mockAssignAccountToOrg(...args),
}));

const mockSendWelcomeEmail = vi.fn();
vi.mock("@/lib/emails/sendWelcomeEmail", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

describe("createAccountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing account for a known email", async () => {
    const account = {
      account_id: "account-123",
      email: "user@example.com",
      image: "https://example.com/avatar.png",
    };

    mockSelectAccountByEmail.mockResolvedValue({ account_id: "account-123" });
    mockGetAccountWithDetails.mockResolvedValue(account);

    const response = await createAccountHandler({
      email: "user@example.com",
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ data: account });
    expect(mockAssignAccountToOrg).toHaveBeenCalledWith("account-123", "user@example.com");
    expect(mockGetAccountWithDetails).toHaveBeenCalledWith("account-123");
    expect(mockSelectAccountByWallet).not.toHaveBeenCalled();
    expect(mockInsertAccount).not.toHaveBeenCalled();
  });

  it("returns the existing account for a known wallet", async () => {
    mockSelectAccountByEmail.mockResolvedValue(null);
    mockSelectAccountByWallet.mockResolvedValue({
      id: "account-456",
      name: "Wallet User",
      account_info: [{ image: "https://example.com/wallet.png", instruction: "Hi" }],
      account_emails: [{ email: "wallet@example.com" }],
      account_wallets: [{ wallet: "0xabc" }],
    });

    const response = await createAccountHandler({
      wallet: "0xabc",
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      data: {
        id: "account-456",
        account_id: "account-456",
        name: "Wallet User",
        image: "https://example.com/wallet.png",
        instruction: "Hi",
        organization: undefined,
        email: "wallet@example.com",
        wallet: "0xabc",
      },
    });
    expect(mockInsertAccount).not.toHaveBeenCalled();
  });

  it("creates a new account when no existing email or wallet is found", async () => {
    mockSelectAccountByEmail.mockResolvedValue(null);
    mockSelectAccountByWallet.mockRejectedValue(new Error("not found"));
    mockInsertAccount.mockResolvedValue({ id: "account-789" });

    const response = await createAccountHandler({
      email: "new@example.com",
      wallet: "0xdef",
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      data: {
        id: "account-789",
        account_id: "account-789",
        email: "new@example.com",
        wallet: "0xdef",
        image: "",
        instruction: "",
        organization: "",
      },
    });
    expect(mockInsertAccount).toHaveBeenCalledWith({ name: "" });
    expect(mockInsertAccountEmail).toHaveBeenCalledWith("account-789", "new@example.com");
    expect(mockAssignAccountToOrg).toHaveBeenCalledWith("account-789", "new@example.com");
    expect(mockInsertAccountWallet).toHaveBeenCalledWith("account-789", "0xdef");
    expect(mockInitializeAccountCredits).toHaveBeenCalledWith("account-789");
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      accountId: "account-789",
      email: "new@example.com",
    });
  });

  it("does not send a welcome email to an existing account", async () => {
    mockSelectAccountByEmail.mockResolvedValue({ account_id: "account-123" });
    mockGetAccountWithDetails.mockResolvedValue({ account_id: "account-123" });

    await createAccountHandler({ email: "user@example.com" });

    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("does not send a welcome email for a wallet-only signup", async () => {
    mockSelectAccountByEmail.mockResolvedValue(null);
    mockSelectAccountByWallet.mockRejectedValue(new Error("not found"));
    mockInsertAccount.mockResolvedValue({ id: "account-789" });

    await createAccountHandler({ wallet: "0xdef" });

    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when account creation fails", async () => {
    mockSelectAccountByEmail.mockResolvedValue(null);
    mockInsertAccount.mockRejectedValue(new Error("insert failed"));

    const response = await createAccountHandler({
      email: "broken@example.com",
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ message: "insert failed" });
  });
});
