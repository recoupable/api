import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersUpdate } = vi.hoisted(() => ({
  customersUpdate: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    customers: {
      update: customersUpdate,
    },
  },
}));

const { setAutoRechargeOptOut } = await import("@/lib/stripe/setAutoRechargeOptOut");

describe("setAutoRechargeOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customersUpdate.mockResolvedValue({ id: "cus_x" });
  });

  it("stamps a truthy marker when opting out", async () => {
    await setAutoRechargeOptOut("cus_x", true);

    expect(customersUpdate).toHaveBeenCalledWith("cus_x", {
      metadata: { auto_recharge_opt_out: "true" },
    });
  });

  it("deletes the key (empty string) when opting back in — never writes 'false'", async () => {
    await setAutoRechargeOptOut("cus_x", false);

    expect(customersUpdate).toHaveBeenCalledWith("cus_x", {
      metadata: { auto_recharge_opt_out: "" },
    });
  });
});
