import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatusHandler } from "@/lib/subscription/getSubscriptionStatusHandler";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

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

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = () => new NextRequest("http://localhost/api/subscriptions/status");

const mockAuthOk = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT,
    orgId: null,
    authToken: "token",
  });

describe("getSubscriptionStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the auth-error response unchanged when auth fails", async () => {
    const err = NextResponse.json({ message: "unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);

    const res = await getSubscriptionStatusHandler(buildRequest());
    expect(res).toBe(err);
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns isPro:true when the account has an active subscription", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({} as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub !== null && sub !== undefined);

    const res = await getSubscriptionStatusHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns isPro:true when only the org has a subscription", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue({} as never);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub !== null && sub !== undefined);

    const res = await getSubscriptionStatusHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });

  it("returns isPro:false when neither the account nor its orgs have one", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockReturnValue(false);

    const res = await getSubscriptionStatusHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: false });
  });

  it("returns 500 with generic message when an upstream call throws", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockRejectedValue(new Error("Stripe down"));
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const res = await getSubscriptionStatusHandler(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("Stripe down");
  });
});
