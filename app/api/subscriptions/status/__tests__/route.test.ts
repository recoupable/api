import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionStatusHandler } from "@/lib/stripe/getSubscriptionStatusHandler";

const { GET, OPTIONS } = await import("../route");

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("app/api/subscriptions/status/route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(getCorsHeaders).toHaveBeenCalled();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET forwards the request to getSubscriptionStatusHandler and returns its response", async () => {
    const handlerRes = NextResponse.json({ isPro: true }, { status: 200 });
    vi.mocked(getSubscriptionStatusHandler).mockResolvedValue(handlerRes);

    const url = `http://localhost/api/subscriptions/status?accountId=${ACCOUNT_ID}`;
    const req = new NextRequest(url, { headers: { "x-api-key": "test-key" } });
    const res = await GET(req);

    expect(getSubscriptionStatusHandler).toHaveBeenCalledTimes(1);
    expect(getSubscriptionStatusHandler).toHaveBeenCalledWith(req);
    expect(res).toBe(handlerRes);
    await expect(res.json()).resolves.toEqual({ isPro: true });
  });
});
