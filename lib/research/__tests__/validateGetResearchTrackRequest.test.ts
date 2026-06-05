import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchTrackRequest } from "../validateGetResearchTrackRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const okAuth = {
  accountId: "acc_1",
  orgId: null,
  authToken: "tok",
} as ReturnType<typeof validateAuthContext> extends Promise<infer T>
  ? Exclude<T, NextResponse>
  : never;

describe("validateGetResearchTrackRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth response when auth fails", async () => {
    const authErr = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr);
    const req = new NextRequest("http://localhost/api/research/track?id=12345");
    const res = await validateGetResearchTrackRequest(req);
    expect(res).toBe(authErr);
  });

  it("returns 400 when id is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track");
    const res = await validateGetResearchTrackRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("id parameter is required");
  });

  it("returns 400 when id contains unsupported characters", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?id=bad/id");
    const res = await validateGetResearchTrackRequest(req);
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.error).toBe("id must be a provider track ID");
  });

  it("returns the validated request for a numeric id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?id=15194376");
    const res = await validateGetResearchTrackRequest(req);
    expect(res).toEqual({ accountId: "acc_1", id: "15194376" });
  });

  it("accepts provider-neutral track IDs", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    const req = new NextRequest("http://localhost/api/research/track?id=track_123");
    const res = await validateGetResearchTrackRequest(req);

    expect(res).toMatchObject({ accountId: "acc_1", id: "track_123" });
  });
});
