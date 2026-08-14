import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersRetrieve } = vi.hoisted(() => ({
  customersRetrieve: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    customers: {
      retrieve: customersRetrieve,
    },
  },
}));

const { getAutoRechargeOptOut } = await import("@/lib/stripe/getAutoRechargeOptOut");

describe("getAutoRechargeOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the opt-out metadata key is present", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_x",
      metadata: { auto_recharge_opt_out: "true" },
    });

    await expect(getAutoRechargeOptOut("cus_x")).resolves.toBe(true);
    expect(customersRetrieve).toHaveBeenCalledWith("cus_x");
  });

  it("returns true for any non-empty value (presence semantics, never parse)", async () => {
    customersRetrieve.mockResolvedValue({
      id: "cus_x",
      metadata: { auto_recharge_opt_out: "false" },
    });

    await expect(getAutoRechargeOptOut("cus_x")).resolves.toBe(true);
  });

  it("returns false when the key is absent", async () => {
    customersRetrieve.mockResolvedValue({ id: "cus_x", metadata: {} });

    await expect(getAutoRechargeOptOut("cus_x")).resolves.toBe(false);
  });

  it("returns false for a deleted customer", async () => {
    customersRetrieve.mockResolvedValue({ id: "cus_x", deleted: true });

    await expect(getAutoRechargeOptOut("cus_x")).resolves.toBe(false);
  });
});
