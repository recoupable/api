import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

describe("getOrgSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when accountId is empty", async () => {
    await expect(getOrgSubscription("")).resolves.toBeNull();
    expect(getAccountOrganizations).not.toHaveBeenCalled();
  });

  it("returns first org subscription and avoids extra Stripe work after a match", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org-a" },
      { organization_id: "org-b" },
      { organization_id: "org-c" },
    ] as Awaited<ReturnType<typeof getAccountOrganizations>>);

    const sub = { id: "sub_from_a" } as Stripe.Subscription;
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(sub);

    await expect(getOrgSubscription("acc-1")).resolves.toBe(sub);

    expect(getActiveSubscriptionDetails).toHaveBeenCalledTimes(1);
    expect(getActiveSubscriptionDetails).toHaveBeenCalledWith("org-a");
  });

  it("walks orgs in order until a subscription is found", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      { organization_id: "org-a" },
      { organization_id: "org-b" },
    ] as Awaited<ReturnType<typeof getAccountOrganizations>>);

    const sub = { id: "sub_from_b" } as Stripe.Subscription;
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValueOnce(null).mockResolvedValueOnce(sub);

    await expect(getOrgSubscription("acc-1")).resolves.toBe(sub);

    expect(getActiveSubscriptionDetails).toHaveBeenCalledTimes(2);
    expect(getActiveSubscriptionDetails).toHaveBeenNthCalledWith(1, "org-a");
    expect(getActiveSubscriptionDetails).toHaveBeenNthCalledWith(2, "org-b");
  });

  it("returns null when no org has a subscription", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([{ organization_id: "org-a" }] as Awaited<
      ReturnType<typeof getAccountOrganizations>
    >);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);

    await expect(getOrgSubscription("acc-1")).resolves.toBeNull();
    expect(getActiveSubscriptionDetails).toHaveBeenCalledTimes(1);
  });
});
