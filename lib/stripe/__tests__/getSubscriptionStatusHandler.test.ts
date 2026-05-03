import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionStatusHandler } from "@/lib/stripe/getSubscriptionStatusHandler";
import { validateSubscriptionStatusQuery } from "@/lib/stripe/validateSubscriptionStatusQuery";
import { getSubscriptionIsPro } from "@/lib/stripe/getSubscriptionIsPro";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateSubscriptionStatusQuery", () => ({
  validateSubscriptionStatusQuery: vi.fn(),
}));

vi.mock("@/lib/stripe/getSubscriptionIsPro", () => ({
  getSubscriptionIsPro: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("getSubscriptionStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validation response unchanged", async () => {
    const err = NextResponse.json({ error: "accountId is required" }, { status: 400 });
    vi.mocked(validateSubscriptionStatusQuery).mockResolvedValue(err);
    const req = new NextRequest(`http://localhost/api/subscriptions/status`);
    expect(await getSubscriptionStatusHandler(req)).toBe(err);
    expect(getSubscriptionIsPro).not.toHaveBeenCalled();
  });

  it("returns 200 { isPro: true }", async () => {
    vi.mocked(validateSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getSubscriptionIsPro).mockResolvedValue(true);

    const res = await getSubscriptionStatusHandler(
      new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: true });
    expect(getSubscriptionIsPro).toHaveBeenCalledWith(ACCOUNT);
  });

  it("returns 200 { isPro: false }", async () => {
    vi.mocked(validateSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getSubscriptionIsPro).mockResolvedValue(false);

    const res = await getSubscriptionStatusHandler(
      new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: false });
  });

  it("returns 500 when getSubscriptionIsPro throws", async () => {
    vi.mocked(validateSubscriptionStatusQuery).mockResolvedValue({ accountId: ACCOUNT });
    vi.mocked(getSubscriptionIsPro).mockRejectedValue(new Error("stripe down"));

    const res = await getSubscriptionStatusHandler(
      new NextRequest(`http://localhost/api/subscriptions/status?accountId=${ACCOUNT}`),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
