import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersListMock, subscriptionsListMock } = vi.hoisted(() => ({
  customersListMock: vi.fn(),
  subscriptionsListMock: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    customers: { list: customersListMock },
    subscriptions: { list: subscriptionsListMock },
  },
}));

const { hasActiveSubscriptionForEmail } = await import(
  "@/lib/stripe/hasActiveSubscriptionForEmail"
);

describe("hasActiveSubscriptionForEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when no customer carries the email", async () => {
    customersListMock.mockResolvedValue({ data: [] });
    expect(await hasActiveSubscriptionForEmail("nobody@example.com")).toBe(false);
    expect(customersListMock).toHaveBeenCalledWith({ email: "nobody@example.com", limit: 10 });
    expect(subscriptionsListMock).not.toHaveBeenCalled();
  });

  it("returns true when any customer with the email has an active or trialing subscription", async () => {
    customersListMock.mockResolvedValue({ data: [{ id: "cus_a" }, { id: "cus_b" }] });
    subscriptionsListMock
      .mockResolvedValueOnce({ data: [{ status: "canceled" }] })
      .mockResolvedValueOnce({ data: [{ status: "trialing" }] });

    expect(await hasActiveSubscriptionForEmail("fan@example.com")).toBe(true);
    expect(subscriptionsListMock).toHaveBeenCalledWith({
      customer: "cus_a",
      status: "all",
      limit: 10,
    });
  });

  it("returns false when every subscription is inactive", async () => {
    customersListMock.mockResolvedValue({ data: [{ id: "cus_a" }] });
    subscriptionsListMock.mockResolvedValue({
      data: [{ status: "canceled" }, { status: "incomplete_expired" }],
    });
    expect(await hasActiveSubscriptionForEmail("fan@example.com")).toBe(false);
  });

  it("returns false (never throws) when Stripe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    customersListMock.mockRejectedValue(new Error("stripe down"));
    expect(await hasActiveSubscriptionForEmail("fan@example.com")).toBe(false);
  });
});
