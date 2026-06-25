import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertRecipientsAllowed } from "../assertRecipientsAllowed";

const mockAccountHasPaymentMethod = vi.fn();
const mockSelectAccountEmails = vi.fn();

vi.mock("@/lib/emails/accountHasPaymentMethod", () => ({
  accountHasPaymentMethod: (...args: unknown[]) => mockAccountHasPaymentMethod(...args),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

describe("assertRecipientsAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectAccountEmails.mockResolvedValue([{ email: "owner@account.com" }]);
  });

  it("allows any recipient when a payment method is on file", async () => {
    mockAccountHasPaymentMethod.mockResolvedValue(true);

    const result = await assertRecipientsAllowed({
      accountId: "acct-1",
      recipients: ["stranger@example.com", "another@example.com"],
    });

    expect(result.allowed).toBe(true);
    // No need to look up account emails when a card is on file.
    expect(mockSelectAccountEmails).not.toHaveBeenCalled();
  });

  it("allows the account's own email without a payment method (case-insensitive)", async () => {
    mockAccountHasPaymentMethod.mockResolvedValue(false);

    const result = await assertRecipientsAllowed({
      accountId: "acct-1",
      recipients: ["OWNER@Account.com"],
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks foreign recipients without a payment method and lists them", async () => {
    mockAccountHasPaymentMethod.mockResolvedValue(false);

    const result = await assertRecipientsAllowed({
      accountId: "acct-1",
      recipients: ["owner@account.com", "stranger@example.com"],
    });

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.disallowed).toEqual(["stranger@example.com"]);
    }
  });
});
