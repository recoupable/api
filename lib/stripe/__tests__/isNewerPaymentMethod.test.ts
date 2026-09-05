import { describe, it, expect, vi, beforeEach } from "vitest";

const { retrieve, findDefaultPaymentMethodForCustomerMock } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  findDefaultPaymentMethodForCustomerMock: vi.fn(),
}));
vi.mock("@/lib/stripe/client", () => ({ default: { paymentMethods: { retrieve } } }));
vi.mock("@/lib/stripe/findDefaultPaymentMethodForCustomer", () => ({
  findDefaultPaymentMethodForCustomer: findDefaultPaymentMethodForCustomerMock,
}));

const { isNewerPaymentMethod } = await import("@/lib/stripe/isNewerPaymentMethod");

describe("isNewerPaymentMethod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is true when the customer has no default yet", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue(null);
    expect(await isNewerPaymentMethod("cus_x", "pm_new")).toBe(true);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("is true when the candidate is the current default", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue("pm_new");
    expect(await isNewerPaymentMethod("cus_x", "pm_new")).toBe(true);
  });

  it("is true when the candidate was created after the current default", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue("pm_cur");
    retrieve.mockImplementation(async (id: string) => ({
      id,
      created: id === "pm_new" ? 200 : 100,
    }));
    expect(await isNewerPaymentMethod("cus_x", "pm_new")).toBe(true);
  });

  it("is false when the current default was created after the candidate", async () => {
    findDefaultPaymentMethodForCustomerMock.mockResolvedValue("pm_cur");
    retrieve.mockImplementation(async (id: string) => ({
      id,
      created: id === "pm_new" ? 100 : 200,
    }));
    expect(await isNewerPaymentMethod("cus_x", "pm_new")).toBe(false);
  });
});
