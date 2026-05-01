import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getCreditsHandler } from "@/lib/credits/getCreditsHandler";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = (qs: string) => new NextRequest(`http://localhost/api/credits/get${qs}`);

describe("getCreditsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns 400 when accountId is missing", async () => {
    const res = await getCreditsHandler(buildRequest(""));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ message: "accountId is required" });
    expect(checkAndResetCredits).not.toHaveBeenCalled();
  });

  it("returns 200 with the credits row", async () => {
    const row = {
      account_id: ACCOUNT,
      remaining_credits: 250,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(checkAndResetCredits).mockResolvedValue(
      row as Awaited<ReturnType<typeof checkAndResetCredits>>,
    );

    const res = await getCreditsHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: row });
    expect(checkAndResetCredits).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns 200 with data:null when no credits row exists", async () => {
    vi.mocked(checkAndResetCredits).mockResolvedValue(null);

    const res = await getCreditsHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: null });
  });

  it("returns 500 with generic message when checkAndResetCredits throws", async () => {
    vi.mocked(checkAndResetCredits).mockRejectedValue(new Error("DB down"));

    const res = await getCreditsHandler(buildRequest(`?accountId=${ACCOUNT}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Internal server error" });
    expect(body.message).not.toContain("DB down");
  });
});
