import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { GET } from "@/app/api/sandbox/reconnect/route";
import { getSandboxReconnectHandler } from "@/lib/sandbox/getSandboxReconnectHandler";

vi.mock("@/lib/sandbox/getSandboxReconnectHandler", () => ({
  getSandboxReconnectHandler: vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}));

describe("GET /api/sandbox/reconnect route shell", () => {
  it("delegates to getSandboxReconnectHandler", async () => {
    const req = new NextRequest("http://localhost/api/sandbox/reconnect?sessionId=s", {
      method: "GET",
    });
    const res = await GET(req);

    expect(getSandboxReconnectHandler).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });
});
