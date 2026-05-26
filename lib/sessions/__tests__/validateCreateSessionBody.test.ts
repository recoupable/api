import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateCreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const okAuth = { accountId: "acc-1", orgId: null, authToken: "key" };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateCreateSessionBody", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ status: "error", error: "no auth" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const result = await validateCreateSessionBody(req({}));
    expect(result).toBe(failure);
  });

  it("returns body + auth on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const result = await validateCreateSessionBody(req({ title: "Hello" }));
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.body).toEqual({ title: "Hello" });
      expect(result.auth).toBe(okAuth);
    }
  });

  it("treats malformed JSON as an empty body and accepts it", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const result = await validateCreateSessionBody(req("{not valid"));
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.body).toEqual({});
    }
  });

  it("rejects a non-UUID organizationId with 400", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const result = await validateCreateSessionBody(req({ organizationId: "not-a-uuid" }));
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = (await result.json()) as { status: string; error: string };
      expect(body.error).toMatch(/UUID/i);
    }
  });

  it("forwards organizationId to validateAuthContext for org-access validation", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const orgId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
    await validateCreateSessionBody(req({ organizationId: orgId }));

    expect(validateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: orgId }),
    );
  });
});
