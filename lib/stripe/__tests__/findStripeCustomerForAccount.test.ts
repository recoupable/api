import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersSearchMock } = vi.hoisted(() => ({
  customersSearchMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: { customers: { search: customersSearchMock } },
}));

const { findStripeCustomerForAccount } = await import("@/lib/stripe/findStripeCustomerForAccount");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.clearAllMocks());

describe("findStripeCustomerForAccount", () => {
  it("returns the customer id when one exists for the accountId", async () => {
    customersSearchMock.mockResolvedValue({ data: [{ id: "cus_match" }] });

    const result = await findStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_match");
    expect(customersSearchMock).toHaveBeenCalledWith({
      query: `metadata['accountId']:'${ACCOUNT}'`,
      limit: 1,
    });
  });

  it("returns null when no customer matches — does NOT create one (no side effect)", async () => {
    customersSearchMock.mockResolvedValue({ data: [] });

    const result = await findStripeCustomerForAccount(ACCOUNT);

    expect(result).toBeNull();
  });
});
