import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { resolveAccountIdForCustomer } from "@/scripts/resolveAccountIdForCustomer";

const SUB_ACCOUNT = "11111111-1111-1111-1111-111111111111";
const EMAIL_ACCOUNT = "22222222-2222-2222-2222-222222222222";

const customer = (overrides: Partial<Stripe.Customer> = {}): Stripe.Customer =>
  ({ id: "cus_x", email: null, ...overrides }) as unknown as Stripe.Customer;

describe("resolveAccountIdForCustomer", () => {
  const accountByEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the subscription map when both sub and email match", async () => {
    accountByEmail.mockResolvedValue({ account_id: EMAIL_ACCOUNT });
    const subMap = new Map([["cus_x", SUB_ACCOUNT]]);

    const result = await resolveAccountIdForCustomer({
      customer: customer({ email: "user@example.com" }),
      subMap,
      accountByEmail,
    });

    expect(result).toEqual({ accountId: SUB_ACCOUNT, source: "subscription" });
    expect(accountByEmail).not.toHaveBeenCalled();
  });

  it("falls back to email lookup when not in the sub map", async () => {
    accountByEmail.mockResolvedValue({ account_id: EMAIL_ACCOUNT });
    const subMap = new Map<string, string>();

    const result = await resolveAccountIdForCustomer({
      customer: customer({ email: "user@example.com" }),
      subMap,
      accountByEmail,
    });

    expect(result).toEqual({ accountId: EMAIL_ACCOUNT, source: "email" });
    expect(accountByEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("normalizes the email to lowercase before lookup", async () => {
    accountByEmail.mockResolvedValue({ account_id: EMAIL_ACCOUNT });
    const subMap = new Map<string, string>();

    await resolveAccountIdForCustomer({
      customer: customer({ email: "  USER@Example.COM  " }),
      subMap,
      accountByEmail,
    });

    expect(accountByEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("returns null when no sub match and no email", async () => {
    const result = await resolveAccountIdForCustomer({
      customer: customer({ email: null }),
      subMap: new Map(),
      accountByEmail,
    });
    expect(result).toBeNull();
    expect(accountByEmail).not.toHaveBeenCalled();
  });

  it("returns null when no sub match and email doesn't match an account", async () => {
    accountByEmail.mockResolvedValue(null);
    const result = await resolveAccountIdForCustomer({
      customer: customer({ email: "nobody@example.com" }),
      subMap: new Map(),
      accountByEmail,
    });
    expect(result).toBeNull();
  });
});
