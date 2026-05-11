import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getAccountCreditsHandler } from "@/lib/credits/getAccountCreditsHandler";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/credits/validateAccountCreditsParams", () => ({
  validateAccountCreditsParams: vi.fn(),
}));

vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const buildRequest = () => new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/credits`);
const buildParams = () => Promise.resolve({ id: ACCOUNT });

describe("getAccountCreditsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards a 401 from validation as { error } with the original status", async () => {
    const denial = NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(denial);

    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(checkAndResetCredits).not.toHaveBeenCalled();
  });

  it("forwards a 403 from validation", async () => {
    const denial = NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(denial);

    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns 404 with { error } when no credits row exists for the account", async () => {
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT);
    vi.mocked(checkAndResetCredits).mockResolvedValue({ creditsUsage: null, isPro: false });

    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Account credits not found" });
  });

  it("returns the enriched credits response for a free-tier account", async () => {
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT);
    vi.mocked(checkAndResetCredits).mockResolvedValue({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: 250,
        timestamp: "2026-05-01T12:00:00.000Z",
      },
      isPro: false,
    });

    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      remaining_credits: 250,
      total_credits: DEFAULT_CREDITS,
      used_credits: DEFAULT_CREDITS - 250,
      is_pro: false,
      timestamp: "2026-05-01T12:00:00.000Z",
    });
  });

  it("returns the enriched credits response for a pro account", async () => {
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT);
    vi.mocked(checkAndResetCredits).mockResolvedValue({
      creditsUsage: {
        id: 1,
        account_id: ACCOUNT,
        remaining_credits: PRO_CREDITS,
        timestamp: "2026-05-11T12:00:00.000Z",
      },
      isPro: true,
    });

    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account_id: ACCOUNT,
      remaining_credits: PRO_CREDITS,
      total_credits: PRO_CREDITS,
      used_credits: 0,
      is_pro: true,
      timestamp: "2026-05-11T12:00:00.000Z",
    });
  });

  it("returns 500 with { error } when an unexpected error is thrown", async () => {
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT);
    vi.mocked(checkAndResetCredits).mockRejectedValue(new Error("boom"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getAccountCreditsHandler(buildRequest(), buildParams());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });
});
