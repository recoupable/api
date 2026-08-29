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
    expect(customersListMock).toHaveBeenCalledWith({ email: "nobody@example.com", limit: 100 });
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
      limit: 100,
    });
  });

  it("treats active and past_due as live subscriptions", async () => {
    customersListMock.mockResolvedValue({ data: [{ id: "cus_a" }] });
    subscriptionsListMock.mockResolvedValueOnce({ data: [{ status: "active" }] });
    expect(await hasActiveSubscriptionForEmail("fan@example.com")).toBe(true);
    subscriptionsListMock.mockResolvedValueOnce({ data: [{ status: "past_due" }] });
    expect(await hasActiveSubscriptionForEmail("fan@example.com")).toBe(true);
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
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("fan@example.com");
  });
});
