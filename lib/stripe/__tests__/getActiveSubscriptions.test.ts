import { describe, it, expect, vi, beforeEach } from "vitest";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import stripeClient from "@/lib/stripe/client";
import { getActiveSubscriptionsTestHelpers } from "./getActiveSubscriptionsTestHelpers";

vi.mock("@/lib/stripe/client", () => ({
  default: { subscriptions: { list: vi.fn() } },
}));

const {
  testAccountId: ACC,
  subscription: sub,
  subscriptionListPage: apiList,
} = getActiveSubscriptionsTestHelpers();
const list = () => vi.mocked(stripeClient.subscriptions.list);

describe("getActiveSubscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("walks pages until a batch matches accountId", async () => {
    list()
      .mockResolvedValueOnce(apiList([sub("sub_x", "other")], true))
      .mockResolvedValueOnce(apiList([sub("sub_1", ACC)], true));
    const result = await getActiveSubscriptions(ACC);
    expect(list()).toHaveBeenCalledTimes(2);
    expect(result.map(s => s.id)).toEqual(["sub_1"]);
    expect(list().mock.calls[1][0]).toMatchObject({ starting_after: "sub_x", limit: 100 });
  });

  it("finds a match on a later page (no artificial page limit)", async () => {
    for (let i = 0; i < 52; i++)
      list().mockResolvedValueOnce(apiList([sub(`sub_${i}`, "other")], true));
    list().mockResolvedValueOnce(apiList([sub("sub_late", ACC)], false));
    const result = await getActiveSubscriptions(ACC);
    expect(result.map(s => s.id)).toEqual(["sub_late"]);
    expect(list()).toHaveBeenCalledTimes(53);
  });

  it("stops after the first page that includes a match", async () => {
    list().mockResolvedValueOnce(
      apiList([sub("sub_x", "other"), sub("sub_1", ACC), sub("sub_2", ACC)], true),
    );
    const result = await getActiveSubscriptions(ACC);
    expect(list()).toHaveBeenCalledTimes(1);
    expect(result.map(s => s.id)).toEqual(["sub_1", "sub_2"]);
  });

  it("passes stripeCustomerId to subscriptions.list when provided", async () => {
    list().mockResolvedValueOnce(apiList([sub("sub_1", ACC)], false));
    await getActiveSubscriptions(ACC, "cus_123");
    expect(list()).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123", limit: 100 }),
    );
  });

  it("returns [] when nothing matches after Stripe exhausts pages", async () => {
    for (let i = 0; i < 3; i++) {
      list().mockResolvedValueOnce(apiList([sub(`sub_${i}`, "other")], i < 2));
    }
    const result = await getActiveSubscriptions(ACC);
    expect(result).toEqual([]);
    expect(list()).toHaveBeenCalledTimes(3);
  });

  it("breaks if pagination cursor does not advance", async () => {
    const s = sub("sub_stuck", "other");
    list()
      .mockResolvedValueOnce(apiList([s], true))
      .mockResolvedValueOnce(apiList([s], true));
    const result = await getActiveSubscriptions(ACC);
    expect(result).toEqual([]);
    expect(list()).toHaveBeenCalledTimes(2);
  });

  it("returns [] when Stripe throws", async () => {
    list().mockRejectedValue(new Error("stripe error"));
    await expect(getActiveSubscriptions(ACC)).resolves.toEqual([]);
  });
});
