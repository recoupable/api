import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createPortalSessionHandler } from "@/lib/billing/createPortalSessionHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/billing/createPortalSessionHandler", () => ({
  createPortalSessionHandler: vi.fn(),
}));

const { POST, OPTIONS } = await import("../route");

describe("/api/accounts/[id]/portal route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("POST delegates to createPortalSessionHandler with the request and params", async () => {
    const out = NextResponse.json({ id: "bps_1", url: "https://x" });
    vi.mocked(createPortalSessionHandler).mockResolvedValue(out);
    const req = new NextRequest("http://localhost/api/accounts/abc/portal", { method: "POST" });
    const params = Promise.resolve({ id: "abc" });
    expect(await POST(req, { params })).toBe(out);
    expect(createPortalSessionHandler).toHaveBeenCalledWith(req, params);
  });
});
