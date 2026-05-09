import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCreditsHandler } from "@/lib/credits/getCreditsHandler";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { validateGetCreditsRequest } from "@/lib/credits/validateGetCreditsRequest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: vi.fn(),
}));

vi.mock("@/lib/credits/validateGetCreditsRequest", () => ({
  validateGetCreditsRequest: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = () => new NextRequest("http://localhost/api/credits");

describe("getCreditsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the validator's error response unchanged", async () => {
    const err = NextResponse.json({ message: "unauthorized" }, { status: 401 });
    vi.mocked(validateGetCreditsRequest).mockResolvedValue(err);

    const res = await getCreditsHandler(buildRequest());
    expect(res).toBe(err);
    expect(checkAndResetCredits).not.toHaveBeenCalled();
  });

  it("returns 200 with the credits row for the authenticated account", async () => {
    vi.mocked(validateGetCreditsRequest).mockResolvedValue({ accountId: ACCOUNT });

    const row = {
      account_id: ACCOUNT,
      remaining_credits: 250,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(checkAndResetCredits).mockResolvedValue(
      row as Awaited<ReturnType<typeof checkAndResetCredits>>,
    );

    const res = await getCreditsHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: row });
    expect(checkAndResetCredits).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns 200 with data:null when no credits row exists", async () => {
    vi.mocked(validateGetCreditsRequest).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(checkAndResetCredits).mockResolvedValue(null);

    const res = await getCreditsHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: null });
  });

  it("returns 500 with generic message when checkAndResetCredits throws", async () => {
    vi.mocked(validateGetCreditsRequest).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(checkAndResetCredits).mockRejectedValue(new Error("DB down"));

    const res = await getCreditsHandler(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("DB down");
  });
});
