import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateAutoTopUpHandler } from "@/lib/billing/updateAutoTopUpHandler";
import { validateGetPaymentMethodParams } from "@/lib/billing/validateGetPaymentMethodParams";
import { validateUpdateAutoTopUpBody } from "@/lib/billing/validateUpdateAutoTopUpBody";
import { accountHasPaymentMethod } from "@/lib/stripe/accountHasPaymentMethod";
import { saveAutoTopUpSettings } from "@/lib/billing/saveAutoTopUpSettings";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateGetPaymentMethodParams", () => ({
  validateGetPaymentMethodParams: vi.fn(),
}));
vi.mock("@/lib/billing/validateUpdateAutoTopUpBody", () => ({
  validateUpdateAutoTopUpBody: vi.fn(),
}));
vi.mock("@/lib/stripe/accountHasPaymentMethod", () => ({ accountHasPaymentMethod: vi.fn() }));
vi.mock("@/lib/billing/saveAutoTopUpSettings", () => ({ saveAutoTopUpSettings: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const buildRequest = () =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-top-up`, { method: "PUT" });
const buildParams = () => Promise.resolve({ id: ACCOUNT });
const storedRow = {
  account_id: ACCOUNT,
  auto_topup_enabled: true,
  auto_topup_amount: 100_000_000,
  auto_topup_threshold: 1_000_000,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
};

beforeEach(() => vi.clearAllMocks());

describe("updateAutoTopUpHandler", () => {
  it("saves enabled settings when a card is on file and returns them in cents", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue({
      enabled: true,
      amountCents: 10000,
      thresholdCents: 100,
    });
    vi.mocked(accountHasPaymentMethod).mockResolvedValue(true);
    vi.mocked(saveAutoTopUpSettings).mockResolvedValue(storedRow);

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      enabled: true,
      amountCents: 10000,
      thresholdCents: 100,
      lastRunAt: null,
      lastError: null,
    });
    expect(saveAutoTopUpSettings).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      enabled: true,
      amountCredits: 100_000_000,
      thresholdCredits: 1_000_000,
    });
  });

  it("400s when enabling without a card on file and does not write", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue({
      enabled: true,
      amountCents: 10000,
      thresholdCents: 100,
    });
    vi.mocked(accountHasPaymentMethod).mockResolvedValue(false);

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Add a payment method before turning on auto top-up",
    });
    expect(saveAutoTopUpSettings).not.toHaveBeenCalled();
  });

  it("skips the card check when disabling and still stores the amounts", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue({
      enabled: false,
      amountCents: 5000,
      thresholdCents: 250,
    });
    vi.mocked(saveAutoTopUpSettings).mockResolvedValue({
      ...storedRow,
      auto_topup_enabled: false,
      auto_topup_amount: 50_000_000,
      auto_topup_threshold: 2_500_000,
    });

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    expect(accountHasPaymentMethod).not.toHaveBeenCalled();
    expect(saveAutoTopUpSettings).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      enabled: false,
      amountCredits: 50_000_000,
      thresholdCredits: 2_500_000,
    });
    await expect(res.json()).resolves.toMatchObject({ enabled: false, amountCents: 5000 });
  });

  it("forwards param/auth failures and never reads the body", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(
      NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 }),
    );

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "id must be a valid UUID" });
    expect(validateUpdateAutoTopUpBody).not.toHaveBeenCalled();
  });

  it("forwards body validation failures", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue(
      NextResponse.json({ error: "thresholdCents must be below amountCents" }, { status: 400 }),
    );

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "thresholdCents must be below amountCents",
    });
    expect(saveAutoTopUpSettings).not.toHaveBeenCalled();
  });

  it("404s when no credits row exists and one cannot be created", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue({
      enabled: false,
      amountCents: 5000,
      thresholdCents: 250,
    });
    vi.mocked(saveAutoTopUpSettings).mockResolvedValue(null);

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Account not found" });
  });

  it("returns 500 when the write throws", async () => {
    vi.mocked(validateGetPaymentMethodParams).mockResolvedValue(ACCOUNT);
    vi.mocked(validateUpdateAutoTopUpBody).mockResolvedValue({
      enabled: false,
      amountCents: 5000,
      thresholdCents: 250,
    });
    vi.mocked(saveAutoTopUpSettings).mockRejectedValue(new Error("db down"));

    const res = await updateAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
