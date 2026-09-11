import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersSearchMock } = vi.hoisted(() => ({
  customersSearchMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { customers: { search: customersSearchMock } },
}));

const { findStripeCustomerForAccount } = await import("@/lib/stripe/findStripeCustomerForAccount");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const customer = (id: string, created: number, pm: string | null = null) => ({
  id,
  created,
  invoice_settings: { default_payment_method: pm },
});

beforeEach(() => vi.clearAllMocks());

describe("findStripeCustomerForAccount", () => {
  it("returns the customer id when one exists for the accountId", async () => {
    customersSearchMock.mockResolvedValue({ data: [customer("cus_match", 1)] });

    const result = await findStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_match");
    expect(customersSearchMock).toHaveBeenCalledWith({
      query: `metadata['accountId']:'${ACCOUNT}'`,
      limit: 10,
    });
  });

  it("returns the tagged customer holding a default card when several are tagged", async () => {
    customersSearchMock.mockResolvedValue({
      data: [customer("cus_invoices", 200), customer("cus_card", 100, "pm_visa")],
    });

    await expect(findStripeCustomerForAccount(ACCOUNT)).resolves.toBe("cus_card");
  });

  it("returns the newest tagged customer when none holds a card", async () => {
    customersSearchMock.mockResolvedValue({
      data: [customer("cus_old", 100), customer("cus_new", 200)],
    });

    await expect(findStripeCustomerForAccount(ACCOUNT)).resolves.toBe("cus_new");
  });

  it("returns null when no customer matches — does NOT create one (no side effect)", async () => {
    customersSearchMock.mockResolvedValue({ data: [] });

    const result = await findStripeCustomerForAccount(ACCOUNT);

    expect(result).toBeNull();
  });
});
