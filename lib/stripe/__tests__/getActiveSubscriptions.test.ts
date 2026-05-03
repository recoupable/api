import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import stripeClient from "@/lib/stripe/client";

vi.mock("@/lib/stripe/client", () => ({
  default: { subscriptions: { list: vi.fn() } },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("getActiveSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns subscriptions matching accountId across pages", async () => {
    const match = { metadata: { accountId: ACCOUNT } } as Stripe.Subscription;
    const skip = { metadata: { accountId: "other" } } as Stripe.Subscription;
    async function* twoPages() {
      yield skip;
      yield match;
    }
    vi.mocked(stripeClient.subscriptions.list).mockReturnValue({
      autoPagingEach: () => twoPages(),
    } as ReturnType<typeof stripeClient.subscriptions.list>);

    const out = await getActiveSubscriptions(ACCOUNT);
    expect(out).toEqual([match]);
    expect(stripeClient.subscriptions.list).toHaveBeenCalledWith({
      current_period_end: { gt: expect.any(Number) },
    });
  });

  it("returns [] when Stripe throws", async () => {
    vi.mocked(stripeClient.subscriptions.list).mockImplementation(() => {
      throw new Error("stripe api error");
    });
    await expect(getActiveSubscriptions(ACCOUNT)).resolves.toEqual([]);
  });
});
