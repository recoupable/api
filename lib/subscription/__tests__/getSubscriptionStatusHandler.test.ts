import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getSubscriptionStatusHandler } from "@/lib/subscription/getSubscriptionStatusHandler";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

vi.mock("@/lib/stripe/isActiveSubscription", () => ({
  default: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = (qs: string) =>
  new NextRequest(`http://localhost/api/subscription/status${qs}`);

describe("getSubscriptionStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when accountId is missing", async () => {
    const res = await getSubscriptionStatusHandler(buildRequest(""));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ message: "accountId is required" });
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns isPro:true when the account has an active subscription", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({} as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub !== null && sub !== undefined);

    const res = await getSubscriptionStatusHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns isPro:true when only the org has a subscription", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue({} as never);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub !== null && sub !== undefined);

    const res = await getSubscriptionStatusHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns isPro:false when neither the account nor its orgs have one", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockReturnValue(false);

    const res = await getSubscriptionStatusHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: false });
  });

  it("returns 500 with generic message when an upstream call throws", async () => {
    vi.mocked(getActiveSubscriptionDetails).mockRejectedValue(new Error("Stripe down"));
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const res = await getSubscriptionStatusHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("Stripe down");
  });
});
