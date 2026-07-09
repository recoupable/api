import { describe, it, expect, vi, beforeEach } from "vitest";

const { getCustomerEmailMock, getLtvMock } = vi.hoisted(() => ({
  getCustomerEmailMock: vi.fn(),
  getLtvMock: vi.fn(),
}));

vi.mock("@/lib/stripe/getCustomerEmail", () => ({ getCustomerEmail: getCustomerEmailMock }));
vi.mock("@/lib/stripe/getCustomerLifetimeValue", () => ({
  getCustomerLifetimeValue: getLtvMock,
}));

const { buildCustomerSalesContext } = await import("@/lib/stripe/buildCustomerSalesContext");

describe("buildCustomerSalesContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomerEmailMock.mockResolvedValue("fan@example.com");
    getLtvMock.mockResolvedValue(12345);
  });

  it("resolves email and lifetime value for a customer", async () => {
    await expect(buildCustomerSalesContext("cus_9")).resolves.toEqual({
      email: "fan@example.com",
      customerLine: "Customer: fan@example.com (cus_9)",
      lifetimeLine: "Lifetime value: $123.45",
      lifetimeCents: 12345,
    });
  });

  it("skips the email lookup when a known email is provided", async () => {
    const ctx = await buildCustomerSalesContext("cus_9", "known@example.com");
    expect(ctx.email).toBe("known@example.com");
    expect(getCustomerEmailMock).not.toHaveBeenCalled();
  });

  it("falls back to the id-only customer line when no email exists", async () => {
    getCustomerEmailMock.mockResolvedValue(null);
    const ctx = await buildCustomerSalesContext("cus_9");
    expect(ctx.customerLine).toBe("Customer: cus_9");
  });
});
