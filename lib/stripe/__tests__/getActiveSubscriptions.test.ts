import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import {
  getActiveSubscriptions,
  MAX_SUBSCRIPTION_LIST_PAGES,
} from "@/lib/stripe/getActiveSubscriptions";
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

  it("walks pages until a batch matches accountId", async () => {
    const subOther = { id: "sub_x", metadata: { accountId: "other" } } as Stripe.Subscription;
    const sub1 = { id: "sub_1", metadata: { accountId: "acc-a" } } as Stripe.Subscription;

    vi.mocked(stripeClient.subscriptions.list)
      .mockResolvedValueOnce({
        data: [subOther],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>)
      .mockResolvedValueOnce({
        data: [sub1],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    const result = await getActiveSubscriptions("acc-a");

    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(2);
    expect(result.map(s => s.id)).toEqual(["sub_1"]);

    const secondCall = vi.mocked(stripeClient.subscriptions.list).mock.calls[1][0];
    expect(secondCall).toMatchObject({
      starting_after: "sub_x",
      limit: 100,
    });
  });

  it("stops after the first page that includes a match (no further Stripe calls)", async () => {
    const subOther = { id: "sub_x", metadata: { accountId: "other" } } as Stripe.Subscription;
    const sub1 = { id: "sub_1", metadata: { accountId: "acc-a" } } as Stripe.Subscription;
    const sub2 = { id: "sub_2", metadata: { accountId: "acc-a" } } as Stripe.Subscription;

    vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
      data: [subOther, sub1, sub2],
      has_more: true,
    } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    const result = await getActiveSubscriptions("acc-a");

    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(1);
    expect(result.map(s => s.id)).toEqual(["sub_1", "sub_2"]);
  });

  it("passes stripeCustomerId to subscriptions.list when provided", async () => {
    const sub1 = { id: "sub_1", metadata: { accountId: "acc-a" } } as Stripe.Subscription;

    vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
      data: [sub1],
      has_more: false,
    } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    await getActiveSubscriptions("acc-a", "cus_123");

    expect(stripeClient.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123", limit: 100 }),
    );
  });

  it(`returns [] after at most ${MAX_SUBSCRIPTION_LIST_PAGES} pages when nothing matches`, async () => {
    for (let i = 0; i < MAX_SUBSCRIPTION_LIST_PAGES; i++) {
      vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
        data: [{ id: `sub_${i}`, metadata: { accountId: "other" } } as Stripe.Subscription],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);
    }

    const result = await getActiveSubscriptions("acc-a");

    expect(result).toEqual([]);
    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(MAX_SUBSCRIPTION_LIST_PAGES);
  });

  it("returns [] when Stripe throws", async () => {
    vi.mocked(stripeClient.subscriptions.list).mockRejectedValue(new Error("stripe error"));
    await expect(getActiveSubscriptions("acc-a")).resolves.toEqual([]);
  });
});
