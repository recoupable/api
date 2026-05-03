import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import stripeClient from "@/lib/stripe/client";

vi.mock("@/lib/stripe/client", () => ({
  default: {
    subscriptions: { list: vi.fn() },
  },
}));

describe("getActiveSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects subscriptions matching accountId across paginated pages", async () => {
    const sub1 = { id: "sub_1", metadata: { accountId: "acc-a" } } as Stripe.Subscription;
    const subOther = { id: "sub_x", metadata: { accountId: "other" } } as Stripe.Subscription;
    const sub2 = { id: "sub_2", metadata: { accountId: "acc-a" } } as Stripe.Subscription;

    vi.mocked(stripeClient.subscriptions.list)
      .mockResolvedValueOnce({
        data: [subOther, sub1],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>)
      .mockResolvedValueOnce({
        data: [sub2],
        has_more: false,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    const result = await getActiveSubscriptions("acc-a");

    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(2);
    expect(result.map(s => s.id)).toEqual(["sub_1", "sub_2"]);

    const secondCall = vi.mocked(stripeClient.subscriptions.list).mock.calls[1][0];
    expect(secondCall).toMatchObject({
      starting_after: "sub_1",
      limit: 100,
    });
  });

  it("returns [] when Stripe throws", async () => {
    vi.mocked(stripeClient.subscriptions.list).mockRejectedValue(new Error("stripe error"));
    await expect(getActiveSubscriptions("acc-a")).resolves.toEqual([]);
  });
});
