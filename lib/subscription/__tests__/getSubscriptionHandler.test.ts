import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSubscriptionHandler } from "@/lib/subscription/getSubscriptionHandler";
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

const buildRequest = () => new NextRequest("http://localhost/api/subscription");

const mockAuthOk = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT,
    orgId: null,
    authToken: "token",
  });

const accountSub = { id: "sub_account", status: "active" } as unknown as Stripe.Subscription;
const orgSub = { id: "sub_org", status: "active" } as unknown as Stripe.Subscription;

describe("getSubscriptionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the auth-error response unchanged when auth fails", async () => {
    const err = NextResponse.json({ message: "unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);

    const res = await getSubscriptionHandler(buildRequest());
    expect(res).toBe(err);
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("prefers the account-level subscription when both are active", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(accountSub);
    vi.mocked(getOrgSubscription).mockResolvedValue(orgSub);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub != null);

    const res = await getSubscriptionHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: true,
      source: "account",
      subscription: accountSub,
    });
  });

  it("falls back to the organization subscription when only the org is active", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(orgSub);
    vi.mocked(isActiveSubscription).mockImplementation(sub => sub != null);

    const res = await getSubscriptionHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: true,
      source: "organization",
      subscription: orgSub,
    });
  });

  it("returns isPro:false with null subscription when neither is active", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);
    vi.mocked(isActiveSubscription).mockReturnValue(false);

    const res = await getSubscriptionHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      isPro: false,
      source: null,
      subscription: null,
    });
  });

  it("returns 500 with generic message when an upstream call throws", async () => {
    mockAuthOk();
    vi.mocked(getActiveSubscriptionDetails).mockRejectedValue(new Error("Stripe down"));
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const res = await getSubscriptionHandler(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("Stripe down");
  });
});
