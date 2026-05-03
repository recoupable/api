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

  it("finds a match on a later page (no artificial page limit)", async () => {
    const subLate = { id: "sub_late", metadata: { accountId: "acc-a" } } as Stripe.Subscription;
    for (let i = 0; i < 52; i++) {
      vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
        data: [{ id: `sub_${i}`, metadata: { accountId: "other" } } as Stripe.Subscription],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);
    }
    vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
      data: [subLate],
      has_more: false,
    } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    const result = await getActiveSubscriptions("acc-a");

    expect(result.map(s => s.id)).toEqual(["sub_late"]);
    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(53);
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

  it("returns [] when nothing matches after Stripe exhausts pages", async () => {
    for (let i = 0; i < 3; i++) {
      vi.mocked(stripeClient.subscriptions.list).mockResolvedValueOnce({
        data: [{ id: `sub_${i}`, metadata: { accountId: "other" } } as Stripe.Subscription],
        has_more: i < 2,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);
    }

    const result = await getActiveSubscriptions("acc-a");

    expect(result).toEqual([]);
    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(3);
  });

  it("breaks if pagination cursor does not advance", async () => {
    const stuck = { id: "sub_stuck", metadata: { accountId: "other" } } as Stripe.Subscription;
    vi.mocked(stripeClient.subscriptions.list)
      .mockResolvedValueOnce({
        data: [stuck],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>)
      .mockResolvedValueOnce({
        data: [stuck],
        has_more: true,
      } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>);

    const result = await getActiveSubscriptions("acc-a");

    expect(result).toEqual([]);
    expect(stripeClient.subscriptions.list).toHaveBeenCalledTimes(2);
  });

  it("returns [] when Stripe throws", async () => {
    vi.mocked(stripeClient.subscriptions.list).mockRejectedValue(new Error("stripe error"));
    await expect(getActiveSubscriptions("acc-a")).resolves.toEqual([]);
  });
});
