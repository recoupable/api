import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCreditsHandler } from "@/lib/credits/getCreditsHandler";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = () => new NextRequest("http://localhost/api/credits");

describe("getCreditsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the auth-error response unchanged when auth fails", async () => {
    const err = NextResponse.json({ message: "unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);

    const res = await getCreditsHandler(buildRequest());
    expect(res).toBe(err);
    expect(checkAndResetCredits).not.toHaveBeenCalled();
  });

  it("returns 200 with the credits row for the authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "token",
    });

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
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(checkAndResetCredits).mockResolvedValue(null);

    const res = await getCreditsHandler(buildRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: null });
  });

  it("returns 500 with generic message when checkAndResetCredits throws", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(checkAndResetCredits).mockRejectedValue(new Error("DB down"));

    const res = await getCreditsHandler(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("DB down");
  });
});
