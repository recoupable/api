import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("getAccountSubscriptionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
