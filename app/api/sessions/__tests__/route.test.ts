import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { POST } from "@/app/api/sessions/route";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";

vi.mock("@/lib/sessions/createSessionHandler", () => ({
  createSessionHandler: vi.fn(),
}));

describe("POST /api/sessions", () => {
  it("delegates to createSessionHandler", async () => {
    const expected = NextResponse.json({ ok: true }, { status: 200 });
    vi.mocked(createSessionHandler).mockResolvedValue(expected);

    const req = new NextRequest("http://localhost/api/sessions", { method: "POST" });
    const res = await POST(req);

    expect(createSessionHandler).toHaveBeenCalledWith(req);
    expect(res).toBe(expected);
  });
});
