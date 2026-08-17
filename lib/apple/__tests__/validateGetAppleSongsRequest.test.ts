import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetAppleSongsRequest } from "../validateGetAppleSongsRequest";

const mockValidateAuthContext = vi.fn();
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

const request = (query: string) =>
  new NextRequest(`https://api.recoupable.dev/api/apple/songs${query}`);

const authorized = { accountId: "acct-1", orgId: null, authToken: "key" };

describe("validateGetAppleSongsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue(authorized);
  });

  it("returns the auth failure untouched when credentials are missing", async () => {
    const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
    mockValidateAuthContext.mockResolvedValue(unauthorized);

    const result = await validateGetAppleSongsRequest(request("?isrc=DEH742611917"));

    expect(result).toBe(unauthorized);
  });

  it("uppercases ISRCs and defaults the storefront to us", async () => {
    const result = await validateGetAppleSongsRequest(request("?isrc=deh742611917"));

    expect(result).toEqual({
      accountId: "acct-1",
      isrcs: ["DEH742611917"],
      storefront: "us",
    });
  });

  it("splits a comma-separated list and trims whitespace", async () => {
    const result = await validateGetAppleSongsRequest(
      request("?isrc=DEH742611917,%20TCAEC1931080"),
    );

    expect(result).toMatchObject({ isrcs: ["DEH742611917", "TCAEC1931080"] });
  });

  it("de-duplicates repeated ISRCs so the upstream request stays under the cap", async () => {
    const result = await validateGetAppleSongsRequest(request("?isrc=DEH742611917,DEH742611917"));

    expect(result).toMatchObject({ isrcs: ["DEH742611917"] });
  });

  // Apple answers a malformed ISRC with 200 + an empty result, identical to a real
  // takedown. Rejecting it here is what keeps `found: false` trustworthy.
  it("rejects a malformed ISRC with a 400 naming the offending value", async () => {
    const result = await validateGetAppleSongsRequest(request("?isrc=NOTANISRC"));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      status: "error",
      error: expect.stringContaining("NOTANISRC"),
    });
  });

  it("requires the isrc parameter", async () => {
    const result = await validateGetAppleSongsRequest(request(""));

    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects more than 25 ISRCs", async () => {
    const isrcs = Array.from({ length: 26 }, (_, i) => `US${String(i).padStart(3, "0")}2600001`);

    const result = await validateGetAppleSongsRequest(request(`?isrc=${isrcs.join(",")}`));

    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      error: expect.stringContaining("25"),
    });
  });

  it("lowercases a valid storefront", async () => {
    const result = await validateGetAppleSongsRequest(request("?isrc=DEH742611917&storefront=GB"));

    expect(result).toMatchObject({ storefront: "gb" });
  });

  it("rejects an unknown storefront before any upstream call", async () => {
    const result = await validateGetAppleSongsRequest(request("?isrc=DEH742611917&storefront=zz"));

    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      error: expect.stringContaining("zz"),
    });
  });
});
