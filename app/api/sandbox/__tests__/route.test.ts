import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { POST } from "@/app/api/sandbox/route";
import { createSandboxHandler } from "@/lib/sandbox/createSandboxHandler";

vi.mock("@/lib/sandbox/createSandboxHandler", () => ({
  createSandboxHandler: vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 })),
}));

describe("POST /api/sandbox route shell", () => {
  it("delegates to createSandboxHandler", async () => {
    const req = new NextRequest("http://localhost/api/sandbox", { method: "POST" });
    const res = await POST(req);

    expect(createSandboxHandler).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });
});
