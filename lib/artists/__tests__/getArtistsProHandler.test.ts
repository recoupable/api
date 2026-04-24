import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getArtistsProHandler } from "../getArtistsProHandler";
import { validateGetArtistsProRequest } from "../validateGetArtistsProRequest";
import { getProArtists } from "@/lib/artists/getProArtists";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetArtistsProRequest", () => ({
  validateGetArtistsProRequest: vi.fn(),
}));

vi.mock("@/lib/artists/getProArtists", () => ({
  getProArtists: vi.fn(),
}));

describe("getArtistsProHandler", () => {
  const request = new NextRequest("http://localhost/api/artists/pro");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetArtistsProRequest).mockResolvedValue({});
  });

  it.each([
    ["enterprise-only", ["a1", "a2"]],
    ["subscription-only", ["b1"]],
    ["both enterprise and subscription, deduped", ["a1", "b1", "c1"]],
    ["neither — empty", []],
  ])("returns %s artists on 200", async (_label, artists) => {
    vi.mocked(getProArtists).mockResolvedValue(artists);

    const response = await getArtistsProHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "success", artists });
  });

  it("propagates the 401 response when validator fails auth", async () => {
    const err = NextResponse.json({ status: "error", error: "no auth" }, { status: 401 });
    vi.mocked(validateGetArtistsProRequest).mockResolvedValue(err);

    const response = await getArtistsProHandler(request);

    expect(response).toBe(err);
    expect(getProArtists).not.toHaveBeenCalled();
  });

  it("propagates the 403 response for non-admin callers", async () => {
    const err = NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetArtistsProRequest).mockResolvedValue(err);

    const response = await getArtistsProHandler(request);

    expect(response).toBe(err);
    expect(getProArtists).not.toHaveBeenCalled();
  });

  it("returns a generic 500 without leaking error details", async () => {
    vi.mocked(getProArtists).mockRejectedValue(
      new Error("db.internal.host=10.0.0.5 connection refused"),
    );

    const response = await getArtistsProHandler(request);
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(bodyText).not.toContain("db.internal");
    expect(bodyText).not.toContain("10.0.0.5");
    expect(bodyText).not.toContain("connection refused");
    expect(JSON.parse(bodyText)).toEqual({
      status: "error",
      artists: [],
      error: "Internal server error",
    });
  });
});
