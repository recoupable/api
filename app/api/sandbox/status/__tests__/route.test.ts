import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { GET } from "@/app/api/sandbox/status/route";
import { getSandboxStatusHandler } from "@/lib/sandbox/getSandboxStatusHandler";

vi.mock("@/lib/sandbox/getSandboxStatusHandler", () => ({
  getSandboxStatusHandler: vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}));

describe("GET /api/sandbox/status route shell", () => {
  it("delegates to getSandboxStatusHandler", async () => {
    const req = new NextRequest("http://localhost/api/sandbox/status?sessionId=s", {
      method: "GET",
    });
    const res = await GET(req);

    expect(getSandboxStatusHandler).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });
});
