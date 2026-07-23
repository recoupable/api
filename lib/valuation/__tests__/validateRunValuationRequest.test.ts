import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRunValuationRequest } from "@/lib/valuation/validateRunValuationRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const post = (body: unknown) =>
  new NextRequest("http://x/api/valuation", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("validateRunValuationRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
    } as never);
  });

  it("returns the auth response (401) when auth fails, before touching the body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "x" }));
    expect((r as NextResponse).status).toBe(401);
  });

  it("400s with an error envelope when spotify_artist_id is missing", async () => {
    const r = await validateRunValuationRequest(post({}));
    expect(r).toBeInstanceOf(NextResponse);
    const res = r as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual(["spotify_artist_id"]);
  });

  it("400s when spotify_artist_id is empty", async () => {
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "" }));
    expect((r as NextResponse).status).toBe(400);
  });

  it("returns { accountId, spotify_artist_id } on success", async () => {
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "0xPoV" }));
    expect(r).toEqual({ accountId: "acc_1", spotify_artist_id: "0xPoV" });
  });
});
