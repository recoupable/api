import { describe, it, expect, vi, beforeEach } from "vitest";

const { chargesListMock } = vi.hoisted(() => ({ chargesListMock: vi.fn() }));

vi.mock("@/lib/stripe/client", () => ({
  default: { charges: { list: chargesListMock } },
}));

const { getCustomerLifetimeValue } = await import("@/lib/stripe/getCustomerLifetimeValue");

const charge = (amount: number, amountRefunded = 0, status = "succeeded") => ({
  amount,
  amount_refunded: amountRefunded,
  status,
});

describe("getCustomerLifetimeValue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums succeeded charges in cents, net of refunds", async () => {
    chargesListMock.mockResolvedValue({
      data: [charge(9900), charge(546, 546), charge(2000, 500)],
      has_more: false,
    });

    await expect(getCustomerLifetimeValue("cus_1")).resolves.toBe(9900 + 0 + 1500);
    expect(chargesListMock).toHaveBeenCalledWith({ customer: "cus_1", limit: 100 });
  });

  it("ignores charges that did not succeed", async () => {
    chargesListMock.mockResolvedValue({
      data: [charge(9900, 0, "failed"), charge(546)],
      has_more: false,
    });

    await expect(getCustomerLifetimeValue("cus_1")).resolves.toBe(546);
  });

  it("paginates until has_more is false", async () => {
    chargesListMock
      .mockResolvedValueOnce({
        data: [charge(100), { ...charge(200), id: "ch_last" }],
        has_more: true,
      })
      .mockResolvedValueOnce({ data: [charge(300)], has_more: false });

    await expect(getCustomerLifetimeValue("cus_1")).resolves.toBe(600);
    expect(chargesListMock).toHaveBeenNthCalledWith(2, {
      customer: "cus_1",
      limit: 100,
      starting_after: "ch_last",
    });
  });

  it("returns 0 for a customer with no charges", async () => {
    chargesListMock.mockResolvedValue({ data: [], has_more: false });
    await expect(getCustomerLifetimeValue("cus_1")).resolves.toBe(0);
  });
});
