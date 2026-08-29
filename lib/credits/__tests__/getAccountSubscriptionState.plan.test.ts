import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));
vi.mock("@/lib/stripe/getOrgSubscription", () => ({ getOrgSubscription: vi.fn() }));
vi.mock("@/lib/enterprise/isEnterpriseAccount", () => ({ isEnterpriseAccount: vi.fn() }));
vi.mock("@/lib/stripe/config", () => ({ STRIPE_STARTER_PRICE_ID: "price_starter" }));

const { getAccountSubscriptionState } = await import("@/lib/credits/getAccountSubscriptionState");
const { getActiveSubscriptionDetails } = await import("@/lib/stripe/getActiveSubscriptionDetails");
const { getOrgSubscription } = await import("@/lib/stripe/getOrgSubscription");
const { isEnterpriseAccount } = await import("@/lib/enterprise/isEnterpriseAccount");

const sub = (priceId: string) =>
  ({
    id: "sub_1",
    status: "active",
    canceled_at: null,
    items: { data: [{ price: { id: priceId } }] },
  }) as never;

describe("getAccountSubscriptionState plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEnterpriseAccount).mockResolvedValue(false);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
  });

  it("free: plan free, isPro false", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    expect(await getAccountSubscriptionState("acc")).toEqual({
      isPro: false,
      plan: "free",
      activeSubscription: null,
    });
  });

  it("starter: plan starter, isPro false, the starter sub is the active one", async () => {
    const s = sub("price_starter");
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(s);
    expect(await getAccountSubscriptionState("acc")).toEqual({
      isPro: false,
      plan: "starter",
      activeSubscription: s,
    });
  });

  it("pro: plan pro, isPro true", async () => {
    const s = sub("price_pro");
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(s);
    expect(await getAccountSubscriptionState("acc")).toEqual({
      isPro: true,
      plan: "pro",
      activeSubscription: s,
    });
  });
});
