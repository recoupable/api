import { ACCOUNT, validated } from "./createCreditsSessionHandlerTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createCreditsSessionHandler } from "@/lib/stripe/createCreditsSessionHandler";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";

const makeReq = () =>
  new NextRequest("http://localhost/api/credits/sessions", { method: "POST", body: "{}" });

describe("createCreditsSessionHandler — auth, auto-charge, and 5xx paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(validated);
    vi.mocked(resolveStripeCustomerForAccount).mockResolvedValue("cus_x");
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateCreateCreditsSessionRequest).mockResolvedValue(err);
    expect(await createCreditsSessionHandler(makeReq())).toBe(err);
    expect(chargeCustomerOffSession).not.toHaveBeenCalled();
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("auto-charges and returns paymentIntentId/creditsPurchased/totalCents on success", async () => {
    vi.mocked(chargeCustomerOffSession).mockResolvedValue({
      kind: "charged",
      paymentIntentId: "pi_ok",
    });
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      paymentIntentId: "pi_ok",
      creditsPurchased: 250,
      totalCents: 289,
    });
    expect(createCreditsStripeSession).not.toHaveBeenCalled();
  });

  it("returns 500 when chargeCustomerOffSession throws", async () => {
    vi.mocked(chargeCustomerOffSession).mockRejectedValue(new Error("Stripe down"));
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("returns 500 when resolveStripeCustomerForAccount throws", async () => {
    vi.mocked(resolveStripeCustomerForAccount).mockRejectedValue(new Error("Stripe down"));
    const res = await createCreditsSessionHandler(makeReq());
    expect(res.status).toBe(500);
  });
});

// Sanity guard so an accidental ACCOUNT rename in the shared mocks file is caught.
describe("test-mock contract", () => {
  it("validated.accountId stays in sync with ACCOUNT", () => {
    expect(validated.accountId).toBe(ACCOUNT);
  });
});
