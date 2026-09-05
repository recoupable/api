import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
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

describe("createPortalSessionHandler errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when the session has no url", async () => {
    validated();
    subscribed();
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: null,
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);
    const res = await createPortalSessionHandler(request(), params());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Billing portal URL missing" });
  });

  it("returns 500 when the subscription lookup throws", async () => {
    validated();
    vi.mocked(getActiveSubscriptionDetails).mockRejectedValue(new Error("stripe down"));
    const res = await createPortalSessionHandler(request(), params());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("returns 500 when creating the portal session throws", async () => {
    validated();
    subscribed();
    vi.mocked(createBillingPortalSession).mockRejectedValue(new Error("Stripe down"));
    const res = await createPortalSessionHandler(request(), params());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
