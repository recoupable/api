import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAutoTopUpHandler } from "@/lib/billing/getAutoTopUpHandler";
import { validateAutoTopUpParams } from "@/lib/billing/validateAutoTopUpParams";
import { selectAutoTopUp } from "@/lib/supabase/credits_usage/selectAutoTopUp";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/validateAutoTopUpParams", () => ({ validateAutoTopUpParams: vi.fn() }));
vi.mock("@/lib/supabase/credits_usage/selectAutoTopUp", () => ({ selectAutoTopUp: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const buildRequest = () => new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/auto-top-up`);
const buildParams = () => Promise.resolve({ id: ACCOUNT });

beforeEach(() => vi.clearAllMocks());

describe("getAutoTopUpHandler", () => {
  it("returns 200 with defaults when the account has no credits_usage row", async () => {
    vi.mocked(validateAutoTopUpParams).mockResolvedValue(ACCOUNT);
    vi.mocked(selectAutoTopUp).mockResolvedValue(null);

    const res = await getAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      enabled: false,
      amountCents: null,
      thresholdCents: null,
      lastRunAt: null,
      lastError: null,
    });
    expect(selectAutoTopUp).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns 200 with the stored settings in cents", async () => {
    vi.mocked(validateAutoTopUpParams).mockResolvedValue(ACCOUNT);
    vi.mocked(selectAutoTopUp).mockResolvedValue({
      account_id: ACCOUNT,
      auto_topup_enabled: true,
      auto_topup_amount: 100_000_000,
      auto_topup_threshold: 1_000_000,
      auto_topup_last_run_at: null,
      auto_topup_last_error: null,
    });

    const res = await getAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      enabled: true,
      amountCents: 10000,
      thresholdCents: 100,
    });
  });

  it("forwards validation/auth failures as { error } with their status", async () => {
    vi.mocked(validateAutoTopUpParams).mockResolvedValue(
      NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403 },
      ),
    );

    const res = await getAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied to specified account_id" });
    expect(selectAutoTopUp).not.toHaveBeenCalled();
  });

  it("returns 500 when the read throws", async () => {
    vi.mocked(validateAutoTopUpParams).mockResolvedValue(ACCOUNT);
    vi.mocked(selectAutoTopUp).mockRejectedValue(new Error("db down"));

    const res = await getAutoTopUpHandler(buildRequest(), buildParams());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
