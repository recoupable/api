import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { isEnterpriseAccount } from "@/lib/enterprise/isEnterpriseAccount";

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

vi.mock("@/lib/enterprise/isEnterpriseAccount", () => ({
  isEnterpriseAccount: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("getAccountSubscriptionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEnterpriseAccount).mockResolvedValue(false);
  });

  it("returns isPro=false / activeSubscription=null when neither subscription is active", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: false, activeSubscription: null });
  });

  it("returns isPro=true and prefers the account subscription when both are active", async () => {
    const accountSub = {
      id: "sub_account",
      status: "active",
      canceled_at: null,
    } as never;
    const orgSub = { id: "sub_org", status: "active", canceled_at: null } as never;
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(accountSub);
    vi.mocked(getOrgSubscription).mockResolvedValue(orgSub);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: true, activeSubscription: accountSub });
  });

  it("falls back to the org subscription when only it is active", async () => {
    const orgSub = {
      id: "sub_org",
      status: "trialing",
      canceled_at: null,
    } as never;
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(orgSub);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: true, activeSubscription: orgSub });
  });

  it("returns isPro=false when the account subscription exists but is canceled trialing", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      id: "sub_account",
      status: "trialing",
      canceled_at: 1700000000,
    } as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: false, activeSubscription: null });
  });

  it("returns isPro=true with activeSubscription=null for an enterprise account without Stripe", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isEnterpriseAccount).mockResolvedValue(true);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: true, activeSubscription: null });
    expect(isEnterpriseAccount).toHaveBeenCalledWith(ACCOUNT);
  });

  it("keeps activeSubscription Stripe-only when both enterprise and a Stripe sub apply", async () => {
    const accountSub = {
      id: "sub_account",
      status: "active",
      canceled_at: null,
    } as never;
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(accountSub);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isEnterpriseAccount).mockResolvedValue(true);

    const result = await getAccountSubscriptionState(ACCOUNT);

    expect(result).toEqual({ isPro: true, activeSubscription: accountSub });
  });
});
