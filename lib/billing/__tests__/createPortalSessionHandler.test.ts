import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPortalSessionHandler } from "@/lib/billing/createPortalSessionHandler";
import { validateCreatePortalParams } from "@/lib/billing/validateCreatePortalParams";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateCreatePortalParams", () => ({
  validateCreatePortalParams: vi.fn(),
}));
vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));
vi.mock("@/lib/stripe/createBillingPortalSession", () => ({
  createBillingPortalSession: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";
const RETURN_URL = "https://app.recoupable.dev/billing";
const request = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/portal`, {
    method: "POST",
    body: "{}",
  });
const params = () => Promise.resolve({ id: ACCOUNT });
const validated = () =>
  vi
    .mocked(validateCreatePortalParams)
    .mockResolvedValue({ accountId: ACCOUNT, returnUrl: RETURN_URL });
const subscribed = () =>
  vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
    customer: "cus_test_123",
  } as Awaited<ReturnType<typeof getActiveSubscriptionDetails>>);

describe("createPortalSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreatePortalParams).mockResolvedValue(err);
    expect(await createPortalSessionHandler(request(), params())).toBe(err);
    expect(getActiveSubscriptionDetails).not.toHaveBeenCalled();
  });

  it("returns 400 when the account has no active subscription", async () => {
    validated();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    const res = await createPortalSessionHandler(request(), params());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "No active subscription found" });
    expect(createBillingPortalSession).not.toHaveBeenCalled();
  });

  it("looks up the subscription for the path account, not the caller", async () => {
    validated();
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    const req = request();
    await createPortalSessionHandler(req, params());
    expect(validateCreatePortalParams).toHaveBeenCalledWith(req, ACCOUNT);
    expect(getActiveSubscriptionDetails).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns 200 with id and url when the portal session is created", async () => {
    validated();
    subscribed();
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);
    const res = await createPortalSessionHandler(request(), params());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    });
    expect(createBillingPortalSession).toHaveBeenCalledWith("cus_test_123", RETURN_URL);
  });
});
